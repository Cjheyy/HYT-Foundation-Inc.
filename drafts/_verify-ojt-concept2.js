/**
 * Concept 02 — "Active Placement" card, end-to-end verification.
 *
 * The route cannot be reached without a session, so this stubs the Supabase
 * Auth + REST endpoints and seeds a non-expired session, exactly like
 * `_audit-portals.js`. Nothing is written to the database.
 *
 * Four fixture states are exercised, because the card has four shapes:
 *   placement — approved posting, no ojt_record yet  -> the branch that changed
 *   record    — an ojt_record exists                 -> the OTHER branch (regression)
 *   nohours   — required_hours = 0                   -> no rail, no calendar, ring "—"
 *   complete  — rendered = required                  -> completed copy + full rail
 *
 * Usage:
 *   node drafts/_verify-ojt-concept2.js [baseUrl]
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { contrastAudit } = require('./_contrast');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
/* react-scripts wipes build/ before rebuilding, which trips the sandbox's
   bulk-delete guard once the bundle has >50 files. Building into a fresh
   BUILD_PATH sidesteps the delete entirely — point the harness at it with
   BUILD_DIR. */
const BUILD = process.env.BUILD_DIR
  ? path.resolve(process.env.BUILD_DIR)
  : path.join(__dirname, '..', 'build');
const SHOTS = path.join(__dirname, '_shots-ojt-concept2');
const PORT = Number(process.env.PORT || 4391);
const RING_RADIUS = 52;
const RING_C = 2 * Math.PI * RING_RADIUS;

const results = [];
const record = (name, ok, detail) => {
  results.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) });
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail !== undefined ? '   [' + detail + ']' : ''));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ server */
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.map': 'application/json', '.txt': 'text/plain'
};

const startServer = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(BUILD, urlPath);
    // SPA fallback: anything that is not a real asset serves index.html.
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(BUILD, 'index.html');
    }
    fs.readFile(file, (err, body) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(body);
    });
  });
  server.listen(PORT, '127.0.0.1', () => resolve(server));
});

/* ---------------------------------------------------------------- fixtures */
const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const SUPABASE_URL = (env.match(/REACT_APP_SUPABASE_URL\s*=\s*(\S+)/) || [])[1];
const SUPABASE_HOST = new URL(SUPABASE_URL).hostname;
const STORAGE_KEY = `sb-${SUPABASE_HOST.split('.')[0]}-auth-token`;

const STUDENT_ID = '22222222-2222-4222-8222-222222222222';
const now = Date.now();
const iso = (offsetDays) => new Date(now + offsetDays * 86400000).toISOString();
const day = (offsetDays) => iso(offsetDays).slice(0, 10);

const buildSession = (profile) => ({
  access_token: 'stub-access-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(now / 1000) + 3600,
  refresh_token: 'stub-refresh-token',
  user: {
    id: profile.id, aud: 'authenticated', role: 'authenticated', email: profile.email,
    email_confirmed_at: iso(-60), phone: '', app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { full_name: profile.full_name }, identities: [], created_at: iso(-60), updated_at: iso(-1)
  }
});

const studentProfile = (overrides = {}) => ({
  id: STUDENT_ID, email: 'juan.santos@example.com', role: 'OJT/Intern',
  full_name: 'Juan Santos', first_name: 'Juan', last_name: 'Santos',
  account_type: 'ojt-student', application_status: 'APPROVED', is_active: true,
  school: 'University of the Philippines', course: 'BS Information Technology',
  required_hours: 80, rendered_hours: 32, created_at: iso(-40), ...overrides
});

const OPPORTUNITY = {
  id: 'o1', title: 'Backend Developer Intern', organization: 'Acme Software Corp',
  description: 'Work with the platform team on the internship tracking portal.',
  category: 'Technical Training', thrust: 'Experience', location: 'Makati City',
  status: 'PUBLISHED', slots: 5, slots_taken: 2,
  start_date: day(-5), end_date: day(40), application_deadline: day(15), created_at: iso(-20)
};

/** Same posting, but with no title / organisation, so the page falls back to
 *  `terms.postingLabel` and the literal 'HYT Foundation Inc.' default. */
const BARE_OPPORTUNITY = {
  id: 'o1', title: '', organization: '', location: '',
  status: 'PUBLISHED', slots: 5, slots_taken: 2,
  start_date: day(-5), end_date: day(40), application_deadline: day(15), created_at: iso(-20)
};

const APPROVED_APPLICATION = {
  id: 'a1', user_id: STUDENT_ID, opportunity_id: 'o1', program_id: null,
  type: 'opportunity', status: 'APPROVED', applied_at: iso(-18),
  reviewed_at: iso(-5), created_at: iso(-18), updated_at: iso(-5)
};

