/**
 * Build the printable DTR (Daily Time Record) summary for ONE trainee.
 *
 * Output is a complete standalone HTML document handed to
 * `printHtmlDocument()`, which renders it in an off-screen iframe and opens the
 * browser's print dialog.  There is no PDF library in this project, so
 * "Save as PDF" in that dialog is the honest path to a PDF.
 *
 * Design decisions worth stating, because each one is a thing that silently
 * breaks in print:
 *
 * 1. THE LOGO IS A DATA URI.  An asset import resolves to `/static/media/...`,
 *    which the iframe resolves against its OWN document rather than the app
 *    origin — a broken image, and it fails silently.  `HYT_LOGO_DATA_URI`
 *    inlines the bytes so there is no lookup at all.
 *
 *    The logo is 1024x439 — a wide banner, NOT a square.  It is sized by WIDTH
 *    with `height: auto` so the intrinsic ratio is preserved.  Pinning it to a
 *    square box letterboxes it into a thin strip across the middle of the box,
 *    which reads as a printing fault rather than a logo.
 *
 * 2. THE TABLE HEADER REPEATS.  `thead { display: table-header-group }` makes
 *    the browser re-draw the header on every printed page, so page 3 of a long
 *    DTR is still readable.  Without it the header prints once and every
 *    continuation page is a grid of unlabelled numbers.
 *
 * 3. ROWS DON'T SPLIT.  `tr { break-inside: avoid }` keeps one day's line
 *    together; a half-row across a page break is how dates get misread.
 *
 * 4. A4 PORTRAIT, REAL MARGINS.  `@page { size: A4 portrait; margin: 12mm }`
 *    so it files with the other HR paper instead of coming out US Letter.
 *
 * 5. EVERY USER VALUE IS ESCAPED.  Names, schools and the building/office line
 *    come from the database; an unescaped `<` would break the document.  Note
 *    that escaping runs on RAW text — passing an already-escaped label such as
 *    `'Year &amp; Degree'` would double-escape and print the literal `&amp;`.
 *
 * 6. ZERO-MINUTE DAYS ARE NOT COUNTED.  A row with times but no rendered hours
 *    (an abandoned clock-in) would otherwise inflate "days rendered".
 *
 * 7. THE PERIOD LINE SPANS THE LISTED DAYS, not the counted ones.  A day with a
 *    clock-in and no clock-out still occupies a table row, so deriving the
 *    period from hours-carrying days alone made the header contradict the body.
 *
 * 8. THE LAST COLUMN IS THE STATION, NOT THE TASK LIST.  It prints the trainee's
 *    building / office (`resolveWorkplace()` in dtrRows.js), resolved from the
 *    OJT posting's location.  The daily reports themselves are untouched — they
 *    are simply not reproduced on this sheet, because the office that signs the
 *    DTR cares where the trainee was stationed, not what they typed that day.
 */
import { HYT_BRANDING } from './helpers';
import { HYT_LOGO_DATA_URI } from '../assets/hytLogoDataUri';

/** Escape a value for HTML text/attribute context. */
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

