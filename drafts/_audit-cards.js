/**
 * Card contrast audit.
 *
 * Walks the public routes, finds every text node inside a `.card`, resolves the
 * background that text is ACTUALLY painted on (including gradient stops
 * composited over whatever is behind them), and applies the WCAG large-text
 * rule:
 *
 *   >= 24px, or >= 18.66px && weight >= 700  ->  3:1
 *   everything else                          ->  4.5:1
 *
 * Grouped output by card class so a single rule can be blamed once.
 *
 * Usage:
 *   node drafts/_audit-cards.js http://127.0.0.1:4323
 */
const puppeteer = require('puppeteer-core');

const BASE = process.argv[2] || 'http://127.0.0.1:4323';
const ROUTES = ['/', '/about', '/programs', '/opportunities', '/contact', '/impact', '/login', '/register'];

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const run = async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', `--user-data-dir=${process.env.TEMP || '/tmp'}/audit-cards-${Date.now()}`]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1200, deviceScaleFactor: 1 });

  const audit = () => {
    const parseColor = (value) => {
      const m = String(value).match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const parts = m[1].split(',').map((p) => parseFloat(p.trim()));
      return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
    };

    const over = (fg, bg) => ({
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
      a: 1
    });

    const lum = (c) => {
      const ch = (v) => {
        const s = v / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
    };

    const ratio = (a, b) => {
      const la = lum(a);
      const lb = lum(b);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    };

    const hex = (c) => `#${[c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

    /** Every colour stop in a gradient string, or null when not a gradient. */
    const gradientStops = (image) => {
      if (!image || image === 'none' || !image.includes('gradient')) return null;
      const stops = [];
      const re = /rgba?\([^)]+\)/g;
      let m;
      while ((m = re.exec(image))) {
        const c = parseColor(m[0]);
        if (c) stops.push(c);
      }
      return stops.length ? stops : null;
    };

    /** The surfaces behind `el`, nearest first, resolved to concrete colours. */
    const backgroundLayers = (el) => {
      const layers = [];
      let node = el;
      while (node && node.nodeType === 1) {
        const cs = getComputedStyle(node);
        const stops = gradientStops(cs.backgroundImage);
        if (stops) {
          // A gradient is opaque enough to be the answer; sample its stops.
          const base = layers.length ? layers[layers.length - 1] : { r: 255, g: 255, b: 255, a: 1 };
          return stops.map((s) => (s.a < 1 ? over(s, base) : s));
        }
        const bg = parseColor(cs.backgroundColor);
        if (bg && bg.a > 0) {
          if (bg.a >= 1) return [bg];
          layers.push(bg);
        }
        node = node.parentElement;
      }
      // Composite any translucent layers over white.
      let acc = { r: 255, g: 255, b: 255, a: 1 };
      for (let i = layers.length - 1; i >= 0; i -= 1) acc = over(layers[i], acc);
      return [acc];
    };

    const offenders = [];
    const cardStats = new Map();

    document.querySelectorAll('.card').forEach((card) => {
      const cardClass = card.className;
      const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const text = node.nodeValue && node.nodeValue.trim();
        if (!text) continue;
        const el = node.parentElement;
        if (!el) continue;
        if (el.closest('[aria-hidden="true"]')) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) continue;

        const fg = parseColor(cs.color);
        if (!fg || fg.a === 0) continue;
        const fontSize = parseFloat(cs.fontSize);
        const weight = parseInt(cs.fontWeight, 10) || 400;
        const isLarge = fontSize >= 24 || (fontSize >= 18.66 && weight >= 700);
        const need = isLarge ? 3 : 4.5;

        const backgrounds = backgroundLayers(el);
        let worst = Infinity;
        let worstBg = null;
        backgrounds.forEach((bg) => {
          const solid = fg.a < 1 ? over(fg, bg) : fg;
          const value = ratio(solid, bg);
          if (value < worst) { worst = value; worstBg = bg; }
        });

        if (!cardStats.has(cardClass)) cardStats.set(cardClass, { cards: 0, texts: 0, bad: 0 });
        const stat = cardStats.get(cardClass);
        stat.texts += 1;

        if (worst < need) {
          stat.bad += 1;
          offenders.push({
            cardClass,
            text: text.slice(0, 40),
            el: `${el.tagName.toLowerCase()}.${String(el.className || '').split(' ').filter(Boolean).join('.')}`,
            ratio: Math.round(worst * 100) / 100,
            need,
            fg: hex(fg),
            bg: hex(worstBg),
            size: `${fontSize}px/${weight}`
          });
        }
      }
    });

    return {
      cards: document.querySelectorAll('.card').length,
      offenders,
      cardStats: [...cardStats.entries()].map(([k, v]) => ({ cardClass: k, ...v }))
    };
  };

  let total = 0;
  for (const route of ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 700));
    const result = await page.evaluate(audit);

    console.log(`\n=== ${route}  (${result.cards} cards, ${result.offenders.length} offenders)`);
    if (result.offenders.length) {
      const byCard = new Map();
      result.offenders.forEach((o) => {
        if (!byCard.has(o.cardClass)) byCard.set(o.cardClass, []);
        byCard.get(o.cardClass).push(o);
      });
      for (const [cardClass, list] of byCard) {
        console.log(`  .card  ${cardClass}`);
        list.slice(0, 12).forEach((o) => {
          console.log(`      ${String(o.ratio).padEnd(6)} (need ${o.need})  ${o.fg} on ${o.bg}  ${o.size}  "${o.text}"`);
        });
        if (list.length > 12) console.log(`      ... and ${list.length - 12} more`);
      }
    }
    total += result.offenders.length;
  }

  console.log(`\nTOTAL OFFENDERS: ${total}`);
  await browser.close();
  process.exit(total === 0 ? 0 : 1);
};

run().catch((error) => {
  console.error(error);
  process.exit(2);
});
