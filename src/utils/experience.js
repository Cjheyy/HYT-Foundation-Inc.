/**
 * Experience derivation shared by the OJT/Intern and Trainee portals.
 *
 * Rules that live here so the screens cannot drift apart:
 *
 * 1. An application an administrator approved becomes an *experience*.
 * 2. That experience is **Ongoing** until it is finished, then **Done**.
 *    "Finished" means whichever of these happens first:
 *      a. the application status itself says completed, or
 *      b. the listing's own end has passed - an exact clock time when the
 *         listing carries one (`ends_at`), the end of the day when it does not
 *         (`schedule_end` is a DATE column), or
 *      c. the required hours have been rendered.
 * 3. The projected end date is derived from the hours still to be rendered,
 *    spread over a standard working day. It is never hand-entered.
 *
 * Rule 2b needs care for events. An event is a single instant in the diary, and
 * the admin form lets `ends_at` be left empty - `eventWindow` in
 * supabaseService already treats a start-only event as a zero-length window.
 * If the end date were simply null, such an event would stay Ongoing forever,
 * so an event with no end falls back to its start day. An OJT posting must NOT
 * get that fallback: `scheduleStart` with no `scheduleEnd` is a genuinely
 * open-ended placement, and treating it as a one-day event would mark it Done
 * on the day it started.
 *
 * A note on rule 2c. Hours are stored on the *user* (`users.rendered_hours`) or
 * on a single OJT record, not on the application. So with two ongoing postings
 * both cards would read the same balance, and reaching the requirement would
 * flip all of them to Done at once. The hours rule is therefore only applied
 * when the user has exactly one hour-bearing experience still in play, where the
 * numbers are genuinely attributable to it. `hoursAttributable` carries that
 * decision.
 *
 * "Hour-bearing" means an OJT posting and nothing else. An event is a diary
 * entry and a programme has no `required_hours` column, so neither may finish on
 * the student's hours - and neither may consume the pool that the posting needs.
 *
 * Everything is pure and takes `today` as an argument, so the projection and the
 * finished/ongoing split can be asserted without freezing the clock.
 */
import { normalizeStatus } from '../services/supabaseService';
import { formatDate, formatTime } from './helpers';

export const APPROVED_APPLICATION_STATUSES = ['APPROVED', 'ACCEPTED', 'ACTIVE', 'ONGOING'];
export const COMPLETED_APPLICATION_STATUSES = ['COMPLETED', 'DONE', 'FINISHED'];
export const PENDING_APPLICATION_STATUSES = [
  'APPLIED',
  'PENDING',
  'PENDING_APPROVAL',
  'PENDING_APPLICATION',
  'SUBMITTED',
  'UNDER_REVIEW',
  'REVIEWING',
  'INTERVIEW',
  'SHORTLISTED'
];
export const REJECTED_APPLICATION_STATUSES = [
  'REJECTED',
  'DECLINED',
  'DENIED',
  'WITHDRAWN',
  'CANCELLED',
  'CANCELED'
];

export const ONGOING_LABEL = 'Ongoing';
export const ALREADY_DONE_LABEL = 'Done';

/** A standard rendered-hours day.  Overridable per call site. */
export const DEFAULT_HOURS_PER_DAY = 8;

const round2 = (value) => Math.round(value * 100) / 100;

/** `YYYY-MM-DD` with no clock time: a calendar day, not an instant. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const toValidDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    const copy = new Date(value.getTime());
    return Number.isNaN(copy.getTime()) ? null : copy;
  }
  // `new Date('2026-10-20')` is parsed as UTC midnight, which lands on 08:00 in
  // Manila and would make a whole-day event read "8:00 AM". A date with no time
  // means local midnight.
  if (typeof value === 'string' && DATE_ONLY.test(value.trim())) {
    const [year, month, day] = value.trim().split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** First defined value, so camelCase and snake_case rows both resolve. */
const pick = (...values) => values.find((value) => value !== undefined && value !== null && value !== '') ?? null;

