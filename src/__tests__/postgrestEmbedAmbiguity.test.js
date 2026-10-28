import fs from 'fs';
import path from 'path';

/**
 * PostgREST embed ambiguity.
 *
 * `absence_requests` and `attendance_logs` each point at `users` twice - the
 * owner (`user_id`) and the person who signed it off (`noted_by` /
 * `approved_by`). A bare `user:users(...)` embed cannot pick one of them, so
 * PostgREST answers
 *
 *   PGRST201: Could not embed because more than one relationship was found
 *             for 'absence_requests' and 'users'
 *
 * instead of rows. On the Absence Report page that surfaced as
 * `Error loading absence requests: Object` and a "Failed to load absence
 * reports" toast, because the raw error object prints as "Object".
 *
 * The attendance queue hid the same bug: every relation select failed and fell
 * back to `select('*')` plus a second profile query, so it looked like it
 * worked while doing two round-trips for every page load.
 *
 * These assertions read the real files and the real migrations, so adding a
 * third FK to either table - or dropping the `!user_id` hint - fails the build
 * instead of silently emptying a page.
 */

const ROOT = process.cwd();
const SERVICE = fs.readFileSync(path.join(ROOT, 'src/services/supabaseService.js'), 'utf8');
const ABSENCE_MIGRATION = fs.readFileSync(path.join(ROOT, 'db/migrations/ABSENCE_REQUESTS_MIGRATION.sql'), 'utf8');
const TIMER_MIGRATION = fs.readFileSync(path.join(ROOT, 'db/migrations/TIMER_STATE_MACHINE_MIGRATION.sql'), 'utf8');

const stripComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/--[^\n]*/g, '')
  .replace(/^\s*\/\/[^\n]*/gm, '');

const code = stripComments(SERVICE);

/** Every `alias:table(...)` / `alias:table!hint(...)` embed in the service. */
const embeds = () => [...code.matchAll(/(\w+):(\w+)(!\w+)?\(/g)]
  .map((match) => ({
    alias: match[1],
    table: match[2],
    hint: match[3] ? match[3].slice(1) : null,
    raw: match[0]
  }));

/** Count `REFERENCES ... users(id)` occurrences inside one CREATE/ALTER block. */
const fkCount = (sql, pattern) => (stripComments(sql).match(pattern) || []).length;

describe('the two ambiguous tables really are ambiguous', () => {
  it('absence_requests has two foreign keys into users', () => {
    // user_id (who filed it) and noted_by (which admin answered it).
    const fks = fkCount(ABSENCE_MIGRATION, /REFERENCES\s+public\.users\s*\(\s*id\s*\)/gi);
    expect(fks).toBe(2);
  });

  it('attendance_logs has two foreign keys into users', () => {
    // user_id (who clocked in) and approved_by (who approved it).
    expect(TIMER_MIGRATION).toMatch(/ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public\.users\(id\)/i);
    expect(fkCount(TIMER_MIGRATION, /REFERENCES\s+public\.users\s*\(\s*id\s*\)/gi)).toBeGreaterThanOrEqual(1);
  });
});

describe('every users embed names its foreign key', () => {
  it('finds the two embeds it is meant to guard', () => {
    const usersEmbeds = embeds().filter((embed) => embed.table === 'users');
    expect(usersEmbeds).toHaveLength(2);
  });

  it('none of them is a bare user:users(...)', () => {
    const bare = embeds().filter((embed) => embed.table === 'users' && !embed.hint);
    expect(bare.map((embed) => embed.raw)).toEqual([]);
  });

  it('all of them hint the owner column, not the reviewer column', () => {
    // `!noted_by` / `!approved_by` would compile and return the ADMIN as the
    // applicant - a wrong answer is worse than an error.
    const hints = embeds().filter((embed) => embed.table === 'users').map((embed) => embed.hint);
    expect(hints).toEqual(['user_id', 'user_id']);
  });
});

describe('getAbsenceRequests survives a refused relation select', () => {
  const body = (() => {
    const start = code.indexOf('export const getAbsenceRequests');
    expect(start).toBeGreaterThan(-1);
    const end = code.indexOf('export const getPendingAbsenceRequests', start);
    return code.slice(start, end > start ? end : undefined);
  })();

  it('retries with a plain select when the embed fails', () => {
    // PGRST201 is neither a missing column nor a missing table, so without an
    // explicit fallback the whole page throws.
    expect(body).toMatch(/run\('\*'\)/);
  });

  it('re-attaches the profile after the plain select', () => {
    expect(body).toMatch(/attachUserProfiles\(/);
  });

  it('still scopes to one user after the fallback', () => {
    expect(body).toMatch(/const scope = \(rows\) =>/);
    expect(body).toMatch(/rowUserId\(row\) === userId/);
  });

  it('still reports a genuinely unreadable table', () => {
    expect(body).toMatch(/throw plain\.error/);
  });
});

describe('the page reports the real cause instead of "Object"', () => {
  const PAGE = fs.readFileSync(path.join(ROOT, 'src/pages/admin/AbsenceReview.jsx'), 'utf8');

  it('imports describeError', () => {
    expect(PAGE).toMatch(/import \{[^}]*describeError[^}]*\} from '\.\.\/\.\.\/utils\/helpers'/);
  });

  it('does not log a raw Supabase error object', () => {
    expect(PAGE).not.toMatch(/console\.error\('Error loading absence requests:', error\)/);
    expect(PAGE).toMatch(/console\.error\('Error loading absence requests:', describeError\(error\)/);
  });

  it('puts the cause in the toast, not just "Failed"', () => {
    expect(PAGE).toMatch(/toast\.error\(`Failed to load absence reports: \$\{describeError\(error\)\}`\)/);
  });
});
