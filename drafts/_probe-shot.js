/**
 * Portal (auth-gated) card contrast audit.
 *
 * The portal routes cannot be reached without a session, which is why the
 * gradient-card rollout was previously unverifiable.  This harness closes that
 * gap: it stubs the Supabase REST and Auth endpoints with fixtures and seeds a
 * non-expired session into localStorage, so the real application boots into the
 * admin and student portals and can be audited like any public page.
 *
 * Nothing is written to the database — every Supabase request is fulfilled
 * locally by the request interceptor.
 *
 * Usage:
 *   node drafts/_audit-portals.js <baseUrl> [admin|student|both]
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const { contrastAudit } = require('./_contrast');

const BASE = process.argv[2] || 'http://127.0.0.1:4324';
const WHICH = process.argv[3] || 'both';
// Optional: when SHOTS_DIR is set, capture a full-page screenshot of every
// audited route so the design can be reviewed alongside the measurements.
const SHOTS_DIR = process.env.SHOTS_DIR || '';
if (SHOTS_DIR) fs.mkdirSync(SHOTS_DIR, { recursive: true });
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const SUPABASE_URL = (env.match(/REACT_APP_SUPABASE_URL\s*=\s*(\S+)/) || [])[1];
const SUPABASE_KEY = (env.match(/REACT_APP_SUPABASE_ANON_KEY\s*=\s*(\S+)/) || [])[1];
const SUPABASE_HOST = new URL(SUPABASE_URL).hostname;
const STORAGE_KEY = `sb-${SUPABASE_HOST.split('.')[0]}-auth-token`;

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const STUDENT_ID = '22222222-2222-4222-8222-222222222222';
const TRAINEE_ID = '33333333-3333-4333-8333-333333333333';

const ADMIN_PROFILE = {
  id: ADMIN_ID,
  email: 'admin@hytfoundation.org',
  role: 'ADMIN',
  full_name: 'Hydee Tabao',
  first_name: 'Hydee',
  last_name: 'Tabao',
  account_type: 'admin',
  application_status: 'APPROVED',
  is_active: true,
  created_at: '2026-01-05T00:00:00.000Z'
};

const STUDENT_PROFILE = {
  id: STUDENT_ID,
  email: 'juan.santos@example.com',
  role: 'OJT/Intern',
  full_name: 'Juan Santos',
  first_name: 'Juan',
  last_name: 'Santos',
  account_type: 'ojt-student',
  application_status: 'APPROVED',
  is_active: true,
  school: 'University of the Philippines',
  course: 'BS Information Technology',
  required_hours: 80,
  rendered_hours: 32,
  created_at: '2026-01-10T00:00:00.000Z'
};

const TRAINEE_PROFILE = {
  id: TRAINEE_ID,
  email: 'maria.rodriguez@example.com',
  role: 'Trainee',
  full_name: 'Maria Rodriguez',
  first_name: 'Maria',
  last_name: 'Rodriguez',
  account_type: 'trainee',
  application_status: 'APPROVED',
  is_active: true,
  school: 'Polytechnic University of the Philippines',
  course: 'BS Office Administration',
  required_hours: 120,
  rendered_hours: 24,
  created_at: '2026-01-12T00:00:00.000Z'
};

const now = Date.now();
const iso = (offsetDays) => new Date(now + offsetDays * 86400000).toISOString();
const day = (offsetDays) => iso(offsetDays).slice(0, 10);

/** Fixture rows keyed by table name. */
const FIXTURES = {
  users: [ADMIN_PROFILE, STUDENT_PROFILE, TRAINEE_PROFILE],
  programs: [
    {
      id: 'p1', title: 'Youth Leadership Camp', organization: 'HYT Foundation Inc.',
      description: 'A three-day leadership intensive for community youth leaders.',
      category: 'Community Outreach', thrust: 'Empowerment', location: 'Quezon City',
      status: 'PUBLISHED', slots: 20, slots_taken: 5,
      start_date: day(-10), end_date: day(20), application_deadline: day(12),
      created_at: iso(-30)
    }
  ],
  opportunities: [
    {
      id: 'o1', title: 'Backend Developer Intern', organization: 'Acme Software Corp',
      description: 'Work with the platform team on the internship tracking portal.',
      category: 'Technical Training', thrust: 'Experience', location: 'Makati City',
      status: 'PUBLISHED', slots: 5, slots_taken: 2,
      start_date: day(-5), end_date: day(40), application_deadline: day(15),
      created_at: iso(-20)
    }
  ],
  applications: [
    {
      id: 'a1', user_id: STUDENT_ID, opportunity_id: 'o1', program_id: null,
      type: 'opportunity', status: 'APPROVED', applied_at: iso(-18),
      reviewed_at: iso(-5), created_at: iso(-18), updated_at: iso(-5)
    },
    {
      id: 'a2', user_id: STUDENT_ID, opportunity_id: null, program_id: 'p1',
      type: 'program', status: 'Applied', applied_at: iso(-3),
      created_at: iso(-3), updated_at: iso(-3)
    }
  ],
  attendance_logs: [
    {
      id: 'log-1', user_id: STUDENT_ID, date: day(-4), time_in: iso(-4), time_out: iso(-4),
      status: 'APPROVED', rendered_hours: 8, duration_seconds: 28800,
      admin_note: 'Verified.', created_at: iso(-4)
    },
    {
      id: 'log-2', user_id: STUDENT_ID, date: day(-2), time_in: iso(-2), time_out: null,
      status: 'PENDING_CLOCK_IN', rendered_hours: 0, created_at: iso(-2)
    }
  ],
  ot_requests: [
    {
      id: 'ot1', user_id: STUDENT_ID, attendance_id: null, requested_hours: 2,
      reason: 'Extended deployment for the release cutover.',
      status: 'Pending', created_at: iso(-2)
    }
  ],
  absence_requests: [
    {
      id: 'ab1', user_id: STUDENT_ID, absence_date: day(2),
      reason: 'Medical appointment at the university clinic.',
      status: 'Noted', admin_note: 'Noted, get well soon.', created_at: iso(-1)
    },
    {
      id: 'ab2', user_id: STUDENT_ID, absence_date: day(6),
      reason: 'Family emergency out of town for two days.',
      status: 'Submitted', created_at: iso(0)
    }
  ],
  daily_reports: [
    {
      id: 'r1', user_id: STUDENT_ID, report_date: day(-3),
      accomplishments: 'Implemented the attendance approval endpoint.',
      status: 'Pending', created_at: iso(-3)
    }
  ],
  requirements: [
    { id: 'q1', user_id: STUDENT_ID, title: 'Medical Certificate', status: 'Required', created_at: iso(-9) }
  ],
  certificates: [
    { id: 'c1', user_id: STUDENT_ID, title: 'OJT Completion with Hours', status: 'Issued', created_at: iso(-1) }
  ],
  announcements: [
    {
      id: 'n1', title: 'Orientation moved to Monday',
      content: 'The general orientation has been moved to Monday 9 AM at the main hall.',
      priority: 'High', published_at: iso(-1), created_at: iso(-1)
    }
  ],
  notifications: [
    { id: 'nt1', user_id: STUDENT_ID, title: 'Application approved', body: 'Your application was approved.', read: false, created_at: iso(-5) }
  ],
  ojt_records: [
    {
      id: 'ojt1', student_id: STUDENT_ID, company: 'Acme Software Corp',
      supervisor: 'Engr. Reyes', required_hours: 80, verified_hours: 32,
      pending_hours: 0, remaining_hours: 48, progress: 40, status: 'Active',
      start_date: day(-5), created_at: iso(-5)
    }
  ],
  settings: [{ id: 's1', key: 'geofence_enforcement_enabled', value: false }]
};