/**
 * The window a listing runs for, independent of any application.
 *
 * Events carry `startsAt` / `endsAt`; OJT postings carry
 * `scheduleStart` / `scheduleEnd`. Both shapes are accepted here so the caller
 * does not have to know which kind of listing it is holding.
 */
export const getListingWindow = (listing) => {
  if (!listing) return { startDate: null, endDate: null };
  return {
    startDate: toValidDate(
      pick(listing.startsAt, listing.starts_at, listing.scheduleStart, listing.schedule_start, listing.startDate, listing.start_date)
    ),
    endDate: toValidDate(
      pick(listing.endsAt, listing.ends_at, listing.scheduleEnd, listing.schedule_end, listing.endDate, listing.end_date)
    )
  };
};

/**
 * The date a listing is considered over.
 *
 * An event is a single diary entry, so a start with no end is a zero-length
 * window rather than an open-ended one - its start day doubles as its end. This
 * mirrors `eventWindow`, which already collapses a start-only event to an
 * instant. Anything else (an OJT posting, a programme) keeps a null end, which
 * means "no end on file" and is never treated as finished.
 */
export const getListingEndDate = (listing, { isEvent = false } = {}) => {
  const { startDate, endDate } = getListingWindow(listing);
  if (endDate) return endDate;
  return isEvent ? startDate : null;
};

/**
 * True when the listing's own end has already passed.
 *
 * The end is read as an INSTANT when the listing carries a real clock time, and
 * as the end of its calendar day when it does not. Both halves matter:
 *
 *   timed      an event ending at 15:00 is Done at 15:01 the same day. Waiting
 *              for midnight would leave a finished event sitting in Ongoing
 *              for nine hours after everybody had gone home.
 *   whole day  00:00-23:59, 00:00-next 00:00, or a bare `YYYY-MM-DD` - there is
 *              no time to compare, so the day itself is the unit and the tile
 *              only moves at 23:59:59.
 *
 * `isWholeDayEvent` already answers the second question for events; an OJT
 * posting's `schedule_end` is a DATE column, which `toValidDate` turns into
 * local midnight, so a midnight end is treated as "end of that day" rather than
 * "the placement ended the instant it began".
 */
export const isListingFinished = (listing, today = new Date(), { isEvent = false } = {}) => {
  const endDate = getListingEndDate(listing, { isEvent });
  const reference = toValidDate(today) || new Date();
  if (!endDate) return false;

  const endsAtMidnight = endDate.getHours() === 0 && endDate.getMinutes() === 0;
  // For an event, `isWholeDayEvent` is the authority as long as it has a start
  // to compare against - a 22:00-00:00 session is timed, not a whole day. With
  // no start at all there is nothing to compare, so a midnight end is read as
  // the end of that day. A posting/programme end is a DATE column, so midnight
  // always means "that day".
  const hasStart = Boolean(getListingWindow(listing).startDate);
  const wholeDay = isEvent ? (hasStart ? isWholeDayEvent(listing) : endsAtMidnight) : endsAtMidnight;

  if (wholeDay) {
    const endOfEndDay = new Date(endDate.getTime());
    endOfEndDay.setHours(23, 59, 59, 999);
    return endOfEndDay.getTime() < reference.getTime();
  }

  return endDate.getTime() < reference.getTime();
};

/**
 * Whether an event occupies a whole calendar day rather than a time slot.
 *
 * There is no all-day column, so this is read off the timestamps. All three of
 * these are a whole day:
 *
 *   00:00 - 23:59          the literal full day
 *   00:00 - next 00:00     a 24-hour span
 *   a date with no time    `YYYY-MM-DD`, which toValidDate puts at midnight
 *
 * A window that starts at 00:00 but ends at midday is a morning session, not a
 * whole day, and is left as timed.
 */
export const isWholeDayEvent = (listing) => {
  const { startDate, endDate } = getListingWindow(listing);
  if (!startDate) return false;

  const midnight = new Date(startDate.getTime());
  midnight.setHours(0, 0, 0, 0);
  if (startDate.getTime() !== midnight.getTime()) return false;

  if (!endDate) return true;

  const span = endDate.getTime() - startDate.getTime();
  // 23h59m for 00:00-23:59, 24h for 00:00-next 00:00.
  return span >= 23 * 60 * 60 * 1000 + 59 * 60 * 1000;
};

