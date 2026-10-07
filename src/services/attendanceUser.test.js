/**
 * Regression cover for the "Unknown" approver bug.
 *
 * The embedded `user:users(...)` relation in the attendance select is the fast
 * path.  On a deployment whose attendance_logs -> users foreign key is missing
 * (or whose PostgREST schema cache has not picked it up) the relation select is
 * rejected, every caller falls back to `select('*')`, and the returned rows carry
 * no `user` key at all -- which is what rendered the admin approval queue as
 * "Unknown".  These tests pin the fallback behaviour.
 */
import { supabase } from '../config/supabase';
import {
  getAttendanceLogs,
  getDailyReports,
  resolveAttendanceUserName,
  resolveUserName
} from './supabaseService';

jest.mock('../config/supabase', () => ({
  supabase: { from: jest.fn() },
  toCamelCase: jest.requireActual('../config/supabase').toCamelCase,
  toSnakeCase: jest.requireActual('../config/supabase').toSnakeCase
}));

/** Minimal chainable stand-in for a PostgREST query builder.
 *  Returns the `from` implementation itself, ready for `mockImplementation`. */
const makeFrom = (handler) => (table) => {
  const st = { table, select: null, filters: [] };
  const builder = {
    select(sel) {
      st.select = sel;
      return builder;
    },
    order() {
      return builder;
    },
    eq(col, val) {
      st.filters.push({ op: 'eq', col, val });
      return builder;
    },
    in(col, vals) {
      st.filters.push({ op: 'in', col, vals });
      return builder;
    },
    then(onOk, onErr) {
      return Promise.resolve()
        .then(() => handler(st))
        .then(onOk, onErr);
    }
  };
  return builder;
};

const relationSelectFailed = (st) =>
  st.table === 'attendance_logs' && String(st.select || '').includes('users(');

const LOG_ROWS = [
  { id: 'log-1', user_id: 'user-a', date: '2026-03-01', status: 'PENDING_CLOCK_IN' },
  { id: 'log-2', user_id: 'user-b', date: '2026-03-02', status: 'PENDING_CLOCK_OUT' }
];

const USER_ROWS = [
  { id: 'user-a', full_name: 'Christian Jay Santos', email: 'cj@example.com' },
  { id: 'user-b', full_name: 'Maria Rodriguez', email: 'mr@example.com' }
];

describe('getAttendanceLogs re-attaches the profile after the relation fallback', () => {
  beforeEach(() => {
    supabase.from.mockReset();
  });

  test('every row carries a real name even when the relation select is rejected', async () => {
    supabase.from.mockImplementation(
      makeFrom((st) => {
        if (relationSelectFailed(st)) {
          return { data: null, error: { code: 'PGRST200', message: 'relationship not found' } };
        }
        if (st.table === 'users') return { data: USER_ROWS, error: null };
        return { data: LOG_ROWS, error: null };
      })
    );

    const logs = await getAttendanceLogs();

    expect(logs).toHaveLength(2);
    expect(logs.map((log) => log.user?.fullName)).toEqual([
      'Christian Jay Santos',
      'Maria Rodriguez'
    ]);
    expect(logs.map(resolveAttendanceUserName)).toEqual([
      'Christian Jay Santos',
      'Maria Rodriguez'
    ]);
    // The whole point: no caller can print "Unknown" for a real person.
    expect(logs.map(resolveAttendanceUserName)).not.toContain('Unknown');
  });

  test('scopes to one user after the fallback and still resolves the name', async () => {
    supabase.from.mockImplementation(
      makeFrom((st) => {
        if (relationSelectFailed(st)) {
          return { data: null, error: { code: 'PGRST200', message: 'relationship not found' } };
        }
        if (st.table === 'users') return { data: USER_ROWS, error: null };
        return { data: LOG_ROWS, error: null };
      })
    );

    const logs = await getAttendanceLogs('user-b');

    expect(logs).toHaveLength(1);
    expect(resolveAttendanceUserName(logs[0])).toBe('Maria Rodriguez');
  });

  test('falls back to e-mail then id when the profile lookup also fails', async () => {
    supabase.from.mockImplementation(
      makeFrom((st) => {
        if (relationSelectFailed(st)) {
          return { data: null, error: { code: 'PGRST200', message: 'relationship not found' } };
        }
        if (st.table === 'users') {
          return { data: null, error: { code: '42501', message: 'permission denied' } };
        }
        return { data: LOG_ROWS, error: null };
      })
    );

    const logs = await getAttendanceLogs();

    // No profile could be read, so the placeholder must at least be traceable
    // to a concrete record rather than the bare word "Unknown".
    logs.forEach((log) => {
      const label = resolveAttendanceUserName(log);
      expect(label).not.toBe('Unknown');
      expect(label).toMatch(/^User user-/);
    });
  });

  test('keeps the fast path untouched when the relation select succeeds', async () => {
    supabase.from.mockImplementation(
      makeFrom((st) => {
        if (st.table === 'attendance_logs') {
          return {
            data: [
              { ...LOG_ROWS[0], user: { id: 'user-a', full_name: 'Embedded Name' } }
            ],
            error: null
          };
        }
        return { data: [], error: null };
      })
    );

    const logs = await getAttendanceLogs();

    expect(logs[0].user.fullName).toBe('Embedded Name');
    // No extra users round-trip when the relation already delivered the profile.
    const userLookups = supabase.from.mock.calls.filter(([table]) => table === 'users');
    expect(userLookups).toHaveLength(0);
  });

  test('re-attaches profiles when the relation select SUCCEEDS but returns no user', async () => {
    // The relation select is accepted, so there is no `result.error` to trigger
    // the fallback — but PostgREST still hands back rows with no joined `user`
    // (an unresolved FK, or RLS hiding the joined row). This is the second half
    // of the "Unknown" bug, and the one the error-only fallback missed.
    supabase.from.mockImplementation(
      makeFrom((st) => {
        if (st.table === 'users') return { data: USER_ROWS, error: null };
        return { data: LOG_ROWS, error: null };
      })
    );

    const logs = await getAttendanceLogs();

    expect(logs.map(resolveAttendanceUserName)).toEqual([
      'Christian Jay Santos',
      'Maria Rodriguez'
    ]);
    const userLookups = supabase.from.mock.calls.filter(([table]) => table === 'users');
    expect(userLookups).toHaveLength(1);
  });
});

