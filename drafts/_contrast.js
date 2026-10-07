/**
 * Shared card-contrast audit, serialisable into page.evaluate().
 *
 * No closures over Node values — everything it needs is resolved inside the
 * browser, so it can be passed straight to `page.evaluate`.
 */
const contrastAudit = (options = {}) => {
  const minRatioOverride = options.minRatio || null;

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

  const hex = (c) =>
    `#${[c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

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

  /** Resolve the colour(s) actually painted behind `el`. */
  const backgroundLayers = (el) => {
    const layers = [];
    let node = el;
    while (node && node.nodeType === 1) {
      const cs = getComputedStyle(node);
      const stops = gradientStops(cs.backgroundImage);
      if (stops) {
        // Composite the translucent layers collected on the way up BEFORE the
        // gradient is sampled.  Skipping this step reported the bare gradient
        // for text sitting on a dark translucent chip, which hid the real
        // (and much worse) contrast of e.g. #666 on rgba(14,23,38,0.28).
        let base = stops;
        for (let i = layers.length - 1; i >= 0; i -= 1) {
          base = base.map((stop) => over(layers[i], stop));
        }
        return base;
      }
      const bg = parseColor(cs.backgroundColor);
      if (bg && bg.a > 0) {
        if (bg.a >= 1) {
          let solid = bg;
          for (let i = layers.length - 1; i >= 0; i -= 1) solid = over(layers[i], solid);
          return [solid];
        }
        layers.push(bg);
      }
      node = node.parentElement;
    }
    let acc = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i -= 1) acc = over(layers[i], acc);
    return [acc];
  };

  const offenders = [];
  const cardStats = new Map();
  const scope = options.root || document;

  scope.querySelectorAll(options.cardSelector || '.card').forEach((card) => {
    const cardClass = String(card.className || '');
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
      const need = minRatioOverride || (isLarge ? 3 : 4.5);

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
    cards: scope.querySelectorAll(options.cardSelector || '.card').length,
    offenders,
    cardStats: [...cardStats.entries()].map(([k, v]) => ({ cardClass: k, ...v }))
  };
};

module.exports = { contrastAudit };
