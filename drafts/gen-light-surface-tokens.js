/**
 * Generate the "light surface re-points the tokens" block for index.css.
 *
 * WHY THIS EXISTS
 * ---------------
 * `.card` paints the brand gradient (teal -> orange) and therefore sets
 * `--dark-text`/`--muted-text`/`--border` to white-ish values.  A light chip
 * rendered INSIDE a card (an amber notice, a white table wrapper, a #F9FAFB
 * panel) then inherits those white tokens, so its own dark text is replaced by
 * near-white on a pale surface.
 *
 * CSS cannot detect "this element painted itself light", so the fix is to make
 * every light surface re-point the tokens for its own subtree.  The key
 * property that makes this safe to over-apply: a custom property is INERT
 * unless something consumes it.  The only consumers are `.card` and its
 * descendants, so a remap on an element that is not inside a card does
 * nothing at all.
 *
 * This script walks every stylesheet, finds each TOP-LEVEL rule that paints a
 * light background, and emits a companion rule carrying the token remap taken
 * from that rule's own `color` (falling back to the standard light-surface
 * pair).  Rules nested in a @media block are skipped: a surface that is only
 * light at one breakpoint would otherwise get dark tokens at every width.
 *
 * Usage: node drafts/gen-light-surface-tokens.js > block.css
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');

const LIGHT_BG = /(?:^|\s)(?:background|background-color)\s*:\s*([^;]+);/gi;

/**
 * Relative luminance of an #rrggbb string.
 *
 * Strips a leading `#` first: callers pass both forms (the `contrastOnWhite`
 * path used the bare hex, the ramp walk passes the `#`-prefixed literals), and
 * `parseInt('#6B7280', 16)` is NaN — which silently made every `#`-prefixed
 * colour measure as pure black, so the first ramp candidate always "passed".
 */
const luminance = (hex) => {
  const bare = String(hex).replace('#', '');
  const full = bare.length === 3 ? bare.split('').map((c) => c + c).join('') : bare;
  const n = parseInt(full, 16);
  const ch = (v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
};

/** WCAG contrast ratio between two #rrggbb colours. */
const contrast = (a, b) => {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
};

/** WCAG contrast of a hex colour against white. */
const contrastOnWhite = (hex) => contrast(hex, 'ffffff');

/**
 * Custom properties that resolve to a light surface.
 *
 * `var(--background)` is #F9FBFC here — near-white.  Without this list the
 * walker reads "no literal hex" as "not light" and skips the rule, which is why
 * the admin list rows kept near-white text on a pale row (1.04:1).
 */
const LIGHT_VAR_TOKENS = [
  '--background',
  '--surface',
  '--card-bg',
  '--card-background',
  '--white',
  '--bg',
  '--light',
  '--light-bg',
  '--very-light-cyan',
];

/** Does the background value reference a known light custom property? */
const usesLightVar = (value) => {
  const v = String(value).toLowerCase();
  return LIGHT_VAR_TOKENS.some((token) => v.includes(`var(${token}`));
};

/**
 * Does this background value paint a light surface?
 *
 * A channel threshold ("all of R,G,B >= 0xE0") is NOT good enough: the badge
 * palette uses pale tints such as #DBEAFE (blue-100) and #D1FAE5 (green-100)
 * whose red channel is only 0xD1-0xDB.  Those are unmistakably light surfaces,
 * and missing them is what left the card badges with near-white text on a pale
 * chip.  Luminance is the honest test.
 */
const isLightBackground = (value) => {
  const v = String(value).trim().toLowerCase();
  if (/\b(white|#fff\b|#ffffff\b)/.test(v)) return true;
  if (usesLightVar(v)) return true;
  const hex = v.match(/#([0-9a-f]{3}|[0-9a-f]{6})\b/);
  if (!hex) return false;
  return luminance(hex[1]) >= 0.55;
};

/** The hex a light background value actually resolves to, for contrast maths. */
const hexOfBackground = (value) => {
  const v = String(value).trim().toLowerCase();
  const hex = v.match(/#([0-9a-f]{3}|[0-9a-f]{6})\b/);
  if (hex) return hex[1];
  if (v.includes('var(--very-light-cyan')) return 'b4e5f1';
  if (v.includes('var(--white')) return 'ffffff';
  if (usesLightVar(v)) return 'f9fbfc';
  return 'ffffff';
};

/**
 * The dark text a light surface should carry.
 *
 * Prefers the rule's own `color` whenever that colour is itself legible on the
 * surface it actually paints (>= 4.6:1) — that is what keeps a badge blue, a
 * success chip green and a rejection chip red instead of flattening them all
 * to grey.  When it is not legible, walk the grey ramp until the muted colour
 * clears the surface, so a #F9FBFC row gets a darker grey than a #FFF card.
 */
const darkPairFor = (body, background) => {
  const colorMatch = body.match(/(?:^|[\s;])color\s*:\s*([^;]+);/i);
  const raw = colorMatch ? colorMatch[1].trim() : '';
  const value = raw.toLowerCase();

  const surface = hexOfBackground(background);

  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(value)) {
    const hex = value.slice(1);
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    if (contrast(full, surface) >= 4.6) return { strong: raw, muted: raw };
  }

  for (const candidate of ['#6B7280', '#5B6472', '#4B5563', '#374151', '#1F2937']) {
    if (contrast(candidate, surface) >= 4.6) {
      const strong = contrast('#1F2937', surface) >= 4.6 ? '#1F2937' : '#111827';
      return { strong, muted: candidate };
    }
  }

  return { strong: '#1F2937', muted: '#6B7280' };
};

const collectCssFiles = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectCssFiles(full, out);
    else if (entry.name.endsWith('.css')) out.push(full);
  }
  return out;
};

/** Walk a stylesheet, yielding only brace-depth-1 rules. */
const topLevelRules = (css) => {
  const rules = [];
  let depth = 0;
  let selectorStart = 0;
  let bodyStart = -1;

  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i];
    if (ch === '{') {
      if (depth === 0) {
        bodyStart = i + 1;
        rules.push({ selector: css.slice(selectorStart, i), nested: false, body: null, _bodyStart: i + 1 });
      }
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        const rule = rules[rules.length - 1];
        if (rule && rule.body === null && rule._bodyStart === bodyStart) {
          rule.body = css.slice(rule._bodyStart, i);
        }
        selectorStart = i + 1;
      }
      if (depth < 0) depth = 0;
    }
  }

  // Any rule whose selector starts with @ is an at-rule wrapper, not a rule.
  return rules.filter((rule) => rule.body !== null && !rule.selector.trim().startsWith('@'));
};

