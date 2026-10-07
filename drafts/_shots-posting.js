/**
 * Screenshots of each posting surface at REST and on HOVER, so the two states
 * can be compared side by side.
 *
 * Usage: node drafts/_shots-posting.js http://127.0.0.1:PORT
 */
const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.argv[2] || 'http://127.0.0.1:4392';
const OUT = 'C:/Users/Christian Mabbayad/Downloads/HYTFoundation/hyt-foundation/drafts/posting-shots';

const TARGETS = [
  { route: '/programs', sel: '.program-card', name: 'programs' },
  { route: '/opportunities', sel: '.opportunity-card', name: 'opportunities' },
  { route: '/', sel: '.reveal-card', name: 'home-featured' },
  { route: '/impact', sel: '.story-card', name: 'impact-control' },
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', `--user-data-dir=${process.env.TEMP || '/tmp'}/shots-posting-${Date.now()}`],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 950, deviceScaleFactor: 1 });

  for (const t of TARGETS) {
    await page.goto(BASE + t.route, { waitUntil: 'load' });
    await page.evaluate(async () => {
      const step = Math.round(window.innerHeight * 0.5);
      for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 100));
      }
      window.scrollTo(0, 0);
    });
    await new Promise((r) => setTimeout(r, 600));

    // `body { scroll-behavior: smooth }` makes scrollIntoView animate, so the
    // rect must be re-read AFTER the scroll settles — measuring in the same
    // evaluate captures a mid-animation position and crops the card in half.
    const found = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      return true;
    }, t.sel);

    if (!found) {
      console.log(`skip ${t.name}: ${t.sel} not found`);
      continue;
    }
    await new Promise((r) => setTimeout(r, 500));

    // screenshot({ clip }) wants DOCUMENT coordinates, but getBoundingClientRect
    // returns VIEWPORT coordinates — so a scrolled page needs the scroll offset
    // added, or the crop lands on the wrong part of the card.
    const box = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      const r = el.getBoundingClientRect();
      return {
        x: r.x + window.scrollX,
        y: r.y + window.scrollY,
        w: r.width,
        h: r.height,
      };
    }, t.sel);

    const clip = {
      x: Math.max(0, box.x - 16),
      y: Math.max(0, box.y - 16),
      width: Math.min(1440, box.w + 32),
      height: box.h + 32,
    };

    await page.screenshot({ path: path.join(OUT, `${t.name}-rest.png`), clip });
    await page.hover(t.sel);
    await new Promise((r) => setTimeout(r, 900));
    await page.screenshot({ path: path.join(OUT, `${t.name}-hover.png`), clip });
    console.log(`shot ${t.name}`);
  }

  await browser.close();
  process.exit(0);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
