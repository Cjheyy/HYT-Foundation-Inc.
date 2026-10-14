import {
  addMonths,
  buildMonthGrid,
  dayKeyOf,
  daysInMonth,
  formatClock,
  formatDisplay,
  formatMonthLabel,
  isOutOfRange,
  minuteOptions,
  parseValue,
  toDateValue,
  toDateTimeValue,
  toValue,
  todayIso,
  todayParts
} from './dateParts';

describe('parseValue', () => {
  test('reads a date-only value', () => {
    expect(parseValue('2026-10-14')).toEqual({
      year: 2026, month: 10, day: 14, hour: 0, minute: 0, hasTime: false
    });
  });

  test('reads a datetime-local value', () => {
    expect(parseValue('2026-10-14T09:05')).toEqual({
      year: 2026, month: 10, day: 14, hour: 9, minute: 5, hasTime: true
    });
  });

  test('tolerates a space separator and trailing seconds', () => {
    expect(parseValue('2026-10-14 09:05:00')).toMatchObject({ hour: 9, minute: 5, hasTime: true });
    expect(parseValue('2026-10-14T09:05:30.000Z')).toMatchObject({ hour: 9, minute: 5 });
  });

  test('returns null for empty, null and junk', () => {
    expect(parseValue('')).toBeNull();
    expect(parseValue(null)).toBeNull();
    expect(parseValue(undefined)).toBeNull();
    expect(parseValue('not a date')).toBeNull();
    expect(parseValue('14/10/2026')).toBeNull();
  });

  test('rejects a day that does not exist in that month', () => {
    // 2026 is not a leap year, so 29 February is not a real date.  A picker
    // that accepted it would emit a value the database rejects.
    expect(parseValue('2026-02-29')).toBeNull();
    expect(parseValue('2024-02-29')).toMatchObject({ day: 29 });
    expect(parseValue('2026-04-31')).toBeNull();
    expect(parseValue('2026-13-01')).toBeNull();
  });

  test('rejects an impossible clock time', () => {
    expect(parseValue('2026-10-14T24:00')).toBeNull();
    expect(parseValue('2026-10-14T10:60')).toBeNull();
  });
});

describe('serialising', () => {
  const parts = { year: 2026, month: 10, day: 4, hour: 9, minute: 5 };

  test('pads single-digit months and days', () => {
    expect(toDateValue(parts)).toBe('2026-10-04');
  });

  test('emits the exact datetime-local shape', () => {
    expect(toDateTimeValue(parts)).toBe('2026-10-04T09:05');
  });

  test('toValue picks the shape the field asked for', () => {
    expect(toValue(parts, false)).toBe('2026-10-04');
    expect(toValue(parts, true)).toBe('2026-10-04T09:05');
  });

  test('round-trips through parseValue', () => {
    expect(parseValue(toDateValue(parts))).toMatchObject({ year: 2026, month: 10, day: 4 });
    expect(parseValue(toDateTimeValue(parts))).toMatchObject({ hour: 9, minute: 5 });
  });

  test('dayKeyOf strips the time half', () => {
    expect(dayKeyOf('2026-10-14T09:05')).toBe('2026-10-14');
    expect(dayKeyOf('2026-10-14')).toBe('2026-10-14');
    expect(dayKeyOf('')).toBe('');
    expect(dayKeyOf('nope')).toBe('');
  });
});

describe('daysInMonth', () => {
  test('knows the short months', () => {
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 12)).toBe(31);
  });
});