const ADMIN_ROUTES = [
  '/admin', '/admin/dashboard', '/admin/students', '/admin/programs',
  '/admin/opportunities', '/admin/applications', '/admin/attendance',
  '/admin/attendance-review', '/admin/ojt', '/admin/daily-reports',
  '/admin/requirements', '/admin/certificates', '/admin/announcements',
  '/admin/reports', '/admin/attendance-verification', '/admin/ot-approvals',
  '/admin/report-approvals', '/admin/application-review'
];

const STUDENT_ROUTES = [
  '/student', '/student/dashboard', '/student/profile', '/student/programs',
  '/student/opportunities', '/student/applications', '/student/requirements',
  '/student/ojt', '/student/attendance', '/student/daily-reports',
  '/student/certificates', '/student/announcements'
];

// The Trainee portal renders the same components with role = 'Trainee', which is
// where the time-in/time-out-only and no-overtime rules have to hold.
const TRAINEE_ROUTES = [
  '/trainee', '/trainee/dashboard', '/trainee/profile', '/trainee/programs',
  '/trainee/opportunities', '/trainee/applications', '/trainee/requirements',
  '/trainee/attendance', '/trainee/daily-reports', '/trainee/certificates',
  '/trainee/announcements'
];

const buildSession = (profile) => ({
  access_token: 'stub-access-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(now / 1000) + 3600,
  refresh_token: 'stub-refresh-token',
  user: {
    id: profile.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: profile.email,
    email_confirmed_at: iso(-60),
    phone: '',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { full_name: profile.full_name },
    identities: [],
    created_at: iso(-60),
    updated_at: iso(-1)
  }
});

