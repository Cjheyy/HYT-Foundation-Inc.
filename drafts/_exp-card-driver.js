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
  card.querySelectorAll('.experience-item-title, .experience-item-org, .experience-item-dates, .experience-progress-label, .experience-tile-label, .experience-tile-value').forEach((el) => {
    const cs = getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
    const lines = Math.max(1, Math.round(el.getBoundingClientRect().height / lh));
    if (lines > 1) {
      wrapped.push({ cls: el.className.toString().slice(0, 26), lines, text: el.textContent.trim().slice(0, 30) });
    }
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
  const fill = card.querySelector('.experience-progress-fill');
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

const run = async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_EXE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', `--user-data-dir=${process.env.TEMP || '/tmp'}/exp-card-${Date.now()}`]
  });

  // Independent expectation, computed in this same process/timezone from the
  // fixture's own offset. If the card's date maths slips a day (the UTC trap in
  // toLocalISODate) this is what catches it.
  const startDate = new Date(now - 5 * 86400000);
  const expectedStart = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const currentYear = String(new Date(now).getFullYear());
  console.log(`expected start label: "${expectedStart}", year ${currentYear}`);

  let failures = 0;
  const fail = (msg) => {
    failures += 1;
    console.log(`  FAIL  ${msg}`);
  };
  const ok = (msg) => console.log(`  ok    ${msg}`);

  for (const width of WIDTHS) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
    await page.setRequestInterception(true);
    attachStub(page, STUDENT_PROFILE);
    await page.evaluateOnNewDocument(
      (key, session) => window.localStorage.setItem(key, JSON.stringify(session)),
      STORAGE_KEY,
      buildSession(STUDENT_PROFILE)
    );

    console.log(`\n================= viewport ${width}px =================`);
    try {
      await page.goto(`${BASE}/student/dashboard`, { waitUntil: 'networkidle2', timeout: 45000 });
      await sleep(900);

      if (page.url().includes('/student/dashboard')) {
        ok('stayed on /student/dashboard');
      } else {
        fail(`redirected to ${page.url()}`);
      }

      const r = await page.evaluate(cardProbe);
      if (!r.found) {
        fail('.experience-card not found');
        await page.close();
        continue;
      }

      console.log(`  card ${r.cardWidth}x${r.cardHeight}px, ${r.itemCount} entr(y|ies)`);
      console.log(`  titles  ${JSON.stringify(r.titles)}`);
      console.log(`  orgs    ${JSON.stringify(r.orgs)}`);
      console.log(`  dates   ${JSON.stringify(r.dates)}`);
      console.log(`  tiles   ${JSON.stringify(r.tiles)}`);
      console.log(`  progress "${r.progressLabel}" ${r.progressValue}`);
      console.log(`  badge   "${r.badgeText}" [${r.badgeClass}]`);
      console.log(`  cta     "${r.ctaText}" [${r.ctaVariant}]`);

      // --- the card actually rendered real data
      if (r.itemCount === 1) ok('one experience rendered');
      else fail(`expected 1 experience, got ${r.itemCount}`);
      if (r.titles[0] === 'Backend Developer Intern') ok('title from the listing');
      else fail(`unexpected title "${r.titles[0]}"`);
      if (r.orgs[0] === 'Acme Software Corp') ok('organisation from the listing');
      else fail(`unexpected org "${r.orgs[0]}"`);

      // --- the date range is right (and not 1970 / Invalid)
      const dates = r.dates[0] || '';
      if (dates.startsWith(expectedStart)) ok(`date range starts ${expectedStart}`);
      else fail(`date range "${dates}" does not start with "${expectedStart}"`);
      if (!/1970|Invalid|NaN|undefined/.test(dates)) ok('no placeholder dates');
      else fail(`placeholder in dates: "${dates}"`);
      if (dates.includes(currentYear)) ok(`date range carries ${currentYear}`);
      else fail(`date range "${dates}" is missing ${currentYear}`);

      // --- the two figures are the fixture's, with units
      if (/Rendered\s*32\.00\s*h/.test(r.tiles[0] || '')) ok('rendered = 32.00 h');
      else fail(`rendered tile "${r.tiles[0]}"`);
      if (/Remaining\s*48\.00\s*h/.test(r.tiles[1] || '')) ok('remaining = 48.00 h');
      else fail(`remaining tile "${r.tiles[1]}"`);
      if (r.progressLabel === 'Progress · 80.00 h required') ok('denominator stated');
      else fail(`progress label "${r.progressLabel}"`);
      if (r.progressValue === '40.0%') ok('40.0% (32/80)');
      else fail(`progress value "${r.progressValue}"`);

      // --- the fill is proportional and never paints at zero
      const pct = parseFloat(r.fillPercent);
      if (Math.abs(pct - 40) < 0.01) ok(`fill width ${r.fillPercent}`);
      else fail(`fill width ${r.fillPercent}`);
      if (r.fillWidth > 0 && r.fillWidth < r.cardWidth) ok(`fill painted ${r.fillWidth}px`);
      else fail(`fill painted ${r.fillWidth}px inside a ${r.cardWidth}px card`);

      // --- the badge is the teal variant
      if (/\bbadge-teal\b/.test(r.badgeClass)) ok('badge uses badge-teal');
      else fail(`badge class "${r.badgeClass}"`);

      // --- the CTA is demoted off btn-primary
      if (/\bbtn-outline\b/.test(r.ctaVariant) && !/\bbtn-primary\b/.test(r.ctaVariant)) {
        ok('CTA is btn-outline');
      } else {
        fail(`CTA class "${r.ctaVariant}"`);
      }

      // --- nothing wrapped, clipped or overflowed
      if (r.wrapped.length === 0) ok('no wrapped rows');
      else r.wrapped.forEach((w) => fail(`wrapped ${w.lines} lines: ${w.cls} "${w.text}"`));
      if (r.clipped.length === 0) ok('nothing clipped');
      else r.clipped.forEach((c) => fail(`clipped ${c.need}px into ${c.have}px: ${c.cls} "${c.text}"`));
      if (r.overflowing.length === 0) ok('no overflowing boxes');
      else r.overflowing.forEach((o) => fail(`overflow +${o.over}px: ${o.cls}`));

      // --- contrast
      if (r.offenders.length === 0) ok(`contrast: 0 offenders`);
      else
        r.offenders.forEach((o) =>
          fail(`contrast ${o.ratio}:1 (need ${o.need}) ${o.cls} ${o.size}px "${o.text}"`)
        );
    } catch (error) {
      fail(`threw: ${error.message}`);
    }
    await page.close();
  }

  console.log(`\n=================================================`);
  console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} FAILURE(S)`);
  await browser.close();
  process.exit(failures === 0 ? 0 : 1);
};

run().catch((error) => {
  console.error(error);
  process.exit(2);
});