describe('addMonths', () => {
  test('steps forward across a year boundary', () => {
    expect(addMonths(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
  });

  test('steps backward across a year boundary', () => {
    // The trap: `total % 12` keeps the dividend's sign, so a naive
    // implementation returns month 0 here instead of 12.
    expect(addMonths(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });

  test('handles multi-year jumps in both directions', () => {
    expect(addMonths(2026, 6, 20)).toEqual({ year: 2028, month: 2 });
    expect(addMonths(2026, 6, -20)).toEqual({ year: 2024, month: 10 });
  });

  test('is a no-op for a zero delta', () => {
    expect(addMonths(2026, 7, 0)).toEqual({ year: 2026, month: 7 });
  });
});

describe('buildMonthGrid', () => {
  test('always returns six full weeks', () => {
    // October 2026 starts on a Thursday and ends on a Saturday, which is the
    // worst case for a 5-week grid; a fixed 42 keeps the popover from jumping.
    expect(buildMonthGrid(2026, 10)).toHaveLength(42);
    expect(buildMonthGrid(2026, 2)).toHaveLength(42);
  });

  test('starts on a Sunday', () => {
    expect(buildMonthGrid(2026, 10)[0].weekday).toBe(0);
  });

  test('marks exactly the days of the requested month as in-month', () => {
    const cells = buildMonthGrid(2026, 10);
    expect(cells.filter((cell) => cell.inMonth)).toHaveLength(31);
    expect(cells.filter((cell) => cell.inMonth)[0]).toMatchObject({ day: 1, iso: '2026-10-01' });
    expect(cells.filter((cell) => cell.inMonth).pop()).toMatchObject({ day: 31, iso: '2026-10-31' });
  });

  test('pads with the tail of the previous month and the head of the next', () => {
    const cells = buildMonthGrid(2026, 10);
    // 1 October 2026 is a Thursday, so the grid opens on Sunday 27 September.
    expect(cells[0]).toMatchObject({ iso: '2026-09-27', inMonth: false });
    expect(cells[41]).toMatchObject({ iso: '2026-11-07', inMonth: false });
  });

  test('handles February in a leap year without spilling a day', () => {
    const cells = buildMonthGrid(2024, 2);
    expect(cells.filter((cell) => cell.inMonth)).toHaveLength(29);
  });
});

describe('formatClock', () => {
  test('renders midnight and noon as 12, not 0', () => {
    expect(formatClock(0, 0)).toBe('12:00 AM');
    expect(formatClock(12, 0)).toBe('12:00 PM');
  });

  test('renders the rest of the 12-hour clock', () => {
    expect(formatClock(9, 5)).toBe('9:05 AM');
    expect(formatClock(13, 30)).toBe('1:30 PM');
    expect(formatClock(23, 59)).toBe('11:59 PM');
  });
});

describe('formatDisplay', () => {
  test('formats a date without a time', () => {
    expect(formatDisplay('2026-10-14', false)).toBe('October 14, 2026');
  });

  test('appends the time when asked', () => {
    expect(formatDisplay('2026-10-14T09:05', true)).toBe('October 14, 2026 · 9:05 AM');
  });

  test('does NOT shift the day backwards for a date-only string', () => {
    // `new Date('2026-10-14')` is UTC midnight; formatting that would print
    // October 13 anywhere west of Greenwich.  Building from parts cannot.
    expect(formatDisplay('2026-10-14', false)).toContain('14');
  });

  test('returns empty for a missing or junk value', () => {
    expect(formatDisplay('', false)).toBe('');
    expect(formatDisplay(null, true)).toBe('');
    expect(formatDisplay('nope', false)).toBe('');
  });
});

describe('formatMonthLabel', () => {
  test('names the month and the year', () => {
    expect(formatMonthLabel(2026, 1)).toBe('January 2026');
    expect(formatMonthLabel(2026, 12)).toBe('December 2026');
  });
});

describe('minuteOptions', () => {
  test('steps every five minutes', () => {
    const options = minuteOptions(0);
    expect(options[0]).toBe(0);
    expect(options[1]).toBe(5);
    expect(options).toHaveLength(12);
  });

  test('keeps an off-grid minute already in the value', () => {
    // A value typed before this picker existed must still show as selected,
    // otherwise merely opening the popover silently changes the time.
    const options = minuteOptions(7);
    expect(options).toContain(7);
    expect(options).toEqual([...options].sort((a, b) => a - b));
  });

  test('does not duplicate an on-grid minute', () => {
    expect(minuteOptions(15).filter((value) => value === 15)).toHaveLength(1);
  });

  test('ignores a missing minute', () => {
    expect(minuteOptions(undefined)).toHaveLength(12);
  });
});

describe('isOutOfRange', () => {
  test('flags a day before the minimum', () => {
    expect(isOutOfRange('2026-10-13', '2026-10-14')).toBe(true);
    expect(isOutOfRange('2026-10-14', '2026-10-14')).toBe(false);
  });

  test('flags a day after the maximum', () => {
    expect(isOutOfRange('2026-10-15', null, '2026-10-14')).toBe(true);
    expect(isOutOfRange('2026-10-14', null, '2026-10-14')).toBe(false);
  });

  test('compares only the date half of a datetime bound', () => {
    // `endsAt` carries `min={startsAt}`, a full datetime.  Comparing strings
    // raw would make the SAME day compare as "before" it.
    expect(isOutOfRange('2026-10-14', '2026-10-14T09:00')).toBe(false);
    expect(isOutOfRange('2026-10-13', '2026-10-14T09:00')).toBe(true);
  });

  test('allows everything when no bounds are given', () => {
    expect(isOutOfRange('1999-01-01', '', '')).toBe(false);
    expect(isOutOfRange('2099-01-01', null, null)).toBe(false);
  });
});

describe('todayParts', () => {
  test('reads local calendar fields, not UTC', () => {
    const parts = todayParts(new Date(2026, 9, 14, 23, 30));
    expect(parts).toEqual({ year: 2026, month: 10, day: 14, hour: 23, minute: 30 });
  });
});

describe('todayIso', () => {
  test('pads to a sortable YYYY-MM-DD', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  test('stays on the LOCAL day just after midnight', () => {
    // The bug this guards: the admin forms passed
    // `new Date().toISOString().split('T')[0]`, which is UTC.  At 00:30 in
    // Manila that is still the previous day in UTC, so a `min` bound built
    // from it would allow a deadline that had already passed.
    expect(todayIso(new Date(2026, 9, 14, 0, 30))).toBe('2026-10-14');
    expect(todayIso(new Date(2026, 9, 14, 23, 59))).toBe('2026-10-14');
  });
});
