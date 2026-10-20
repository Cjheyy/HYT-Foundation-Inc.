import {
  LISTING_ID_COLUMN_BY_KIND,
  LISTING_TABLE_BY_KIND,
  MAX_ACTIVE_EVENT_APPLICATIONS,
  eventWindow,
  eventWindowsOverlap
} from './supabaseService';

/**
 * The three listing kinds and the event overlap rule.
 *
 * The overlap test is the whole basis of rule #3 ("event dates and times must
 * not overlap"), and it has one deliberately surprising case: a
 * back-to-back pair counts as a clash.  That is asserted explicitly below so
 * nobody "fixes" it to a strict comparison without deciding to.
 */

const at = (iso) => ({ starts_at: iso, ends_at: null });

describe('listing kinds', () => {
  test('every kind maps to its own table and foreign-key column', () => {
    expect(LISTING_TABLE_BY_KIND).toEqual({
      program: 'programs',
      event: 'events',
      opportunity: 'opportunities'
    });
    expect(LISTING_ID_COLUMN_BY_KIND).toEqual({
      program: 'program_id',
      event: 'event_id',
      opportunity: 'opportunity_id'
    });
  });

  test('the three kinds and their columns stay in step', () => {
    expect(Object.keys(LISTING_TABLE_BY_KIND).sort())
      .toEqual(Object.keys(LISTING_ID_COLUMN_BY_KIND).sort());
  });

  test('an event application limit exists and is a positive number', () => {
    expect(MAX_ACTIVE_EVENT_APPLICATIONS).toBeGreaterThan(0);
  });
});

describe('eventWindow', () => {
  test('reads camelCase and snake_case alike', () => {
    const camel = eventWindow({ startsAt: '2026-10-20T09:00:00Z', endsAt: '2026-10-20T11:00:00Z' });
    const snake = eventWindow({ starts_at: '2026-10-20T09:00:00Z', ends_at: '2026-10-20T11:00:00Z' });
    expect(camel).toEqual(snake);
    expect(camel.start).toBeLessThan(camel.end);
  });

  test('a start with no end is a single instant', () => {
    const window = eventWindow(at('2026-10-20T09:00:00Z'));
    expect(window).toEqual({ start: window.start, end: window.start });
  });

  test('a listing with no structured time has no window', () => {
    expect(eventWindow({})).toBeNull();
    expect(eventWindow({ schedule: 'December 10' })).toBeNull();
    expect(eventWindow({ starts_at: '' })).toBeNull();
    expect(eventWindow({ starts_at: 'not a date' })).toBeNull();
  });

  test('tolerates null and undefined rows', () => {
    expect(eventWindow(null)).toBeNull();
    expect(eventWindow(undefined)).toBeNull();
  });
});

describe('eventWindowsOverlap', () => {
  const morning = { starts_at: '2026-10-20T09:00:00Z', ends_at: '2026-10-20T12:00:00Z' };

  test('a window inside another clashes', () => {
    expect(eventWindowsOverlap(morning, {
      starts_at: '2026-10-20T10:00:00Z', ends_at: '2026-10-20T11:00:00Z'
    })).toBe(true);
  });

  test('a partially overlapping window clashes', () => {
    expect(eventWindowsOverlap(morning, {
      starts_at: '2026-10-20T11:00:00Z', ends_at: '2026-10-20T14:00:00Z'
    })).toBe(true);
  });

  test('a window on another day does not clash', () => {
    expect(eventWindowsOverlap(morning, {
      starts_at: '2026-10-21T09:00:00Z', ends_at: '2026-10-21T12:00:00Z'
    })).toBe(false);
  });

  test('a same-day window that ends before the other starts does not clash', () => {
    expect(eventWindowsOverlap(morning, {
      starts_at: '2026-10-20T18:00:00Z', ends_at: '2026-10-20T20:00:00Z'
    })).toBe(false);
  });

  test('a back-to-back pair DOES clash (inclusive by design)', () => {
    // 09:00-12:00 and 12:00-14:00 touch at exactly 12:00.  Treating that as a
    // clash is the conservative reading - the youth would have to travel.
    expect(eventWindowsOverlap(morning, {
      starts_at: '2026-10-20T12:00:00Z', ends_at: '2026-10-20T14:00:00Z'
    })).toBe(true);
  });

  test('the relation is symmetric', () => {
    const other = { starts_at: '2026-10-20T11:00:00Z', ends_at: '2026-10-20T14:00:00Z' };
    expect(eventWindowsOverlap(morning, other)).toBe(eventWindowsOverlap(other, morning));
  });

  test('two events on the same instant clash', () => {
    expect(eventWindowsOverlap(at('2026-10-20T09:00:00Z'), at('2026-10-20T09:00:00Z'))).toBe(true);
  });

  test('a listing with no window can never clash', () => {
    expect(eventWindowsOverlap(morning, {})).toBe(false);
    expect(eventWindowsOverlap({}, {})).toBe(false);
    // …and it is not blocked BY a windowed event either.
    expect(eventWindowsOverlap({}, morning)).toBe(false);
  });
});
