/**
 * Pure date plumbing for the custom `DateField` picker.
 *
 * Everything here works on PARTS - `{ year, month, day, hour, minute }` - and
 * never on `Date` objects for anything a human reads back.  The reason is the
 * same trap that has bitten this project before: `new Date('2026-10-14')` is
 * parsed as UTC midnight, so in a negative-offset timezone it formats as
 * October 13.  Reading the parts straight out of the string and formatting them
 * with `toLocaleDateString` on a locally-constructed Date cannot drift.
 *
 * Kept separate from the component so the month grid, the parsing and the
 * formatting can be tested without rendering anything.
 */

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/** Sunday-first, matching how a Philippine wall calendar is printed. */
export const WEEKDAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/** Minute choices in the time dropdown - 5-minute steps keep the list short. */
export const MINUTE_STEP = 5;

export function pad2(value) {
  return String(value).padStart(2, '0');
}

/** Days in a 1-based month.  Day 0 of the NEXT month is the last of this one. */
export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * `'YYYY-MM-DD'` or `'YYYY-MM-DDTHH:mm'` (also tolerating a space separator and
 * trailing seconds) into parts.  Anything unparseable - including a value whose
 * day does not exist, such as `2026-02-31` - returns `null` rather than a
 * half-built object, so callers can branch once.
 */
export function parseValue(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?/.exec(text);
  if (!match) return null;

  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: match[4] === undefined ? 0 : Number(match[4]),
    minute: match[5] === undefined ? 0 : Number(match[5]),
    hasTime: match[4] !== undefined
  };

  if (parts.month < 1 || parts.month > 12) return null;
  if (parts.day < 1 || parts.day > daysInMonth(parts.year, parts.month)) return null;
  if (parts.hour > 23 || parts.minute > 59) return null;

  return parts;
}

/** `'YYYY-MM-DD'` from parts. */
export function toDateValue(parts) {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

/** `'YYYY-MM-DDTHH:mm'` from parts - the exact shape `datetime-local` emits. */
export function toDateTimeValue(parts) {
  return `${toDateValue(parts)}T${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

/** The wire format for the field, given whether it carries a time. */
export function toValue(parts, withTime) {
  return withTime ? toDateTimeValue(parts) : toDateValue(parts);
}

/** Just the `YYYY-MM-DD` half of any value - for `min`/`max` comparisons. */
export function dayKeyOf(value) {
  const parts = parseValue(value);
  return parts ? toDateValue(parts) : '';
}

/** Local "today", as parts.  Takes `now` so tests are not clock-dependent. */
export function todayParts(now = new Date()) {
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes()
  };
}

/**
 * Local "today" as `'YYYY-MM-DD'` - the value to use for a `min` bound.
 *
 * NOT `new Date().toISOString().split('T')[0]`, which is what the admin forms
 * used to pass: `toISOString` is UTC, so between midnight and 08:00 in Manila
 * it returns YESTERDAY, and the deadline field would let an admin pick a date
 * that has already passed.
 */
export function todayIso(now = new Date()) {
  return toDateValue(todayParts(now));
}

/**
 * Step a (year, month) pair by whole months, wrapping the year in both
 * directions.  The `% 12` is re-based because JavaScript's remainder keeps the
 * sign of the dividend, so a plain `total % 12` yields a negative month for
 * anything before year 0 and, more practically, makes a January step backwards
 * produce month `0` instead of `12`.
 */
export function addMonths(year, month, delta) {
  const total = year * 12 + (month - 1) + delta;
  return {
    year: Math.floor(total / 12),
    month: ((total % 12) + 12) % 12 + 1
  };
}

/**
 * Six weeks of cells, always 42 entries, starting on the Sunday on or before
 * the 1st.  A fixed 42 keeps the popover the same height every month, so the
 * grid does not jump as the admin pages through it.
 */
export function buildMonthGrid(year, month) {
  const start = new Date(year, month - 1, 1 - new Date(year, month - 1, 1).getDay());
  const cells = [];

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    const cellYear = date.getFullYear();
    const cellMonth = date.getMonth() + 1;
    const cellDay = date.getDate();
    cells.push({
      year: cellYear,
      month: cellMonth,
      day: cellDay,
      weekday: date.getDay(),
      iso: `${cellYear}-${pad2(cellMonth)}-${pad2(cellDay)}`,
      inMonth: cellYear === year && cellMonth === month
    });
  }

  return cells;
}

/** `9:05 AM` from a 24-hour pair.  Midnight and noon read as 12, not 0. */
export function formatClock(hour, minute) {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${pad2(minute)} ${suffix}`;
}

/**
 * `October 14, 2026`, or `October 14, 2026 · 9:05 AM` with a time.  Built from
 * parts via a LOCAL Date, never from `new Date(string)` - see the file header.
 */
export function formatDisplay(value, withTime) {
  const parts = typeof value === 'object' && value !== null ? value : parseValue(value);
  if (!parts) return '';

  const base = `${MONTH_NAMES[parts.month - 1]} ${parts.day}, ${parts.year}`;
  return withTime ? `${base} · ${formatClock(parts.hour, parts.minute)}` : base;
}

/** `October 2026` - the popover's month heading. */
export function formatMonthLabel(year, month) {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/**
 * The minute options for the time dropdown: every 5 minutes, plus whatever
 * minute the current value already carries so a value typed before this picker
 * existed (or a rounded-off one) still shows as selected instead of silently
 * snapping when the admin touches another control.
 */
export function minuteOptions(currentMinute) {
  const options = [];
  for (let minute = 0; minute < 60; minute += MINUTE_STEP) options.push(minute);
  if (Number.isInteger(currentMinute) && currentMinute >= 0 && currentMinute < 60
    && !options.includes(currentMinute)) {
    options.push(currentMinute);
    options.sort((a, b) => a - b);
  }
  return options;
}

/** Is `iso` outside the allowed window?  `min`/`max` are date-ish strings. */
export function isOutOfRange(iso, min, max) {
  const floor = dayKeyOf(min);
  const ceiling = dayKeyOf(max);
  if (floor && iso < floor) return true;
  if (ceiling && iso > ceiling) return true;
  return false;
}
