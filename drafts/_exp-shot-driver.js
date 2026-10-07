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
