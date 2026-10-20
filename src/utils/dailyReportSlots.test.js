import {
  REPORT_SLOTS,
  SLOT_KEYS,
  SUMMARY_SLOT,
  dayHasAnyEntry,
  dayHasSummary,
  dayIsComplete,
  dayMissedSlots,
  daySlots,
  emptyEntry,
  entryIsFilled,
  groupReportsByDay,
  mergeSlotEntry,
  normalizeEntry,
  readSlotEntries,
  reviewStateOf,
  rowDay,
  rowUserId,
  slotByKey,
  slotLabel,
  slotStatus,
  summariseForAccomplishments
} from './dailyReportSlots';

/** A fixed clock: 14 October 2026, 11:30 local - inside the 11:00 window. */
const at = (hour, minute = 0) => new Date(2026, 9, 14, hour, minute);
const DAY = '2026-10-14';

const entry = (over = {}) => ({
  accomplished: 'Filed documents',
  inProgress: 'Encoding records',
  pending: 'Archive box',
  submittedAt: '2026-10-14T11:32:00+08:00',
  ...over
});

const row = (over = {}) => ({
  id: 'r1',
  userId: 'u1',
  reportDate: DAY,
  slotEntries: {},
  ...over
});

const slot = (key) => slotByKey(key);

describe('the slot table', () => {
  test('has exactly the three designated windows, in order', () => {
    expect(REPORT_SLOTS.map((s) => s.key)).toEqual(['11:00', '15:00', '17:00']);
    expect(SLOT_KEYS).toEqual(['11:00', '15:00', '17:00']);
  });

  test('the 17:00 filing is the summary trigger', () => {
    expect(SUMMARY_SLOT).toBe('17:00');
    expect(slot(SUMMARY_SLOT).hour).toBe(17);
  });

  test('labels the slots the way the trainee reads them', () => {
    expect(slotLabel('11:00')).toBe('11:00 AM');
    expect(slotLabel('15:00')).toBe('3:00 PM');
    expect(slotLabel('17:00')).toBe('5:00 PM');
  });

  test('falls back to the raw key for an unknown slot', () => {
    expect(slotLabel('19:00')).toBe('19:00');
    expect(slotByKey('19:00')).toBeNull();
  });
});

describe('normalizeEntry', () => {
  test('returns a blank entry for nothing at all', () => {
    expect(normalizeEntry(null)).toEqual(emptyEntry());
    expect(normalizeEntry('nonsense')).toEqual(emptyEntry());
  });

  test('trims every box', () => {
    expect(normalizeEntry({ accomplished: '  a  ', inProgress: ' b ', pending: ' c ' }))
      .toMatchObject({ accomplished: 'a', inProgress: 'b', pending: 'c' });
  });

  test('accepts the snake_case and alternative names', () => {
    expect(normalizeEntry({ in_progress: 'x', pending_tasks: 'y', accomplishments: 'z' }))
      .toMatchObject({ accomplished: 'z', inProgress: 'x', pending: 'y' });
    expect(normalizeEntry({ submitted_at: 'T' }).submittedAt).toBe('T');
  });
});

describe('readSlotEntries', () => {
  test('reads an object straight off the jsonb column', () => {
    const entries = readSlotEntries(row({ slotEntries: { '11:00': entry() } }));
    expect(Object.keys(entries)).toEqual(['11:00']);
    expect(entries['11:00'].accomplished).toBe('Filed documents');
  });

  test('parses a JSON string, which is what a text column returns', () => {
    const entries = readSlotEntries({
      userId: 'u1', reportDate: DAY, slot_entries: JSON.stringify({ '17:00': entry() })
    });
    expect(entries['17:00'].pending).toBe('Archive box');
  });

  test('degrades to empty rather than throwing on junk', () => {
    // A render must not blow up because one row holds a malformed value.
    expect(readSlotEntries(row({ slotEntries: '{not json' }))).toEqual({});
    expect(readSlotEntries(row({ slotEntries: null }))).toEqual({});
    expect(readSlotEntries(row({ slotEntries: [] }))).toEqual({});
    expect(readSlotEntries(null)).toEqual({});
  });

  test('drops keys that are not real slots', () => {
    const entries = readSlotEntries(row({ slotEntries: { '11:00': entry(), '19:00': entry() } }));
    expect(Object.keys(entries)).toEqual(['11:00']);
  });
});

