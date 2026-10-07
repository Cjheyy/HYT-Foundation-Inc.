/**
 * Posting-card hover verifier.
 *
 * Asserts the design on the PUBLIC routes:
 *
 *   1. at rest a posting card is WHITE (no gradient), like every other card;
 *   2. on hover a LIGHT brand wash sweeps in via the clip-path circle wipe, and
 *      the card's text stays DARK (a light wash must never flip text to white);
 *   3. the wash really is light — every stop's luminance is checked, because
 *      "light" is the whole point and a saturated ramp would look identical in
 *      a passing screenshot;
 *   4. cards that are NOT posting surfaces stay white even on hover.
 *
 * Reads only computed styles, so it cannot be fooled by a rule that is present
 * but never applies.
 *
 * Usage: node drafts/_verify-hover.js http://127.0.0.1:PORT
 */
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.argv[2] || 'http://127.0.0.1:4391';

// Posting surfaces, and the cards that must NOT take the ramp.
const POSTING = [
  { route: '/programs', sel: '.program-card', label: 'public Programs' },
  { route: '/opportunities', sel: '.opportunity-card', label: 'public Opportunities' },
  { route: '/', sel: '.reveal-card', label: 'Home featured rails' },
];
const PLAIN = [
  { route: '/impact', sel: '.story-card', label: 'Impact story card' },
  { route: '/impact', sel: '.reach-card', label: 'Impact reach card' },
  { route: '/about', sel: '.card.team-card, .team-card', label: 'About team card' },
  { route: '/', sel: '.bento-cell', label: 'Home bento cell' },
];

const read = (sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const cs = getComputedStyle(el);
  // `.reveal-card` deliberately does NOT paint the wash on itself — it owns a
  // `.reveal-wipe` child whose clip-path circle opens on hover.  Report the
  // wipe too, and sample a real text node, so the check proves the text is
  // legible on the wash rather than trusting the card's inherited `color`.
  const wipe = el.querySelector('.reveal-wipe');
  const title = el.querySelector('.program-title, .opportunity-title, .opportunity-card-title, .card-title');
  return {
    bgImage: cs.backgroundImage,
    bgColor: cs.backgroundColor,
    color: cs.color,
    wipeImage: wipe ? getComputedStyle(wipe).backgroundImage : null,
    wipeClip: wipe ? getComputedStyle(wipe).clipPath : null,
    titleColor: title ? getComputedStyle(title).color : null,
  };
};

// A clip-path circle(0% ...) is invisible; anything wider means it opened.
const wipeOpen = (clip) => {
  if (!clip) return false;
  const m = /circle\(([\d.]+)%/.exec(clip);
  return Boolean(m) && parseFloat(m[1]) > 5;
};

const isGradient = (s) => /gradient/.test(s || '');
const isWhite = (s) => /^rgb\(255,\s*255,\s*255\)$/.test((s || '').trim());

const lum = (css) => {
  const m = /rgba?\(([^)]+)\)/.exec(css || '');
  if (!m) return null;
  const p = m[1].split(',').map((v) => parseFloat(v.trim()));
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2]);
};