describe('getDailyReports attaches profiles too', () => {
  beforeEach(() => {
    supabase.from.mockReset();
  });

  test('the admin report feed gets real names, not "User <id>"', async () => {
    supabase.from.mockImplementation(
      makeFrom((st) => {
        if (st.table === 'users') return { data: USER_ROWS, error: null };
        return {
          data: [
            { id: 'r1', user_id: 'user-a', report_date: '2026-03-01', status: 'PENDING' },
            { id: 'r2', user_id: 'user-b', report_date: '2026-03-02', status: 'SUBMITTED' }
          ],
          error: null
        };
      })
    );

    const reports = await getDailyReports();

    expect(reports.map(resolveAttendanceUserName)).toEqual([
      'Christian Jay Santos',
      'Maria Rodriguez'
    ]);
  });
});

describe('resolveUserName', () => {
  test('prefers the full name', () => {
    expect(resolveUserName({ fullName: 'Juan Santos', email: 'j@x.com' })).toBe('Juan Santos');
    expect(resolveUserName({ full_name: '  Juan Santos  ' })).toBe('Juan Santos');
  });

  test('composes a name from first and last name', () => {
    expect(resolveUserName({ firstName: 'Juan', lastName: 'Santos' })).toBe('Juan Santos');
    expect(resolveUserName({ first_name: 'Juan', last_name: 'Santos' })).toBe('Juan Santos');
    expect(resolveUserName({ firstName: 'Juan' })).toBe('Juan');
  });

  test('falls back to the e-mail local part, then the id', () => {
    expect(resolveUserName({ email: 'juan.santos@hyt.org' })).toBe('juan.santos');
    expect(resolveUserName({ userId: 'abcdef1234567890' })).toBe('User abcdef12');
  });

  test('reads the owner off the log row when no profile is attached', () => {
    expect(resolveUserName(null, { userId: 'abcdef1234567890' })).toBe('User abcdef12');
    expect(resolveUserName(undefined, { user_id: 'zzzzzzzz9999' })).toBe('User zzzzzzzz');
  });

  test('only reports a placeholder once every identity field is absent', () => {
    expect(resolveUserName(null)).toBe('Unknown user');
    expect(resolveUserName({})).toBe('Unknown user');
    expect(resolveUserName({ fullName: '   ' })).toBe('Unknown user');
  });

  test('never returns the bare string "Unknown"', () => {
    const cases = [
      { fullName: 'A' },
      { email: 'b@c.com' },
      { id: 'd' },
      { userId: 'e' },
      { first_name: 'f' }
    ];
    cases.forEach((input) => expect(resolveUserName(input)).not.toBe('Unknown'));
  });
});
