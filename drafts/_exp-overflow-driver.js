/* ==========================================================================
 * Page-level horizontal-overflow probe.
 *
 * Why: the scoped card probe only inspects the card's own subtree.  If the
 * dashboard GRID is forced wider than its container — because the card has a
 * min-content floor (the meta row is org + gap + dates, all nowrap) — the
 * overflow lives on `.dashboard-grid` / the content area, not on the card, and
 * the scoped probe reports a clean pass while the page scrolls sideways.
 *
 * The card at the 900px viewport measured 292px wide, which is exactly the
 * min-content sum of the meta row.  That is the fingerprint of a grid being
 * pushed past its track, so measure the document, not the card.
 * ========================================================================== */

const PROBE_WIDTHS = [1920, 1440, 1280, 1024, 900, 834, 768, 640, 480, 390, 360];

const overflowProbe = () => {
  const de = document.documentElement;
  const out = {
    inner: window.innerWidth,
    docScroll: de.scrollWidth,
    docClient: de.clientWidth,
    over: de.scrollWidth - de.clientWidth
  };
  const grid = document.querySelector('.dashboard-grid');
  if (grid) {
    const r = grid.getBoundingClientRect();
    out.grid = { width: Math.round(r.width), left: Math.round(r.left), right: Math.round(r.right) };
    out.gridScroll = grid.scrollWidth;
    out.gridClient = grid.clientWidth;
  }
  const card = document.querySelector('.experience-card');
  if (card) out.card = Math.round(card.getBoundingClientRect().width);

  // Which element is sticking out the furthest to the right?
  let worst = null;
  document.querySelectorAll('*').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1) return;
    const spill = Math.round(r.right - de.clientWidth);
    if (spill > 1 && (!worst || spill > worst.spill)) {
      worst = { cls: el.className.toString().slice(0, 40), tag: el.tagName, spill };
    }
  });
  out.worst = worst;
  return out;
};

const run = async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_EXE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', `--user-data-dir=${process.env.TEMP || '/tmp'}/exp-of-${Date.now()}`]
  });

  let bad = 0;
  for (const width of PROBE_WIDTHS) {
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

    const r = await page.evaluate(overflowProbe);
    const flag = r.over > 0 ? 'OVERFLOW' : 'ok';
    if (r.over > 0) bad += 1;
    console.log(
      `${flag.padEnd(9)} vw=${String(r.inner).padEnd(5)} doc ${r.docScroll}/${r.docClient} (over ${r.over})` +
        `  card=${r.card}px  grid=${r.grid ? r.grid.width + 'px' : 'n/a'}` +
        (r.worst ? `  worst=${r.worst.tag}.${r.worst.cls} +${r.worst.spill}px` : '')
    );
    await page.close();
  }

  console.log(bad === 0 ? '\nNo horizontal page overflow at any width.' : `\n${bad} width(s) overflow horizontally.`);
  await browser.close();
  process.exit(bad === 0 ? 0 : 1);
};

run().catch((error) => {
  console.error(error);
  process.exit(2);
});