/** Which fixture rows satisfy the request's query string. */
const rowsFor = (table, url, viewerId) => {
  const ownerKeys = ['user_id', 'student_id'];
  let rows = FIXTURES[table]
    ? FIXTURES[table].map((row) => {
        if (!viewerId || viewerId === STUDENT_ID) return row;
        const owned = ownerKeys.some((key) => row[key] === STUDENT_ID);
        if (!owned) return row;
        const next = { ...row };
        ownerKeys.forEach((key) => {
          if (next[key] === STUDENT_ID) next[key] = viewerId;
        });
        return next;
      })
    : [];
  const params = new URL(url).searchParams;

  for (const [key, raw] of params.entries()) {
    if (['select', 'order', 'limit', 'offset', 'apikey'].includes(key)) continue;
    const value = raw.replace(/^eq\./, '');
    if (raw.startsWith('eq.')) {
      rows = rows.filter((row) => String(row[key]) === value);
    }
  }
  return rows;
};


/* ==========================================================================
 * Driver: measure the OJT / Experience card on the real /student/dashboard.
 *
 * Everything above this point is the proven Supabase stub from
 * _audit-portals.js (fixtures + rowsFor + buildSession + the request
 * interceptor), reused verbatim so the fixtures cannot drift.  Only the driver
 * below is new.
 *
 * The card is measured at every width the dashboard grid actually produces,
 * because the card width is NOT fixed: `repeat(auto-fit, minmax(300px, 1fr))`
 * gives 328px at a 1024px viewport but 456px at 1280px, and the narrow case is
 * the one that breaks.
 * ========================================================================== */

const CHROME_EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const WIDTHS = [1024, 1280, 1440, 1920, 900, 768, 390];

