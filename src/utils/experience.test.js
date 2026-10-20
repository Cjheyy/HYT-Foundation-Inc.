import {
  ALREADY_DONE_LABEL,
  ONGOING_LABEL,
  addWorkingDays,
  computeExperienceSchedule,
  deriveExperienceEntries,
  getApplicationExperienceState,
  getApplicationListingKind,
  getListingEndDate,
  formatListingSchedule,
  getListingWindow,
  isHoursAttributable,
  isWholeDayEvent,
  groupApplications,
  isApplicationApproved,
  isApplicationCompleted,
  isApplicationPending,
  isApplicationWindowFinished,
  isListingFinished,
  spansMultipleDays
} from './experience';

const at = (iso) => new Date(`${iso}T00:00:00`);

describe('application state classification', () => {
  test('approved applications become experiences', () => {
    ['APPROVED', 'Accepted', 'ACTIVE', 'Ongoing'].forEach((status) => {
      expect(isApplicationApproved({ status })).toBe(true);
      expect(getApplicationExperienceState({ status })).toBe(ONGOING_LABEL);
    });
  });

  test('a finished application reads "Already Done", not "Ongoing"', () => {
    ['COMPLETED', 'Completed', 'DONE'].forEach((status) => {
      expect(getApplicationExperienceState({ status })).toBe(ALREADY_DONE_LABEL);
    });
  });

  test('pending and rejected applications are never experiences', () => {
    ['Applied', 'Pending', 'Under Review', 'Interview', 'SUBMITTED'].forEach((status) => {
      expect(isApplicationPending({ status })).toBe(true);
      expect(getApplicationExperienceState({ status })).toBeNull();
    });
    ['Rejected', 'Declined', 'Withdrawn'].forEach((status) => {
      expect(getApplicationExperienceState({ status })).toBeNull();
    });
  });

  test('the two labels are distinct strings', () => {
    expect(ONGOING_LABEL).not.toBe(ALREADY_DONE_LABEL);
  });
});

describe('addWorkingDays', () => {
  test('skips the weekend', () => {
    // 2026-03-06 is a Friday.
    expect(addWorkingDays(at('2026-03-06'), 1).getDate()).toBe(9);
    expect(addWorkingDays(at('2026-03-06'), 1).getDay()).toBe(1); // Monday
  });

  test('walks a whole working week', () => {
    // Monday + 5 working days = the following Monday.
    expect(addWorkingDays(at('2026-03-02'), 5).getDate()).toBe(9);
  });

  test('returns null for a non-positive or invalid span', () => {
    expect(addWorkingDays(at('2026-03-02'), 0)).toBeNull();
    expect(addWorkingDays(at('2026-03-02'), -3)).toBeNull();
    expect(addWorkingDays(null, 4)).toBeNull();
  });
});