/** Whether two wall-clock values fall on different calendar days. */
export const spansMultipleDays = (start, end) => {
  const from = toValidDate(start);
  const to = toValidDate(end);
  if (!from || !to) return false;
  return from.toDateString() !== to.toDateString();
};

/** Which kind of listing an application points at, or null if it points nowhere. */
export const getApplicationListingKind = (application) => {
  if (!application) return null;
  if (application.opportunityId || application.opportunity_id) return 'opportunity';
  if (application.programId || application.program_id) return 'program';
  if (application.eventId || application.event_id) return 'event';
  return null;
};

/**
 * The date half of the Done rule, resolved for a specific application.
 *
 * This is the call the screens should use. It is the only place that knows an
 * event's start-only window behaves differently from a posting's, so neither
 * page has to re-derive it and drift.
 */
export const isApplicationWindowFinished = (application, listing, today = new Date()) =>
  isListingFinished(listing, today, {
    isEvent: getApplicationListingKind(application) === 'event'
  });

/**
 * A listing's schedule in words, the way its own kind should read.
 *
 * An event is a diary entry: the clock time IS the schedule, so "20 October
 * 2026" on its own does not say when to turn up. A posting or programme runs
 * over weeks, where the dates are what matter and a time on every one of them
 * would be noise.
 *
 * Events come in two shapes and they must not be worded the same way:
 *
 *   whole day   00:00-23:59, 00:00-next 00:00, or a date with no time at all
 *               -> "October 20, 2026 · Whole day". Printing "12:00 AM - 11:59 PM"
 *               for a clean-up drive is worse than printing nothing.
 *   timed       any other window -> "October 20, 2026 · 08:00 AM - 05:00 PM".
 *
 * Lives here rather than in a page because four screens print this string and
 * they drifted apart once already.
 */
export const formatListingSchedule = (listing, { isEvent = false } = {}) => {
  const { startDate, endDate } = getListingWindow(listing);

  if (isEvent) {
    if (!startDate) return listing?.schedule || null;

    const lastDay = getListingEndDate(listing, { isEvent: true });
    const wholeDay = isWholeDayEvent(listing);

    if (startDate.toDateString() === lastDay.toDateString()) {
      if (wholeDay) return `${formatDate(startDate)} · Whole day`;
      if (endDate) {
        return `${formatDate(startDate)} · ${formatTime(startDate)} - ${formatTime(endDate)}`;
      }
      return `${formatDate(startDate)} · ${formatTime(startDate)}`;
    }

    return `${formatDate(startDate)} - ${formatDate(lastDay)}${wholeDay ? ' · Whole day' : ''}`;
  }

  if (startDate && endDate) return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  if (endDate) return formatDate(endDate);
  if (startDate) return `Started ${formatDate(startDate)}`;
  return null;
};

/** Owner id regardless of whether the row came back camelCased or not. */
export const getApplicationOwnerId = (application) =>
  application?.userId ||
  application?.user_id ||
  application?.studentId ||
  application?.student_id ||
  null;

export const isApplicationPending = (application) =>
  PENDING_APPLICATION_STATUSES.includes(normalizeStatus(application?.status));

export const isApplicationRejected = (application) =>
  REJECTED_APPLICATION_STATUSES.includes(normalizeStatus(application?.status));

export const isApplicationCompleted = (application) =>
  COMPLETED_APPLICATION_STATUSES.includes(normalizeStatus(application?.status));

/** Approved = surfaced as an experience.  Completed is a subset of approved. */
export const isApplicationApproved = (application) =>
  isApplicationCompleted(application) ||
  APPROVED_APPLICATION_STATUSES.includes(normalizeStatus(application?.status));

/**
 * The Ongoing / Done label, or null when it is not an experience yet.
 *
 * Called with only an application, this falls back to the status alone, which
 * keeps every existing caller working. Pass `listing` (and optionally the hours)
 * to get the date-aware answer.
 */
