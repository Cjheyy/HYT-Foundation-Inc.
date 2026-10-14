/**
 * The three daily-report slots and every question you can ask about them.
 *
 * A day is no longer a single free-text report. The trainee files three
 * updates — at 11:00, 15:00 and 17:00 — and each one carries the same three
 * boxes:
 *
 *   Accomplished · In-Progress · Pending
 *
 * The **17:00 filing is the trigger**: the whole day (all three slots together)
 * reaches the administrator only once that filing exists. Nothing is sent
 * automatically and there is no scheduler — the trainee sends and the
 * administrator reads. A day whose 17:00 slot is missing is shown to the
 * administrator as "No 5 PM report" rather than silently disappearing.
 *
 * Everything here is pure, so the window rules, the merging and the
 * "is it complete" question can all be tested without a clock, a database or
 * React.
 */

import { toDateValue, todayParts } from './dateParts';

/** The windows, in order. `key` doubles as both the storage key and the sort key. */
export const REPORT_SLOTS = [
  { key: '11:00', hour: 11, label: '11:00 AM', window: '11:00 – 11:59 AM' },
  { key: '15:00', hour: 15, label: '3:00 PM', window: '3:00 – 3:59 PM' },
  { key: '17:00', hour: 17, label: '5:00 PM', window: '5:00 – 5:59 PM' }
];

/** The slot whose filing releases the day's summary to the administrator. */
export const SUMMARY_SLOT = '17:00';

export const SLOT_KEYS = REPORT_SLOTS.map((slot) => slot.key);

/** The three boxes, in the order they are displayed and printed. */
export const ENTRY_FIELDS = [
  { key: 'accomplished', label: 'Accomplished' },
  { key: 'inProgress', label: 'In-Progress' },
  { key: 'pending', label: 'Pending' }
];

/** A slot definition by key, or null. */
export function slotByKey(key) {
  return REPORT_SLOTS.find((slot) => slot.key === key) || null;
}

export function slotLabel(key) {
  return slotByKey(key)?.label || key;
}

/** A blank entry — also the shape every stored entry is normalised to. */
export function emptyEntry() {
  return { accomplished: '', inProgress: '', pending: '', submittedAt: '' };
}

/**
 * Coerce whatever is stored in the column into the entry shape.
 *
 * Tolerant of snake_case and of the alternative names a hand-written row might
 * use, because this data can arrive from a legacy insert, from a manual fix in
 * the SQL editor, or from a future column rename.
 */
export function normalizeEntry(value) {
  if (!value || typeof value !== 'object') return emptyEntry();
  const text = (candidate) => String(candidate ?? '').trim();
  return {
    accomplished: text(value.accomplished ?? value.accomplishments),
    inProgress: text(value.inProgress ?? value.in_progress),
    pending: text(value.pending ?? value.pendingTasks ?? value.pending_tasks),
    submittedAt: value.submittedAt ?? value.submitted_at ?? ''
  };
}

/**
 * The slot map off a report row.
 *
 * The column is `slot_entries` (jsonb). PostgREST returns jsonb as an object,
 * but a value that has passed through a text column or a CSV round-trip arrives
 * as a string, so both are accepted — and anything unparseable degrades to
 * "no slots filed" rather than throwing inside a render.
 */