describe('computeExperienceSchedule', () => {
  test('derives the end date from the hours still to render', () => {
    const schedule = computeExperienceSchedule({
      startDate: at('2026-03-02'),
      requiredHours: 80,
      renderedHours: 0,
      today: at('2026-03-02')
    });

    // 80 hours / 8 per day = 10 working days from Mon 2 Mar -> Mon 16 Mar.
    expect(schedule.workDaysRemaining).toBe(10);
    expect(schedule.endDate.getDate()).toBe(16);
    expect(schedule.isComplete).toBe(false);
  });

  test('shrinks the projection as hours are rendered', () => {
    const base = { startDate: at('2026-03-02'), requiredHours: 80, today: at('2026-03-02') };
    const full = computeExperienceSchedule({ ...base, renderedHours: 0 });
    const half = computeExperienceSchedule({ ...base, renderedHours: 40 });

    expect(half.workDaysRemaining).toBe(5);
    expect(half.endDate.getTime()).toBeLessThan(full.endDate.getTime());
    expect(half.remainingHours).toBe(40);
  });

  test('projects from today when the start date is already in the past', () => {
    const schedule = computeExperienceSchedule({
      startDate: at('2026-01-05'),
      requiredHours: 16,
      renderedHours: 0,
      today: at('2026-03-02')
    });

    expect(schedule.startDate.getTime()).toBe(at('2026-01-05').getTime());
    expect(schedule.endDate.getTime()).toBe(addWorkingDays(at('2026-03-02'), 2).getTime());
  });

  test('reports completion once the hours are rendered', () => {
    const schedule = computeExperienceSchedule({
      startDate: at('2026-01-05'),
      requiredHours: 80,
      renderedHours: 80,
      completedAt: at('2026-02-20'),
      today: at('2026-03-02')
    });

    expect(schedule.isComplete).toBe(true);
    expect(schedule.remainingHours).toBe(0);
    expect(schedule.endDate.getTime()).toBe(at('2026-02-20').getTime());
  });

  test('refuses to invent an end date without required hours', () => {
    const schedule = computeExperienceSchedule({ requiredHours: 0, renderedHours: 0 });
    expect(schedule.hasSchedule).toBe(false);
    expect(schedule.endDate).toBeNull();
  });

  test('never returns a negative remaining balance', () => {
    const schedule = computeExperienceSchedule({ requiredHours: 40, renderedHours: 100 });
    expect(schedule.remainingHours).toBe(0);
  });
});

describe('deriveExperienceEntries', () => {
  const applications = [
    { id: 'a1', userId: 'u1', opportunityId: 'o1', status: 'APPROVED' },
    { id: 'a2', userId: 'u1', programId: 'p1', status: 'Applied' },
    { id: 'a3', userId: 'u1', programId: 'p2', status: 'COMPLETED' },
    { id: 'a4', userId: 'other', opportunityId: 'o1', status: 'APPROVED' }
  ];
  const opportunities = [{ id: 'o1', title: 'Backend Intern', organization: 'Acme Corp' }];
  const programs = [
    { id: 'p1', title: 'Leadership Camp' },
    { id: 'p2', title: 'Skills Bootcamp' }
  ];

  test('keeps only this user\u2019s approved applications', () => {
    const entries = deriveExperienceEntries({
      applications,
      opportunities,
      programs,
      currentUser: { id: 'u1' }
    });

    expect(entries.map((entry) => entry.id)).toEqual(['a1', 'a3']);
  });

  test('labels an unfinished experience Ongoing and a finished one Already Done', () => {
    const entries = deriveExperienceEntries({
      applications,
      opportunities,
      programs,
      currentUser: { id: 'u1' }
    });

    expect(entries.find((entry) => entry.id === 'a1').state).toBe(ONGOING_LABEL);
    expect(entries.find((entry) => entry.id === 'a3').state).toBe(ALREADY_DONE_LABEL);
    expect(entries.find((entry) => entry.id === 'a3').isComplete).toBe(true);
  });

  test('resolves the listing title and organisation', () => {
    const entries = deriveExperienceEntries({
      applications,
      opportunities,
      programs,
      currentUser: { id: 'u1' }
    });

    const first = entries.find((entry) => entry.id === 'a1');
    expect(first.title).toBe('Backend Intern');
    expect(first.organization).toBe('Acme Corp');
    expect(first.type).toBe('opportunity');
  });

  test('falls back gracefully when the listing is missing', () => {
    const entries = deriveExperienceEntries({
      applications: [{ id: 'a9', userId: 'u1', programId: 'gone', status: 'ACCEPTED' }],
      currentUser: { id: 'u1' }
    });

    expect(entries[0].title).toBe('Program');
    expect(entries[0].organization).toBe('HYT Foundation Inc.');
  });

  test('never surfaces a pending application as an experience', () => {
    const entries = deriveExperienceEntries({
      applications: [{ id: 'p1', userId: 'u1', programId: 'p1', status: 'Applied' }],
      programs,
      currentUser: { id: 'u1' }
    });
    expect(entries).toHaveLength(0);
  });

  test('is safe with no data at all', () => {
    expect(deriveExperienceEntries()).toEqual([]);
    expect(deriveExperienceEntries({ applications: null })).toEqual([]);
  });
});