const OJT_RECORD = {
  id: 'ojt1', student_id: STUDENT_ID, company: 'Acme Software Corp',
  supervisor: 'Engr. Reyes', required_hours: 80, verified_hours: 32,
  pending_hours: 0, remaining_hours: 48, progress: 40, status: 'Active',
  start_date: day(-5), created_at: iso(-5)
};

const fixturesFor = (scenario) => ({
  users: [scenario.profile],
  programs: [],
  opportunities: scenario.opportunity ? [scenario.bareOpportunity ? BARE_OPPORTUNITY : OPPORTUNITY] : [],
  applications: scenario.application ? [APPROVED_APPLICATION] : [],
  ojt_records: scenario.ojtRecord ? [OJT_RECORD] : [],
  attendance_logs: [], ot_requests: [], absence_requests: [], daily_reports: [],
  requirements: [], certificates: [], announcements: [], notifications: [],
  settings: [{ id: 's1', key: 'geofence_enforcement_enabled', value: false }]
});

const SCENARIOS = [
  {
    name: 'placement',
    label: 'approved posting, no ojt_record — the branch that changed',
    profile: studentProfile(),
    opportunity: true, application: true, ojtRecord: false,
    widths: [1280, 1024, 900, 390]
  },
  {
    name: 'record',
    label: 'an ojt_record exists — the other branch (regression)',
    profile: studentProfile(),
    opportunity: true, application: true, ojtRecord: true,
    widths: [1280, 390]
  },
  {
    name: 'nohours',
    label: 'required_hours = 0 — no rail, no calendar, ring shows a dash',
    profile: studentProfile({ required_hours: 0, rendered_hours: 0 }),
    opportunity: true, application: true, ojtRecord: false,
    bareOpportunity: true,
    widths: [1280, 390]
  },
  {
    name: 'complete',
    label: 'rendered = required — completed copy and a full rail',
    profile: studentProfile({ required_hours: 80, rendered_hours: 80 }),
    opportunity: true, application: true, ojtRecord: false,
    widths: [1280, 390]
  }
];

/* ------------------------------------------------------------------- checks */
/* The copy that must survive, taken from the fixture so the expectations cannot
   rot when the fixture moves. Compared case-insensitively: several labels are
   `text-transform: uppercase`, and Chrome's `innerText` returns the RENDERED
   text, so 'Position Title' reads as 'POSITION TITLE'. */
const COPY = [
  'OJT / Experience', 'Active Placement', 'Position Title', 'Backend Developer Intern',
  'Company / Foundation Branch', 'Acme Software Corp', 'Approved Date',
  'Start Date', 'Projected End Date', 'Working Days Remaining',
  '(48.00 hrs at 8 hrs/day)', 'Accepted', 'Progress',
  'Rendered: 32.00 / 80.00 hrs', '40.0%'
];

const lower = (s) => String(s).toLowerCase();