/** Runs in the page. Returns everything the assertions need. */
const cardProbe = () => {
  const parse = (c) => {
    const m = String(c).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.95) return c;
      n = n.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1
  });

  const card = document.querySelector('.experience-card');
  if (!card) return { found: false };

  /* ---------- contrast ---------- */
  const offenders = [];
  card.querySelectorAll('*').forEach((el) => {
    const own = Array.from(el.childNodes).some(
      (n) => n.nodeType === 3 && n.textContent.trim().length > 0
    );
    if (!own) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return;
    if (el.getBoundingClientRect().width < 1) return;
    const fgRaw = parse(cs.color);
    if (!fgRaw) return;
    const bg = bgOf(el);
    const fg = fgRaw.a < 1 ? over(fgRaw, bg) : fgRaw;
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    const cr = ratio(fg, bg);
    if (cr < need) {
      offenders.push({
        text: el.textContent.trim().slice(0, 30),
        cls: el.className.toString().slice(0, 26),
        size,
        ratio: +cr.toFixed(2),
        need
      });
    }
  });

  /* ---------- text ---------- */
  const text = (sel) => {
    const el = card.querySelector(sel);
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : null;
  };

  /* ---------- wrap / clip / overflow ---------- */
  const wrapped = [];
  const clipped = [];

  /* Single-line rule.  `.experience-item-title` is deliberately NOT in this
     list: it WRAPS at the two narrow card widths instead of ellipsising
     "Backend Developer Intern" down to "Backend Developer Int…".  Wrapping is
     the design now; truncation is the defect.  The title is therefore held to
     the no-clip rule below rather than to this one. */
  card.querySelectorAll('.experience-item-org, .experience-item-dates, .experience-progress-label, .experience-tile-label, .experience-tile-value').forEach((el) => {
    const cs = getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
    const lines = Math.max(1, Math.round(el.getBoundingClientRect().height / lh));
    if (lines > 1) {
      wrapped.push({ cls: el.className.toString().slice(0, 26), lines, text: el.textContent.trim().slice(0, 30) });
    }
  });

  /* No-clip rule: nothing may lose text, whether it wraps or not.  This is the
     check that catches an `ellipsis` guard quietly converting a visible wrap
     into an invisible truncation. */
  card.querySelectorAll('.experience-item-title, .experience-item-org, .experience-item-dates, .experience-progress-label, .experience-tile-label, .experience-tile-value').forEach((el) => {
    if (el.scrollWidth - el.clientWidth > 1) {
      clipped.push({
        cls: el.className.toString().slice(0, 26),
        need: el.scrollWidth,
        have: el.clientWidth,
        text: el.textContent.trim().slice(0, 30)
      });
    }
  });

  const overflowing = [];
  [card, ...card.querySelectorAll('*')].forEach((el) => {
    if (el.scrollWidth - el.clientWidth > 2 && el.clientWidth > 0) {
      overflowing.push({ cls: el.className.toString().slice(0, 26), over: el.scrollWidth - el.clientWidth });
    }
  });

  /* ---------- the fill must not paint at zero ---------- */
  /* `.experience-progress-fill` was the first guess here and it does not exist
     — the markup uses the design system's `.progress-bar-fill` inside
     `.experience-progress`.  A wrong selector does not throw, it returns null,
     which is exactly how a check reports a defect that is really its own. */
  const fill = card.querySelector('.experience-progress .progress-bar-fill');
  const fillWidth = fill ? fill.getBoundingClientRect().width : null;
  const fillPercent = fill ? fill.style.width : null;

  return {
    found: true,
    cardWidth: Math.round(card.getBoundingClientRect().width),
    cardHeight: Math.round(card.getBoundingClientRect().height),
    itemCount: card.querySelectorAll('.experience-item').length,
    badgeText: text('.experience-item-head .badge'),
    badgeClass: (card.querySelector('.experience-item-head .badge') || {}).className || '',
    titles: Array.from(card.querySelectorAll('.experience-item-title')).map((e) => e.textContent.trim()),
    orgs: Array.from(card.querySelectorAll('.experience-item-org')).map((e) => e.textContent.trim()),
    dates: Array.from(card.querySelectorAll('.experience-item-dates')).map((e) => e.textContent.trim()),
    note: text('.experience-note'),
    tiles: Array.from(card.querySelectorAll('.experience-tile')).map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
    progressLabel: text('.experience-progress-label'),
    progressValue: text('.experience-progress-value'),
    ctaText: text('.btn-outline'),
    ctaVariant: (card.querySelector('.btn-outline') || {}).className || '',
    fillPercent,
    fillWidth: fillWidth === null ? null : Math.round(fillWidth),
    /* Reported positively so a pass is visible evidence: the title is allowed
       to wrap, so "1 line" vs "2 lines" is information, not a pass/fail. */
    titleLines: (() => {
      const el = card.querySelector('.experience-item-title');
      if (!el) return null;
      const cs = getComputedStyle(el);
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
      return Math.max(1, Math.round(el.getBoundingClientRect().height / lh));
    })(),
    /* Printed so the org/dates fit is a number, not an adjective. */
    meta: (() => {
      const org = card.querySelector('.experience-item-org');
      const dates = card.querySelector('.experience-item-dates');
      const meta = card.querySelector('.experience-item-meta');
      if (!org || !dates || !meta) return null;
      return {
        row: Math.round(meta.getBoundingClientRect().width),
        orgNeed: org.scrollWidth,
        orgHave: org.clientWidth,
        datesNeed: dates.scrollWidth,
        datesHave: dates.clientWidth
      };
    })(),
    offenders,
    wrapped,
    clipped,
    overflowing
  };
};