describe('groupApplications', () => {
  test('splits applications for the My Applications view', () => {
    const grouped = groupApplications([
      { id: '1', status: 'Applied' },
      { id: '2', status: 'APPROVED' },
      { id: '3', status: 'COMPLETED' },
      { id: '4', status: 'Rejected' }
    ]);

    expect(grouped.all).toHaveLength(4);
    expect(grouped.pending.map((a) => a.id)).toEqual(['1']);
    expect(grouped.approved.map((a) => a.id)).toEqual(['2']);
    expect(grouped.completed.map((a) => a.id)).toEqual(['3']);
    expect(grouped.rejected.map((a) => a.id)).toEqual(['4']);
  });

  test('a completed application is not double-counted as ongoing', () => {
    const grouped = groupApplications([{ id: '3', status: 'COMPLETED' }]);
    expect(grouped.approved).toHaveLength(0);
    expect(grouped.completed).toHaveLength(1);
    expect(isApplicationCompleted(grouped.completed[0])).toBe(true);
  });
});

describe('listing window', () => {
  test('reads an event window from startsAt / endsAt', () => {
    const window = getListingWindow({ startsAt: '2026-10-14T09:00:00', endsAt: '2026-10-14T18:00:00' });
    expect(window.startDate).toBeInstanceOf(Date);
    expect(window.endDate).toBeInstanceOf(Date);
  });

  test('reads an OJT posting window from scheduleStart / scheduleEnd', () => {
    const window = getListingWindow({ scheduleStart: '2026-10-14', scheduleEnd: '2026-12-20' });
    expect(window.startDate.getFullYear()).toBe(2026);
    expect(window.endDate.getMonth()).toBe(11);
  });

  test('accepts snake_case rows too', () => {
    const window = getListingWindow({ ends_at: '2026-10-14T18:00:00' });
    expect(window.endDate).toBeInstanceOf(Date);
  });

  test('is empty rather than throwing when there is no listing', () => {
    expect(getListingWindow(null)).toEqual({ startDate: null, endDate: null });
    expect(getListingWindow({})).toEqual({ startDate: null, endDate: null });
  });
});

describe('isListingFinished', () => {
  const today = at('2026-10-20');

  test('is false for a listing that ends in the future', () => {
    expect(isListingFinished({ endsAt: '2026-10-25T18:00:00' }, today)).toBe(false);
  });

  test('is true for a listing that ended before today', () => {
    expect(isListingFinished({ endsAt: '2026-10-19T18:00:00' }, today)).toBe(true);
  });

  test('is still false on the end day itself, so a same-day event does not flicker', () => {
    expect(isListingFinished({ endsAt: '2026-10-20T09:00:00' }, today)).toBe(false);
  });

  test('is false when the listing has no end date at all', () => {
    expect(isListingFinished({ title: 'No dates' }, today)).toBe(false);
    expect(isListingFinished(null, today)).toBe(false);
  });
});

describe('date-aware experience state', () => {
  const today = at('2026-10-20');

  test('an approved application on a future listing is Ongoing', () => {
    const state = getApplicationExperienceState(
      { status: 'APPROVED' },
      { listing: { endsAt: '2026-12-20T18:00:00' }, today }
    );
    expect(state).toBe(ONGOING_LABEL);
  });

  test('an approved application on a finished listing is Done without a status change', () => {
    const state = getApplicationExperienceState(
      { status: 'APPROVED' },
      { listing: { endsAt: '2026-10-01T18:00:00' }, today }
    );
    expect(state).toBe(ALREADY_DONE_LABEL);
  });

  test('the hours rule finishes an experience when the hours are attributable', () => {
    const state = getApplicationExperienceState(
      { status: 'APPROVED', opportunityId: 'o1' },
      {
        listing: { endsAt: '2026-12-20T18:00:00' },
        requiredHours: 486,
        renderedHours: 486,
        hoursAttributable: true,
        today
      }
    );
    expect(state).toBe(ALREADY_DONE_LABEL);
  });

  test('the hours rule is ignored when they cannot be attributed to one experience', () => {
    const state = getApplicationExperienceState(
      { status: 'APPROVED', opportunityId: 'o1' },
      {
        listing: { endsAt: '2026-12-20T18:00:00' },
        requiredHours: 486,
        renderedHours: 486,
        hoursAttributable: false,
        today
      }
    );
    expect(state).toBe(ONGOING_LABEL);
  });

  test('a pending application is never an experience, whatever the dates say', () => {
    const state = getApplicationExperienceState(
      { status: 'PENDING' },
      { listing: { endsAt: '2026-10-01T18:00:00' }, today }
    );
    expect(state).toBeNull();
  });
});

