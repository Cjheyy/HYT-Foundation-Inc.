/* ==========================================================================
 * One-off probe: dump the computed style + the *matched* CSS rules for the
 * badge and the progress fill on the real /student/dashboard.
 *
 * Why this exists: the verifier reported the badge at 4.11:1 when the source
 * rule (.badge-teal) should give 7.10:1.  Hand-reading 2100 lines of index.css
 * to find the winner is guesswork; asking the browser which rules actually
 * matched is evidence.  4.11:1 is exactly #6B7280 (var(--muted-text)) on
 * #DDF0F4, so *something* is re-declaring the colour and it is not a
 * .card .badge-* rule (there is none for teal).
 * ========================================================================== */

// CHROME_EXE, sleep and attachStub all come from the harness above (lines 1-450
// of _verify-experience-card.js), which is why they are not re-declared here.

const dumpProbe = () => {
  const out = {};

  const rulesMatching = (el, needle) => {
    const hits = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch (e) {
        continue; // cross-origin sheet
      }
      if (!rules) continue;
      const walk = (list, media) => {
        for (const rule of Array.from(list)) {
          if (rule.cssRules && !rule.selectorText) {
            walk(rule.cssRules, rule.conditionText || media);
            continue;
          }
          if (!rule.selectorText) continue;
          for (const sel of rule.selectorText.split(',').map((s) => s.trim())) {
            if (needle && !sel.includes(needle)) continue;
            let m = false;
            try {
              m = el.matches(sel);
            } catch (e) {
              continue;
            }
            if (m) hits.push({ sel, media: media || null, css: rule.style.cssText });
          }
        }
      };
      walk(rules, null);
    }
    return hits;
  };

  const keep = (hits) => hits.filter((h) => /font-size|color|white-space|text-overflow|overflow|font-weight/.test(h.css));

  const badge = document.querySelector('.experience-item-head .badge')
    || document.querySelector('.experience-card .badge');
  if (badge) {
    const cs = getComputedStyle(badge);
    out.badge = {
      text: badge.textContent,
      className: badge.className,
      inlineStyle: badge.getAttribute('style'),
      color: cs.color,
      background: cs.backgroundColor,
      fontSize: cs.fontSize,
      parentClass: badge.parentElement.className,
      parentColor: getComputedStyle(badge.parentElement).color,
      matched: keep(rulesMatching(badge, null))
    };
  } else {
    out.badge = null;
  }

  const fill = document.querySelector('.experience-progress .progress-bar-fill')
    || document.querySelector('.progress-bar-fill');
  if (fill) {
    const r = fill.getBoundingClientRect();
    const pr = fill.parentElement.getBoundingClientRect();
    out.fill = {
      className: fill.className,
      inlineWidth: fill.style.width,
      computedWidth: getComputedStyle(fill).width,
      rectWidth: Math.round(r.width),
      parentRectWidth: Math.round(pr.width),
      parentClass: fill.parentElement.className
    };
  } else {
    out.fill = null;
  }

  out.progressOuterHtml = document.querySelector('.experience-progress')
    ? document.querySelector('.experience-progress').outerHTML.replace(/\s+/g, ' ').slice(0, 700)
    : null;

  const title = document.querySelector('.experience-item-title');
  if (title) {
    const r = title.getBoundingClientRect();
    const cs = getComputedStyle(title);
    out.title = {
      text: title.textContent,
      rectWidth: Math.round(r.width),
      scrollWidth: title.scrollWidth,
      clientWidth: title.clientWidth,
      headWidth: Math.round(title.parentElement.getBoundingClientRect().width),
      fontSize: cs.fontSize,
      textOverflow: cs.textOverflow,
      whiteSpace: cs.whiteSpace,
      overflow: cs.overflow,
      headDisplay: getComputedStyle(title.parentElement).display,
      headGap: getComputedStyle(title.parentElement).gap,
      titleFlex: cs.flex,
      titleMinWidth: cs.minWidth,
      siblingClasses: Array.from(title.parentElement.children).map((c) => c.className),
      matched: keep(rulesMatching(title, null))
    };
  } else {
    out.title = null;
  }

  const card = document.querySelector('.experience-card');
  out.cardWidth = card ? Math.round(card.getBoundingClientRect().width) : null;

  return out;
};

const run = async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_EXE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', `--user-data-dir=${process.env.TEMP || '/tmp'}/exp-dump-${Date.now()}`]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 1000, deviceScaleFactor: 1 });
  await page.setRequestInterception(true);
  attachStub(page, STUDENT_PROFILE);
  await page.evaluateOnNewDocument(
    (key, session) => window.localStorage.setItem(key, JSON.stringify(session)),
    STORAGE_KEY,
    buildSession(STUDENT_PROFILE)
  );

  await page.goto(`${BASE}/student/dashboard`, { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(900);

  const data = await page.evaluate(dumpProbe);
  console.log(JSON.stringify(data, null, 2));

  await browser.close();
};

run().catch((err) => {
  console.error('PROBE CRASHED:', err && err.stack ? err.stack : err);
  process.exit(1);
});