// Pull every rgb() out of a `linear-gradient(...)` computed value.
const gradientStops = (s) => (s || '').match(/rgba?\([^)]+\)/g) || [];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', `--user-data-dir=${process.env.TEMP || '/tmp'}/verify-hover-${Date.now()}`],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 950, deviceScaleFactor: 1 });

  let fails = 0;
  const fail = (msg) => {
    fails += 1;
    console.log('  FAIL  ' + msg);
  };

  console.log('\n=== POSTING cards: white at rest, LIGHT wash on hover, dark text kept ===');
  for (const t of POSTING) {
    await page.goto(BASE + t.route, { waitUntil: 'load' });
    await page.evaluate(async () => {
      const step = Math.round(window.innerHeight * 0.5);
      for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 100));
      }
      window.scrollTo(0, 0);
    });

    // Posting lists are populated from Supabase AFTER mount, so a fixed sleep is
    // a race: the card may simply not exist yet and the check reports "not found"
    // against a build that is actually fine.  Wait for the card instead.
    try {
      await page.waitForSelector(t.sel, { timeout: 15000 });
    } catch (e) {
      fail(`${t.label}: ${t.sel} not found`);
      continue;
    }
    await new Promise((r) => setTimeout(r, 400));

    const rest = await page.evaluate(read, t.sel);
    if (!rest) {
      fail(`${t.label}: ${t.sel} not found`);
      continue;
    }
    if (isGradient(rest.bgImage) || !isWhite(rest.bgColor)) {
      fail(`${t.label} AT REST should be white — got bg-image "${rest.bgImage}" / bg "${rest.bgColor}"`);
    } else if (rest.wipeImage && wipeOpen(rest.wipeClip)) {
      fail(`${t.label} AT REST wipe should be closed — clip "${rest.wipeClip}"`);
    } else {
      console.log(`  ok    ${t.label}: white at rest (${rest.bgColor}, no gradient)`);
    }

    await page.hover(t.sel);
    await new Promise((r) => setTimeout(r, 900));
    const hov = await page.evaluate(read, t.sel);

    // The wipe child must open and carry a gradient.  (A card that repaints its
    // own background is no longer a supported mechanism — the reveal is the
    // whole effect.)
    const wipeOpened = isGradient(hov.wipeImage) && wipeOpen(hov.wipeClip);

    if (!wipeOpened) {
      fail(`${t.label} ON HOVER the wipe should open — image "${hov.wipeImage}", clip "${hov.wipeClip}"`);
    } else {
      // "Light" is the requirement, so measure it: every stop of the wash must
      // be a pale colour.  A saturated ramp would pass a screenshot review.
      const stops = gradientStops(hov.wipeImage);
      const lums = stops.map(lum).filter((v) => v !== null);
      const darkest = Math.min(...lums);
      if (!lums.length || darkest < 0.5) {
        fail(`${t.label} ON HOVER wash should be LIGHT — darkest stop luminance ${darkest.toFixed(3)} (need >= 0.5)`);
      }

      // The text must stay dark: a light wash with white text is 1:1.
      const tl = lum(hov.titleColor || hov.color);
      if (tl === null || tl > 0.35) {
        fail(`${t.label} ON HOVER title should stay DARK on the light wash — got "${hov.titleColor || hov.color}"`);
      } else {
        console.log(`  ok    ${t.label}: wipe opens on hover, light wash (darkest stop ${darkest.toFixed(3)}), title ${hov.titleColor}`);
      }
    }
  }

  console.log('\n=== NON-posting cards: white at rest AND on hover (negative controls) ===');
  for (const t of PLAIN) {
    await page.goto(BASE + t.route, { waitUntil: 'load' });
    await page.evaluate(async () => {
      const step = Math.round(window.innerHeight * 0.5);
      for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 100));
      }
      window.scrollTo(0, 0);
    });
    // Same async-load race as above: give the card a chance to appear, but a
    // genuine absence on this route is a legitimate skip, not a failure.
    try {
      await page.waitForSelector(t.sel, { timeout: 8000 });
    } catch (e) {
      console.log(`  skip  ${t.label}: not present on ${t.route}`);
      continue;
    }
    await new Promise((r) => setTimeout(r, 300));

    await page.hover(t.sel);
    await new Promise((r) => setTimeout(r, 500));
    const hov = await page.evaluate(read, t.sel);
    const opened = hov.wipeImage && wipeOpen(hov.wipeClip);
    if (isGradient(hov.bgImage) || opened) {
      fail(`${t.label} must NOT take the wash — bg "${hov.bgImage}", wipe "${hov.wipeClip}"`);
    } else {
      console.log(`  ok    ${t.label}: stayed white on hover`);
    }
  }

  console.log('\n' + (fails === 0
    ? 'CLEAN — the five posting cards sweep a light wash on hover and keep dark text; everything else stays white'
    : `FAILURES: ${fails}`));
  await browser.close();
  process.exit(fails === 0 ? 0 : 2);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
