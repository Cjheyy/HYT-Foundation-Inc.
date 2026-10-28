import fs from 'fs';
import path from 'path';
import { CLOCK_OUT_CUTOFF_MINUTES, CLOCK_OUT_REMINDER_LEAD_MINUTES } from '../utils/clockReminder';

/**
 * The clock-out deadline contract.
 *
 * The cutoff exists in two places by necessity - the browser has to be able to
 * say no before the button is pressed, and the database has to be able to say
 * no when the browser is lying. This suite guards the thing that actually
 * matters: that the two agree, and that the server-side guard is still there.
 *
 * It reads the real migration file rather than the running database, because a
 * migration that has been quietly edited to remove the guard would still pass
 * every runtime test in this repo.
 */

const ROOT = process.cwd();
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const CUTOFF_SQL = read('db/patches/PATCH_CLOCKOUT_CUTOFF.sql');
const ABSENCE_SQL = read('db/patches/PATCH_ABSENCE_REVIEW.sql');

describe('the clock-out cutoff is enforced by the database, not just the browser', () => {
  test('the RPC is rebuilt in the migration', () => {
    expect(CUTOFF_SQL).toMatch(/CREATE OR REPLACE FUNCTION public\.request_clock_out/);
  });

  test('the function refuses a late clock-out with a reason the UI can read', () => {
    expect(CUTOFF_SQL).toContain("'too_late'");
    // A refusal must be a returned object, not an exception - the page turns
    // `reason` into copy, and an exception would surface as a raw database error.
    expect(CUTOFF_SQL).toMatch(/'success',\s*false/);
  });

  test('the cutoff is measured in Manila time, not the server default', () => {
    expect(CUTOFF_SQL).toContain("NOW() AT TIME ZONE 'Asia/Manila'");
  });

  test('the default cutoff matches the constant the browser uses', () => {
    // 18:30 == 18 * 60 + 30 == CLOCK_OUT_CUTOFF_MINUTES
    const hours = Math.floor(CLOCK_OUT_CUTOFF_MINUTES / 60);
    const minutes = CLOCK_OUT_CUTOFF_MINUTES % 60;
    const expected = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

    expect(expected).toBe('18:30');
    expect(CUTOFF_SQL).toContain(`TIME '${expected}'`);
  });

  test('the reminder fires before the cutoff, never after it', () => {
    expect(CLOCK_OUT_REMINDER_LEAD_MINUTES).toBe(5);
    expect(CLOCK_OUT_REMINDER_LEAD_MINUTES).toBeLessThan(CLOCK_OUT_CUTOFF_MINUTES);
  });

  test('a malformed setting falls back to the default instead of failing open', () => {
    // The EXCEPTION handler is what stops a bad settings row from turning the
    // cutoff off entirely.
    expect(CUTOFF_SQL).toMatch(/EXCEPTION WHEN OTHERS THEN\s*\n\s*cutoff_time := TIME '18:30'/);
  });

  test('verification lives in its own file, so a typo cannot roll back the migration', () => {
    const verify = read('db/verify/VERIFY_CLOCKOUT_CUTOFF.sql');
    expect(verify).toMatch(/SELECT/i);
    expect(verify).not.toMatch(/CREATE OR REPLACE FUNCTION/i);
    expect(verify).not.toMatch(/ALTER TABLE/i);
  });
});

describe('absence review is a decision, not a one-way acknowledgement', () => {
  test('the status CHECK allows Accepted and Rejected', () => {
    expect(ABSENCE_SQL).toContain("'Accepted'");
    expect(ABSENCE_SQL).toContain("'Rejected'");
  });

  test('a rejection cannot be saved without a usable reason', () => {
    expect(ABSENCE_SQL).toContain('absence_requests_reject_needs_note');
    expect(ABSENCE_SQL).toMatch(/LENGTH\(TRIM\(admin_note\)\) >= 10/);
  });

  test('a trainee cannot decide their own absence', () => {
    expect(ABSENCE_SQL).toContain('hyt_guard_absence_status');
    expect(ABSENCE_SQL).toMatch(/RAISE EXCEPTION 'Only an administrator can accept or reject/);
  });

  test('legacy "Noted" rows are migrated rather than left unreadable', () => {
    expect(ABSENCE_SQL).toMatch(/SET status = 'Accepted'/);
  });
});
