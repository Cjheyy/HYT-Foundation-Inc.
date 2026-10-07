/* ==========================================================================
 * Attribution probe: is the 900px/834px horizontal overflow caused by the
 * OJT / Experience card, or is it pre-existing?
 *
 * Method: at a width that overflows, measure `.main-content` as-is, then hide
 * the experience card and measure again.  If main-content is still too wide,
 * the card is not the cause and the overflow belongs to the page shell
 * (fixed 280px sidebar + `repeat(auto-fit, minmax(300px, 1fr))`).
 *
 * Guessing here would be easy and wrong: the card happens to sit at 292px,
 * which is suspiciously close to the 300px track minimum, so the honest answer
 * needs a controlled A/B rather than arithmetic.
 * ========================================================================== */

const ATTRIB_WIDTHS = [900, 834, 1024];

const attribProbe = () => {
  const de = document.documentElement;
  const mc = document.querySelector('.main-content');
  const grid = document.querySelector('.dashboard-grid');
  const card = document.querySelector('.experience-card');
  const box = (el) => (el ? Math.round(el.getBoundingClientRect().width) : null);

  const snap = () => ({
    docOver: de.scrollWidth - de.clientWidth,
    main: box(mc),
    grid: box(grid),
    card: box(card)
  });

  const before = snap();
  let after = null;
  if (card) {
    const prev = card.style.display;
    card.style.display = 'none';
    // force layout
    void de.offsetWidth;
    after = snap();
    card.style.display = prev;
  }

  return { before, after };
};

const run = async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_EXE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', `--user-data-dir=${process.env.TEMP || '/tmp'}/exp-attr-${Date.now()}`]
  });

  for (const width of ATTRIB_WIDTHS) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
    await page.setRequestInterception(true);
    attachStub(page, STUDENT_PROFILE);
    await page.evaluateOnNewDocument(
      (key, session) => window.localStorage.setItem(key, JSON.stringify(session)),
      STORAGE_KEY,
      buildSession(STUDENT_PROFILE)
    );
    await page.goto(`${BASE}/student/dashboard`, { waitUntil: 'networkidle2', timeout: 45000 });
    await sleep(900);

    const r = await page.evaluate(attribProbe);
    console.log(`\n--- viewport ${width}px ---`);
    console.log(`  card visible : doc over ${r.before.docOver}px | main ${r.before.main}px | grid ${r.before.grid}px | card ${r.before.card}px`);
    console.log(`  card hidden  : doc over ${r.after.docOver}px | main ${r.after.main}px | grid ${r.after.grid}px`);
    console.log(
      r.after.docOver > 0
        ? '  => overflow SURVIVES hiding the card: pre-existing shell issue'
        : '  => overflow DISAPPEARS without the card: the card causes it'
    );
    await page.close();
  }

  await browser.close();
};

run().catch((error) => {
  console.error(error);
  process.exit(2);
});