const seen = new Set();
const entries = [];

/**
 * Second pass: rules that set a DARK hardcoded text colour.
 *
 * The on-gradient text rule in index.css targets phrasing elements
 * (`span`, `p`, `td`, ...).  That is not enough: dozens of card styles use a
 * `<div>` for a label or a value, and a div is not phrasing content, so
 * `.stat-label { color: #666 }` survived and rendered #666 on the gradient.
 *
 * Adding `div` to the global rule is the wrong fix — it would clobber the
 * deliberate accents (`.stat-value { color: var(--yellow) }` is a single class
 * too).  Instead this pass emits a CARD-SCOPED override for exactly those rules
 * whose colour is a dark literal:
 *
 *   .card .stat-label { color: var(--muted-text); }
 *
 * Specificity (0,2,0) beats both the original rule (0,1,0) and the global
 * phrasing rule (0,1,1).  The colour is only treated as text when it is legible
 * on white (>= 4.5:1); a light accent like #F3DB6E (1.38:1) or #10b981
 * (2.54:1) is deliberately left alone, which is what preserves the accents.
 * Anything between 4.5:1 and 8:1 is treated as secondary text, at or above 8:1
 * as primary text.
 */
const textOverrides = [];
const seenText = new Set();

for (const file of collectCssFiles(SRC)) {
  const rel = path.relative(SRC, file).replace(/\\/g, '/');
  const css = fs.readFileSync(file, 'utf8');

  for (const rule of topLevelRules(css)) {
    const selector = rule.selector
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!selector || selector.includes('--dark-text')) continue;
    // Only class selectors; never touch element, id, :root or .card itself.
    if (!/^[.:#\w-]/.test(selector) || selector.startsWith('@')) continue;
    if (/(^|[\s,])\.card(\s|$|[,.:])/.test(` ${selector}`)) continue;
    if (/:hover|:focus|:active|:disabled/.test(selector)) continue;

    const colorMatch = rule.body.match(/(?:^|[\s;])color\s*:\s*([^;]+);/i);
    if (!colorMatch) continue;
    const raw = colorMatch[1].trim();
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) continue;

    const hex = raw.slice(1);
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    const onWhite = contrastOnWhite(full);
    if (onWhite < 4.5) continue; // a light accent — leave it alone

    const token = onWhite >= 8 ? '--dark-text' : '--muted-text';
    const key = `${selector}|${token}`;
    if (seenText.has(key)) continue;
    seenText.add(key);
    textOverrides.push({ selector, token, file: rel });
  }
}

