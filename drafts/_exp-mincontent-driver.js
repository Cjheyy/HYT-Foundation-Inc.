/* ==========================================================================
 * Per-child min-content probe.
 *
 * The card renders at 292px minimum at the 900px viewport, 33px more than the
 * card it replaced (259px, measured on the pre-V3 build).  That extra 33px is
 * what turns a pre-existing 27px page overflow into a 60px one.
 *
 * Measure each BLOCK child of the card at `width: min-content` — reliable for
 * block boxes, unlike measuring the card itself, which is a grid item whose
 * width is owned by the track.
 * ========================================================================== */

const MC_WIDTH = 900;

const minContentProbe = () => {
  const card = document.querySelector('.experience-card');
  if (!card) return { found: false };
  const de = document.documentElement;

  const mc = (el) => {
    const prev = el.style.width;
    el.style.width = 'min-content';
    void de.offsetWidth;
    const w = Math.round(el.getBoundingClientRect().width);
    el.style.width = prev;
    void de.offsetWidth;
    return w;
  };

  const cardStyle = getComputedStyle(card);
  const out = {
    cardWidth: Math.round(card.getBoundingClientRect().width),
    cardPadding: `${cardStyle.paddingLeft}/${cardStyle.paddingRight}`,
    children: []
  };

  // Walk the card's block-level descendants, one level of nesting deep, and
  // report the min-content of each leaf-ish container.
  const walk = (parent, depth) => {
    Array.from(parent.children).forEach((el) => {
      const cs = getComputedStyle(el);
      const isContainer = el.children.length > 0;
      const label = `${'  '.repeat(depth)}${el.tagName}.${el.className.toString().slice(0, 30)}`;
      if (isContainer && depth < 3) {
        out.children.push({ label, min: mc(el), display: cs.display });
        walk(el, depth + 1);
      } else if (!isContainer) {
        out.children.push({ label, min: mc(el), display: cs.display });
      }
    });
  };
  walk(card, 0);

  // The CTA button specifically — buttons are the usual nowrap culprit.
  const cta = card.querySelector('.btn-outline');
  if (cta) {
    const cs = getComputedStyle(cta);
    out.cta = {
      min: mc(cta),
      whiteSpace: cs.whiteSpace,
      text: cta.textContent.trim(),
      scrollWidth: cta.scrollWidth,
      clientWidth: cta.clientWidth
    };
  }
  return { found: true, ...out };
};

const run = async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_EXE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', `--user-data-dir=${process.env.TEMP || '/tmp'}/exp-mc-${Date.now()}`]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: MC_WIDTH, height: 1000, deviceScaleFactor: 1 });
  await page.setRequestInterception(true);
  attachStub(page, STUDENT_PROFILE);
  await page.evaluateOnNewDocument(
    (key, session) => window.localStorage.setItem(key, JSON.stringify(session)),
    STORAGE_KEY,
    buildSession(STUDENT_PROFILE)
  );
  await page.goto(`${BASE}/student/dashboard`, { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(900);

  const r = await page.evaluate(minContentProbe);
  if (!r.found) {
    console.log('card not found');
    await browser.close();
    return;
  }
  console.log(`card ${r.cardWidth}px, padding ${r.cardPadding}`);
  if (r.cta) {
    console.log(`CTA min-content ${r.cta.min}px  white-space=${r.cta.whiteSpace}  scrollWidth=${r.cta.scrollWidth} clientWidth=${r.cta.clientWidth}`);
    console.log(`CTA text "${r.cta.text}"`);
  }
  console.log('\nmin-content of each descendant (deepest last):');
  r.children
    .sort((a, b) => b.min - a.min)
    .forEach((c) => console.log(`  ${String(c.min).padStart(4)}px  [${c.display}] ${c.label}`));

  await browser.close();
};

run().catch((error) => {
  console.error(error);
  process.exit(2);
});
