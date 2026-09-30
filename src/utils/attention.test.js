import { buildAttentionItems, resolveNavBadges } from './attention';

const USER = 'user-1';

const stateWith = (overrides = {}) => ({
  requirements: [],
  dailyReports: [],
  attendance: [],
  announcements: [],
  ...overrides
});

describe('buildAttentionItems', () => {
  test('returns nothing when there is nothing to do', () => {
    expect(buildAttentionItems({ state: stateWith(), userId: USER })).toEqual([]);
  });

  test('surfaces requirements that need action', () => {
    const items = buildAttentionItems({
      state: stateWith({
        requirements: [
          { id: 'r1', studentId: USER, name: 'NSC', status: 'Required' },
          { id: 'r2', studentId: USER, name: 'Barangay Clearance', status: 'Rejected' },
          { id: 'r3', studentId: USER, name: 'Good Moral', status: 'Submitted' }
        ]
      }),
      userId: USER
    });

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('requirements');
    expect(items[0].title).toBe('2 requirements need action');
    expect(items[0].detail).toBe('NSC · Barangay Clearance');
    expect(items[0].to).toBe('/student/requirements');
  });

  test('singularises a single requirement', () => {
    const items = buildAttentionItems({
      state: stateWith({ requirements: [{ id: 'r1', studentId: USER, name: 'NSC', status: 'Required' }] }),
      userId: USER
    });
    expect(items[0].title).toBe('1 requirement needs action');
  });

  test('flags a returned daily report as danger and carries the admin note', () => {
    const items = buildAttentionItems({
      state: stateWith({
        dailyReports: [
          {
            id: 'd1',
            userId: USER,
            status: 'Rejected',
            reportDate: '2026-10-28',
            adminNote: 'Kulang ang detalye'
          }
        ]
      }),
      userId: USER
    });

    expect(items[0].tone).toBe('danger');
    expect(items[0].detail).toBe('Kulang ang detalye');
    expect(items[0].to).toBe('/student/daily-reports');
  });

  test('describes a pending clock-in without inventing a time', () => {
    const items = buildAttentionItems({
      state: stateWith({
        attendance: [{ id: 'a1', userId: USER, status: 'PENDING_CLOCK_IN' }]
      }),
      userId: USER
    });

    expect(items[0].id).toBe('attendance');
    expect(items[0].title).toBe('Clock-in request waiting for approval');
    expect(items[0].detail).toBe('Waiting for an administrator to review it');
  });

  test('describes a pending clock-out when time_in is already set', () => {
    const items = buildAttentionItems({
      state: stateWith({
        attendance: [{ id: 'a1', userId: USER, status: 'PENDING_CLOCK_OUT', timeIn: '2026-10-01T00:58:00Z' }]
      }),
      userId: USER
    });
    expect(items[0].title).toBe('Clock-out request waiting for approval');
  });

  test('counts only published announcements that are unread', () => {
    const items = buildAttentionItems({
      state: stateWith({
        announcements: [
          { id: 'n1', status: 'Published', title: 'Orientation' },
          { id: 'n2', status: 'Published', title: 'Holiday' },
          { id: 'n3', status: 'Draft', title: 'Not published yet' }
        ]
      }),
      userId: USER,
      readIds: new Set(['n2'])
    });

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('1 unread announcement');
    expect(items[0].detail).toBe('Orientation');
  });

  test('accepts lower-cased statuses from the database', () => {
    const items = buildAttentionItems({
      state: stateWith({
        requirements: [{ id: 'r1', studentId: USER, name: 'NSC', status: 'required' }],
        announcements: [{ id: 'n1', status: 'published', title: 'Hi' }]
      }),
      userId: USER
    });
    expect(items.map((item) => item.id)).toEqual(['requirements', 'announcements']);
  });

  test('ignores rows that belong to somebody else', () => {
    const items = buildAttentionItems({
      state: stateWith({
        requirements: [{ id: 'r1', studentId: 'other-user', name: 'NSC', status: 'Required' }],
        dailyReports: [{ id: 'd1', userId: 'other-user', status: 'Rejected' }],
        attendance: [{ id: 'a1', userId: 'other-user', status: 'PENDING' }]
      }),
      userId: USER
    });
    expect(items).toEqual([]);
  });

  test('uses the trainee base path when asked', () => {
    const items = buildAttentionItems({
      state: stateWith({ requirements: [{ id: 'r1', studentId: USER, name: 'NSC', status: 'Required' }] }),
      userId: USER,
      basePath: '/trainee'
    });
    expect(items[0].to).toBe('/trainee/requirements');
  });

  test('tolerates a completely empty state object', () => {
    expect(buildAttentionItems({ state: {}, userId: USER })).toEqual([]);
    expect(buildAttentionItems({ state: undefined, userId: USER })).toEqual([]);
  });
});

describe('resolveNavBadges', () => {
  test('counts actionable requirements and unread announcements', () => {
    const badges = resolveNavBadges({
      state: stateWith({
        requirements: [
          { id: 'r1', studentId: USER, status: 'Required' },
          { id: 'r2', studentId: USER, status: 'Rejected' },
          { id: 'r3', studentId: USER, status: 'Approved' }
        ],
        announcements: [
          { id: 'n1', status: 'Published' },
          { id: 'n2', status: 'Published' },
          { id: 'n3', status: 'Draft' }
        ]
      }),
      userId: USER,
      readIds: new Set(['n1'])
    });

    expect(badges).toEqual({ requirements: 2, announcements: 1 });
  });

  test('reports zero so the layout renders no badge', () => {
    expect(resolveNavBadges({ state: stateWith(), userId: USER }))
      .toEqual({ requirements: 0, announcements: 0 });
  });
});