for (const file of collectCssFiles(SRC)) {
  const rel = path.relative(SRC, file).replace(/\\/g, '/');
  const css = fs.readFileSync(file, 'utf8');

  for (const rule of topLevelRules(css)) {
    const selector = rule.selector
      .replace(/\/\*[\s\S]*?\*\//g, ' ')  // strip comments that precede the selector
      .replace(/\s+/g, ' ')
      .trim();
    if (!selector || selector.includes('--dark-text')) continue;
    if (selector === '.card' || selector === ':root' || selector === '*') continue;
    if (/^\.card\b/.test(selector) && /(card--surface|:has\()/.test(selector)) continue;

    LIGHT_BG.lastIndex = 0;
    let match;
    let light = false;
    let surface = '';
    while ((match = LIGHT_BG.exec(rule.body))) {
      if (isLightBackground(match[1])) { light = true; surface = match[1]; break; }
    }
    if (!light) continue;

    const key = `${selector}|${rel}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // The background value is passed through so the muted grey is chosen
    // against the surface the rule ACTUALLY paints.  Without it the ramp was
    // always walked against white and #6B7280 (4.44:1 on #EFF6FF) slipped
    // through on the palest tints.
    entries.push({ selector, ...darkPairFor(rule.body, surface), file: rel });
  }
}

// Emit, grouped and commented by source file so the block stays reviewable.
const byFile = new Map();
for (const entry of entries) {
  if (!byFile.has(entry.file)) byFile.set(entry.file, []);
  byFile.get(entry.file).push(entry);
}

const lines = [];
lines.push('/* ==== GENERATED: light surfaces re-point the card text tokens ====');
lines.push(' *');
lines.push(' * Produced by drafts/gen-light-surface-tokens.js.  Every rule below paints a');
lines.push(' * light background, so it must hand its subtree dark text tokens — otherwise');
lines.push(' * a card ancestor would push near-white text onto a pale chip.');
lines.push(' *');
lines.push(' * Safe to over-apply: a custom property is inert unless consumed, and the only');
lines.push(' * consumers are `.card` and its descendants.  A remap outside a card is a no-op.');
lines.push(' */');

for (const [file, list] of [...byFile.entries()].sort()) {
  lines.push('');
  lines.push(`/* ${file} */`);
  for (const entry of list) {
    lines.push(`${entry.selector} {`);
    lines.push(`  --dark-text: ${entry.strong};`);
    lines.push(`  --muted-text: ${entry.muted};`);
    // The `color` line is NOT redundant with the token remap.  A bare <div>
    // with no `color` of its own INHERITS the computed colour from `.card`
    // (white) — the tokens are only read by descendants that consume them.
    // Measured example: `.admin-item` paints var(--background) but its
    // `.admin-item-name` child has no colour, so it rendered #FFFFFF on
    // #F9FBFC (1.04:1).  Declaring `color` here gives the subtree a dark
    // baseline to inherit, which is what actually fixes that class of bug.
    lines.push(`  color: ${entry.strong};`);
    lines.push('}');
  }
}
lines.push('');

lines.push('/* ==== GENERATED: dark hardcoded text re-pointed to the card tokens ==== */');
const textByFile = new Map();
for (const entry of textOverrides) {
  if (!textByFile.has(entry.file)) textByFile.set(entry.file, []);
  textByFile.get(entry.file).push(entry);
}
for (const [file, list] of [...textByFile.entries()].sort()) {
  lines.push('');
  lines.push(`/* ${file} */`);
  for (const entry of list) {
    lines.push(`.card ${entry.selector} { color: var(${entry.token}); }`);
  }
}
lines.push('');

process.stdout.write(lines.join('\n'));
process.stderr.write(
  `light-surface rules: ${entries.length} across ${byFile.size} files; ` +
  `text overrides: ${textOverrides.length} across ${textByFile.size} files\n`
);
