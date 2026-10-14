import { buildDtrHtml, summariseDtr } from './dtrDocument';
import { HYT_LOGO_DATA_URI } from '../assets/hytLogoDataUri';

/**
 * The inlined logo is ~93 KB of base64, and base64 uses the full A–Za–z0–9+/ set
 * — so the literal substring "NaN" DOES occur inside it by chance.  A naive
 * `expect(html).not.toContain('NaN')` therefore fails on a perfectly correct
 * document.  Every "no NaN on the sheet" assertion below goes through this
 * helper, which looks at the document with the logo stripped out.
 */
const withoutLogo = (html) => html.replace(HYT_LOGO_DATA_URI, '[LOGO]');

const dtrRow = (over = {}) => ({
  id: 'a1',
  userId: 'u1',
  date: '2026-09-08',
  timeIn: '2026-09-08T08:00:00+08:00',
  timeOut: '2026-09-08T17:00:00+08:00',
  renderedHours: 8,
  description: 'Filed documents',
  ...over
});

// Carries the fields the sheet is NOT supposed to print (contact number, year
// level, degree program) so the "does not print" tests below have something to
// fail on if those rows ever creep back in.
const person = {
  id: 'u1',
  fullName: 'Juan Dela Cruz',
  email: 'juan@example.com',
  school: 'Quezon City University',
  course: 'BS Information Technology',
  yearLevel: '4th Year',
  contactNumber: '0917 000 0000',
  requiredHours: 486
};

describe('summariseDtr', () => {
  test('totals hours and counts distinct rendered days', () => {
    const summary = summariseDtr([
      dtrRow({ date: '2026-09-08' }),
      dtrRow({ date: '2026-09-09', renderedHours: 7.5 })
    ]);
    expect(summary.totalHoursRounded).toBe(15.5);
    expect(summary.daysRendered).toBe(2);
  });

  test('does NOT count a day whose hours are zero', () => {
    // An abandoned clock-in: a date exists but nothing was rendered.  Counting
    // it would overstate the trainee's progress on a document they sign.
    const summary = summariseDtr([
      dtrRow({ date: '2026-09-08', renderedHours: 8 }),
      dtrRow({ id: 'a2', date: '2026-09-09', renderedHours: 0 })
    ]);
    expect(summary.daysRendered).toBe(1);
    expect(summary.totalHoursRounded).toBe(8);
  });

  test('rounds float drift so 0.1+0.2 does not print as 0.30000000000000004', () => {
    const summary = summariseDtr([
      dtrRow({ date: '2026-09-08', renderedHours: 0.1 }),
      dtrRow({ id: 'a2', date: '2026-09-09', renderedHours: 0.2 })
    ]);
    expect(summary.totalHoursRounded).toBe(0.3);
    expect(summary.totalHoursRounded.toFixed(2)).toBe('0.30');
  });

  test('reports the first and last rendered day', () => {
    const summary = summariseDtr([
      dtrRow({ date: '2026-09-10' }),
      dtrRow({ id: 'a2', date: '2026-09-08' }),
      dtrRow({ id: 'a3', date: '2026-09-15' })
    ]);
    expect(summary.firstDay).toBe('2026-09-08');
    expect(summary.lastDay).toBe('2026-09-15');
  });

  test('treats one calendar day as one day even across two rows', () => {
    const summary = summariseDtr([
      dtrRow({ date: '2026-09-08', renderedHours: 4 }),
      dtrRow({ id: 'a2', date: '2026-09-08', renderedHours: 4 })
    ]);
    expect(summary.daysRendered).toBe(1);
    expect(summary.totalHoursRounded).toBe(8);
  });

  test('is safe against empty and non-array input', () => {
    expect(summariseDtr([]).daysRendered).toBe(0);
    expect(summariseDtr(null).totalHoursRounded).toBe(0);
  });

  test('lists every day on the sheet, including zero-hour ones', () => {
    // A day with a clock-in and no clock-out still occupies a row, so the
    // "period covered" line has to span it or the header contradicts the body.
    const summary = summariseDtr([
      dtrRow({ date: '2026-09-23', renderedHours: 0, timeOut: null }),
      dtrRow({ id: 'a2', date: '2026-09-30', renderedHours: 8 })
    ]);
    expect(summary.daysListed).toBe(2);
    expect(summary.firstListedDay).toBe('2026-09-23');
    expect(summary.lastListedDay).toBe('2026-09-30');
    // The rendered-day metric is unchanged: only one day carries hours.
    expect(summary.daysRendered).toBe(1);
  });
});

