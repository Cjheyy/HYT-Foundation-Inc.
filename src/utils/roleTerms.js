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
  programLabel: 'Events Postings',
  eventsLabel: 'Events Postings',
  postingLabel: 'OJT Postings',
  experienceLabel: 'OJT / Experience',
  hoursTitle: 'OJT Hours Progress',
  progressLabel: 'OJT Progress',
  progressNoun: 'OJT progress',
  attendanceSubtitle: 'Submit attendance requests and track approved OJT progress',
  attendanceLockedCopy: 'Please apply for an OJT Posting and wait for Admin acceptance before clocking in.',
  approvalRequiredTitle: 'OJT approval required',
  dailyReportsLockedCopy: 'Please apply for an OJT Posting and wait for Admin acceptance before filing a daily report.',
  journeyEmptyMessage: 'Apply to postings to start your OJT journey',
  completionTitle: 'OJT Completed',
  completionNotice: 'You have successfully completed your OJT program. Your certificate is now available.'
};

export const TRAINEE_TERMS = {
  key: 'TRAINEE',
  isTrainee: true,
  roleLabel: 'Trainee',
  portalName: 'Trainee Portal',
  programLabel: 'Programs Available',
  eventsLabel: 'Events',
  postingLabel: 'Programs',
  experienceLabel: 'Experience',
  hoursTitle: 'Training Hours Progress',
  progressLabel: 'Training Progress',
  progressNoun: 'training progress',
  attendanceSubtitle: 'Submit attendance requests and track approved training hours',
  attendanceLockedCopy: 'Please join a program and wait for Admin acceptance before clocking in.',
  approvalRequiredTitle: 'Program approval required',
  dailyReportsLockedCopy: 'Please join a program and wait for Admin acceptance before filing a daily report.',
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

/**
 * Admins run the programme - they do not take part in it.
 *
 * Every "apply" surface asks this before it offers the action. Without it an
 * admin account could apply to its own postings: the public detail pages are
 * not role-gated, so a logged-in admin saw the same "Apply Now" button an
 * intern does, and the RPC happily accepted the row.
 */
export function isAdminRole(role) {
  return normalizeRoleKey(role) === 'ADMIN';
}
