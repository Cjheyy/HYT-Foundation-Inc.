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

const run = async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', `--user-data-dir=${process.env.TEMP || '/tmp'}/audit-portals-${Date.now()}`]
  });

  let total = 0;
  const scenarios = [
    { name: 'admin', profile: ADMIN_PROFILE, routes: ADMIN_ROUTES },
    { name: 'student', profile: STUDENT_PROFILE, routes: STUDENT_ROUTES },
    { name: 'trainee', profile: TRAINEE_PROFILE, routes: TRAINEE_ROUTES }
  ].filter((s) => WHICH === 'both' || WHICH === s.name);

  for (const scenario of scenarios) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1200, deviceScaleFactor: 1 });

    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = request.url();
      if (!url.includes(SUPABASE_HOST)) {
        request.continue();
        return;
      }
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
        request.respond({
          status,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify(body)
        });

      const parsed = new URL(url);
      const pathname = parsed.pathname;

      if (pathname.startsWith('/auth/v1/user')) return json(scenario.profile);
      if (pathname.startsWith('/auth/v1/token')) return json(buildSession(scenario.profile));
      if (pathname.startsWith('/auth/v1/logout')) return json({}, 204);
      if (pathname.startsWith('/auth/v1/')) return json({});

      if (pathname.startsWith('/rest/v1/rpc/')) {
        // Dashboard aggregate RPCs: let the app fall back to its own queries by
        // reporting the function as missing, exactly as an un-migrated database
        // would.
        return json({ code: 'PGRST202', message: 'function not found' }, 404);
      }

      if (pathname.startsWith('/rest/v1/')) {
        const table = pathname.replace('/rest/v1/', '');
        const rows = rowsFor(table, url, scenario.profile.id);
        // `.single()` / `.maybeSingle()` request a bare object.
        const wantsObject = request.headers().accept &&
          request.headers().accept.includes('vnd.pgrst.object');
        if (wantsObject) {
          if (!rows.length) return json({ code: 'PGRST116', message: 'no rows' }, 406);
          return json(rows[0]);
        }
        return json(rows);
      }

      return json({});
    });

    await page.evaluateOnNewDocument(
      (key, session) => {
        window.localStorage.setItem(key, JSON.stringify(session));
      },
      STORAGE_KEY,
      buildSession(scenario.profile)
    );

    console.log(`\n########## ${scenario.name.toUpperCase()} PORTAL ##########`);
    for (const route of scenario.routes) {
      try {
        await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle2', timeout: 45000 });
        await new Promise((r) => setTimeout(r, 900));
        const finalUrl = page.url().replace(BASE, '');
        const result = await page.evaluate(contrastAudit, {});

        if (SHOTS_DIR) {
          const name = route.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root';
          await page.screenshot({ path: path.join(SHOTS_DIR, `${scenario.name}-${name}.png`), fullPage: true });
        }
        const note = finalUrl !== route ? `  [redirected -> ${finalUrl}]` : '';
        console.log(`\n=== ${route}  (${result.cards} cards, ${result.offenders.length} offenders)${note}`);
        if (result.offenders.length) {
          const byCard = new Map();
          result.offenders.forEach((o) => {
            if (!byCard.has(o.cardClass)) byCard.set(o.cardClass, []);
            byCard.get(o.cardClass).push(o);
          });
          for (const [cardClass, list] of byCard) {
            console.log(`  .card  ${cardClass}`);
            list.slice(0, 10).forEach((o) => {
              console.log(`      ${String(o.ratio).padEnd(6)} (need ${o.need})  ${o.fg} on ${o.bg}  ${o.size}  "${o.text}"`);
            });
            if (list.length > 10) console.log(`      ... and ${list.length - 10} more`);
          }
        }
        total += result.offenders.length;
      } catch (error) {
        console.log(`\n=== ${route}  FAILED: ${error.message}`);
      }
    }
    await page.close();
  }

  console.log(`\nTOTAL PORTAL OFFENDERS: ${total}`);
  await browser.close();
  process.exit(total === 0 ? 0 : 1);
};

run().catch((error) => {
  console.error(error);
  process.exit(2);
});
