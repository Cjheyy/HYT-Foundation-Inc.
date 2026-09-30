import {
  getAttendanceStage,
  isEventActive,
  isPendingAttendanceStatus,
  normalizeStatus
} from './services/supabaseService';
import { isAccountApproved } from './services/authService';

describe('OJT status normalization', () => {
  test('normalizes legacy casing and separators', () => {
    expect(normalizeStatus('Pending Approval')).toBe('PENDING_APPROVAL');
    expect(normalizeStatus('pending-clock-in')).toBe('PENDING_CLOCK_IN');
  });

  test('recognizes both attendance approval stages', () => {
    expect(getAttendanceStage({ status: 'PENDING_CLOCK_IN', timeIn: null })).toBe('CLOCK_IN');
    expect(getAttendanceStage({ status: 'Pending', timeIn: '2026-01-01T08:00:00Z' })).toBe('CLOCK_OUT');
    expect(isPendingAttendanceStatus('PENDING_APPROVAL')).toBe(true);
    expect(isPendingAttendanceStatus('APPROVED')).toBe(false);
  });

  test('allows direct login for pending accounts; blocks inactive approved accounts', () => {
    // Direct login flow: newly registered Trainees/OJT can log in immediately.
    expect(isAccountApproved({ role: 'Trainee', applicationStatus: 'PENDING_APPROVAL', isActive: false })).toBe(true);
    expect(isAccountApproved({ role: 'Trainee', applicationStatus: 'APPROVED', isActive: false })).toBe(false);
    expect(isAccountApproved({ role: 'Trainee', applicationStatus: 'APPROVED', isActive: true })).toBe(true);
  });

  test('hides expired events while allowing open deadlines', () => {
    expect(isEventActive({ status: 'Published', applicationDeadline: '2099-01-01' }, '2026-09-24')).toBe(true);
    expect(isEventActive({ status: 'Draft', applicationDeadline: '2099-01-01' }, '2026-09-24')).toBe(false);
    expect(isEventActive({ status: 'Published', applicationDeadline: '2020-01-01' }, '2026-09-24')).toBe(false);
    expect(isEventActive({ status: 'Closed', applicationDeadline: null }, '2026-09-24')).toBe(false);
  });
});
