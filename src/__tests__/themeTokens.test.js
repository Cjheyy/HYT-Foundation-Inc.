import fs from 'fs';
import path from 'path';

/**
 * The dark-theme contract.
 *
 * Dark mode is implemented as a single block of token overrides in index.css.
 * That only works if every component reads a token: one literal `background:
 * #fff` and that element stays a white slab with near-white text on it, which
 * is exactly what happened to the public header, the `.section.bg-white` bands
 * and the footer before this suite existed.
 *
 * Two invariants are enforced here, both against the real files:
 *
 *   1. Token parity. Every custom property declared in `:root` is restated in
 *      `[data-theme='dark']`, unless it is in the brand palette (the identity
 *      colours, which must NOT change between themes). A new token added to
 *      `:root` and forgotten in the dark block fails here.
 *
 *   2. No theme-blind surfaces. No stylesheet outside index.css may paint a
 *      light background, border or text colour with a hex literal. The two
 *      exceptions are the brand yellow and light cyan, which are meant to stay
 *      bright in both themes.
 *
 * Neither can be caught by a DOM test: jsdom does not resolve the cascade
 * against a `data-theme` attribute, and it has no idea what a stylesheet says.
 */

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const INDEX_CSS = path.join(SRC, 'index.css');

/** Brand identity colours. Constant by design, so absent from the dark block. */
const BRAND_TOKENS = [
  '--primary-orange',
  '--strong-orange',
  '--yellow',
  '--teal',
  '--light-cyan',
  '--very-light-cyan',
  '--white'
];

/** Hex values that are meant to stay bright in both themes. */
const BRAND_HEXES = ['#F3DB6E', '#B4E5F1'];

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const read = (file) => stripComments(fs.readFileSync(file, 'utf8'));

/** WCAG relative luminance, 0 (black) to 1 (white). */
function luminance(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  h = h.slice(0, 6);
  const channel = (v) => {
    const c = parseInt(v, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(h.slice(0, 2)) +
    0.7152 * channel(h.slice(2, 4)) +
    0.0722 * channel(h.slice(4, 6))
  );
}

/** Anything lighter than this reads as a "light surface" on a dark page. */
const LIGHT_THRESHOLD = 0.62;

function collectCssFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      collectCssFiles(full, out);
    } else if (entry.name.endsWith('.css')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * index.css is scanned too, but never its token blocks - that is precisely where
 * the light literals are supposed to live. Excluding the file outright (as an
 * earlier version did) let 16 light backgrounds hide there, including the
 * `.schedule-preview` box and every status badge.
 */
const readForScan = (file) => {
  const source = read(file);
  if (file !== INDEX_CSS) return source;
  return source
    .replace(/:root\s*\{[\s\S]*?\n\}/, '')
    .replace(/\[data-theme='dark'\]\s*\{[\s\S]*?\n\}/, '');
};

const block = (css, selector) => {
  const match = css.match(new RegExp(selector + '\\s*\\{([\\s\\S]*?)\\n\\}'));
  if (!match) throw new Error(`Could not find the ${selector} block in index.css`);
  return match[1];
};

const tokensIn = (cssBlock) =>
  new Set([...cssBlock.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));

describe('theme tokens', () => {
  const css = read(INDEX_CSS);
  const rootTokens = tokensIn(block(css, ':root'));
  const darkTokens = tokensIn(block(css, "\\[data-theme='dark'\\]"));

  it('declares the full surface palette in :root', () => {
    const required = [
      '--background',
      '--surface',
      '--surface-alt',
      '--surface-sunken',
      '--surface-frosted',
      '--dark-text',
      '--muted-text',
      '--muted-text-strong',
      '--border',
      '--border-strong',
      '--footer-ink'
    ];
    required.forEach((token) => expect([...rootTokens]).toContain(token));
  });

  it('restates every non-brand token in the dark block', () => {
    const missing = [...rootTokens]
      .filter((token) => !BRAND_TOKENS.includes(token))
      .filter((token) => !darkTokens.has(token));

    expect(missing).toEqual([]);
  });

  it('keeps the brand palette out of the dark block', () => {
    const leaked = [...darkTokens].filter((token) => BRAND_TOKENS.includes(token));
    expect(leaked).toEqual([]);
  });

  it('gives the dark block no tokens that :root does not define', () => {
    const orphans = [...darkTokens].filter((token) => !rootTokens.has(token));
    expect(orphans).toEqual([]);
  });
});

describe('no theme-blind colours outside index.css', () => {
  const files = collectCssFiles(SRC);
  const declaration = /(background(?:-color)?|border(?:-[a-z]+)?(?:-color)?|color)\s*:\s*([^;}]+)/gi;
  const hex = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;

  it('scans a realistic number of stylesheets', () => {
    // Guards against the walker silently finding nothing and the suite passing.
    expect(files.length).toBeGreaterThan(40);
  });

  it('uses tokens, not light hex literals, for surfaces and text', () => {
    const offences = [];

    files.forEach((file) => {
      const relative = path.relative(ROOT, file).replace(/\\/g, '/');
      const source = readForScan(file);

      for (const match of source.matchAll(declaration)) {
        const property = match[1].toLowerCase();
        // White text on a saturated brand fill is legitimate and theme-safe.
        const isTextProperty = property === 'color';

        for (const literal of match[2].matchAll(hex)) {
          const value = '#' + literal[1].toUpperCase();
          if (BRAND_HEXES.includes(value)) continue;
          if (isTextProperty && (value === '#FFFFFF' || value === '#FFF')) continue;
          if (luminance(value) <= LIGHT_THRESHOLD) continue;

          offences.push(`${relative}: ${property}: ${value}`);
        }
      }
    });

    expect(offences).toEqual([]);
  });
});

describe('no theme-blind colours in inline styles', () => {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
        walk(full);
      } else if (/\.jsx?$/.test(entry.name) && !/\.test\.jsx?$/.test(entry.name)) {
        files.push(full);
      }
    }
  };
  walk(SRC);

  it('does not paint light surfaces from a style prop', () => {
    const declaration = /(background|backgroundColor|border|borderColor)\s*:\s*['"]([^'"]+)['"]/g;
    const hex = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;
    const offences = [];

    files.forEach((file) => {
      const relative = path.relative(ROOT, file).replace(/\\/g, '/');
      for (const match of read(file).matchAll(declaration)) {
        for (const literal of match[2].matchAll(hex)) {
          const value = '#' + literal[1].toUpperCase();
          if (BRAND_HEXES.includes(value)) continue;
          if (luminance(value) <= LIGHT_THRESHOLD) continue;
          offences.push(`${relative}: ${match[1]}: ${value}`);
        }
      }
    });

    expect(offences).toEqual([]);
  });
});