describe('row identity', () => {
  test('reads the day and the user under every alias', () => {
    expect(rowDay({ reportDate: DAY })).toBe(DAY);
    expect(rowDay({ report_date: DAY })).toBe(DAY);
    expect(rowDay({ date: `${DAY}T00:00:00+08:00` })).toBe(DAY);
    expect(rowDay({})).toBe('');

    expect(rowUserId({ userId: 'a' })).toBe('a');
    expect(rowUserId({ user_id: 'b' })).toBe('b');
    expect(rowUserId({ studentId: 'c' })).toBe('c');
    expect(rowUserId({})).toBe('');
  });
});

describe('entryIsFilled', () => {
  test('needs at least one box with text', () => {
    expect(entryIsFilled({ accomplished: 'x' })).toBe(true);
    expect(entryIsFilled({ pending: 'x' })).toBe(true);
    expect(entryIsFilled({ accomplished: '   ' })).toBe(false);
    expect(entryIsFilled({})).toBe(false);
  });
});

describe('slotStatus', () => {
  test('a filed entry always reads as submitted, even late', () => {
    // 20:00 - the window closed hours ago, but the filing exists.
    expect(slotStatus(slot('11:00'), { '11:00': entry() }, DAY, at(20))).toBe('submitted');
  });

  test('is upcoming before the hour', () => {
    expect(slotStatus(slot('15:00'), {}, DAY, at(11, 30))).toBe('upcoming');
  });

  test('is open during the hour', () => {
    expect(slotStatus(slot('11:00'), {}, DAY, at(11, 0))).toBe('open');
    expect(slotStatus(slot('11:00'), {}, DAY, at(11, 59))).toBe('open');
  });

  test('is missed once the hour has passed', () => {
    expect(slotStatus(slot('11:00'), {}, DAY, at(12, 0))).toBe('missed');
    expect(slotStatus(slot('11:00'), {}, DAY, at(16))).toBe('missed');
  });

  test('a PAST day marks every gap as missed regardless of the clock', () => {
    // Otherwise a report from last week would read "upcoming" on a device
    // whose clock is behind, and "open" on a day nobody can file any more.
    expect(slotStatus(slot('17:00'), {}, '2026-10-10', at(11, 30))).toBe('missed');
    expect(slotStatus(slot('17:00'), { '17:00': entry() }, '2026-10-10', at(11, 30))).toBe('submitted');
  });

  test('a FUTURE day is entirely upcoming', () => {
    expect(slotStatus(slot('11:00'), {}, '2026-10-20', at(23))).toBe('upcoming');
  });
});

describe('daySlots', () => {
  test('reports all three slots with their status and entry', () => {
    const slots = daySlots(row({ slotEntries: { '11:00': entry() } }), at(16));
    expect(slots.map((s) => s.status)).toEqual(['submitted', 'missed', 'upcoming']);
    expect(slots[0].entry.accomplished).toBe('Filed documents');
    expect(slots[1].entry).toBeNull();
  });
});

describe('day questions', () => {
  const full = row({
    slotEntries: { '11:00': entry(), '15:00': entry(), '17:00': entry() }
  });

  test('dayHasAnyEntry', () => {
    expect(dayHasAnyEntry(full)).toBe(true);
    expect(dayHasAnyEntry(row())).toBe(false);
  });

  test('dayHasSummary keys on the 17:00 filing alone', () => {
    expect(dayHasSummary(full)).toBe(true);
    expect(dayHasSummary(row({ slotEntries: { '11:00': entry(), '15:00': entry() } }))).toBe(false);
  });

  test('dayIsComplete needs all three', () => {
    expect(dayIsComplete(full)).toBe(true);
    expect(dayIsComplete(row({ slotEntries: { '11:00': entry(), '17:00': entry() } }))).toBe(false);
  });

  test('dayMissedSlots lists only the closed, unfilled windows', () => {
    const missed = dayMissedSlots(row({ slotEntries: { '11:00': entry() } }), at(17, 30));
    expect(missed.map((s) => s.key)).toEqual(['15:00']);
  });
});

