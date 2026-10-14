import {
  mergeDtrRows,
  indexDailyReports,
  dtrColumns,
  rowUserId,
  reportDescription,
  reportLink,
  attendanceNote,
  resolveWorkplace
} from './dtrRows';
/**
 * `dtrColumns()` takes its date/time formatters as ARGUMENTS, so `dtrRows.js`
 * itself has no import of its own.  The CSV export module (`utils/csvExport.js`)
 * is not part of this build, so the two formatters it used to supply live here
 * instead — same behaviour, kept local so this DTR test stays self-contained.
 */
function formatDateOnly(value) {
  // `new Date(null)` is the epoch (1970-01-01), not an invalid date — null
  // coerces to 0, and 0 is a perfectly good timestamp.  So a missing date would
  // render as "1970-01-01" instead of an empty cell.  Reject empty input first.
  if (value === null || value === undefined || value === '') return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** `HH:mm` (24-hour) from local clock parts. */
function formatTimeOnly(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

const attendance = (over = {}) => ({
  id: 'a1',
  userId: 'u1',
  date: '2026-09-08',
  timeIn: '2026-09-08T08:00:00+08:00',
  timeOut: '2026-09-08T17:00:00+08:00',
  renderedHours: 8,
  status: 'APPROVED',
  ...over
});

const report = (over = {}) => ({
  id: 'r1',
  userId: 'u1',
  reportDate: '2026-09-08',
  accomplishments: 'Filed documents',
  status: 'APPROVED',
  ...over
});

describe('rowUserId', () => {
  test('reads camelCase, snake_case and the student alias', () => {
    expect(rowUserId({ userId: 'a' })).toBe('a');
    expect(rowUserId({ user_id: 'b' })).toBe('b');
    expect(rowUserId({ studentId: 'c' })).toBe('c');
    expect(rowUserId({ student_id: 'd' })).toBe('d');
  });

  test('returns null for a row with no owner', () => {
    expect(rowUserId({})).toBeNull();
    expect(rowUserId(null)).toBeNull();
  });
});

describe('indexDailyReports', () => {
  test('keys on userId + calendar day', () => {
    const map = indexDailyReports([report()]);
    expect(map.get('u1|2026-09-08')).toBeTruthy();
  });

  test('treats a full ISO timestamp and a plain date as the same day', () => {
    // The trap: new Date('2026-09-08T00:00:00+08:00') is 2026-09-07T16:00Z.
    // Keying on the parsed Date in local time would still be the 8th, but
    // keying on toISOString() would give the 7th and silently lose the join.
    const map = indexDailyReports([
      report({ reportDate: '2026-09-08T00:00:00+08:00' })
    ]);
    expect(map.has('u1|2026-09-08')).toBe(true);
  });

  test('a later report for the same day overwrites the earlier one', () => {
    const map = indexDailyReports([
      report({ id: 'old', accomplishments: 'first' }),
      report({ id: 'new', accomplishments: 'second' })
    ]);
    expect(map.get('u1|2026-09-08').accomplishments).toBe('second');
  });

  test('skips rows missing a user or a date', () => {
    const map = indexDailyReports([
      report({ userId: null }),
      report({ reportDate: null }),
      report()
    ]);
    expect(map.size).toBe(1);
  });

  test('accepts the report_date / date aliases', () => {
    expect(indexDailyReports([report({ reportDate: undefined, report_date: '2026-09-09' })])
      .has('u1|2026-09-09')).toBe(true);
    expect(indexDailyReports([report({ reportDate: undefined, date: '2026-09-10' })])
      .has('u1|2026-09-10')).toBe(true);
  });

  test('is defensive about a non-array', () => {
    expect(indexDailyReports(null).size).toBe(0);
    expect(indexDailyReports(undefined).size).toBe(0);
  });
});

describe('mergeDtrRows', () => {
  test('attaches the matching description to the attendance row', () => {
    const [row] = mergeDtrRows([attendance()], [report()]);
    expect(row.description).toBe('Filed documents');
    expect(row.id).toBe('a1');
  });

  test('leaves the description empty when no report exists for that day', () => {
    const [row] = mergeDtrRows([attendance()], [report({ reportDate: '2026-09-09' })]);
    expect(row.description).toBe('');
  });

  test('does not cross-link two people on the same date', () => {
    const rows = mergeDtrRows(
      [attendance({ id: 'a-u1', userId: 'u1' }), attendance({ id: 'a-u2', userId: 'u2' })],
      [report({ userId: 'u2', accomplishments: "u2's work" })]
    );
    const u1 = rows.find((r) => r.id === 'a-u1');
    const u2 = rows.find((r) => r.id === 'a-u2');
    expect(u1.description).toBe('');
    expect(u2.description).toBe("u2's work");
  });

  test('sorts oldest first, because a DTR reads as a timeline', () => {
    const rows = mergeDtrRows([
      attendance({ id: 'later', date: '2026-09-10' }),
      attendance({ id: 'earlier', date: '2026-09-08' })
    ], []);
    expect(rows.map((r) => r.id)).toEqual(['earlier', 'later']);
  });

  test('never invents a row for a report with no attendance', () => {
    const rows = mergeDtrRows([], [report()]);
    expect(rows).toEqual([]);
  });

  test('returns [] for a non-array, rather than throwing', () => {
    expect(mergeDtrRows(null, null)).toEqual([]);
  });

  test('does not mutate the attendance input', () => {
    const input = [attendance()];
    mergeDtrRows(input, [report()]);
    expect(input[0].description).toBeUndefined();
  });

  test('fills the link only when a report actually carries one', () => {
    expect(mergeDtrRows([attendance()], [report()])[0].accomplishmentLink).toBe('');
    expect(mergeDtrRows([attendance()], [report({ accomplishmentLink: 'https://drive/x' })])[0]
      .accomplishmentLink).toBe('https://drive/x');
  });
});

describe('reportDescription / reportLink', () => {
  test('falls back through the description aliases', () => {
    expect(reportDescription({ tasksCompleted: 'x' })).toBe('x');
    expect(reportDescription({ notes: 'y' })).toBe('y');
    expect(reportDescription(null)).toBe('');
  });

  test('link aliases resolve, and a missing report is empty', () => {
    expect(reportLink({ report_link: 'z' })).toBe('z');
    expect(reportLink(null)).toBe('');
  });
});

describe('attendanceNote', () => {
  test('strips the MANUAL tag and its separator', () => {
    // This is the exact string request_manual_attendance() writes.
    expect(attendanceNote({ status: 'MANUAL', adminNote: 'MANUAL — Day 1 - orientation' }))
      .toBe('Day 1 - orientation');
  });

  test('keeps a hyphen inside the note itself', () => {
    expect(attendanceNote({ status: 'MANUAL', adminNote: 'MANUAL — Half-day - AM only' }))
      .toBe('Half-day - AM only');
  });

  test('a bare tag means the trainee left no note', () => {
    expect(attendanceNote({ status: 'MANUAL', adminNote: 'MANUAL' })).toBe('');
    expect(attendanceNote({ status: 'MANUAL', adminNote: 'MANUAL — ' })).toBe('');
  });

  test('reads the snake_case column straight off the database', () => {
    expect(attendanceNote({ status: 'MANUAL', admin_note: 'MANUAL — Encoding' })).toBe('Encoding');
  });

  test('ignores an administrator note on a non-manual row', () => {
    // An internal remark must not end up on a document the trainee signs.
    expect(attendanceNote({ status: 'APPROVED', adminNote: 'Late again, warned verbally' })).toBe('');
    expect(attendanceNote({ status: 'PENDING', adminNote: 'Needs follow-up' })).toBe('');
  });

  test('a manual row whose note carries no tag is returned as-is', () => {
    expect(attendanceNote({ status: 'MANUAL', adminNote: 'Filed documents' })).toBe('Filed documents');
  });

  test('is safe on an empty or missing row', () => {
    expect(attendanceNote(null)).toBe('');
    expect(attendanceNote({})).toBe('');
    expect(attendanceNote({ status: 'MANUAL', adminNote: null })).toBe('');
  });
});

describe('mergeDtrRows — description fallback', () => {
  test('uses the manual note when there is no daily report', () => {
    // Without this the Description column printed blank for every backfilled
    // day, which is most of a hand-entered DTR.
    const [row] = mergeDtrRows(
      [attendance({ status: 'MANUAL', adminNote: 'MANUAL — Day 1 - orientation' })],
      []
    );
    expect(row.description).toBe('Day 1 - orientation');
  });

  test('a daily report still wins over the manual note', () => {
    const [row] = mergeDtrRows(
      [attendance({ status: 'MANUAL', adminNote: 'MANUAL — short note' })],
      [report({ accomplishments: 'The full daily report' })]
    );
    expect(row.description).toBe('The full daily report');
  });

  test('an ordinary approved row is unaffected', () => {
    const [row] = mergeDtrRows([attendance()], []);
    expect(row.description).toBe('');
  });
});

describe('dtrColumns', () => {
  const columns = dtrColumns(formatDateOnly, formatTimeOnly);

  test('header order matches the Google Sheet exactly', () => {
    expect(columns.map((c) => c.label)).toEqual([
      'Date',
      'Time In',
      'Time Out',
      'Hours Rendered',
      'Description of Tasks Done / In-Progress',
      'Accomplishment Report Link'
    ]);
  });

  test('renders a merged row in Sheet shape', () => {
    const [row] = mergeDtrRows([attendance()], [report()]);
    const values = columns.map((c) => (typeof c.value === 'function' ? c.value(row) : row[c.key]));
    expect(values).toEqual([
      '2026-09-08',
      '08:00',
      '17:00',
      '8.00',
      'Filed documents',
      ''
    ]);
  });

  test('trims NUMERIC(8,4) hours to two decimals', () => {
    const hoursCol = columns.find((c) => c.label === 'Hours Rendered');
    expect(hoursCol.value({ renderedHours: 8.25 })).toBe('8.25');
    expect(hoursCol.value({ renderedHours: 7.5 })).toBe('7.50');
  });

  test('a row with no times yet renders empty time cells, not 1970', () => {
    const [row] = mergeDtrRows([attendance({ timeIn: null, timeOut: null, renderedHours: 0 })], []);
    const values = columns.map((c) => c.value(row));
    expect(values[1]).toBe('');
    expect(values[2]).toBe('');
  });

  test('reads snake_case hours and times off a raw row', () => {
    const [row] = mergeDtrRows(
      [{ user_id: 'u1', date: '2026-09-08', time_in: '2026-09-08T09:15:00+08:00', rendered_hours: 3.5 }],
      []
    );
    const values = columns.map((c) => c.value(row));
    expect(values[1]).toBe('09:15');
    expect(values[3]).toBe('3.50');
  });
});

/**
 * The "Building / Office" column of the printed DTR.  The chain is
 *   user_id → ojt_records.student_id → ojt_records.opportunity_id
 *           → opportunities.location
 * so each test here walks one more link than the last.
 */
describe('resolveWorkplace', () => {
  const ojt = (over = {}) => ({
    id: 'o1', studentId: 'u1', opportunityId: 'p1', workplace: 'Legacy Site', ...over
  });
  const posting = (over = {}) => ({ id: 'p1', location: 'HR Office, Quezon City', ...over });

  test('walks attendance user → OJT record → posting → location', () => {
    expect(resolveWorkplace([ojt()], [posting()], 'u1')).toBe('HR Office, Quezon City');
  });

  test('reads snake_case rows straight off the database', () => {
    expect(resolveWorkplace(
      [{ id: 'o1', student_id: 'u1', opportunity_id: 'p1' }],
      [{ id: 'p1', location: 'Main Building' }],
      'u1'
    )).toBe('Main Building');
  });

  test('falls back to ojt_records.workplace when the posting has no location', () => {
    expect(resolveWorkplace([ojt()], [posting({ location: '' })], 'u1')).toBe('Legacy Site');
  });

  test('falls back to ojt_records.workplace when the posting is missing entirely', () => {
    expect(resolveWorkplace([ojt()], [], 'u1')).toBe('Legacy Site');
  });

  test('returns empty for a trainee with no OJT record', () => {
    expect(resolveWorkplace([ojt({ studentId: 'someone-else' })], [posting()], 'u1')).toBe('');
  });

  test('returns empty for a missing/blank user id', () => {
    expect(resolveWorkplace([ojt()], [posting()], '')).toBe('');
    expect(resolveWorkplace([ojt()], [posting()], null)).toBe('');
  });

  test('is safe against null and non-array input', () => {
    expect(resolveWorkplace(null, null, 'u1')).toBe('');
    expect(resolveWorkplace([ojt()], null, 'u1')).toBe('Legacy Site');
  });

  test('trims whitespace so a padded location cannot print as a blank-looking cell', () => {
    expect(resolveWorkplace([ojt()], [posting({ location: '  Annex B  ' })], 'u1')).toBe('Annex B');
  });

  test('never returns the string "undefined" when a record is malformed', () => {
    expect(resolveWorkplace([{ studentId: 'u1' }], [], 'u1')).toBe('');
    expect(resolveWorkplace([{ studentId: 'u1', opportunityId: null }], [posting()], 'u1')).toBe('');
  });
});
