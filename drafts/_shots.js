/**
 * Visual evidence capture: the gradient-card treatment (image #1) and the
 * partner dialog (item 10).  Usage: node drafts/_shots.js <baseUrl> <outDir>
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const BASE = process.argv[2] || 'http://127.0.0.1:4334';
const OUT = process.argv[3] || 'drafts/shots';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const run = async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', `--user-data-dir=${process.env.TEMP || '/tmp'}/shots-${Date.now()}`]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });

  // 1. Public About — partner tiles.
  await page.goto(`${BASE}/about`, { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    const el = document.querySelector('#partners');
    if (el) el.scrollIntoView({ block: 'start' });
  });
  await new Promise((r) => setTimeout(r, 700));
  await page.screenshot({ path: path.join(OUT, 'about-partners.png') });

  // 2. Partner dialog open.
  const opened = await page.evaluate(() => {
    const tile = document.querySelector('.partner-chip');
    if (!tile) return false;
    tile.click();
    return true;
  });
  if (opened) {
    await new Promise((r) => setTimeout(r, 700));
    await page.screenshot({ path: path.join(OUT, 'partner-modal.png') });
  }

  // 3. Public Programs listing (postings + badges).
  await page.goto(`${BASE}/programs`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 700));
  await page.screenshot({ path: path.join(OUT, 'programs.png') });

  console.log('captured ->', OUT);
  await browser.close();
};

run().catch((error) => { console.error(error); process.exit(1); });