export const getApplicationExperienceState = (application, options = {}) => {
  const {
    listing = null,
    requiredHours = 0,
    renderedHours = 0,
    today = new Date(),
    hoursAttributable = false
  } = options;

  if (!isApplicationApproved(application)) return null;

  // a. The status itself says the experience finished.
  if (isApplicationCompleted(application)) return ALREADY_DONE_LABEL;

  // b. The listing has run its course. Events resolve their start-only window
  //    here, so a same-day event with no `ends_at` still finishes.
  if (isApplicationWindowFinished(application, listing, today)) return ALREADY_DONE_LABEL;

  // c. The hours are done - but only when they can be attributed to this one
  //    experience, AND only for an experience that has hours at all. `required_hours`
  //    exists on the user and on ojt_records; no event or programme row carries
  //    one. Without the kind test the user's balance finished every card on the
  //    page, including a whole-day event that has no requirement to meet.
  if (hoursAttributable && getApplicationListingKind(application) === 'opportunity') {
    const required = Number(requiredHours) || 0;
    const rendered = Number(renderedHours) || 0;
    if (required > 0 && rendered >= required) return ALREADY_DONE_LABEL;
  }

  return ONGOING_LABEL;
};

/**
 * Still in play: filed and neither rejected/withdrawn nor finished.  This is
 * what the dashboards' "Active Application" card lists, so a declined or
 * cancelled application never appears there.
 */
export const isApplicationActive = (application) =>
  !isApplicationRejected(application) && !isApplicationCompleted(application);

/**
 * The same question, but date-aware - what a dashboard should actually ask.
 *
 * `isApplicationActive` only reads the status column, so an approved
 * application whose event/programme/placement has already ended still counted
 * as "active" and sat on the dashboard beside the Done card on My Applications.
 * Pass the resolved listing to get the honest answer. A pending application is
 * still in play (it has no experience state yet) and stays listed.
 */
export const isApplicationInPlay = (application, {
  listing = null,
  today = new Date(),
  requiredHours = 0,
  renderedHours = 0,
  hoursAttributable = false
} = {}) =>
  isApplicationActive(application) &&
  getApplicationExperienceState(application, {
    listing,
    today,
    requiredHours,
    renderedHours,
    hoursAttributable
  }) !== ALREADY_DONE_LABEL;

/**
 * Human title for an application's listing.
 *
 * Application rows carry only the foreign key (`opportunityId` / `programId` /
 * `eventId`). There is no title column and no `opportunityTitle` field, so
 * reading one straight off the row always fell back to the generic label.
 * Resolve it from the loaded listings instead.
 */
export function getApplicationListingTitle(application, { opportunities = [], programs = [], events = [] } = {}) {
  const opportunityId = application?.opportunityId || application?.opportunity_id || null;
  const programId = application?.programId || application?.program_id || null;
  const eventId = application?.eventId || application?.event_id || null;
  const id = opportunityId || programId || eventId;
  const source = opportunityId ? opportunities : programId ? programs : events;
  const match = (Array.isArray(source) ? source : []).find((item) => item && item.id === id);

  if (match?.title) return match.title;
  if (opportunityId) return 'OJT Posting';
  if (programId) return 'Program';
  if (eventId) return 'Event';
  return 'Application';
}

/** The listing row an application points at, or null. */
export function findApplicationListing(application, { opportunities = [], programs = [], events = [] } = {}) {
  if (!application) return null;
  const opportunityId = application.opportunityId || application.opportunity_id || null;
  const programId = application.programId || application.program_id || null;
  const eventId = application.eventId || application.event_id || null;

  if (opportunityId) return (opportunities || []).find((item) => item && item.id === opportunityId) || null;
  if (programId) return (programs || []).find((item) => item && item.id === programId) || null;
  if (eventId) return (events || []).find((item) => item && item.id === eventId) || null;
  return null;
}

/**
 * Short noun for an application's listing kind.
 *
 * Used by the dashboards' "more info" dialog, which previously read
 * `opportunityId ? 'OJT Posting' : 'Training Program'`, so an EVENT
 * application was mislabelled a training programme.
 */
