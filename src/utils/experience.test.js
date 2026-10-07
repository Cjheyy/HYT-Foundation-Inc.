import {
  ALREADY_DONE_LABEL,
  ONGOING_LABEL,
  addWorkingDays,
  computeExperienceSchedule,
  deriveExperienceEntries,
  getApplicationExperienceState,
  groupApplications,
  isApplicationApproved,
  isApplicationCompleted,
  isApplicationPending
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