/** `September 8, 2026` from a `YYYY-MM-DD` string, without timezone drift. */
function formatLongDate(value) {
  const iso = typeof value === 'string'
    ? (/^(\d{4}-\d{2}-\d{2})/.exec(value.trim()) || [])[1]
    : '';
  if (!iso) return String(value ?? '');
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

/** `HH:mm` from a timestamp or a bare time string; '' when unusable. */
function formatClock(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    const bare = /^(\d{1,2}):(\d{2})/.exec(value.trim());
    if (bare) return `${bare[1].padStart(2, '0')}:${bare[2]}`;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** `YYYY-MM-DD` in LOCAL time (never toISOString — that shifts the day back). */
function formatIsoDay(value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string') {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
    if (match) return match[1];
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Read the day key off a DTR row, tolerant of casing. */
function rowDay(row) {
  return formatIsoDay(row?.date ?? row?.reportDate ?? row?.report_date);
}

/**
 * Monday-first weekday label, e.g. `2026-09-08` -> `Tuesday`.
 *
 * Parsed from the parts, NOT `new Date('2026-09-08')` — that form is treated as
 * UTC midnight and lands on the previous day west of Greenwich, which would
 * print "Monday" for every Tuesday.
 */
function weekdayLabel(isoDay) {
  if (!isoDay) return '';
  const [year, month, day] = isoDay.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

/**
 * Total the hours on a set of DTR rows.
 *
 * Returns the hours, the count of days that actually carry hours, the local
 * dates so a caller can render a "period covered" line — and separately the
 * span of every day that appears on the sheet at all.
 */
export function summariseDtr(rows) {
  const list = Array.isArray(rows) ? rows : [];
  let totalHours = 0;
  const countedDays = [];
  const listedDays = [];

  list.forEach((row) => {
    const day = rowDay(row);
    // Every row occupies a line on the sheet, hours or not.
    if (day && !listedDays.includes(day)) listedDays.push(day);

    const hours = Number(row?.renderedHours ?? row?.rendered_hours ?? 0);
    if (!Number.isFinite(hours) || hours <= 0) return;
    totalHours += hours;
    if (day && !countedDays.includes(day)) countedDays.push(day);
  });

  countedDays.sort();
  listedDays.sort();

  return {
    totalHours,
    // NUMERIC(8,4) in the DB, and float addition drifts (0.1+0.2), so round to
    // 4dp before the caller formats it for paper.
    totalHoursRounded: Math.round(totalHours * 10000) / 10000,
    daysRendered: countedDays.length,
    firstDay: countedDays[0] || '',
    lastDay: countedDays[countedDays.length - 1] || '',
    dates: countedDays,
    daysListed: listedDays.length,
    firstListedDay: listedDays[0] || '',
    lastListedDay: listedDays[listedDays.length - 1] || ''
  };
}

/**
 * Build the full printable HTML for one trainee's DTR.
 *
 * @param {object} options
 * @param {object}  options.user        the trainee (fullName/email/school/...)
 * @param {Array}   options.rows        DTR rows from `mergeDtrRows()`
 * @param {number}  options.requiredHours  contractual hours, for the header
 * @param {string}  options.workplace   building/office, for the last column
 * @param {string}  options.mentorName  printed above the Mentor/Supervisor line
 * @param {string}  options.hrName      printed above the HR line (blank by design)
 * @param {Date}    options.generatedAt when the document was produced
 */
export function buildDtrHtml({
  user,
  rows,
  requiredHours,
  workplace = '',
  mentorName = '',
  hrName = '',
  generatedAt = new Date()
} = {}) {
  const person = user || {};
  const list = Array.isArray(rows) ? rows : [];
  const summary = summariseDtr(list);

  const required = Number(requiredHours ?? person.requiredHours ?? person.required_hours ?? 0);
  const safeRequired = Number.isFinite(required) && required > 0 ? required : 0;

  const fullName = person.fullName || person.full_name || '';
  const email = person.email || '';
  const school = person.school || '';

  // The span of the days actually printed on the sheet.
  const period = summary.firstListedDay
    ? (summary.firstListedDay === summary.lastListedDay
      ? formatLongDate(summary.firstListedDay)
      : `${formatLongDate(summary.firstListedDay)} — ${formatLongDate(summary.lastListedDay)}`)
    : 'No entries in this range';

  // The station is a property of the trainee, not of the day, so it is resolved
  // once and repeated on every line — the same way a real DTR repeats the
  // assignment down the sheet.
  const station = String(workplace ?? '').trim();

  // One table row per DTR row.  A row with no time-out is still printed: the
  // whole point of the sheet is to show which days are incomplete.
  const bodyRows = list.length
    ? list.map((row, index) => {
      const hours = Number(row?.renderedHours ?? row?.rendered_hours ?? 0);
      const hoursCell = Number.isFinite(hours) && hours > 0 ? hours.toFixed(2) : '';
      return `<tr>
        <td class="c">${index + 1}</td>
        <td>${escapeHtml(formatLongDate(rowDay(row)))}</td>
        <td class="c">${escapeHtml(weekdayLabel(rowDay(row)))}</td>
        <td class="c num">${escapeHtml(formatClock(row?.timeIn ?? row?.time_in))}</td>
        <td class="c num">${escapeHtml(formatClock(row?.timeOut ?? row?.time_out))}</td>
        <td class="c num">${escapeHtml(hoursCell)}</td>
        <td class="place">${escapeHtml(station)}</td>
      </tr>`;
    }).join('')
    : '<tr><td colspan="7" class="empty">No attendance records for this trainee yet.</td></tr>';

  const infoRow = (label, value) => (
    `<div class="info-pair"><span class="info-label">${escapeHtml(label)}</span>`
    + `<span class="info-value">${escapeHtml(value || '—')}</span></div>`
  );

  // The <th> widths below are measured, not guessed.  At 11px the longest date
  // ("September 23, 2026") is 98px and the longest weekday ("Wednesday") is
  // 57px; each column needs that plus 12px of padding and border, or the cell
  // wraps to a second line and the row heights go ragged.
  return `<!doctype html><html><head><meta charset="utf-8" />
<title>DTR — ${escapeHtml(fullName || 'Trainee')}</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }

  * { box-sizing: border-box; }

  html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  body {
    margin: 0;
    padding: 24px;
    background: #f1f2f4;
    color: #1f2937;
    font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
    font-size: 11px;
    line-height: 1.45;
  }

  .sheet {
    max-width: 800px;
    margin: 0 auto;
    background: #fff;
    padding: 30px 32px 34px;
    border-radius: 6px;
    box-shadow: 0 1px 6px rgba(15,23,42,.10);
  }

  /* ---- Letterhead ---------------------------------------------------- */
  .head {
    display: flex;
    align-items: center;
    gap: 16px;
    padding-bottom: 13px;
    border-bottom: 2.5px solid #D57156;
  }
  /* The logo is a 1024x439 banner.  Width-driven sizing keeps that ratio;
     a square box would letterbox it into a thin strip. */
  .head img { width: 118px; height: auto; flex-shrink: 0; display: block; }
  .head-text { flex: 1; min-width: 0; }
  .org { font-size: 17px; font-weight: 700; letter-spacing: .1px; margin: 0; color: #16202b; }
  .tagline { font-size: 10px; color: #6b7280; margin: 2px 0 0; }
  .doc-title {
    font-size: 12.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.6px;
    margin: 7px 0 0;
    color: #B8441F;
  }

  /* ---- Trainee info -------------------------------------------------- */
  .info { display: grid; grid-template-columns: 1fr 1fr; gap: 0 26px; margin: 16px 0 2px; }
  .info-pair {
    display: flex;
    gap: 8px;
    align-items: baseline;
    padding: 5px 0;
    border-bottom: 1px dotted #e2e5ea;
  }
  .info-label { color: #6b7280; min-width: 118px; flex-shrink: 0; }
  .info-value { font-weight: 600; min-width: 0; overflow-wrap: anywhere; }

  .period {
    margin: 12px 0 14px;
    padding: 7px 11px;
    background: #FDF3F0;
    border-left: 3px solid #D57156;
    border-radius: 0 3px 3px 0;
  }
  .period strong { color: #B8441F; }

  /* ---- Table --------------------------------------------------------- */
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  /* Repeat the header on every printed page — without this, page 2+ is
     unlabelled columns. */
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  th {
    background: #F4F5F7;
    border: 1px solid #cbd2da;
    padding: 7px 5px;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .5px;
    color: #46505c;
    text-align: center;
    vertical-align: middle;
  }
  td { border: 1px solid #e2e5ea; padding: 6px 5px; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #FAFBFC; }
  td.c { text-align: center; }
  td.num { font-variant-numeric: tabular-nums; }
  td.place { font-size: 10px; line-height: 1.4; color: #374151; overflow-wrap: anywhere; }
  td.empty { text-align: center; color: #6b7280; padding: 20px; font-style: italic; }
  tfoot td { background: #F4F5F7; font-weight: 700; border: 1px solid #cbd2da; }

  .cert-note { margin: 18px 0 0; font-size: 10px; line-height: 1.65; color: #374151; }

  /* ---- Signatures ---------------------------------------------------- */
  .signs { display: flex; gap: 48px; margin-top: 46px; }
  .sign { flex: 1; text-align: center; }
  .sign-space { height: 36px; }
  .sign-name {
    border-top: 1.4px solid #1f2937;
    padding-top: 6px;
    font-weight: 700;
    font-size: 11px;
    min-height: 15px;
  }
  .sign-title { font-size: 9.5px; color: #6b7280; margin-top: 2px; letter-spacing: .3px; }

  .foot {
    margin-top: 28px;
    padding-top: 8px;
    border-top: 1px solid #e2e5ea;
    font-size: 8.5px;
    color: #9ca3af;
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }

  /* ---- Print --------------------------------------------------------- */
  @media print {
    body { background: #fff; padding: 0; font-size: 10.5px; }
    .sheet { max-width: none; margin: 0; padding: 0; border-radius: 0; box-shadow: none; }
    .head img { width: 108px; }
    /* Keep the letterhead and the signature block off a page break of their own. */
    .head, .signs, .period { break-inside: avoid; page-break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="sheet">

  <div class="head">
    <img src="${HYT_LOGO_DATA_URI}" alt="${escapeHtml(HYT_BRANDING.organization)}" />
    <div class="head-text">
      <p class="org">${escapeHtml(HYT_BRANDING.organization)}</p>
      <p class="tagline">${escapeHtml(HYT_BRANDING.tagline)}</p>
      <p class="doc-title">Daily Time Record — OJT / Internship</p>
    </div>
  </div>

  <div class="info">
    ${infoRow('Full Name', fullName)}
    ${infoRow('Email', email)}
    ${infoRow('College / University', school)}
    ${infoRow('Required Hours', safeRequired > 0 ? `${safeRequired} hours` : '')}
  </div>

  <div class="period">
    <strong>Period covered:</strong> ${escapeHtml(period)}
    &nbsp;·&nbsp; <strong>Days rendered:</strong> ${summary.daysRendered}
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:24px">#</th>
        <th style="width:112px">Date</th>
        <th style="width:70px">Day</th>
        <th style="width:56px">Time In</th>
        <th style="width:62px">Time Out</th>
        <th style="width:48px">Hours</th>
        <th>Building / Office</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="5" style="text-align:right">TOTAL HOURS RENDERED</td>
        <td class="c num">${summary.totalHoursRounded > 0 ? summary.totalHoursRounded.toFixed(2) : '0.00'}</td>
        <td>${summary.daysRendered} day(s)</td>
      </tr>
    </tfoot>
  </table>

  <p class="cert-note">
    I certify that the entries above are a true record of the on-the-job training hours
    rendered by the trainee named herein, as verified against the attendance log of
    ${escapeHtml(HYT_BRANDING.organization)}.
  </p>

  <div class="signs">
    <div class="sign">
      <div class="sign-space"></div>
      <div class="sign-name">${escapeHtml(mentorName)}</div>
      <div class="sign-title">Mentor / Supervisor</div>
    </div>
    <div class="sign">
      <div class="sign-space"></div>
      <div class="sign-name">${escapeHtml(hrName)}</div>
      <div class="sign-title">HR Representative</div>
    </div>
  </div>

  <div class="foot">
    <span>Generated ${escapeHtml(generatedAt.toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }))}</span>
    <span>${escapeHtml(HYT_BRANDING.organization)} — Daily Time Record</span>
  </div>

</div>
</body></html>`;
}

const dtrDocument = { buildDtrHtml, summariseDtr };

export default dtrDocument;
