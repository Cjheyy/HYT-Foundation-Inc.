/* ==========================================================================
 * Min-content ablation probe.
 *
 * The card at the 900px viewport has a min-content floor that forces the
 * `1fr` grid columns wider than the container, producing a 60px horizontal
 * page overflow.  Rather than reason about which child sets that floor, hide
 * one child at a time and watch the card's min-content width drop.
 *
 * `width: min-content` on the card asks the browser directly, so the number is
 * measured, not derived.
 * ========================================================================== */

const ABL_WIDTH = 900;

const ablationProbe = () => {
  const card = document.querySelector('.experience-card');
  if (!card) return { found: false };

  const de = document.documentElement;
  const mc = document.querySelector('.main-content');
  const grid = document.querySelector('.dashboard-grid');

  const minContentOf = (el) => {
    const prev = el.style.width;
    el.style.width = 'min-content';
    void de.offsetWidth;
    const w = Math.round(el.getBoundingClientRect().width);
    el.style.width = prev;
    void de.offsetWidth;
    return w;
  };

  const rows = [];
  rows.push({ label: '(baseline, nothing hidden)', cardMin: minContentOf(card), docOver: de.scrollWidth - de.clientWidth });

  // Every element inside the card, deepest-last, each hidden in turn.
  const candidates = Array.from(card.querySelectorAll('*')).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && el.children.length === 0;
  });

  const seen = new Set();
  for (const el of candidates) {
    const cls = el.className.toString();
    if (seen.has(cls)) continue;
    seen.add(cls);
    const prev = el.style.display;
    el.style.display = 'none';
    void de.offsetWidth;
    rows.push({
      label: `hide ${el.tagName}.${cls || '(no class)'}`,
      cardMin: minContentOf(card),
      docOver: de.scrollWidth - de.clientWidth
    });
    el.style.display = prev;
    void de.offsetWidth;
  }

  // Also: the card's own padding, and the container geometry
  const geo = {
    main: Math.round(mc.getBoundingClientRect().width),
    grid: Math.round(grid.getBoundingClientRect().width),
    gridCols: getComputedStyle(grid).gridTemplateColumns,
    cardMin: minContentOf(card)
  };

  return { found: true, geo, rows: rows.sort((a, b) => a.cardMin - b.cardMin) };
};

const run = async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_EXE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', `--user-data-dir=${process.env.TEMP || '/tmp'}/exp-abl-${Date.now()}`]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: ABL_WIDTH, height: 1000, deviceScaleFactor: 1 });
  await page.setRequestInterception(true);
  attachStub(page, STUDENT_PROFILE);
  await page.evaluateOnNewDocument(
    (key, session) => window.localStorage.setItem(key, JSON.stringify(session)),
    STORAGE_KEY,
    buildSession(STUDENT_PROFILE)
  );
  await page.goto(`${BASE}/student/dashboard`, { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(900);

  const r = await page.evaluate(ablationProbe);
  if (!r.found) {
    console.log('card not found');
    await browser.close();
    return;
  }
  console.log(`viewport ${ABL_WIDTH}px`);
  console.log(`main ${r.geo.main}px | grid ${r.geo.grid}px | cols ${r.geo.gridCols} | card min-content ${r.geo.cardMin}px`);
  console.log('\ncard min-content with each leaf hidden (lowest = biggest contributor):');
  r.rows.forEach((row) => {
    console.log(`  ${String(row.cardMin).padStart(4)}px  docOver ${String(row.docOver).padStart(4)}  ${row.label}`);
  });

  await browser.close();
};

run().catch((error) => {
  console.error(error);
  process.exit(2);
});