const attachStub = (page, profile) => {
  page.on('request', (request) => {
    const url = request.url();
    if (!url.includes(SUPABASE_HOST)) return request.continue();
    const corsHeaders = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
      'access-control-max-age': '86400'
    };
    if (request.method() === 'OPTIONS') {
      return request.respond({ status: 204, headers: corsHeaders, body: '' });
    }
    const json = (body, status = 200) =>
      request.respond({ status, contentType: 'application/json', headers: corsHeaders, body: JSON.stringify(body) });

    const pathname = new URL(url).pathname;
    if (pathname.startsWith('/auth/v1/user')) return json(profile);
    if (pathname.startsWith('/auth/v1/token')) return json(buildSession(profile));
    if (pathname.startsWith('/auth/v1/logout')) return json({}, 204);
    if (pathname.startsWith('/auth/v1/')) return json({});
    if (pathname.startsWith('/rest/v1/rpc/')) {
      return json({ code: 'PGRST202', message: 'function not found' }, 404);
    }
    if (pathname.startsWith('/rest/v1/')) {
      const table = pathname.replace('/rest/v1/', '');
      const rows = rowsFor(table, url, profile.id);
      const wantsObject =
        request.headers().accept && request.headers().accept.includes('vnd.pgrst.object');
      if (wantsObject) {
        if (!rows.length) return json({ code: 'PGRST116', message: 'no rows' }, 406);
        return json(rows[0]);
      }
      return json(rows);
    }
    return json({});
  });
};

/* ==========================================================================
 * Screenshot the real /student/dashboard experience card.
 *
 * The skill's rule: always Read the PNGs back.  A probe can only assert what
 * it was told to look for; the screenshot is where you notice the thing you
 * forgot to assert.
 * ========================================================================== */

const SHOT_WIDTHS = [
  { w: 1280, name: 'desktop-1280' },
  { w: 1024, name: 'narrow-1024' },
  { w: 900, name: 'tablet-900' },
  { w: 390, name: 'mobile-390' }
];

const run = async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_EXE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', `--user-data-dir=${process.env.TEMP || '/tmp'}/exp-shot-${Date.now()}`]
  });

  const written = [];
  for (const { w, name } of SHOT_WIDTHS) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: 1200, deviceScaleFactor: 2 });
    await page.setRequestInterception(true);
    attachStub(page, STUDENT_PROFILE);
    await page.evaluateOnNewDocument(
      (key, session) => window.localStorage.setItem(key, JSON.stringify(session)),
      STORAGE_KEY,
      buildSession(STUDENT_PROFILE)
    );
    await page.goto(`${BASE}/student/dashboard`, { waitUntil: 'networkidle2', timeout: 45000 });
    await sleep(1000);

    const card = await page.$('.experience-card');
    const file = `${__dirname}/_portal-exp-${name}.png`;
    if (card) {
      await card.screenshot({ path: file });
      written.push(file);
      console.log(`wrote ${file}`);
    } else {
      console.log(`no .experience-card at ${w}`);
    }
    await page.close();
  }
  console.log(`\n${written.length} screenshot(s) written`);
  await browser.close();
};

run().catch((error) => {
  console.error(error);
  process.exit(2);
});
