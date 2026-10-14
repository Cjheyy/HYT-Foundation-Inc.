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

  test('LOAD_PUBLIC_DATA refreshes the public collections and leaves user rows alone', () => {
    // The regression this guards: `loadPublicData` runs on every realtime
    // posting/announcement broadcast and used to dispatch LOAD_DATA, which
    // replaces EVERY collection.  Its payload never carries the user's own rows,
    // so publishing an event emptied the applications, attendance and
    // requirements of everyone with the portal open.
    const next = appReducer(signedInState, {
      type: 'LOAD_PUBLIC_DATA',
      payload: {
        programs: [{ id: 'p2' }],
        events: [{ id: 'e1' }],
        opportunities: [{ id: 'o1' }],
        announcements: [{ id: 'ann1' }],
        settings: { theme: 'hyt' }
      }
    });

    expect(next.programs).toEqual([{ id: 'p2' }]);
    expect(next.events).toEqual([{ id: 'e1' }]);
    expect(next.opportunities).toEqual([{ id: 'o1' }]);
    expect(next.announcements).toEqual([{ id: 'ann1' }]);

    expect(next.applications).toEqual(signedInState.applications);
    expect(next.attendance).toEqual([{ id: 'a1' }]);
    expect(next.notifications).toEqual([{ id: 'n1' }]);
    expect(next.otRequests).toEqual([{ id: 'ot1' }]);
    expect(next.users).toEqual(signedInState.users);
    expect(next.currentUser).toEqual(signedInState.currentUser);
  });

  test('LOAD_PUBLIC_DATA keeps the rows on screen when one fetch fails', () => {
    // `loadPublicData` sends `undefined` for a rejected fetch, so a single
    // transient failure during a realtime refresh must not blank a list.
    const next = appReducer(signedInState, {
      type: 'LOAD_PUBLIC_DATA',
      payload: { programs: undefined, announcements: undefined, events: [] }
    });

    expect(next.programs).toEqual([{ id: 'p1' }]);
    expect(next.announcements).toEqual(signedInState.announcements);
    expect(next.events).toEqual([]);
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
