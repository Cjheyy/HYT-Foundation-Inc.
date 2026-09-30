import {
  PENDING_ATTENDANCE_STATUSES,
  describeAttendanceStage,
  getAttendanceStage,
  isPendingAttendanceStatus,
  normalizeStatus
} from './supabaseService';

describe('attendance stage resolution', () => {
  test('resolves the canonical dual-approval states', () => {
    expect(getAttendanceStage({ status: 'PENDING_CLOCK_IN', timeIn: null })).toBe('CLOCK_IN');
    expect(getAttendanceStage({ status: 'PENDING_CLOCK_OUT', timeIn: '2026-01-01T08:00:00Z' })).toBe('CLOCK_OUT');
  });

  test('resolves legacy pending values from the presence of time_in', () => {
    expect(getAttendanceStage({ status: 'Pending', timeIn: null })).toBe('CLOCK_IN');
    expect(getAttendanceStage({ status: 'PENDING_APPROVAL', timeIn: '2026-01-01T08:00:00Z' })).toBe('CLOCK_OUT');
  });

  test('resolves every status it lists as pending', () => {
    // A status that the queue treats as pending must never fall through to
    // "unknown", otherwise the admin UI would mislabel it or block approval.
    PENDING_ATTENDANCE_STATUSES.forEach((status) => {
      const withTimeIn = getAttendanceStage({ status, timeIn: '2026-01-01T08:00:00Z' });
      const withoutTimeIn = getAttendanceStage({ status, timeIn: null });
      expect(withTimeIn).not.toBeNull();
      expect(withoutTimeIn).not.toBeNull();
    });
  });

  test('fails closed for statuses outside the workflow', () => {
    expect(getAttendanceStage({ status: 'APPROVED' })).toBeNull();
    expect(getAttendanceStage({ status: 'VOID' })).toBeNull();
    expect(getAttendanceStage({ status: 'SOMETHING_ELSE' })).toBeNull();
    expect(getAttendanceStage(null)).toBeNull();
  });

  test('describes a stage for display without approving unknown states', () => {
    expect(describeAttendanceStage({ status: 'PENDING_CLOCK_IN' })).toBe('CLOCK_IN');
    expect(describeAttendanceStage({ status: 'MYSTERY' })).toBe('CLOCK_IN');
  });

  test('keeps the normalized pending list and helper in sync', () => {
    expect(isPendingAttendanceStatus('pending-approve')).toBe(true);
    expect(isPendingAttendanceStatus('VERIFIED')).toBe(false);
    expect(normalizeStatus('Pending Approval')).toBe('PENDING_APPROVAL');
  });
});
