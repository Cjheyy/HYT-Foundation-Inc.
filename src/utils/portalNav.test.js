import { STUDENT_NAV, TRAINEE_NAV, groupNavItems, resolveActiveNavPath } from './portalNav';

describe('resolveActiveNavPath', () => {
  test('lights only Attendance on the Attendance route', () => {
    // Regression: isActive('/student') used to match every /student/* route,
    // so Dashboard stayed highlighted alongside the real page.
    expect(resolveActiveNavPath(STUDENT_NAV, '/student/attendance')).toBe('/student/attendance');
  });

  test('never returns two entries for any student route', () => {
    const paths = [
      '/student',
      '/student/dashboard',
      '/student/programs',
      '/student/opportunities',
      '/student/applications',
      '/student/requirements',
      '/student/ojt',
      '/student/attendance',
      '/student/daily-reports',
      '/student/certificates',
      '/student/announcements'
    ];
    paths.forEach((path) => {
      const active = resolveActiveNavPath(STUDENT_NAV, path);
      expect(typeof active).toBe('string');
      // A second call with the resolved path must be stable (idempotent).
      expect(resolveActiveNavPath(STUDENT_NAV, active)).toBe(active);
    });
  });

  test('treats the bare portal root as Dashboard', () => {
    expect(resolveActiveNavPath(STUDENT_NAV, '/student')).toBe('/student/dashboard');
    expect(resolveActiveNavPath(TRAINEE_NAV, '/trainee')).toBe('/trainee/dashboard');
  });

  test('ignores trailing slashes and query strings', () => {
    expect(resolveActiveNavPath(STUDENT_NAV, '/student/attendance/')).toBe('/student/attendance');
    expect(resolveActiveNavPath(STUDENT_NAV, '/student/attendance?tab=history')).toBe('/student/attendance');
  });

  test('prefers the longest matching target', () => {
    // "/student/daily-reports" also starts with "/student", but the longer
    // target must win.
    expect(resolveActiveNavPath(STUDENT_NAV, '/student/daily-reports')).toBe('/student/daily-reports');
  });

  test('returns null when nothing matches', () => {
    expect(resolveActiveNavPath(STUDENT_NAV, '/nope')).toBeNull();
    expect(resolveActiveNavPath(STUDENT_NAV, '/')).toBeNull();
    expect(resolveActiveNavPath(null, '/student')).toBeNull();
  });
});

describe('nav models', () => {
  test('student sidebar reaches Requirements', () => {
    // Requirements existed as a route but had no sidebar entry — the page was
    // reachable only from a dashboard button.
    expect(STUDENT_NAV.some((item) => item.path === '/student/requirements')).toBe(true);
  });

  test('trainee sidebar reaches Requirements and Daily Reports', () => {
    const paths = TRAINEE_NAV.map((item) => item.path);
    expect(paths).toContain('/trainee/requirements');
    expect(paths).toContain('/trainee/daily-reports');
  });

  test('trainee sidebar has no OJT Postings entry', () => {
    // StudentOpportunities filters every posting out for trainees, so linking
    // there would only ever open an empty page.
    expect(TRAINEE_NAV.some((item) => item.path === '/trainee/opportunities')).toBe(false);
  });
});

describe('groupNavItems', () => {
  test('groups student nav into Main / My Work / Results', () => {
    const groups = groupNavItems(STUDENT_NAV);
    expect(groups.map((group) => group.name)).toEqual(['Main', 'My Work', 'Results']);
    expect(groups[0].items.map((item) => item.label)).toEqual([
      'Dashboard',
      'Programs & Events',
      'OJT Postings'
    ]);
  });

  test('keeps declaration order and every item', () => {
    const groups = groupNavItems(TRAINEE_NAV);
    const flattened = groups.flatMap((group) => group.items);
    expect(flattened.map((item) => item.path)).toEqual(TRAINEE_NAV.map((item) => item.path));
  });

  test('handles an empty list', () => {
    expect(groupNavItems([])).toEqual([]);
    expect(groupNavItems(undefined)).toEqual([]);
  });
});