const run = async () => {
  // Fail loudly on a missing/stale bundle: the SPA fallback would otherwise
  // serve a 404 body as index.html and every check would fail for the wrong reason.
  if (!fs.existsSync(path.join(BUILD, 'index.html'))) {
    console.error(`No build at ${BUILD}. Run the build first, or set BUILD_DIR.`);
    process.exit(2);
  }
  fs.mkdirSync(SHOTS, { recursive: true });
  const server = await startServer();
  const BASE = process.argv[2] || `http://127.0.0.1:${PORT}`;
  console.log(`serving ${BUILD} at ${BASE}\n`);

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1',
           `--user-data-dir=${process.env.TEMP || '/tmp'}/ojt-c2-${Date.now()}`]
  });

  for (const scenario of SCENARIOS) {
    const FIXTURES = fixturesFor(scenario);
    const page = await browser.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = request.url();
      if (!url.includes(SUPABASE_HOST)) { request.continue(); return; }
      const cors = {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
        'access-control-max-age': '86400'
      };
      if (request.method() === 'OPTIONS') return request.respond({ status: 204, headers: cors, body: '' });
      const json = (body, status = 200) =>
        request.respond({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(body) });

      const parsed = new URL(url);
      const p = parsed.pathname;
      if (p.startsWith('/auth/v1/user')) return json(scenario.profile);
      if (p.startsWith('/auth/v1/token')) return json(buildSession(scenario.profile));
      if (p.startsWith('/auth/v1/logout')) return json({}, 204);
      if (p.startsWith('/auth/v1/')) return json({});
      if (p.startsWith('/rest/v1/rpc/')) return json({ code: 'PGRST202', message: 'function not found' }, 404);
      if (p.startsWith('/rest/v1/')) {
        const table = p.replace('/rest/v1/', '');
        let rows = (FIXTURES[table] || []).slice();
        for (const [key, raw] of parsed.searchParams.entries()) {
          if (['select', 'order', 'limit', 'offset', 'apikey'].includes(key)) continue;
          if (raw.startsWith('eq.')) rows = rows.filter((r) => String(r[key]) === raw.replace(/^eq\./, ''));
        }
        const wantsObject = (request.headers().accept || '').includes('vnd.pgrst.object');
        if (wantsObject) {
          if (!rows.length) return json({ code: 'PGRST116', message: 'no rows' }, 406);
          return json(rows[0]);
        }
        return json(rows);
      }
      return json({});
    });

    await page.evaluateOnNewDocument((key, session) => {
      window.localStorage.setItem(key, JSON.stringify(session));
    }, STORAGE_KEY, buildSession(scenario.profile));

    console.log(`\n########## ${scenario.name.toUpperCase()} — ${scenario.label} ##########`);
    await page.setViewport({ width: 1280, height: 1200, deviceScaleFactor: 1 });
    await page.goto(`${BASE}/student/ojt`, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(1400);

    const finalUrl = page.url().replace(BASE, '');
    record(`[${scenario.name}] routed to /student/ojt`, finalUrl === '/student/ojt', 'landed on ' + finalUrl);

    const shape = await page.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const qa = (s) => [].slice.call(document.querySelectorAll(s));
      const ring = q('.ojt-ring-fill');
      const cs = ring ? getComputedStyle(ring) : null;
      const bar = q('.ojt-bar-inner .progress-bar-fill');
      const barTrack = q('.ojt-bar-inner .progress-bar');
      const rail = q('.ojt-rail-elapsed');
      const railTrack = q('.ojt-rail-track');
      return {
        card: qa('.ojt-placement-card').length,
        facts: qa('.ojt-fact').length,
        factLabels: qa('.ojt-fact dt').map((e) => e.textContent.trim()),
        hoursCells: qa('.ojt-hours > div').length,
        hoursLabels: qa('.ojt-hours dt').map((e) => e.textContent.trim()),
        panels: qa('.ojt-panel').length,
        segButtons: qa('.ojt-seg button').map((b) => ({ label: b.textContent.trim(), pressed: b.getAttribute('aria-pressed') })),
        rail: qa('.ojt-rail').length,
        railNodes: qa('.ojt-rail-node').length,
        railMarker: qa('.ojt-rail-today').length,
        railFlag: qa('.ojt-rail-flag').length,
        railFlagText: q('.ojt-rail-flag') ? q('.ojt-rail-flag').textContent.trim() : null,
        /* The flag is clamped to the track so a 0% or 100% marker cannot hang
           half a label off the end. Measure horizontally only — it sits ABOVE
           the track by design (bottom: calc(100% + 7px)). */
        railFlagRect: q('.ojt-rail-flag')
          ? ((r) => ({ left: r.left, right: r.right }))(q('.ojt-rail-flag').getBoundingClientRect()) : null,
        railTrackRect: railTrack
          ? ((r) => ({ left: r.left, right: r.right }))(railTrack.getBoundingClientRect()) : null,
        ticks: qa('.ojt-ticks span').length,
        ringCount: qa('.ojt-ring').length,
        ringStroke: cs ? cs.stroke : null,
        ringDasharray: cs ? parseFloat(cs.strokeDasharray) : null,
        ringOffset: cs ? parseFloat(cs.strokeDashoffset) : null,
        ringLabel: q('.ojt-ring-wrap') ? q('.ojt-ring-wrap').getAttribute('aria-label') : null,
        ringCenter: q('.ojt-ring-center b') ? q('.ojt-ring-center b').textContent.trim() : null,
        ringCaption: q('.ojt-ring-center span') ? q('.ojt-ring-center span').textContent.trim() : null,
        barFrac: bar && barTrack ? bar.getBoundingClientRect().width / barTrack.getBoundingClientRect().width : null,
        barHeight: barTrack ? barTrack.getBoundingClientRect().height : null,
        barBg: bar ? getComputedStyle(bar).backgroundImage : null,
        // Diagnostics: an animated element measured mid-flight reports a
        // plausible-looking width that is not the settled one.
        fillRectW: bar ? bar.getBoundingClientRect().width : null,
        trackRectW: barTrack ? barTrack.getBoundingClientRect().width : null,
        fillComputedW: bar ? getComputedStyle(bar).width : null,
        fillInlineW: bar ? bar.style.width : null,
        fillTransform: bar ? getComputedStyle(bar).transform : null,
        fillAnims: bar && bar.getAnimations
          ? bar.getAnimations().map((a) => ({
              name: a.animationName, state: a.playState,
              current: Math.round(a.currentTime || 0)
            }))
          : null,
        trackBox: barTrack ? {
          offsetW: barTrack.offsetWidth, clientW: barTrack.clientWidth,
          scrollW: barTrack.scrollWidth,
          pad: getComputedStyle(barTrack).padding, border: getComputedStyle(barTrack).borderWidth,
          boxSizing: getComputedStyle(barTrack).boxSizing,
          display: getComputedStyle(barTrack).display,
          overflow: getComputedStyle(barTrack).overflow
        } : null,
        wrapperBox: q('.ojt-bar-inner') ? {
          offsetW: q('.ojt-bar-inner').offsetWidth, clientW: q('.ojt-bar-inner').clientWidth,
          rectW: q('.ojt-bar-inner').getBoundingClientRect().width
        } : null,
        railFrac: rail && railTrack ? rail.getBoundingClientRect().width / railTrack.getBoundingClientRect().width : null,
        panelLine: q('.ojt-panel-line') ? q('.ojt-panel-line').textContent.replace(/\s+/g, ' ').trim() : null,
        badgeDot: q('.ojt-placement-head .badge')
          ? getComputedStyle(q('.ojt-placement-head .badge'), '::before').content : null,
        bodyText: document.body.innerText.replace(/\s+/g, ' ')
      };
    });

    if (process.env.DUMP) {
      console.log(`  bodyText[${scenario.name}]: ${shape.bodyText}`);
    }

    if (process.env.DIAG) {
      console.log('  shape:', JSON.stringify({
        fillRectW: shape.fillRectW, trackRectW: shape.trackRectW,
        fillComputedW: shape.fillComputedW, fillInlineW: shape.fillInlineW,
        fillTransform: shape.fillTransform, fillAnims: shape.fillAnims,
        trackBox: shape.trackBox, wrapperBox: shape.wrapperBox,
        barFrac: shape.barFrac, ringOffset: shape.ringOffset
      }));
      await sleep(2500);
      const settled = await page.evaluate(() => {
        const bar = document.querySelector('.ojt-bar-inner .progress-bar-fill');
        const track = document.querySelector('.ojt-bar-inner .progress-bar');
        const ring = document.querySelector('.ojt-ring-fill');
        return {
          fillRectW: bar ? bar.getBoundingClientRect().width : null,
          trackRectW: track ? track.getBoundingClientRect().width : null,
          fillComputedW: bar ? getComputedStyle(bar).width : null,
          fillTransform: bar ? getComputedStyle(bar).transform : null,
          frac: bar && track ? bar.getBoundingClientRect().width / track.getBoundingClientRect().width : null,
          ringOffset: ring ? parseFloat(getComputedStyle(ring).strokeDashoffset) : null
        };
      });
      console.log('  settled after +2.5s:', JSON.stringify(settled));
    }

    if (scenario.name === 'placement') {
      const haystack = lower(shape.bodyText);
      const missing = COPY.filter((s) => !haystack.includes(lower(s)));
      record('[placement] every live copy string survives', missing.length === 0, missing.join(' | ') || 'all 15 found');
      record('[placement] one card, 5 facts, 3 hour cells, 1 panel, 2 rail nodes, 1 flag, 3 ticks',
        shape.card === 1 && shape.facts === 5 && shape.hoursCells === 3 && shape.panels === 1 &&
        shape.railNodes === 2 && shape.railFlag === 1 && shape.ticks === 3,
        `card=${shape.card} facts=${shape.facts} hours=${shape.hoursCells} panels=${shape.panels} railNodes=${shape.railNodes} flag=${shape.railFlag} ticks=${shape.ticks}`);
      record('[placement] fact labels keep their original wording',
        shape.factLabels.join(' | ') === 'Position Title | Company / Foundation Branch | Approved Date | Start Date | Projected End Date',
        shape.factLabels.join(' | '));
      record('[placement] hour labels keep their original wording',
        shape.hoursLabels.join(' | ') === 'Rendered | Remaining | Working Days Remaining',
        shape.hoursLabels.join(' | '));
      record('[placement] "Progress" heading survives as the panel eyebrow',
        haystack.includes('progress') && shape.panelLine === 'Rendered: 32.00 / 80.00 hrs',
        shape.panelLine);
      record('[placement] the Accepted badge gained a status dot',
        shape.badgeDot !== 'none' && shape.badgeDot !== null, shape.badgeDot);
      record('[placement] ring paints the teal stroke at 10px, not the brand fill colour',
        shape.ringStroke === 'rgb(39, 158, 182)', shape.ringStroke);
      /* Regression guard for the Attendance.css `.progress-bar` leak: a
         `padding-right: 16px` there shrank the fill's percentage basis, so a
         40% bar measured 37.96% and a 100% bar stopped 16px short. */
      record('[placement] the bar track has no leaked padding (Attendance.css regression)',
        shape.trackBox && shape.trackBox.pad === '0px' && shape.trackBox.display !== 'flex',
        shape.trackBox ? `padding=${shape.trackBox.pad} display=${shape.trackBox.display} min-width via offset ${shape.trackBox.offsetW}` : 'no track');
    }

    /* ring ↔ number ↔ bar ↔ rail must all agree (relationships, not literals).
       Only meaningful on the branch that actually renders the panel. */
    if (shape.panels === 1 && shape.ringCenter && shape.ringCenter !== '—') {
      const pct = parseFloat(shape.ringCenter);
      const expectedOffset = RING_C * (1 - pct / 100);
      record(`[${scenario.name}] ring sweep matches the number it shows`,
        Math.abs(shape.ringOffset - expectedOffset) < 1.5 && Math.abs(shape.ringDasharray - RING_C) < 0.6,
        `${shape.ringCenter} -> offset ${shape.ringOffset.toFixed(2)} expect ${expectedOffset.toFixed(2)} of C=${RING_C.toFixed(2)}`);
      record(`[${scenario.name}] bar fill width equals the ring number`,
        shape.barFrac !== null && Math.abs(shape.barFrac * 100 - pct) < 0.6,
        `${(shape.barFrac * 100).toFixed(2)}% vs ${pct}%`);
      record(`[${scenario.name}] ring has a text alternative`,
        typeof shape.ringLabel === 'string' && shape.ringLabel.length > 20 && /\d/.test(shape.ringLabel),
        shape.ringLabel);
    } else if (shape.panels === 1) {
      record(`[${scenario.name}] no data -> ring shows an em dash, not "NaN%"`,
        shape.ringCenter === '—', shape.ringCenter);
      record(`[${scenario.name}] no data -> bar stays empty`,
        shape.barFrac !== null && shape.barFrac < 0.01, `${(shape.barFrac * 100).toFixed(2)}%`);
    }

    if (scenario.name === 'placement') {
      record('[placement] hours ring reads exactly the fixture 32/80 = 40.0%',
        shape.ringCenter === '40.0%' && shape.ringCaption === 'rendered',
        `${shape.ringCenter} / ${shape.ringCaption}`);
      record('[placement] rail fill measures the calendar window, not the hours bar',
        Math.abs(shape.railFrac - shape.barFrac) > 0.001,
        `rail ${(shape.railFrac * 100).toFixed(2)}% vs bar ${(shape.barFrac * 100).toFixed(2)}% (must differ: different measures)`);
      record('[placement] rail fill is a sane fraction of the window',
        shape.railFrac > 0.05 && shape.railFrac < 0.95, `${(shape.railFrac * 100).toFixed(2)}%`);
      /* The regression this guards: a centred "Today" label in the labels row
         sat under the 50% column while the marker was at 38%, reading as "today
         is halfway through the window". The flag must ride the marker, and the
         clamp must keep it inside the track. */
      record('[placement] the Today flag rides the marker and stays inside the track',
        shape.railFlagRect && shape.railTrackRect &&
        shape.railFlagRect.left >= shape.railTrackRect.left - 0.5 &&
        shape.railFlagRect.right <= shape.railTrackRect.right + 0.5,
        shape.railFlagRect && shape.railTrackRect
          ? `flag ${shape.railFlagRect.left.toFixed(1)}..${shape.railFlagRect.right.toFixed(1)} in track ${shape.railTrackRect.left.toFixed(1)}..${shape.railTrackRect.right.toFixed(1)}`
          : 'no flag');
    }

    if (scenario.name === 'nohours') {
      record('[nohours] no rail, no today marker, no flag, no calendar toggle',
        shape.rail === 0 && shape.railMarker === 0 && shape.railFlag === 0 && shape.segButtons.length === 0,
        `rail=${shape.rail} marker=${shape.railMarker} flag=${shape.railFlag} seg=${shape.segButtons.length}`);
      record('[nohours] the Working Days cell is absent (hasSchedule is false)',
        shape.hoursCells === 2, shape.hoursLabels.join(' | '));
      record('[nohours] untitled posting falls back to the posting label and HYT Foundation Inc.',
        lower(shape.bodyText).includes('ojt postings') && lower(shape.bodyText).includes('hyt foundation inc.'),
        shape.factLabels.join(' | '));
    }

    if (scenario.name === 'complete') {
      record('[complete] rail is full and both the today marker and its flag are gone',
        shape.railFrac > 0.99 && shape.railMarker === 0 && shape.railFlag === 0,
        `fill ${(shape.railFrac * 100).toFixed(2)}%, markers ${shape.railMarker}, flags ${shape.railFlag}`);
      /* OJT.js:188 flips the label to 'End Date' and OJT.js:94 sets the hours
         caption to 'complete' (adjective) — both are the finished-placement
         contract. Assert the ADJECTIVE, not the past-tense 'completed': the
         substring only runs one way ("complete" ⊂ "completed"), so demanding
         'completed' fails on a page that renders the correct word. */
      record('[complete] labels switch to Complete / End Date',
        lower(shape.bodyText).includes('complete') && lower(shape.bodyText).includes('end date') &&
        !lower(shape.bodyText).includes('projected end'),
        shape.factLabels.join(' | '));
      record('[complete] no calendar toggle (the window has closed)',
        shape.segButtons.length === 0, shape.segButtons.length);
      /* A 100% bar must actually reach the end of its track. This is the
         assertion that catches the leaked `padding-right: 16px`. */
      record('[complete] the 100% bar reaches the end of its track',
        Math.abs(shape.barFrac - 1) < 0.005,
        `${(shape.barFrac * 100).toFixed(2)}% of the track (a 16px leak shows ~94.9%)`);
    }

    if (scenario.name === 'record') {
      record('[record] the ojt_record branch is untouched',
        shape.bodyText.includes('Program Details') && shape.bodyText.includes('Hours Tracking') &&
        shape.card === 0 && shape.panels === 0,
        `placementCard=${shape.card} panels=${shape.panels}`);
    }

    /* toggle round-trip */
    if (scenario.name === 'placement') {
      const before = await page.evaluate(() => ({
        pressed: [].slice.call(document.querySelectorAll('.ojt-seg button')).map((b) => b.getAttribute('aria-pressed')),
        num: document.querySelector('.ojt-ring-center b').textContent.trim(),
        offset: parseFloat(getComputedStyle(document.querySelector('.ojt-ring-fill')).strokeDashoffset),
        rail: document.querySelector('.ojt-rail-elapsed').getBoundingClientRect().width
      }));
      await page.evaluate(() => {
        const btn = [].slice.call(document.querySelectorAll('.ojt-seg button'))
          .find((b) => b.textContent.trim() === 'Calendar');
        btn.click();
      });
      await sleep(1100);
      const after = await page.evaluate(() => ({
        pressed: [].slice.call(document.querySelectorAll('.ojt-seg button')).map((b) => b.getAttribute('aria-pressed')),
        num: document.querySelector('.ojt-ring-center b').textContent.trim(),
        caption: document.querySelector('.ojt-ring-center span').textContent.trim(),
        offset: parseFloat(getComputedStyle(document.querySelector('.ojt-ring-fill')).strokeDashoffset),
        rail: document.querySelector('.ojt-rail-elapsed').getBoundingClientRect().width,
        railTrack: document.querySelector('.ojt-rail-track').getBoundingClientRect().width,
        label: document.querySelector('.ojt-ring-wrap').getAttribute('aria-label')
      }));
      record('[placement] toggle flips aria-pressed',
        before.pressed.join() === 'true,false' && after.pressed.join() === 'false,true',
        before.pressed.join() + ' -> ' + after.pressed.join());
      record('[placement] toggle switches the ring to the calendar measure',
        before.num === '40.0%' && after.num !== before.num && after.caption === 'of window' &&
        after.offset > before.offset,
        `${before.num} -> ${after.num} / ${after.caption}`);
      record('[placement] ring, rail and aria-label all follow the calendar measure',
        Math.abs((after.rail / after.railTrack) * 100 - parseFloat(after.num)) < 0.6 &&
        after.label.includes('Calendar elapsed'),
        `rail ${((after.rail / after.railTrack) * 100).toFixed(2)}% vs ring ${after.num} | ${after.label}`);
      await page.evaluate(() => {
        const btn = [].slice.call(document.querySelectorAll('.ojt-seg button'))
          .find((b) => b.textContent.trim() === 'Hours rendered');
        btn.click();
      });
      await sleep(1100);
      const back = await page.evaluate(() => document.querySelector('.ojt-ring-center b').textContent.trim());
      record('[placement] toggle returns to the hours measure', back === '40.0%', back);
    }

    /* contrast + overflow at every width */
    for (const width of scenario.widths) {
      await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
      await sleep(500);
      const overflow = await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth
      }));
      record(`[${scenario.name}] no horizontal overflow @${width}`,
        overflow.scroll - overflow.client <= 1,
        `clientWidth=${overflow.client} scrollWidth=${overflow.scroll}`);

      const cardAudit = await page.evaluate(contrastAudit, { cardSelector: '.card' });
      record(`[${scenario.name}] contrast — .card, 0 offenders @${width}`,
        cardAudit.offenders.length === 0,
        cardAudit.offenders.length
          ? cardAudit.offenders.slice(0, 6).map((o) => `${o.ratio}:1 "${o.text}" ${o.size} ${o.fg} on ${o.bg} <${o.el}>`).join(' || ')
          : `${cardAudit.cards} card(s) swept`);

      const pageAudit = await page.evaluate(contrastAudit, { cardSelector: '.ojt-page' });
      record(`[${scenario.name}] contrast — whole page, 0 offenders @${width}`,
        pageAudit.offenders.length === 0,
        pageAudit.offenders.length
          ? pageAudit.offenders.slice(0, 6).map((o) => `${o.ratio}:1 "${o.text}" ${o.size} ${o.fg} on ${o.bg} <${o.el}>`).join(' || ')
          : 'swept');
    }

    /* columns level + screenshot at the desktop width */
    await page.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 1 });
    await sleep(400);
    if (scenario.name === 'placement') {
      const lvl = await page.evaluate(() => {
        const main = document.querySelector('.ojt-placement-main');
        const panel = document.querySelector('.ojt-panel');
        const m = main.getBoundingClientRect();
        const p = panel.getBoundingClientRect();
        return { gap: Math.abs(m.bottom - p.bottom), mainH: m.height, panelH: p.height };
      });
      record('[placement] fact column and panel end level',
        lvl.gap <= 2 && lvl.mainH > 280,
        `mainH=${lvl.mainH.toFixed(0)} panelH=${lvl.panelH.toFixed(0)} bottom gap=${lvl.gap.toFixed(1)}px`);
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(300);
    await page.screenshot({ path: path.join(SHOTS, `${scenario.name}-1280.png`), fullPage: true });
    await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 1 });
    await sleep(500);
    await page.screenshot({ path: path.join(SHOTS, `${scenario.name}-390.png`), fullPage: true });

    /* reduced motion: the ring and rail must sit at their final value */
    await page.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 1 });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(900);
    const rm = await page.evaluate(() => {
      const g = (s) => {
        const el = document.querySelector(s);
        return el ? getComputedStyle(el) : null;
      };
      const ring = g('.ojt-ring-fill');
      const rail = g('.ojt-rail-elapsed');
      const bar = g('.ojt-bar-inner .progress-bar-fill');
      return {
        ringAnim: ring ? ring.animationName : null,
        railAnim: rail ? rail.animationName : null,
        barAnim: bar ? bar.animationName : null,
        ringOffset: ring ? parseFloat(ring.strokeDashoffset) : null,
        center: document.querySelector('.ojt-ring-center b')
          ? document.querySelector('.ojt-ring-center b').textContent.trim() : null,
        railW: document.querySelector('.ojt-rail-elapsed')
          ? document.querySelector('.ojt-rail-elapsed').getBoundingClientRect().width : null,
        railTrackW: document.querySelector('.ojt-rail-track')
          ? document.querySelector('.ojt-rail-track').getBoundingClientRect().width : null
      };
    });
    const stillCorrect = shape.panels !== 1
      ? true
      : rm.center === '—'
        ? rm.ringOffset !== null
        : Math.abs(rm.ringOffset - RING_C * (1 - parseFloat(rm.center) / 100)) < 1.5;
    // `animationName` is null for an element that does not exist on this branch.
    const noAnim = [rm.ringAnim, rm.railAnim, rm.barAnim].every((a) => a === 'none' || a === null);
    record(`[${scenario.name}] reduced motion: no animations, values still final`,
      noAnim && stillCorrect && (rm.railTrackW === null || rm.railW > 0),
      `ring=${rm.ringAnim} rail=${rm.railAnim} bar=${rm.barAnim} offset=${rm.ringOffset} center=${rm.center}`);
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

    record(`[${scenario.name}] zero console errors / pageerror`, errors.length === 0,
      errors.slice(0, 3).join(' | ') || 'clean');

    await page.close();
  }

  /* ---------------------------------------------------------------------
     The Attendance.css fix. Scoping `.progress-bar` there stops the leak, but
     the attendance widget itself must be unchanged: 32px container, a filled
     bar with a right-aligned white percentage inside it.
     --------------------------------------------------------------------- */
  {
    const scenario = SCENARIOS[0];
    const FIXTURES = fixturesFor(scenario);
    const page = await browser.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = request.url();
      if (!url.includes(SUPABASE_HOST)) { request.continue(); return; }
      const cors = {
        'access-control-allow-origin': '*', 'access-control-allow-headers': '*',
        'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS', 'access-control-max-age': '86400'
      };
      if (request.method() === 'OPTIONS') return request.respond({ status: 204, headers: cors, body: '' });
      const json = (body, status = 200) =>
        request.respond({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(body) });
      const p = new URL(url).pathname;
      if (p.startsWith('/auth/v1/user')) return json(scenario.profile);
      if (p.startsWith('/auth/v1/token')) return json(buildSession(scenario.profile));
      if (p.startsWith('/auth/v1/')) return json({});
      if (p.startsWith('/rest/v1/rpc/')) return json({ code: 'PGRST202', message: 'function not found' }, 404);
      if (p.startsWith('/rest/v1/')) {
        const table = p.replace('/rest/v1/', '');
        let rows = (FIXTURES[table] || []).slice();
        for (const [key, raw] of new URL(url).searchParams.entries()) {
          if (['select', 'order', 'limit', 'offset', 'apikey'].includes(key)) continue;
          if (raw.startsWith('eq.')) rows = rows.filter((r) => String(r[key]) === raw.replace(/^eq\./, ''));
        }
        if ((request.headers().accept || '').includes('vnd.pgrst.object')) {
          if (!rows.length) return json({ code: 'PGRST116', message: 'no rows' }, 406);
          return json(rows[0]);
        }
        return json(rows);
      }
      return json({});
    });
    await page.evaluateOnNewDocument((key, session) => {
      window.localStorage.setItem(key, JSON.stringify(session));
    }, STORAGE_KEY, buildSession(scenario.profile));

    console.log('\n########## ATTENDANCE — regression for the scoped .progress-bar ##########');
    await page.setViewport({ width: 1280, height: 1200, deviceScaleFactor: 1 });
    await page.goto(`${BASE}/student/attendance`, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(1400);

    const att = await page.evaluate(() => {
      const container = document.querySelector('.hours-progress-card .progress-bar-container');
      const bar = document.querySelector('.hours-progress-card .progress-bar');
      const text = document.querySelector('.hours-progress-card .progress-text');
      if (!container || !bar) return { missing: true };
      const cs = getComputedStyle(bar);
      const tcs = text ? getComputedStyle(text) : null;
      return {
        missing: false,
        containerH: container.getBoundingClientRect().height,
        barH: bar.getBoundingClientRect().height,
        barBg: cs.backgroundImage,
        barPad: cs.padding,
        barDisplay: cs.display,
        barMinW: cs.minWidth,
        barFrac: bar.getBoundingClientRect().width / container.getBoundingClientRect().width,
        inlineW: bar.style.width,
        textColor: tcs ? tcs.color : null,
        textWeight: tcs ? tcs.fontWeight : null,
        textRight: text ? (text.getBoundingClientRect().right - bar.getBoundingClientRect().right) : null
      };
    });

    record('[attendance] the widget still renders inside its container',
      !att.missing && att.containerH === 32 && Math.abs(att.barH - 32) < 0.6,
      att.missing ? 'markup missing' : `container=${att.containerH}px bar=${att.barH}px`);
    record('[attendance] the 32px fill keeps its deep gradient, flex layout and 16px inset',
      !att.missing && att.barBg.includes('gradient') && att.barDisplay === 'flex' &&
      att.barPad === '0px 16px 0px 0px' && att.barMinW === '50px',
      att.missing ? 'markup missing' : `bg=${att.barBg.slice(0, 40)}… display=${att.barDisplay} pad=${att.barPad} minW=${att.barMinW}`);
    record('[attendance] the percentage label is still white, bold and right-aligned',
      !att.missing && att.textColor === 'rgb(255, 255, 255)' && Number(att.textWeight) >= 700 &&
      att.textRight !== null && Math.abs(att.textRight) < 20,
      `color=${att.textColor} weight=${att.textWeight} inset from right=${att.textRight === null ? 'n/a' : att.textRight.toFixed(1)}px`);
    record('[attendance] the bar width still follows its inline percentage',
      !att.missing && Math.abs(att.barFrac * 100 - parseFloat(att.inlineW)) < 0.6,
      `inline ${att.inlineW} rendered ${(att.barFrac * 100).toFixed(2)}%`);

    const attAudit = await page.evaluate(contrastAudit, { cardSelector: '.card' });
    record('[attendance] contrast — 0 offenders', attAudit.offenders.length === 0,
      attAudit.offenders.length
        ? attAudit.offenders.slice(0, 5).map((o) => `${o.ratio}:1 "${o.text}" ${o.fg} on ${o.bg}`).join(' || ')
        : `${attAudit.cards} card(s) swept`);
    record('[attendance] zero console errors / pageerror', errors.length === 0,
      errors.slice(0, 3).join(' | ') || 'clean');

    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(300);
    await page.screenshot({ path: path.join(SHOTS, 'attendance-1280.png'), fullPage: true });
    await page.close();
  }

  await browser.close();
  server.close();

  const failed = results.filter((r) => !r.ok);
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' checks passed');
  if (failed.length) {
    console.log('FAILURES:');
    failed.forEach((f) => console.log('  - ' + f.name + '  [' + f.detail + ']'));
  }
  fs.writeFileSync(path.join(SHOTS, '_result.txt'),
    results.map((r) => (r.ok ? 'PASS ' : 'FAIL ') + r.name + '  [' + r.detail + ']').join('\n') +
    '\n\n' + (results.length - failed.length) + '/' + results.length + ' passed\n');
  process.exit(failed.length ? 1 : 0);
};

run().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