describe('buildDtrHtml', () => {
  test('produces a complete standalone HTML document', () => {
    const html = buildDtrHtml({ user: person, rows: [dtrRow()], requiredHours: 486 });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('</html>');
  });

  test('INLINES the logo as a data URI, never a /static path', () => {
    // The regression this guards: an asset import resolves against the print
    // iframe's own document, so the logo silently fails to render when printed.
    const html = buildDtrHtml({ user: person, rows: [dtrRow()] });
    expect(html).toContain(HYT_LOGO_DATA_URI);
    expect(html).toContain('data:image/png;base64,iVBOR');
    expect(html).not.toContain('/static/media');
  });

  test('sizes the logo by width so its 1024x439 ratio is preserved', () => {
    // The regression this guards: the logo is a wide banner.  Pinning it to a
    // square box letterboxes it into a thin strip that reads as a print fault.
    const html = buildDtrHtml({ user: person, rows: [dtrRow()] });
    const rule = /\.head img \{[^}]*\}/.exec(html);
    expect(rule).toBeTruthy();
    expect(rule[0]).toContain('height: auto');
    expect(rule[0]).toContain('width: 118px');
    expect(html).not.toContain('height: 62px');
  });

  test('repeats the table header on every printed page', () => {
    const html = buildDtrHtml({ user: person, rows: [dtrRow()] });
    expect(html).toContain('display: table-header-group');
  });

  test('keeps a day row from splitting across a page break', () => {
    const html = buildDtrHtml({ user: person, rows: [dtrRow()] });
    expect(html).toContain('page-break-inside: avoid');
  });

  test('uses A4 portrait with real margins', () => {
    const html = buildDtrHtml({ user: person, rows: [dtrRow()] });
    expect(html).toContain('size: A4 portrait');
    expect(html).toContain('margin: 12mm');
  });

  test('prints the trainee header information', () => {
    const html = buildDtrHtml({ user: person, rows: [dtrRow()], requiredHours: 486 });
    expect(html).toContain('Juan Dela Cruz');
    expect(html).toContain('juan@example.com');
    expect(html).toContain('Quezon City University');
    expect(html).toContain('486 hours');
  });

  test('prints the building / office column instead of the task list', () => {
    // The last column used to print the day's daily-report text.  The office
    // that signs the DTR needs to know WHERE the trainee was stationed, so the
    // column is now the OJT posting's location, repeated on every line.
    const html = buildDtrHtml({
      user: person,
      rows: [dtrRow()],
      workplace: 'HYT Foundation — HR Office, Quezon City'
    });
    expect(html).toContain('Building / Office');
    expect(html).toContain('HYT Foundation — HR Office, Quezon City');
    expect(html).not.toContain('Description of Tasks');
  });

  test('repeats the station on every line, not just the first', () => {
    const html = buildDtrHtml({
      user: person,
      rows: [dtrRow({ date: '2026-09-08' }), dtrRow({ id: 'a2', date: '2026-09-09' })],
      workplace: 'Main Office'
    });
    expect(html.match(/Main Office/g)).toHaveLength(2);
  });

  test('never reproduces the daily-report text on the printed sheet', () => {
    // The reports themselves are untouched — they still live in the database
    // and in the CSV export.  They are simply not printed here.
    const html = buildDtrHtml({
      user: person,
      rows: [dtrRow({ description: 'Filed documents' })]
    });
    expect(html).not.toContain('Filed documents');
  });

  test('prints a blank station cell, never "undefined", when the OJT is unknown', () => {
    const html = buildDtrHtml({ user: person, rows: [dtrRow()] });
    const sheet = withoutLogo(html);
    expect(sheet).toContain('Building / Office');
    expect(sheet).not.toContain('undefined');
  });

  test('does NOT print the contact number, year level or degree program', () => {
    const html = buildDtrHtml({ user: person, rows: [dtrRow()], requiredHours: 486 });
    expect(html).not.toContain('0917 000 0000');
    expect(html).not.toContain('4th Year');
    expect(html).not.toContain('BS Information Technology');
    expect(html).not.toContain('Contact Number');
    expect(html).not.toContain('Year &');
    expect(html).not.toContain('Degree Program');
  });

  test('never prints a double-escaped label', () => {
    // The regression this guards: passing an already-escaped label such as
    // 'Year &amp; Degree Program' through escapeHtml() prints a literal
    // "&amp;" on the sheet.  No field of this trainee contains an "&", so the
    // document must contain no entity at all apart from the nbsp separator.
    const html = buildDtrHtml({ user: person, rows: [dtrRow()], requiredHours: 486 });
    expect(html).not.toContain('&amp;');
  });

  test('spells the weekday out correctly', () => {
    // 2026-09-08 is a Tuesday.  Parsed via the date PARTS on purpose: a
    // `new Date('2026-09-08')` is UTC midnight and prints Monday in GMT+8.
    const html = buildDtrHtml({ user: person, rows: [dtrRow({ date: '2026-09-08' })] });
    expect(html).toContain('Tuesday');
  });

  test('totals the rendered hours in the table footer', () => {
    const html = buildDtrHtml({
      user: person,
      rows: [dtrRow({ renderedHours: 8 }), dtrRow({ id: 'a2', date: '2026-09-09', renderedHours: 7.5 })],
      requiredHours: 486
    });
    expect(html).toContain('TOTAL HOURS RENDERED');
    expect(html).toContain('15.50');
    expect(html).toContain('2 day(s)');
  });

  test('does NOT print the old summary stat cards', () => {
    const html = buildDtrHtml({ user: person, rows: [dtrRow()], requiredHours: 486 });
    expect(html).not.toContain('Remaining Hours');
    expect(html).not.toContain('REMAINING HOURS');
    expect(html).not.toContain('class="totals"');
    expect(html).not.toContain('total-box');
  });

  test('spans the period over every listed day, not just the ones with hours', () => {
    // The bug this guards: the header said "No rendered days yet" while the
    // body printed a row for 2026-09-23.
    const html = buildDtrHtml({
      user: person,
      rows: [dtrRow({ date: '2026-09-23', renderedHours: 0, timeOut: null })]
    });
    expect(html).toContain('September 23, 2026');
    expect(html).not.toContain('No rendered days yet');
  });

  test('collapses a single-day period to one date instead of a range', () => {
    const html = buildDtrHtml({ user: person, rows: [dtrRow({ date: '2026-09-23' })] });
    expect(html).toContain('September 23, 2026');
    expect(html).not.toContain('September 23, 2026 — September 23, 2026');
  });

  test('shows a range when the listed days span more than one day', () => {
    const html = buildDtrHtml({
      user: person,
      rows: [dtrRow({ date: '2026-09-08' }), dtrRow({ id: 'a2', date: '2026-09-15' })]
    });
    expect(html).toContain('September 8, 2026 — September 15, 2026');
  });

  test('always prints both signature lines, even unnamed', () => {
    const html = buildDtrHtml({ user: person, rows: [dtrRow()] });
    expect(html).toContain('Mentor / Supervisor');
    expect(html).toContain('HR Representative');
  });

  test('prints the names it is given above the signature lines', () => {
    const html = buildDtrHtml({
      user: person, rows: [dtrRow()], mentorName: 'Ms. Reyes', hrName: ''
    });
    expect(html).toContain('Ms. Reyes');
  });

  test('ESCAPES user data so a stray angle bracket cannot break the document', () => {
    const html = buildDtrHtml({
      user: { ...person, fullName: '<script>alert(1)</script>', school: 'A & B "Institute"' },
      rows: [dtrRow()],
      workplace: 'used <div> tags & "quotes"'
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('A &amp; B &quot;Institute&quot;');
    expect(html).toContain('used &lt;div&gt; tags &amp; &quot;quotes&quot;');
  });

  test('handles a trainee with no attendance rows at all', () => {
    const html = buildDtrHtml({ user: person, rows: [] });
    expect(html).toContain('No attendance records');
    expect(withoutLogo(html)).not.toContain('NaN');
    expect(html).toContain('0.00');
  });

  test('still prints a row whose time-out is missing (an incomplete day)', () => {
    const html = buildDtrHtml({
      user: person,
      rows: [dtrRow({ timeOut: null, renderedHours: 0 })]
    });
    expect(html).toContain('September 8, 2026');
    // The whole point of the sheet is to expose the incomplete day.
    expect(html).not.toContain('1970');
  });

  test('defaults a missing trainee without throwing', () => {
    const html = buildDtrHtml({ rows: [dtrRow()] });
    expect(html).toContain('HYT Foundation');
    expect(html).not.toContain('undefined');
  });

  test('reads snake_case rows straight off the database', () => {
    const html = buildDtrHtml({
      user: person,
      rows: [{ user_id: 'u1', date: '2026-09-08', time_in: '2026-09-08T07:30:00+08:00', rendered_hours: 8 }]
    });
    expect(html).toContain('07:30');
  });

  test('reads snake_case trainee fields straight off the database', () => {
    const html = buildDtrHtml({
      user: { id: 'u1', full_name: 'Maria Santos', school: 'PUP', required_hours: 300 },
      rows: [dtrRow()]
    });
    expect(html).toContain('Maria Santos');
    expect(html).toContain('PUP');
    expect(html).toContain('300 hours');
  });

  test('never leaks "undefined" or "NaN" into the printed sheet', () => {
    const html = buildDtrHtml({
      user: { id: 'u1' },
      rows: [dtrRow({ renderedHours: undefined, timeOut: undefined })]
    });
    const sheet = withoutLogo(html);
    expect(sheet).not.toContain('undefined');
    expect(sheet).not.toContain('NaN');
  });

  test('prints a dash rather than a blank when the requirement is unknown', () => {
    const html = buildDtrHtml({ user: { id: 'u1' }, rows: [dtrRow()] });
    const sheet = withoutLogo(html);
    expect(sheet).not.toContain('NaN');
    expect(sheet).not.toContain('Infinity');
    expect(sheet).toContain('—');
  });
});
