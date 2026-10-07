const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const HOST = new URL((env.match(/REACT_APP_SUPABASE_URL\s*=\s*(\S+)/) || [])[1]).hostname;
const KEY = ['sb', HOST.split('.')[0], 'auth-token'].join('-');
const ID = '11111111-1111-4111-8111-111111111111';
const now = Date.now();
const iso = (d) => new Date(now + d * 86400000).toISOString();
const PROFILE = {
  id: ID,
  email: 'admin@hytfoundation.org',
  role: 'ADMIN',
  full_name: 'Hydee Tabao',
  account_type: 'admin',
  application_status: 'APPROVED',
  is_active: true,
  created_at: iso(-60)
};
const session = {
  access_token: 't',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(now / 1000) + 3600,
  refresh_token: 'r',
  user: {
    id: ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: PROFILE.email,
    app_metadata: {},
    user_metadata: {},
    identities: [],
    created_at: iso(-60)
  }
};

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', `--user-data-dir=${process.env.TEMP}/probe-${Date.now()}`]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  await page.setRequestInterception(true);

  const seen = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes(HOST)) {
      const parsed = new URL(url);
      seen.push(`${request.method()} ${parsed.pathname}${parsed.search || ''}`);
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
      const pn = parsed.pathname;
      if (pn.startsWith('/auth/v1/user')) return json(PROFILE);
      if (pn.startsWith('/auth/v1/token')) return json(session);
      if (pn.startsWith('/auth/v1/logout')) return json({}, 204);
      if (pn.startsWith('/auth/v1/')) return json({});
      if (pn.startsWith('/rest/v1/rpc/')) {
        return json({ code: 'PGRST202', message: 'function not found' }, 404);
      }
      if (pn.startsWith('/rest/v1/')) {
        const table = pn.replace('/rest/v1/', '');
        const rows = table === 'users' ? [PROFILE] : [];
        const wantsObject = (request.headers().accept || '').includes('vnd.pgrst.object');
        if (wantsObject) {
          return rows.length ? json(rows[0]) : json({ code: 'PGRST116', message: 'no rows' }, 406);
        }
        return json(rows);
      }
      return json({});
    }
    request.continue();
  });

  page.on('console', (message) => {
    const text = message.text();
    if (/error|fail|supabase|auth|denied/i.test(text)) console.log('  console:', text.slice(0, 240));
  });

  await page.evaluateOnNewDocument(
    (key, value) => window.localStorage.setItem(key, JSON.stringify(value)),
    KEY,
    session
  );

  await page.goto('http://127.0.0.1:4324/admin/dashboard', { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise((resolve) => setTimeout(resolve, 2500));

  console.log('URL:', page.url());
  console.log('storageKey:', KEY);
  console.log('--- supabase requests ---');
  seen.slice(0, 30).forEach((line) => console.log('  ', line));
  const text = await page.evaluate(() => document.body.innerText.slice(0, 900));
  console.log('--- body text ---\n' + text);

  await browser.close();
})();