describe('deriveExperienceEntries with dates', () => {
  const today = at('2026-10-20');
  const user = { id: 'u1' };

  const opportunities = [
    { id: 'o1', title: 'Health Outreach', scheduleStart: '2026-10-01', scheduleEnd: '2026-12-20' },
    { id: 'o2', title: 'Youth Program', scheduleStart: '2026-10-01', scheduleEnd: '2026-12-20' }
  ];

  test('a finished listing turns the entry Done while the status still says approved', () => {
    const entries = deriveExperienceEntries({
      applications: [{ id: 'a1', userId: 'u1', status: 'APPROVED', opportunityId: 'o1' }],
      opportunities: [{ id: 'o1', title: 'Old Posting', scheduleEnd: '2026-09-30' }],
      currentUser: user,
      today
    });
    expect(entries[0].state).toBe(ALREADY_DONE_LABEL);
    expect(entries[0].isComplete).toBe(true);
  });

  test('exposes the listing window so the card can print the schedule', () => {
    const entries = deriveExperienceEntries({
      applications: [{ id: 'a1', userId: 'u1', status: 'APPROVED', opportunityId: 'o1' }],
      opportunities,
      currentUser: user,
      today
    });
    expect(entries[0].window.startDate).toBeInstanceOf(Date);
    expect(entries[0].window.endDate).toBeInstanceOf(Date);
  });

  test('finishes a single experience once its hours are rendered', () => {
    const entries = deriveExperienceEntries({
      applications: [{ id: 'a1', userId: 'u1', status: 'APPROVED', opportunityId: 'o1' }],
      opportunities,
      currentUser: user,
      requiredHours: 486,
      renderedHours: 486,
      today
    });
    expect(entries[0].hoursAttributable).toBe(true);
    expect(entries[0].state).toBe(ALREADY_DONE_LABEL);
  });

  test('leaves both running when two experiences share one hours balance', () => {
    const entries = deriveExperienceEntries({
      applications: [
        { id: 'a1', userId: 'u1', status: 'APPROVED', opportunityId: 'o1' },
        { id: 'a2', userId: 'u1', status: 'APPROVED', opportunityId: 'o2' }
      ],
      opportunities,
      currentUser: user,
      requiredHours: 486,
      renderedHours: 486,
      today
    });
    expect(entries).toHaveLength(2);
    expect(entries[0].hoursAttributable).toBe(false);
    expect(entries[0].state).toBe(ONGOING_LABEL);
    expect(entries[1].state).toBe(ONGOING_LABEL);
  });

  test('still finishes a date-expired one when two are running', () => {
    const entries = deriveExperienceEntries({
      applications: [
        { id: 'a1', userId: 'u1', status: 'APPROVED', opportunityId: 'o1' },
        { id: 'a2', userId: 'u1', status: 'APPROVED', opportunityId: 'o2' }
      ],
      opportunities: [
        { id: 'o1', title: 'Finished', scheduleEnd: '2026-10-01' },
        { id: 'o2', title: 'Running', scheduleEnd: '2026-12-20' }
      ],
      currentUser: user,
      requiredHours: 486,
      renderedHours: 0,
      today
    });
    expect(entries[0].state).toBe(ALREADY_DONE_LABEL);
    expect(entries[1].state).toBe(ONGOING_LABEL);
  });
});

