/**
 * Full-page screenshots of the public routes, at REST (no hover), so the white
 * cards can be reviewed end to end.
 *
 * Usage: node drafts/_shots-public.js http://127.0.0.1:PORT
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.argv[2] || 'http://127.0.0.1:4393';
const OUT = 'C:/Users/Christian Mabbayad/Downloads/HYTFoundation/hyt-foundation/drafts/public-shots-final';
const ROUTES = ['/', '/programs', '/opportunities', '/impact', '/about'];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', `--user-data-dir=${process.env.TEMP || '/tmp'}/shots-public-${Date.now()}`],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });

  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: 'load' });
    await page.evaluate(async () => {
      const step = Math.round(window.innerHeight * 0.5);
      for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 110));
      }
      window.scrollTo(0, 0);
    });
    await new Promise((r) => setTimeout(r, 800));
    const name = route === '/' ? 'home' : route.replace(/\//g, '');
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
    console.log('shot ' + name);
  }

  await browser.close();
  process.exit(0);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
