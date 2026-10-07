import { getApplicationsByStudent, canApply } from './applicationService';
import { toCamelCase } from '../config/supabase';

/**
 * Regression guard for the owner-lookup bug.
 *
 * The deployed `applications` table has `user_id` — there is NO `student_id`
 * column (verified against the live database: selecting it returns
 * `42703 column applications.student_id does not exist`).  `getApplicationsByStudent`
 * used to filter on `app.studentId`, so it compared `undefined` against a real id
 * and returned an empty list for every user.  That silently blanked the student
 * dashboard's "Active Application" card, the trainee "Active Training" card, and
 * the entire My Applications page.
 *
 * These rows are shaped exactly as Supabase returns them after camelCasing.
 */

const OPPORTUNITY_ROW = toCamelCase({
  id: 'a1',
  user_id: 'user-1',
  program_id: null,
  opportunity_id: 'opp-1',
  type: 'opportunity',
  status: 'Applied',
  applied_at: '2026-10-01T00:00:00Z',
  reviewed_at: null,
  reviewed_by: null,
  notes: null,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z'
});

describe('getApplicationsByStudent', () => {
  test('matches a real Supabase row, which carries userId and no studentId', () => {
    expect(OPPORTUNITY_ROW.userId).toBe('user-1');
    expect(OPPORTUNITY_ROW.studentId).toBeUndefined();
    expect(getApplicationsByStudent([OPPORTUNITY_ROW], 'user-1')).toHaveLength(1);
  });

  test('still matches legacy rows that only carry studentId', () => {
    const legacy = { id: 'a2', studentId: 'user-1', status: 'Applied' };
    expect(getApplicationsByStudent([legacy], 'user-1')).toHaveLength(1);
  });

  test('still matches raw snake_case rows', () => {
    const raw = { id: 'a3', user_id: 'user-1', status: 'Applied' };
    expect(getApplicationsByStudent([raw], 'user-1')).toHaveLength(1);
  });

  test('never returns another user\'s applications', () => {
    const other = { ...OPPORTUNITY_ROW, id: 'a4', userId: 'user-2' };
    expect(getApplicationsByStudent([OPPORTUNITY_ROW, other], 'user-1')).toHaveLength(1);
  });

  test('returns an empty list without an id, and tolerates junk input', () => {
    expect(getApplicationsByStudent([OPPORTUNITY_ROW], undefined)).toEqual([]);
    expect(getApplicationsByStudent(undefined, 'user-1')).toEqual([]);
    expect(getApplicationsByStudent(null, 'user-1')).toEqual([]);
  });
});

describe('canApply', () => {
  const opportunity = { id: 'opp-1' };
  const currentUser = { id: 'user-1' };

  test('blocks a second application to the same posting', () => {
    expect(canApply(opportunity, currentUser, [OPPORTUNITY_ROW])).toBe(false);
  });

  test('allows applying when the posting is untouched', () => {
    expect(canApply(opportunity, { id: 'user-9' }, [OPPORTUNITY_ROW])).toBe(true);
  });

  test('is false without a signed-in user', () => {
    expect(canApply(opportunity, null, [])).toBe(false);
  });
});
