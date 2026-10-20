import { getFirstName, formatRelativeTime, toLocalISODate, toIsoInstant, formatScheduleRange } from './helpers';

describe('toLocalISODate', () => {
  test('formats a Date using LOCAL calendar parts', () => {
    expect(toLocalISODate(new Date(2026, 8, 29))).toBe('2026-09-29');
  });

  test('zero-pads month and day', () => {
    expect(toLocalISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  test('does not slip a day in a positive UTC offset', () => {
    // Regression: `new Date(2026, 8, 29).toISOString().slice(0, 10)` is
    // "2026-09-28" anywhere east of UTC, because local midnight is 16:00Z the
    // day before. formatScheduleRange slices its input, so the whole
    // OJT/Experience date range rendered one day early.
    const localMidnight = new Date(2026, 8, 29, 0, 0, 0);
    expect(toLocalISODate(localMidnight)).toBe('2026-09-29');
    expect(localMidnight.toISOString().slice(0, 10)).not.toBe('2026-09-29');
  });

  test('accepts an ISO string', () => {
    expect(toLocalISODate('2026-12-25')).toBe('2026-12-25');
  });

  test('returns empty string for junk so the caller keeps its "--" fallback', () => {
    [undefined, null, '', 'not-a-date', NaN].forEach((value) => {
      expect(toLocalISODate(value)).toBe('');
    });
  });
});

describe('toIsoInstant', () => {
  // A `datetime-local` value is the admin's WALL-CLOCK time.  Handed raw to a
  // timestamptz column, POSTGRES picks the zone - and Supabase's session is UTC
  // - so 09:00 Manila would come back as 17:00 Manila.  These assertions are
  // deliberately round-trip rather than string-equality: the whole point is
  // that the value means the same LOCAL time, whatever zone the test box is in.
  test('a datetime-local value means the same local time on the way back', () => {
    const instant = toIsoInstant('2026-10-20T09:00');
    const back = new Date(instant);
    expect(back.getFullYear()).toBe(2026);
    expect(back.getMonth()).toBe(9);
    expect(back.getDate()).toBe(20);
    expect(back.getHours()).toBe(9);
    expect(back.getMinutes()).toBe(0);
  });

  test('an evening time does not roll over to the next day', () => {
    const back = new Date(toIsoInstant('2026-10-20T23:30'));
    expect(back.getDate()).toBe(20);
    expect(back.getHours()).toBe(23);
  });

  test('a midnight start stays on its own date', () => {
    const back = new Date(toIsoInstant('2026-12-31T00:00'));
    expect(back.getDate()).toBe(31);
    expect(back.getHours()).toBe(0);
  });

  test('produces a real UTC instant, not a naive string', () => {
    // The bug this guards: passing '2026-10-20T09:00' straight through, which
    // Postgres would read as 09:00 in the SESSION zone.
    expect(toIsoInstant('2026-10-20T09:00')).toMatch(/Z$/);
  });

  test('accepts a Date as well as a string', () => {
    const date = new Date(2026, 9, 20, 9, 0);
    expect(toIsoInstant(date)).toBe(date.toISOString());
  });

  test('returns undefined for junk so the column keeps its default', () => {
    [undefined, null, '', 'not-a-date'].forEach((value) => {
      expect(toIsoInstant(value)).toBeUndefined();
    });
  });
});

describe('toLocalISODate feeding formatScheduleRange', () => {
  test('produces the short range the experience card shows', () => {
    const start = new Date(2026, 8, 29);
    const end = new Date(2026, 11, 25);
    expect(formatScheduleRange(toLocalISODate(start), toLocalISODate(end))).toBe('Sep 29 - Dec 25, 2026');
  });

  test('falls back to a single date when there is no end date', () => {
    expect(formatScheduleRange(toLocalISODate(new Date(2026, 8, 29)), '')).toBe('Sep 29');
  });

  test('returns empty string when neither date is usable', () => {
    expect(formatScheduleRange(toLocalISODate(undefined), toLocalISODate('nope'))).toBe('');
  });
});

describe('getFirstName', () => {
  test('prefers the first word of fullName, matching the portal layouts', () => {
    expect(getFirstName({ fullName: 'Juan Dela Cruz', firstName: 'Juanito' })).toBe('Juan');
  });

  test('falls back to firstName when fullName is absent', () => {
    // Regression: both dashboards read `firstName` directly, so a row carrying
    // only `fullName` greeted the user with "Welcome back, !".
    expect(getFirstName({ firstName: 'Maria' })).toBe('Maria');
  });

  test('accepts snake_case rows', () => {
    expect(getFirstName({ full_name: 'Ana Reyes' })).toBe('Ana');
    expect(getFirstName({ first_name: 'Ana' })).toBe('Ana');
  });

  test('never returns an empty string', () => {
    expect(getFirstName(null)).toBe('there');
    expect(getFirstName(undefined)).toBe('there');
    expect(getFirstName({})).toBe('there');
    expect(getFirstName({ fullName: '   ' })).toBe('there');
    expect(getFirstName({ fullName: '   ', firstName: '  ' })).toBe('there');
  });

  test('handles a single-word name', () => {
    expect(getFirstName({ fullName: 'Cher' })).toBe('Cher');
  });
});

describe('formatRelativeTime', () => {
  const at = (offsetMs) => new Date(Date.now() - offsetMs).toISOString();
  const MINUTE = 60 * 1000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  test('labels the very recent past as "just now"', () => {
    expect(formatRelativeTime(at(5 * 1000))).toBe('just now');
  });

  test('counts minutes and hours', () => {
    expect(formatRelativeTime(at(5 * MINUTE))).toBe('5 minutes ago');
    expect(formatRelativeTime(at(1 * MINUTE))).toBe('1 minute ago');
    expect(formatRelativeTime(at(2 * HOUR))).toBe('2 hours ago');
    expect(formatRelativeTime(at(90 * MINUTE))).toBe('2 hours ago');
  });

  test('uses singular units correctly', () => {
    expect(formatRelativeTime(at(1 * HOUR))).toBe('1 hour ago');
    expect(formatRelativeTime(at(1 * DAY))).toBe('yesterday');
  });

  test('counts days and weeks', () => {
    expect(formatRelativeTime(at(3 * DAY))).toBe('3 days ago');
    expect(formatRelativeTime(at(14 * DAY))).toBe('2 weeks ago');
  });

  test('looks forward too', () => {
    expect(formatRelativeTime(at(-3 * HOUR))).toBe('in 3 hours');
  });

  test('returns an empty string rather than "NaN" for bad input', () => {
    // The stepper and the attention centre both fall back on '' to decide
    // whether to render the elapsed line at all.
    expect(formatRelativeTime(null)).toBe('');
    expect(formatRelativeTime(undefined)).toBe('');
    expect(formatRelativeTime('not a date')).toBe('');
    expect(formatRelativeTime('2026-01-01T00:00:00Z', 'also not a date')).toBe('');
  });

  test('accepts an explicit reference date', () => {
    expect(formatRelativeTime('2026-01-01T08:00:00Z', new Date('2026-01-01T10:00:00Z')))
      .toBe('2 hours ago');
  });
});