export function readSlotEntries(row) {
  const raw = row?.slotEntries ?? row?.slot_entries ?? null;
  let source = raw;

  if (typeof raw === 'string') {
    try {
      source = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};

  const entries = {};
  SLOT_KEYS.forEach((key) => {
    if (source[key]) entries[key] = normalizeEntry(source[key]);
  });
  return entries;
}

/** True when at least one of the three boxes has text. */
export function entryIsFilled(entry) {
  const normalized = normalizeEntry(entry);
  return Boolean(normalized.accomplished || normalized.inProgress || normalized.pending);
}

/** The day key off a report row, whichever name the service emitted. */
export function rowDay(row) {
  const raw = row?.reportDate ?? row?.report_date ?? row?.date ?? '';
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(String(raw).trim());
  return iso ? iso[1] : '';
}

/** The owning user id off a report row. */
export function rowUserId(row) {
  return row?.userId || row?.user_id || row?.studentId || row?.student_id || '';
}

/**
 * Where a slot stands right now.
 *
 *  - `submitted` — an entry is filed. Always wins, so a late filing still
 *                  counts instead of being reported as missed.
 *  - `upcoming`  — the window has not opened yet.
 *  - `open`      — the window is open this hour.
 *  - `missed`    — the window has closed with nothing filed.
 *
 * `day` is the row's own date. A PAST day is decided without looking at the
 * clock at all: every window on it is closed, so a gap stays `missed` forever.
 * Otherwise a report from last week would read "upcoming" on a device whose
 * clock is behind, and "open" on a day nobody can file any more.
 *
 * `now` is injectable so tests do not depend on the wall clock.
 */
export function slotStatus(slot, entries, day, now = new Date()) {
  if (entries?.[slot.key]) return 'submitted';

  const todayIso = toDateValue(todayParts(now));
  if (!day) return 'upcoming';
  if (day < todayIso) return 'missed';
  if (day > todayIso) return 'upcoming';

  const hour = now.getHours();
  if (hour < slot.hour) return 'upcoming';
  if (hour === slot.hour) return 'open';
  return 'missed';
}

/** Every slot on a day with its status and (normalised) entry. */
export function daySlots(row, now = new Date()) {
  const entries = readSlotEntries(row);
  const day = rowDay(row);
  return REPORT_SLOTS.map((slot) => ({
    ...slot,
    status: slotStatus(slot, entries, day, now),
    entry: entries[slot.key] || null
  }));
}

/** Has the trainee filed every slot on this day? */
export function dayIsComplete(row) {
  const entries = readSlotEntries(row);
  return SLOT_KEYS.every((key) => entryIsFilled(entries[key]));
}

/**
 * Has the 17:00 filing landed? This is the gate the administrator's list is
 * built on — without it there is no consolidated report, only a gap. An empty
 * 17:00 slot does not count: it is a form that was opened, not a filing.
 */
export function dayHasSummary(row) {
  return entryIsFilled(readSlotEntries(row)[SUMMARY_SLOT]);
}

/** Which slots are missing and already past their window. */
export function dayMissedSlots(row, now = new Date()) {
  return daySlots(row, now).filter((slot) => slot.status === 'missed');
}

/**
 * Has the trainee filed anything at all on this day?
 *
 * A slot counts only when at least one of its three boxes has text. A slot
 * that was opened and submitted empty is not a filing, and must not drag an
 * otherwise empty day into the administrator's list.
 */
export function dayHasAnyEntry(row) {
  const entries = readSlotEntries(row);
  return SLOT_KEYS.some((key) => entryIsFilled(entries[key]));
}

/**
 * Merge one slot into a day's slot map, leaving the other slots untouched.
 * Returns a NEW object: the caller writes this straight to the column, so it
 * must never mutate what the row already held.
 */
export function mergeSlotEntry(entries, key, entry) {
  const base = entries && typeof entries === 'object' && !Array.isArray(entries) ? entries : {};
  return {
    ...base,
    [key]: { ...normalizeEntry(entry), submittedAt: entry?.submittedAt || new Date().toISOString() }
  };
}

/**
 * The plain-text stand-in for the day, kept in `daily_reports.accomplishments`.
 *
 * That column is what every older reader still reads (the CSV export, the DTR
 * merge, the legacy admin screen), so leaving it blank would make a day look
 * empty everywhere except the new screen. It carries the LATEST slot that has
 * an entry — the most current statement of the day's work.
 */
export function summariseForAccomplishments(row) {
  const entries = readSlotEntries(row);
  const latest = [...SLOT_KEYS].reverse().find((key) => entries[key]);
  if (!latest) return '';
  const entry = entries[latest];
  return [entry.accomplished, entry.inProgress, entry.pending].filter(Boolean).join('\n');
}

/**
 * One row per (person, day), newest day first and then by person.
 *
 * Both sides use this: the trainee sees their own history and the administrator
 * sees everyone's. Only days with at least one filing appear — an empty day is
 * not a report. Days whose 17:00 slot is missing stay in the list on purpose:
 * the whole point of the marker is to make that gap visible.
 */
export function groupReportsByDay(rows) {
  const groups = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const userId = rowUserId(row);
    const day = rowDay(row);
    if (!userId || !day) return;
    if (!dayHasAnyEntry(row)) return;

    const id = `${userId}|${day}`;
    const existing = groups.get(id);
    if (existing) {
      // Two rows for one day (a legacy row plus a new one) — the one with the
      // 17:00 filing wins, since that is the consolidated report.
      if (!dayHasSummary(existing) && dayHasSummary(row)) groups.set(id, row);
      return;
    }
    groups.set(id, row);
  });

  return [...groups.values()].sort((left, right) => {
    const leftDay = rowDay(left);
    const rightDay = rowDay(right);
    if (leftDay !== rightDay) return leftDay < rightDay ? 1 : -1;
    // Same day: one person's rows should read in a stable order rather than
    // whatever order the fetch happened to return.
    return rowUserId(left).localeCompare(rowUserId(right));
  });
}
