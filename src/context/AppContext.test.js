import { appReducer } from './AppContext';

const signedInState = {
  currentUser: { id: 'user-1', role: 'ADMIN' },
  users: [{ id: 'user-1' }, { id: 'user-2' }],
  programs: [{ id: 'p1' }],
  opportunities: [],
  applications: [],
  requirements: [],
  attendance: [{ id: 'a1' }],
  dailyReports: [],
  ojtRecords: [],
  certificates: [],
  announcements: [],
  notifications: [{ id: 'n1' }],
  otRequests: [{ id: 'ot1' }],
  settings: { theme: 'hyt' },
  loading: false
};

describe('appReducer', () => {
  test('LOGOUT clears every user-scoped collection', () => {
    const next = appReducer(signedInState, { type: 'LOGOUT' });
    expect(next.currentUser).toBeNull();
    ['users', 'attendance', 'notifications', 'otRequests', 'applications', 'certificates']
      .forEach((key) => expect(next[key]).toEqual([]));
    expect(next.settings).toEqual({});
    expect(next.loading).toBe(false);
  });

  test('LOAD_DATA replaces collections instead of merging them', () => {
    // A trainee→admin switch must not keep the trainee's notifications/OT rows.
    const next = appReducer(signedInState, {
      type: 'LOAD_DATA',
      payload: { users: [{ id: 'admin-9' }], programs: [] }
    });
    expect(next.currentUser).toEqual({ id: 'user-1', role: 'ADMIN' });
    expect(next.users).toEqual([{ id: 'admin-9' }]);
    expect(next.notifications).toEqual([]);
    expect(next.otRequests).toEqual([]);
    expect(next.attendance).toEqual([]);
    expect(next.settings).toEqual({});
  });

  test('UPDATE_USER patches both the directory row and the current profile', () => {
    const next = appReducer(signedInState, {
      type: 'UPDATE_USER',
      payload: { id: 'user-1', renderedHours: 42 }
    });
    expect(next.currentUser.renderedHours).toBe(42);
    expect(next.users.find((user) => user.id === 'user-1').renderedHours).toBe(42);
  });
});