/**
 * An event is a single diary entry, and the admin form lets `ends_at` be left
 * empty. Before this, such an event produced a null end date, `isListingFinished`
 * returned false forever, and the card sat on "Ongoing" years after the event.
 * The fallback has to be event-only: an OJT posting with a start and no end is
 * genuinely open-ended and must not be closed on its first day.
 */
describe('start-only listings', () => {
  test('an event with no end date falls back to its start day', () => {
    const event = { id: 'e1', startsAt: '2026-10-20T08:00:00' };
    expect(getListingEndDate(event, { isEvent: true }).toDateString()).toBe(at('2026-10-20').toDateString());
  });

  test('a posting with no end date keeps a null end', () => {
    const posting = { id: 'o1', scheduleStart: '2026-10-20' };
    expect(getListingEndDate(posting)).toBeNull();
    expect(getListingEndDate(posting, { isEvent: true }).toDateString()).toBe(at('2026-10-20').toDateString());
  });

  test('a start-only event is still Ongoing on its own day', () => {
    const application = { id: 'a1', status: 'APPROVED', eventId: 'e1' };
    const event = { id: 'e1', startsAt: '2026-10-20T08:00:00' };
    const state = getApplicationExperienceState(application, {
      listing: event,
      today: at('2026-10-20')
    });
    expect(state).toBe(ONGOING_LABEL);
  });

  test('a start-only event is Done the day after', () => {
    const application = { id: 'a1', status: 'APPROVED', eventId: 'e1' };
    const event = { id: 'e1', startsAt: '2026-10-20T08:00:00' };
    const state = getApplicationExperienceState(application, {
      listing: event,
      today: at('2026-10-21')
    });
    expect(state).toBe(ALREADY_DONE_LABEL);
  });

  test('a start-only posting is never closed by its start day', () => {
    const application = { id: 'a1', status: 'APPROVED', opportunityId: 'o1' };
    const posting = { id: 'o1', scheduleStart: '2026-10-20' };
    const state = getApplicationExperienceState(application, {
      listing: posting,
      today: at('2026-12-31')
    });
    expect(state).toBe(ONGOING_LABEL);
  });

  test('isApplicationWindowFinished only applies the fallback to events', () => {
    const event = { id: 'e1', startsAt: '2026-10-20T08:00:00' };
    const posting = { id: 'o1', scheduleStart: '2026-10-20' };
    const later = at('2026-11-01');

    expect(isApplicationWindowFinished({ eventId: 'e1' }, event, later)).toBe(true);
    expect(isApplicationWindowFinished({ opportunityId: 'o1' }, posting, later)).toBe(false);
  });
});

describe('getApplicationListingKind', () => {
  test('names the kind from whichever foreign key is present', () => {
    expect(getApplicationListingKind({ opportunityId: 'o1' })).toBe('opportunity');
    expect(getApplicationListingKind({ program_id: 'p1' })).toBe('program');
    expect(getApplicationListingKind({ eventId: 'e1' })).toBe('event');
    expect(getApplicationListingKind({})).toBeNull();
    expect(getApplicationListingKind(null)).toBeNull();
  });

  test('an opportunity wins over a stray event id', () => {
    expect(getApplicationListingKind({ opportunityId: 'o1', eventId: 'e1' })).toBe('opportunity');
  });
});

describe('deriveExperienceEntries with start-only events', () => {
  const user = { id: 'u1' };

  test('a past start-only event is Done on the dashboard too', () => {
    const entries = deriveExperienceEntries({
      applications: [{ id: 'a1', userId: 'u1', status: 'APPROVED', eventId: 'e1' }],
      events: [{ id: 'e1', title: 'Coastal Cleanup', startsAt: '2026-10-01T08:00:00' }],
      currentUser: user,
      today: at('2026-10-20')
    });

    expect(entries).toHaveLength(1);
    expect(entries[0].state).toBe(ALREADY_DONE_LABEL);
  });

  test('a future start-only event stays Ongoing', () => {
    const entries = deriveExperienceEntries({
      applications: [{ id: 'a1', userId: 'u1', status: 'APPROVED', eventId: 'e1' }],
      events: [{ id: 'e1', title: 'Coastal Cleanup', startsAt: '2026-12-01T08:00:00' }],
      currentUser: user,
      today: at('2026-10-20')
    });

    expect(entries[0].state).toBe(ONGOING_LABEL);
  });
});

