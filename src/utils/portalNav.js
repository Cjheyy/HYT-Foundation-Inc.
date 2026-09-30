/**
 * Sidebar navigation models for the OJT/Intern and Trainee portals.
 *
 * Two problems live here:
 *
 * 1. `match` lists every URL that should light an entry up.  The Dashboard is
 *    reachable at "/student" *and* "/student/dashboard", and "/student" is a
 *    prefix of every other student route — so a plain `startsWith()` left
 *    Dashboard highlighted on Attendance, Certificates, everything.
 *    resolveActiveNavPath() picks the longest matching target instead, which
 *    guarantees exactly one active entry.
 *
 * 2. `group` drives the sidebar section headings and `badge` names a count that
 *    the layout resolves from app state.  Keeping the model here means the two
 *    layouts cannot drift apart.
 *
 * `badge` values: 'requirements' (needs action) and 'announcements' (unread).
 */

export const STUDENT_NAV = [
  { path: '/student/dashboard', match: ['/student', '/student/dashboard'], label: 'Dashboard', icon: 'dashboard', group: 'Main' },
  { path: '/student/programs', label: 'Programs & Events', icon: 'book', group: 'Main' },
  { path: '/student/opportunities', label: 'OJT Postings', icon: 'target', group: 'Main' },
  { path: '/student/applications', label: 'My Applications', icon: 'file', group: 'My Work' },
  { path: '/student/requirements', label: 'Requirements', icon: 'inbox', group: 'My Work', badge: 'requirements' },
  { path: '/student/ojt', label: 'OJT / Experience', icon: 'briefcase', group: 'My Work' },
  { path: '/student/attendance', label: 'Attendance', icon: 'check', group: 'My Work' },
  { path: '/student/daily-reports', label: 'Daily Reports', icon: 'file', group: 'My Work' },
  { path: '/student/certificates', label: 'Certificates', icon: 'award', group: 'Results' },
  { path: '/student/announcements', label: 'Announcements', icon: 'bell', group: 'Results', badge: 'announcements' }
];

// Trainees deliberately have no "OJT Postings" entry: StudentOpportunities
// filters every posting out for that role, so the route only ever renders an
// empty state.  Linking to it from the sidebar would be a new dead end.
export const TRAINEE_NAV = [
  { path: '/trainee/dashboard', match: ['/trainee', '/trainee/dashboard'], label: 'Dashboard', icon: 'dashboard', group: 'Main' },
  { path: '/trainee/programs', label: 'Programs & Events', icon: 'book', group: 'Main' },
  { path: '/trainee/applications', label: 'My Applications', icon: 'file', group: 'My Work' },
  { path: '/trainee/requirements', label: 'Requirements', icon: 'inbox', group: 'My Work', badge: 'requirements' },
  { path: '/trainee/attendance', label: 'Attendance', icon: 'check', group: 'My Work' },
  { path: '/trainee/daily-reports', label: 'Daily Reports', icon: 'file', group: 'My Work' },
  { path: '/trainee/certificates', label: 'Certificates', icon: 'award', group: 'Results' },
  { path: '/trainee/announcements', label: 'Announcements', icon: 'bell', group: 'Results', badge: 'announcements' }
];

/** Trailing slashes must not change which entry is active. */
const normalizePathname = (pathname) => {
  const value = String(pathname || '/').split(/[?#]/)[0];
  const trimmed = value.replace(/\/+$/, '');
  return trimmed || '/';
};

/**
 * Return the `path` of the single best-matching nav entry for `pathname`.
 *
 * A target matches when the pathname is identical to it or is nested one level
 * below it.  When several targets match (e.g. "/student" and
 * "/student/attendance" both match "/student/attendance"), the longest one
 * wins.  Returns null when nothing matches, so no entry is highlighted.
 */
export function resolveActiveNavPath(navItems, pathname) {
  const current = normalizePathname(pathname);
  let bestPath = null;
  let bestLength = -1;

  (navItems || []).forEach((item) => {
    if (!item?.path) return;
    const targets = Array.isArray(item.match) && item.match.length ? item.match : [item.path];
    targets.forEach((target) => {
      if (typeof target !== 'string' || !target) return;
      const isMatch = current === target || current.startsWith(`${target}/`);
      if (isMatch && target.length > bestLength) {
        bestLength = target.length;
        bestPath = item.path;
      }
    });
  });

  return bestPath;
}

/** Group nav entries into [{ name, items }] preserving declaration order. */
export function groupNavItems(navItems) {
  const groups = [];
  (navItems || []).forEach((item) => {
    const name = item.group || '';
    const last = groups[groups.length - 1];
    if (last && last.name === name) {
      last.items.push(item);
      return;
    }
    groups.push({ name, items: [item] });
  });
  return groups;
}
