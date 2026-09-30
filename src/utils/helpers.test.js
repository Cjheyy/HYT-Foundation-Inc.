import { getFirstName, formatRelativeTime } from './helpers';

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