/**
 * Events and OJT postings are not the same kind of thing, and the difference is
 * not cosmetic:
 *
 *   an event     is a diary entry - one day, sometimes a whole day, no hours
 *   a posting    is an engagement - weeks long, with `required_hours`
 *
 * Conflating them produced three separate wrong answers at once.
 */
describe('whole-day events', () => {
  test('00:00 to 23:59 is a whole day', () => {
    expect(
      isWholeDayEvent({ startsAt: '2026-10-20T00:00:00', endsAt: '2026-10-20T23:59:00' })
    ).toBe(true);
  });

  test('00:00 to the next 00:00 is a whole day', () => {
    expect(
      isWholeDayEvent({ startsAt: '2026-10-20T00:00:00', endsAt: '2026-10-21T00:00:00' })
    ).toBe(true);
  });

  test('a date with no clock time is a whole day', () => {
    expect(isWholeDayEvent({ startsAt: '2026-10-20' })).toBe(true);
  });

  test('a start-only event at midnight is a whole day', () => {
    expect(isWholeDayEvent({ startsAt: '2026-10-20T00:00:00' })).toBe(true);
  });

  test('a timed slot is not', () => {
    expect(
      isWholeDayEvent({ startsAt: '2026-10-20T08:00:00', endsAt: '2026-10-20T17:00:00' })
    ).toBe(false);
  });

  test('a morning session from midnight is not a whole day', () => {
    expect(
      isWholeDayEvent({ startsAt: '2026-10-20T00:00:00', endsAt: '2026-10-20T12:00:00' })
    ).toBe(false);
  });

  test('a start-only event in the afternoon is not a whole day', () => {
    expect(isWholeDayEvent({ startsAt: '2026-10-20T13:00:00' })).toBe(false);
  });
});

describe('a date with no clock time parses as local midnight', () => {
  test('not UTC midnight', () => {
    const { startDate } = getListingWindow({ startsAt: '2026-10-20' });
    expect(startDate.getHours()).toBe(0);
    expect(startDate.getDate()).toBe(20);
    expect(startDate.getMonth()).toBe(9);
  });
});

describe('formatListingSchedule', () => {
  test('words a whole-day event as a whole day', () => {
    expect(
      formatListingSchedule(
        { startsAt: '2026-10-20T00:00:00', endsAt: '2026-10-20T23:59:00' },
        { isEvent: true }
      )
    ).toBe('October 20, 2026 · Whole day');
  });

  test('words a timed event with its clock range', () => {
    expect(
      formatListingSchedule(
        { startsAt: '2026-10-20T08:00:00', endsAt: '2026-10-20T17:00:00' },
        { isEvent: true }
      )
    ).toBe('October 20, 2026 · 08:00 AM - 05:00 PM');
  });

  test('words a start-only timed event with its start time', () => {
    expect(formatListingSchedule({ startsAt: '2026-10-20T13:30:00' }, { isEvent: true })).toBe(
      'October 20, 2026 · 01:30 PM'
    );
  });

  test('words a multi-day event as a date range', () => {
    expect(
      formatListingSchedule(
        { startsAt: '2026-10-20T08:00:00', endsAt: '2026-10-22T17:00:00' },
        { isEvent: true }
      )
    ).toBe('October 20, 2026 - October 22, 2026');
  });

  test('falls back to the stored schedule string, then to null', () => {
    expect(formatListingSchedule({ schedule: 'To be announced' }, { isEvent: true })).toBe(
      'To be announced'
    );
    expect(formatListingSchedule({}, { isEvent: true })).toBeNull();
  });

  test('keeps a posting as plain dates with no clock time', () => {
    expect(
      formatListingSchedule({ scheduleStart: '2026-09-01', scheduleEnd: '2026-12-20' })
    ).toBe('September 1, 2026 - December 20, 2026');
  });
});

