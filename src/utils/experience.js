/**
 * Experience derivation shared by the OJT/Intern and Trainee portals.
 *
 * Two rules from the product spec live here so the dashboards cannot drift
 * apart:
 *
 * 1. An application that an administrator approved becomes an *experience*.
 *    It is **Ongoing** while the event is unfinished and **Already Done** once
 *    it completes.
 * 2. The projected end date is derived from the hours the user still has to
 *    render, spread over a standard working day — never hand-entered.
 *
 * Everything is pure and takes `today` as an argument so the projection can be
 * asserted without freezing the clock.
 */
import { normalizeStatus } from '../services/supabaseService';

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
export const ALREADY_DONE_LABEL = 'Already Done';

/** A standard rendered-hours day.  Overridable per call site. */
export const DEFAULT_HOURS_PER_DAY = 8;

const round2 = (value) => Math.round(value * 100) / 100;

const toValidDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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

/** The Ongoing / Already Done label, or null when it is not an experience yet. */
export const getApplicationExperienceState = (application) => {
  if (isApplicationCompleted(application)) return ALREADY_DONE_LABEL;
  if (isApplicationApproved(application)) return ONGOING_LABEL;
  return null;
};

/**
 * Still in play: filed and neither rejected/withdrawn nor finished.  This is
 * what the dashboards' "Active Application" card lists, so a declined or
 * cancelled application never appears there.
 */
export const isApplicationActive = (application) =>
  !isApplicationRejected(application) && !isApplicationCompleted(application);

/**
 * Human title for an application's listing.
 *
 * Application rows carry only the foreign key (`opportunityId` / `programId`) —
 * there is no title column and no `opportunityTitle` field, so reading one
 * straight off the row always fell back to the generic label.  Resolve it from
 * the loaded listings instead.
 */
export function getApplicationListingTitle(application, { opportunities = [], programs = [] } = {}) {
  const opportunityId = application?.opportunityId || application?.opportunity_id || null;
  const programId = application?.programId || application?.program_id || null;
  const id = opportunityId || programId;
  const source = opportunityId ? opportunities : programs;
  const match = (Array.isArray(source) ? source : []).find((item) => item && item.id === id);

  if (match?.title) return match.title;
  if (opportunityId) return 'OJT Posting';
  if (programId) return 'Program';
  return 'Application';
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
 * Start date + projected end date for one experience.
 *
 * `endDate` is the day the remaining hours land on, projected forward from
 * whichever is later: the start date or today.  A finished experience reports
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
 * Turn a student's applications into the experience list both dashboards show.
 *
 * Only approved applications qualify, so a pending application can never be
 * presented as an experience.  Pending ones stay in "My Applications".
 */
export function deriveExperienceEntries({
  applications = [],
  programs = [],
  opportunities = [],
  currentUser = null
} = {}) {
  const ownerId = currentUser?.id || null;
  const programList = Array.isArray(programs) ? programs : [];
  const opportunityList = Array.isArray(opportunities) ? opportunities : [];

  return (Array.isArray(applications) ? applications : [])
    .filter((application) => {
      if (!application) return false;
      const applicationOwner = getApplicationOwnerId(application);
      if (ownerId && applicationOwner && applicationOwner !== ownerId) return false;
      return isApplicationApproved(application);
    })
    .map((application) => {
      const opportunityId = application.opportunityId || application.opportunity_id || null;
      const programId = application.programId || application.program_id || null;
      const listing = opportunityId
        ? opportunityList.find((item) => item.id === opportunityId) || null
        : programId
          ? programList.find((item) => item.id === programId) || null
          : null;

      const isComplete = isApplicationCompleted(application);

      return {
        id: application.id,
        application,
        listing,
        type: opportunityId ? 'opportunity' : 'program',
        title:
          listing?.title ||
          (opportunityId ? 'OJT Posting' : programId ? 'Program' : 'Experience'),
        organization:
          listing?.organization ||
          listing?.company ||
          listing?.location ||
          'HYT Foundation Inc.',
        state: getApplicationExperienceState(application),
        isComplete,
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