describe('mergeSlotEntry', () => {
  test('adds a slot without touching the others', () => {
    const before = { '11:00': normalizeEntry(entry()) };
    const after = mergeSlotEntry(before, '15:00', { accomplished: 'New' });
    expect(Object.keys(after).sort()).toEqual(['11:00', '15:00']);
    expect(after['11:00'].accomplished).toBe('Filed documents');
    expect(after['15:00'].accomplished).toBe('New');
  });

  test('does NOT mutate the map it was handed', () => {
    // The caller writes the result straight back to the column; mutating the
    // old object would edit state React is still holding.
    const before = { '11:00': normalizeEntry(entry()) };
    mergeSlotEntry(before, '17:00', { accomplished: 'x' });
    expect(Object.keys(before)).toEqual(['11:00']);
  });

  test('overwrites a slot that is filed twice', () => {
    const after = mergeSlotEntry({ '11:00': normalizeEntry(entry()) }, '11:00', { accomplished: 'Edited' });
    expect(after['11:00'].accomplished).toBe('Edited');
  });

  test('stamps a submission time when the caller does not supply one', () => {
    const after = mergeSlotEntry({}, '11:00', { accomplished: 'x' });
    expect(typeof after['11:00'].submittedAt).toBe('string');
    expect(after['11:00'].submittedAt.length).toBeGreaterThan(0);
  });

  test('keeps the submission time the caller supplies', () => {
    const after = mergeSlotEntry({}, '11:00', { accomplished: 'x', submittedAt: 'FIXED' });
    expect(after['11:00'].submittedAt).toBe('FIXED');
  });

  test('tolerates a null or junk base map', () => {
    expect(Object.keys(mergeSlotEntry(null, '11:00', { accomplished: 'x' }))).toEqual(['11:00']);
    expect(Object.keys(mergeSlotEntry('junk', '11:00', { accomplished: 'x' }))).toEqual(['11:00']);
  });
});

describe('summariseForAccomplishments', () => {
  test('carries the LATEST filed slot into the legacy column', () => {
    // The CSV export, the DTR merge and the legacy admin screen all still read
    // `accomplishments`, so it must not be left blank.
    const value = summariseForAccomplishments(row({
      slotEntries: {
        '11:00': entry({ accomplished: 'Morning work' }),
        '15:00': entry({ accomplished: 'Afternoon work' })
      }
    }));
    expect(value).toContain('Afternoon work');
    expect(value).not.toContain('Morning work');
  });

  test('joins the three boxes that are filled', () => {
    const value = summariseForAccomplishments(row({
      slotEntries: { '17:00': entry({ accomplished: 'A', inProgress: 'B', pending: 'C' }) }
    }));
    expect(value).toBe('A\nB\nC');
  });

  test('skips blank boxes', () => {
    const value = summariseForAccomplishments(row({
      slotEntries: { '17:00': entry({ accomplished: 'A', inProgress: '', pending: '' }) }
    }));
    expect(value).toBe('A');
  });

  test('is empty for a day with no filings', () => {
    expect(summariseForAccomplishments(row())).toBe('');
  });
});

