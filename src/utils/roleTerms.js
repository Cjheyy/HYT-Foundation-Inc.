/**
 * Role-aware wording for pages shared between the OJT/Intern and Trainee
 * portals.
 *
 * Seven of the eight `/trainee/*` routes render a student component, so a
 * Trainee used to read "OJT Hours Progress", "Student" and "Apply to postings
 * to start your OJT journey" on their own screens.  Rather than branching on
 * the role at every call site, each shared page asks this map for the term it
 * needs.
 *
 * Usage: `const terms = getRoleTerms(currentUser?.role);`
 */

// Mirrors supabaseService.normalizeRole without importing the whole service
// (these strings are read from layouts, which must stay cheap to load).
const normalizeRoleKey = (value) => String(value ?? '')
  .trim()
  .toUpperCase()
  .replace(/[\s-]+/g, '_');

export const OJT_TERMS = {
  key: 'OJT/INTERN',
  isTrainee: false,
  roleLabel: 'OJT / Intern',
  portalName: 'OJT Portal',
  programLabel: 'Programs & Events',
  postingLabel: 'OJT Postings',
  experienceLabel: 'OJT / Experience',
  hoursTitle: 'OJT Hours Progress',
  progressLabel: 'OJT Progress',
  progressNoun: 'OJT progress',
  attendanceSubtitle: 'Submit attendance requests and track approved OJT progress',
  attendanceLockedCopy: 'Please apply for an OJT Posting and wait for Admin acceptance before clocking in.',
  approvalRequiredTitle: 'OJT approval required',
  journeyEmptyMessage: 'Apply to postings to start your OJT journey',
  completionTitle: 'OJT Completed',
  completionNotice: 'You have successfully completed your OJT program. Your certificate is now available.'
};

export const TRAINEE_TERMS = {
  key: 'TRAINEE',
  isTrainee: true,
  roleLabel: 'Trainee',
  portalName: 'Trainee Portal',
  programLabel: 'Programs & Events',
  postingLabel: 'Programs',
  experienceLabel: 'Training / Experience',
  hoursTitle: 'Training Hours Progress',
  progressLabel: 'Training Progress',
  progressNoun: 'training progress',
  attendanceSubtitle: 'Submit attendance requests and track approved training hours',
  attendanceLockedCopy: 'Please join a program and wait for Admin acceptance before clocking in.',
  approvalRequiredTitle: 'Program approval required',
  journeyEmptyMessage: 'Join a program to start your training journey',
  completionTitle: 'Training Completed',
  completionNotice: 'You have successfully completed your training program. Your certificate is now available.'
};

// 'STUDENT' is grouped with TRAINEE to match TRAINEE_ROLES in supabaseService,
// which already treats both as the non-OJT audience.
const TRAINEE_KEYS = ['TRAINEE', 'STUDENT'];

export function getRoleTerms(role) {
  return TRAINEE_KEYS.includes(normalizeRoleKey(role)) ? TRAINEE_TERMS : OJT_TERMS;
}

export function isTraineeRole(role) {
  return TRAINEE_KEYS.includes(normalizeRoleKey(role));
}