describe('isHoursAttributable', () => {
  const today = at('2026-10-20');
  const openPosting = { application: { status: 'APPROVED', opportunityId: 'o1' }, listing: {} };
  const otherPosting = { application: { status: 'APPROVED', opportunityId: 'o2' }, listing: {} };
  const event = { application: { status: 'APPROVED', eventId: 'e1' }, listing: {} };
  const programme = { application: { status: 'APPROVED', programId: 'p1' }, listing: {} };

  test('one posting on its own owns the hours', () => {
    expect(isHoursAttributable([openPosting], today)).toBe(true);
  });

  test('two postings have to share them, so neither may claim completion', () => {
    expect(isHoursAttributable([openPosting, otherPosting], today)).toBe(false);
  });

  test('an event does not compete for the hours pool', () => {
    expect(isHoursAttributable([openPosting, event], today)).toBe(true);
  });

  test('a programme does not compete either', () => {
    expect(isHoursAttributable([openPosting, programme], today)).toBe(true);
  });

  test('no posting at all means nothing to attribute', () => {
    expect(isHoursAttributable([event, programme], today)).toBe(false);
    expect(isHoursAttributable([], today)).toBe(false);
  });

  test('a finished posting stops competing', () => {
    const finished = {
      application: { status: 'APPROVED', opportunityId: 'o2' },
      listing: { scheduleStart: '2026-01-01', scheduleEnd: '2026-02-01' }
    };
    expect(isHoursAttributable([openPosting, finished], today)).toBe(true);
  });
});

describe('an event beside an OJT posting', () => {
  test('the posting can still complete on hours', () => {
    const entries = deriveExperienceEntries({
      applications: [
        { id: 'a1', userId: 'u1', status: 'APPROVED', opportunityId: 'o1' },
        { id: 'a2', userId: 'u1', status: 'APPROVED', eventId: 'e1' }
      ],
      opportunities: [{ id: 'o1', title: 'Intern', scheduleStart: '2026-09-01' }],
      events: [{ id: 'e1', title: 'Cleanup', startsAt: '2026-12-01T00:00:00' }],
      currentUser: { id: 'u1' },
      requiredHours: 486,
      renderedHours: 486,
      today: at('2026-10-20')
    });

    const posting = entries.find((entry) => entry.type === 'opportunity');
    const event = entries.find((entry) => entry.type === 'event');

    expect(posting.state).toBe(ALREADY_DONE_LABEL);
    expect(event.state).toBe(ONGOING_LABEL);
  });
});

/**
 * The admin event form warns when a span crosses midnight, because such an event
 * is stored as one continuous window and blocks the whole range for applicants.
 */
describe('spansMultipleDays', () => {
  test('is false inside one day', () => {
    expect(spansMultipleDays('2026-10-20T08:00', '2026-10-20T22:00')).toBe(false);
  });

  test('is true when the end lands on the next day', () => {
    expect(spansMultipleDays('2026-10-20T08:00', '2026-10-21T22:00')).toBe(true);
  });

  test('is true even for a one-minute crossing of midnight', () => {
    expect(spansMultipleDays('2026-10-20T23:30', '2026-10-21T00:10')).toBe(true);
  });

  test('is false when either side is missing or unparseable', () => {
    expect(spansMultipleDays('', '2026-10-21T10:00')).toBe(false);
    expect(spansMultipleDays('2026-10-20T08:00', null)).toBe(false);
    expect(spansMultipleDays('nonsense', '2026-10-21T10:00')).toBe(false);
  });

  test('accepts Date objects as well as strings', () => {
    expect(spansMultipleDays(new Date(2026, 9, 20, 8), new Date(2026, 9, 21, 8))).toBe(true);
  });
});
