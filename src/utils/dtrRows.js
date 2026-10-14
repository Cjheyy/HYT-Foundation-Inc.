/**
 * DTR row building — the JOIN between attendance and daily reports.
 *
 * The paper/Sheet DTR has six columns:
 *   Date · Time In · Time Out · Hours Rendered · Building / Office · Link
 *
 * The first four live in `attendance_logs`.  The station lives on the OJT
 * posting and is resolved per person by `resolveWorkplace()` below.  The
 * trainee's own daily reports are still merged in (`description`), because the
 * CSV export keeps them — they are simply not reproduced on the printed sheet,
 * which prints the station instead.
 *
 * The first four are keyed by (user_id, date) and the reports by the same key,
 * so producing one DTR line per day is a merge, not a query.
 *
 * This is a pure function so the merge can be tested without a database — and
 * because the "same day, same person" key is exactly the kind of thing that is
 * easy to get subtly wrong (`2026-09-08` vs `2026-09-08T00:00:00+08:00` are the
 * same day in Manila but different strings).
 */

/** Local YYYY-MM-DD for a date-ish value; '' when missing/unparseable. */
function dayKey(value) {
  if (value === null || value === undefined || value === '') return '';
  // A `date` column comes back as '2026-09-08' already.  Taking the first 10
  // chars avoids `new Date('2026-09-08')` being parsed as UTC midnight, which
  // would then shift the day backwards in GMT+8.
  if (typeof value === 'string') {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
    if (match) return match[1];
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** The owning user id off a row, whichever casing the service emitted. */
export function rowUserId(row) {
  return row?.userId || row?.user_id || row?.studentId || row?.student_id || null;
}

/**
 * Index daily reports by `${userId}|${dayKey}` so the merge is O(n) rather than
 * O(n·m).  When a person somehow has two reports for one day, the LAST one
 * wins — matching `getDailyReports()`, which orders by `created_at desc`, so
 * the newest report is the one a human would consider current.
 */
export function indexDailyReports(reports) {
  const map = new Map();
  (Array.isArray(reports) ? reports : []).forEach((report) => {
    const userId = rowUserId(report);
    const date = dayKey(report?.reportDate ?? report?.report_date ?? report?.date);
    if (!userId || !date) return;
    map.set(`${userId}|${date}`, report);
  });
  return map;
}

/** The description text off a report row, tolerant of the several aliases. */
export function reportDescription(report) {
  if (!report) return '';
  return report.accomplishments
    ?? report.tasksCompleted
    ?? report.tasks_completed
    ?? report.notes
    ?? '';
}

/**
 * The link column is filled from `report.accomplishmentLink` when a future
 * migration adds it.  Today no such column exists on `daily_reports` (verified
 * against the live project: `42703 column does not exist`), so this resolves to
 * '' — which is what the Sheet shows anyway, since the column is a place to
 * paste a Drive URL by hand.
 */
export function reportLink(report) {
  if (!report) return '';
  return report.accomplishmentLink
    ?? report.accomplishment_link
    ?? report.reportLink
    ?? report.report_link
    ?? '';
}

/**
 * The trainee's own note off a MANUAL attendance row.
 *
 * `request_manual_attendance()` writes `admin_note = 'MANUAL — <note>'`, or the
 * bare string `'MANUAL'` when no note was given, so the tag and its separator
 * have to come off before the text can be printed as prose on the sheet.
 *
 * Only MANUAL rows are read.  On any other row `admin_note` is an
 * administrator's internal remark, and an internal remark does not belong on a
 * document the trainee signs.
 */
export function attendanceNote(row) {
  const raw = String(row?.adminNote ?? row?.admin_note ?? '').trim();
  if (!raw) return '';

  const tagged = raw.toUpperCase().startsWith('MANUAL');
  const status = String(row?.status ?? '').trim().toUpperCase();
  if (status !== 'MANUAL' && !tagged) return '';

  // A MANUAL row whose note carries no tag is already the note itself.
  if (!tagged) return raw;

  // Strip the tag, then the em/en dash or hyphen the RPC wrote after it.  Only
  // the LEADING separator is removed, so a note like "Day 1 - orientation"
  // keeps its own hyphen.
  return raw.slice('MANUAL'.length).replace(/^[\s—–-]+/, '').trim();
}

/**
 * Which building / office a trainee is stationed in — the value printed in the
 * DTR's "Building / Office" column.
 *
 * The chain is
 *   `attendance.user_id` → `ojt_records.student_id`
 *                        → `ojt_records.opportunity_id`
 *                        → `opportunities.location`
 * because the location belongs to the POSTING the trainee applied to, not to
 * the attendance row.  The DTR is per-person, so this resolves once and the
 * same value prints on every line.
 *
 * `ojt_records.workplace` is the fallback: the column exists and carries the
 * same idea, so a record created before the posting had a location still
 * prints something rather than a blank.  A record that matches nothing — or a
 * trainee with no OJT record at all — resolves to `''`, and the sheet prints
 * its dash.
 */
export function resolveWorkplace(ojtRecords, opportunities, userId) {
  if (!userId) return '';

  const records = Array.isArray(ojtRecords) ? ojtRecords : [];
  const postings = Array.isArray(opportunities) ? opportunities : [];

  // `getOjtRecords()` orders by `created_at desc`, so `find` yields the newest
  // record — and a trainee is only allowed one active OJT anyway.
  const record = records.find((item) => (item?.studentId || item?.student_id) === userId);
  if (!record) return '';

  const opportunityId = record.opportunityId || record.opportunity_id || '';
  const posting = opportunityId ? postings.find((item) => item?.id === opportunityId) : null;

  return String(posting?.location || record.workplace || '').trim();
}

/**
 * Merge attendance rows with their daily reports.
 *
 * Returns a NEW array of `{ ...attendanceRow, description, accomplishmentLink }`
 * sorted oldest-first, because a DTR is read top-to-bottom as a timeline and the
 * attendance service returns newest-first.
 *
 * Attendance is the spine: a day with a report but no attendance row is NOT
 * emitted, since a DTR line needs a time in/out to be worth anything.
 */
export function mergeDtrRows(attendanceRows, dailyReports) {
  const reports = indexDailyReports(dailyReports);
  return (Array.isArray(attendanceRows) ? attendanceRows : [])
    .map((row) => {
      const userId = rowUserId(row);
      const date = dayKey(row?.date);
      const report = reports.get(`${userId}|${date}`) || null;
      return {
        ...row,
        // A daily report is the richer, deliberate record and always wins.  A
        // backfilled day usually has none, so the trainee's own manual note
        // stands in — otherwise the Description column prints blank for every
        // day that was entered by hand, which is most of the sheet.
        description: reportDescription(report) || attendanceNote(row),
        accomplishmentLink: reportLink(report)
      };
    })
    .sort((a, b) => {
      const left = dayKey(a?.date);
      const right = dayKey(b?.date);
      if (left === right) return 0;
      return left < right ? -1 : 1;
    });
}

/**
 * Columns for the DTR CSV, matching the Sheet's header order exactly:
 *   Date, TIme In, Time Out, Hours Rendered,
 *   Description of Tasks Done / In-Progress, Accomplishment Report Link
 *
 * `timeIn`/`timeOut` may be a full timestamp or a `time` value; `formatTimeOnly`
 * handles both.  `renderedHours` is NUMERIC(8,4) in the DB, so it is trimmed to
 * 2 decimals for the Sheet — 8.0000 reads as noise on paper.
 */
export function dtrColumns(formatDateOnly, formatTimeOnly) {
  return [
    { key: 'date', label: 'Date', value: (row) => formatDateOnly(row?.date) },
    { key: 'timeIn', label: 'Time In', value: (row) => formatTimeOnly(row?.timeIn ?? row?.time_in) },
    { key: 'timeOut', label: 'Time Out', value: (row) => formatTimeOnly(row?.timeOut ?? row?.time_out) },
    { key: 'renderedHours', label: 'Hours Rendered',
      value: (row) => {
        const hours = Number(row?.renderedHours ?? row?.rendered_hours ?? 0);
        if (!Number.isFinite(hours)) return '';
        // Trim '8.0000' -> '8.00'; zero-with-no-times means "no hours yet".
        return hours.toFixed(2);
      } },
    { key: 'description', label: 'Description of Tasks Done / In-Progress',
      value: (row) => row?.description ?? '' },
    { key: 'accomplishmentLink', label: 'Accomplishment Report Link',
      value: (row) => row?.accomplishmentLink ?? '' }
  ];
}

const dtrRows = {
  mergeDtrRows, indexDailyReports, dtrColumns, rowUserId, attendanceNote, resolveWorkplace
};

export default dtrRows;