export function getApplicationListingTypeLabel(application) {
  const opportunityId = application?.opportunityId || application?.opportunity_id || null;
  const programId = application?.programId || application?.program_id || null;
  const eventId = application?.eventId || application?.event_id || null;
  if (opportunityId) return 'OJT Posting';
  if (programId) return 'Training Program';
  if (eventId) return 'Event';
  return 'Application';
}

/**
 * The role the applicant applied for, exactly as the administrator typed it on
 * the posting - "Software Engineer", "Barista", and so on.
 *
 * `position` is the column both admin forms write. `role` / `jobTitle` are
 * accepted as fallbacks so a deployment that already names the field
 * differently still renders instead of silently showing nothing.
 */
export function getListingPosition(listing) {
  if (!listing) return null;
  const value = pick(listing.position, listing.role, listing.jobTitle, listing.job_title);
  return value ? String(value).trim() || null : null;
}

/**
 * The posting's own description, collapsed to one readable paragraph.
 *
 * The admin writes this when creating the posting, so it is the honest source
 * for "what did I actually apply for" - and it is what the application tile
 * shows under the position. Newlines are folded to spaces and the tail is cut
 * with an ellipsis so a long blurb cannot stretch a tile past its neighbours.
 */
export function getListingSummary(listing, maxLength = 150) {
  const text = String(listing?.description || '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

/** Advance a date by N working days (Mon-Fri), leaving weekends out. */
export function addWorkingDays(from, days) {
  const start = toValidDate(from);
  const count = Math.ceil(Number(days));
  if (!start || !Number.isFinite(count) || count <= 0) return null;

  const cursor = new Date(start.getTime());
  let remaining = count;
  // Bounded loop: 7 days per working day is the worst case, +1 for safety.
  let guard = count * 7 + 1;
  while (remaining > 0 && guard > 0) {
    cursor.setDate(cursor.getDate() + 1);
    const weekday = cursor.getDay();
    if (weekday !== 0 && weekday !== 6) remaining -= 1;
    guard -= 1;
  }
  return remaining > 0 ? null : cursor;
}

/**
 * Whether the user-level hours figure may decide a Done state.
 *
 * Hours live on the user (`users.rendered_hours`), so they can only speak for
 * one experience at a time. Critically, only an OJT posting carries an hours
 * requirement: an event is a diary entry and a programme has no `required_hours`
 * column at all. So neither may be counted as a competing consumer of the same
 * pool. Before this, one placement plus one whole-day event meant two
 * experiences "in play", the hours were never attributed, and the placement
 * could never complete on hours no matter how many were rendered.
 *
 * `entries` is `[{ application, listing }]` - the same shape both screens build.
 */
export const isHoursAttributable = (entries, today = new Date()) => {
  const inPlay = (Array.isArray(entries) ? entries : []).filter(
    (entry) =>
      entry &&
      getApplicationListingKind(entry.application) === 'opportunity' &&
      !isApplicationCompleted(entry.application) &&
      !isApplicationWindowFinished(entry.application, entry.listing, today)
  );
  return inPlay.length === 1;
};

/**
 * Start date + projected end date for one experience.
 *
 * `endDate` is the day the remaining hours land on, projected forward from
 * whichever is later: the start date or today. A finished experience reports
 * the date it finished instead of a projection.
 */
export function computeExperienceSchedule({
  startDate = null,
  requiredHours = 0,
  renderedHours = 0,
  hoursPerDay = DEFAULT_HOURS_PER_DAY,
  completedAt = null,
  today = new Date()
} = {}) {
  const required = Number(requiredHours) || 0;
  const rendered = Number(renderedHours) || 0;
  const perDay = Number(hoursPerDay) > 0 ? Number(hoursPerDay) : DEFAULT_HOURS_PER_DAY;
  const remainingHours = Math.max(0, round2(required - rendered));
  const start = toValidDate(startDate);
  const reference = toValidDate(today) || new Date();

  const base = {
    startDate: start,
    requiredHours: required,
    renderedHours: rendered,
    remainingHours,
    hoursPerDay: perDay
  };

  // No required hours on file: we cannot honestly project an end date.
  if (required <= 0) {
    return { ...base, hasSchedule: false, endDate: null, workDaysRemaining: 0, isComplete: false };
  }

  if (remainingHours <= 0) {
    return {
      ...base,
      hasSchedule: true,
      endDate: toValidDate(completedAt) || start || reference,
      workDaysRemaining: 0,
      isComplete: true
    };
  }

  const workDaysRemaining = Math.ceil(remainingHours / perDay);
  const projectFrom = start && start > reference ? start : reference;

  return {
    ...base,
    hasSchedule: true,
    endDate: addWorkingDays(projectFrom, workDaysRemaining),
    workDaysRemaining,
    isComplete: false
  };
}

/**
 * Turn a student's applications into the experience list the screens show.
 *
 * Only approved applications qualify, so a pending application can never be
 * presented as an experience. Pending ones stay in "My Applications".
 *
 * `requiredHours` / `renderedHours` are the user-level figures. They are only
 * allowed to decide the Done state when exactly one experience is still in play
 * (see the note at the top of the file).
 */
export function deriveExperienceEntries({
  applications = [],
  programs = [],
  opportunities = [],
  events = [],
  currentUser = null,
  requiredHours = 0,
  renderedHours = 0,
  today = new Date()
} = {}) {
  const ownerId = currentUser?.id || null;
  const programList = Array.isArray(programs) ? programs : [];
  const opportunityList = Array.isArray(opportunities) ? opportunities : [];
  const eventList = Array.isArray(events) ? events : [];

  const approved = (Array.isArray(applications) ? applications : []).filter((application) => {
    if (!application) return false;
    const applicationOwner = getApplicationOwnerId(application);
    if (ownerId && applicationOwner && applicationOwner !== ownerId) return false;
    return isApplicationApproved(application);
  });

  // Pass 1: resolve the listing for each approved application.
  const withListing = approved.map((application) => ({
    application,
    listing: findApplicationListing(application, {
      opportunities: opportunityList,
      programs: programList,
      events: eventList
    })
  }));

  // Pass 2: how many hour-bearing experiences are still in play? Only those may
  // compete for the user's single hours balance - see isHoursAttributable.
  const hoursAttributable = isHoursAttributable(withListing, today);

  return withListing.map(({ application, listing }) => {
    const opportunityId = application.opportunityId || application.opportunity_id || null;
    const programId = application.programId || application.program_id || null;
    const eventId = application.eventId || application.event_id || null;

    const isComplete = getApplicationExperienceState(application, {
      listing,
      requiredHours,
      renderedHours,
      today,
      hoursAttributable
    }) === ALREADY_DONE_LABEL;

    return {
      id: application.id,
      application,
      listing,
      type: opportunityId ? 'opportunity' : programId ? 'program' : eventId ? 'event' : 'program',
      title:
        listing?.title ||
        (opportunityId ? 'OJT Posting' : programId ? 'Program' : eventId ? 'Event' : 'Experience'),
      organization:
        listing?.organization ||
        listing?.company ||
        listing?.location ||
        'HYT Foundation Inc.',
      state: getApplicationExperienceState(application, {
        listing,
        requiredHours,
        renderedHours,
        today,
        hoursAttributable
      }),
      isComplete,
      window: getListingWindow(listing),
      hoursAttributable,
      appliedAt: application.appliedAt || application.createdAt || null,
      approvedAt:
        application.reviewedAt ||
        application.updatedAt ||
        application.createdAt ||
        null,
      completedAt: application.completedAt || application.completionDate || null
    };
  });
}

/** Split applications the way "My Applications" presents them. */
export function groupApplications(applications = []) {
  const all = Array.isArray(applications) ? applications.filter(Boolean) : [];
  return {
    all,
    pending: all.filter(isApplicationPending),
    approved: all.filter((application) => isApplicationApproved(application) && !isApplicationCompleted(application)),
    completed: all.filter(isApplicationCompleted),
    rejected: all.filter(isApplicationRejected)
  };
}