describe('groupReportsByDay', () => {
  test('keeps one row per person per day', () => {
    const rows = groupReportsByDay([
      row({ id: 'a', userId: 'u1', reportDate: '2026-10-13', slotEntries: { '11:00': entry() } }),
      row({ id: 'b', userId: 'u1', reportDate: DAY, slotEntries: { '11:00': entry() } }),
      row({ id: 'c', userId: 'u2', reportDate: DAY, slotEntries: { '11:00': entry() } })
    ]);
    expect(rows.map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  test('sorts newest day first, then by person', () => {
    const rows = groupReportsByDay([
      row({ id: 'old', userId: 'u1', reportDate: '2026-10-01', slotEntries: { '11:00': entry() } }),
      row({ id: 'new', userId: 'u9', reportDate: '2026-10-20', slotEntries: { '11:00': entry() } }),
      row({ id: 'mid', userId: 'u1', reportDate: DAY, slotEntries: { '11:00': entry() } })
    ]);
    expect(rows.map((r) => r.id)).toEqual(['new', 'mid', 'old']);
  });

  test('DROPS a day with nothing filed', () => {
    expect(groupReportsByDay([row({ slotEntries: {} })])).toEqual([]);
    // A slot present but every box blank is not a filing either.
    const blank = { accomplished: '', inProgress: '', pending: '', submittedAt: 'T' };
    expect(groupReportsByDay([row({ slotEntries: { '11:00': blank } })])).toEqual([]);
  });

  test('KEEPS a day whose 5 PM filing is missing, so the gap is visible', () => {
    const rows = groupReportsByDay([
      row({ slotEntries: { '11:00': entry(), '15:00': entry() } })
    ]);
    expect(rows).toHaveLength(1);
    expect(dayHasSummary(rows[0])).toBe(false);
  });

  test('prefers the row that carries the 5 PM filing when a day has two', () => {
    const rows = groupReportsByDay([
      row({ id: 'legacy', slotEntries: { '11:00': entry() } }),
      row({ id: 'full', slotEntries: { '17:00': entry() } })
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('full');
  });

  test('keeps the first row when neither carries a 5 PM filing', () => {
    const rows = groupReportsByDay([
      row({ id: 'first', slotEntries: { '11:00': entry() } }),
      row({ id: 'second', slotEntries: { '15:00': entry() } })
    ]);
    expect(rows[0].id).toBe('first');
  });

  test('skips rows with no user or no day', () => {
    expect(groupReportsByDay([
      row({ userId: '', slotEntries: { '11:00': entry() } }),
      row({ reportDate: '', slotEntries: { '11:00': entry() } })
    ])).toEqual([]);
  });

  test('is safe against null and non-array input', () => {
    expect(groupReportsByDay(null)).toEqual([]);
    expect(groupReportsByDay(undefined)).toEqual([]);
  });
});

/**
 * The admin screen approves a WHOLE day, once, and only after the 5 PM filing.
 * These two things are the contract behind that: what "ready" means, and what
 * the trainee is told about the outcome.
 */
describe('the day is approved as a whole, once the 5 PM report is in', () => {
  test('a day missing its 5 PM filing is not ready, even with the other two filed', () => {
    const partial = row({ slotEntries: { '11:00': entry(), '15:00': entry() } });
    expect(dayHasSummary(partial)).toBe(false);
    expect(dayHasAnyEntry(partial)).toBe(true); // filed - so it is listed, just not approvable
  });

  test('the 5 PM filing alone is what makes the day ready', () => {
    expect(dayHasSummary(row({ slotEntries: { '17:00': entry() } }))).toBe(true);
  });

  test('an empty 5 PM slot is a form that was opened, not a filing', () => {
    const openedThenClosed = row({
      slotEntries: { '17:00': { accomplished: '', inProgress: '', pending: '' } }
    });
    expect(dayHasSummary(openedThenClosed)).toBe(false);
  });
});

describe('reviewStateOf', () => {
  test('reports approval, with the mentor note when there is one', () => {
    const state = reviewStateOf(row({ status: 'APPROVED', adminNote: 'Good work.' }));
    expect(state).toEqual({ tone: 'approved', label: 'Approved', note: 'Good work.' });
  });

  test('treats a returned day as returned, not approved', () => {
    const state = reviewStateOf(row({ status: 'REJECTED', adminNote: 'Add the times.' }));
    expect(state.tone).toBe('returned');
    expect(state.note).toBe('Add the times.');
  });

  test('normalises the casing and spacing Postgres may hand back', () => {
    expect(reviewStateOf(row({ status: 'approved' })).tone).toBe('approved');
    expect(reviewStateOf(row({ status: ' Approved ' })).tone).toBe('approved');
    expect(reviewStateOf(row({ status: 'Reviewed' })).tone).toBe('approved');
  });

  test('"under review" is not yet a decision, so it stays silent', () => {
    expect(reviewStateOf(row({ status: 'Under-Review' }))).toBeNull();
  });

  test('a day nobody has looked at reports nothing, so it cannot read as approved', () => {
    expect(reviewStateOf(row({ status: 'PENDING' }))).toBeNull();
    expect(reviewStateOf(row({}))).toBeNull();
    expect(reviewStateOf(null)).toBeNull();
  });

  test('survives the snake_case spelling of the note column', () => {
    expect(reviewStateOf(row({ status: 'APPROVED', admin_note: 'From SQL.' })).note)
      .toBe('From SQL.');
  });
});

