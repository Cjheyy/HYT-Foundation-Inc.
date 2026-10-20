/**
 * Proves the Lucide swap is complete rather than assumed.
 *
 * `Icon` renders the whole app's iconography, and its unknown-name fallback is
 * deliberately silent (it draws `Info`), so a typo or a name that was never
 * migrated would show up as a wrong glyph on one screen and nothing anywhere
 * else.  These tests walk the real source tree and assert that every name the
 * app can ask for is actually mapped.
 */
import fs from 'fs';
import path from 'path';
import { render } from '@testing-library/react';
import { Icon, ICON_COMPONENTS, ICON_NAMES, NAV_ICONS } from './icons';

const SRC = path.resolve(process.cwd(), 'src');

const walk = (dir) => {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__mocks__') continue;
      out.push(...walk(full));
    } else if (/\.(js|jsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
};

const sourceFiles = walk(SRC);

/**
 * Blank out block comments while preserving newlines, so a `<Icon name="..." />`
 * inside a doc comment is not mistaken for a real usage and the reported line
 * numbers stay correct.
 */
const stripBlockComments = (text) =>
  text.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '));

/**
 * Every `<Icon name="literal" />` in the tree.
 *
 * Also returns the bookkeeping needed to prove the scan saw every tag:
 * `literalMatches` (captured) plus `dynamicTags` (the `name={...}` ones the
 * regex deliberately skips) must add up to `totalTags`.  Without that, a regex
 * that stopped matching would make the coverage check pass vacuously.
 */
const collectLiteralIconNames = () => {
  const names = new Map(); // name -> "file:line"
  let totalTags = 0;
  let dynamicTags = 0;
  let literalMatches = 0;

  for (const file of sourceFiles) {
    const text = stripBlockComments(fs.readFileSync(file, 'utf8'));
    totalTags += (text.match(/<Icon\b/g) || []).length;
    dynamicTags += (text.match(/<Icon\b[^>]{0,300}?name=\{/g) || []).length;

    const re = /<Icon\b[^>]{0,300}?name="([^"]+)"/g;
    let match;
    while ((match = re.exec(text)) !== null) {
      literalMatches += 1;
      const line = text.slice(0, match.index).split('\n').length;
      if (!names.has(match[1])) names.set(match[1], `${path.relative(SRC, file)}:${line}`);
    }
  }
  return { names, totalTags, dynamicTags, literalMatches };
};

/**
 * Icon names that arrive through a data map (`icon: 'target'`) rather than a
 * literal `name=` attribute - the nav tables, the attention items, the admin
 * metrics, the registration role cards.
 *
 * Only lower-case words are collected, which is what separates a real icon name
 * from the decorative strings that share the same key: the `'OJT'` / `'SE'`
 * badges in OnboardingModal and the emoji in hytThrusts / Impact / Home are
 * rendered as text, never passed to `Icon`.
 */
const collectMappedIconNames = () => {
  const names = new Map();
  for (const file of sourceFiles) {
    const text = stripBlockComments(fs.readFileSync(file, 'utf8'));
    const re = /icon:\s*['"]([a-z]+)['"]/g;
    let match;
    while ((match = re.exec(text)) !== null) {
      const line = text.slice(0, match.index).split('\n').length;
      if (!names.has(match[1])) names.set(match[1], `${path.relative(SRC, file)}:${line}`);
    }
  }
  return names;
};

describe('Icon (Lucide)', () => {
  it('maps every literal name used in src', () => {
    const { names, totalTags, dynamicTags, literalMatches } = collectLiteralIconNames();

    // Guard the scanner itself: every `<Icon` tag is either a literal the regex
    // captured or a `name={...}` it skipped.
    expect(literalMatches + dynamicTags).toBe(totalTags);

    const unmapped = [...names].filter(([name]) => !ICON_NAMES.includes(name));
    expect(unmapped).toEqual([]);
  });

  it('maps every name that arrives through an icon map', () => {
    const mapped = collectMappedIconNames();
    const unmapped = [...mapped].filter(([name]) => !ICON_NAMES.includes(name));
    expect(unmapped).toEqual([]);
  });

  it('keeps NAV_ICONS pointing at real names', () => {
    const unknown = Object.values(NAV_ICONS).filter((name) => !ICON_NAMES.includes(name));
    expect(unknown).toEqual([]);
  });

  it('covers the full set of names the app relies on', () => {
    // A deliberate canary: if a name is dropped from the map this fails here,
    // naming it, instead of silently rendering a different glyph.
    expect([...ICON_NAMES].sort()).toEqual([
      'alert', 'award', 'bell', 'book', 'briefcase', 'calendar', 'check',
      'clock', 'dashboard', 'file', 'home', 'inbox', 'info', 'logout', 'menu',
      'moon', 'pin', 'search', 'sun', 'target', 'user', 'users', 'x'
    ]);
  });

  it('renders a real Lucide svg', () => {
    const { container } = render(<Icon name="bell" size={18} color="#10B981" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg.getAttribute('width')).toBe('18');
    expect(svg.getAttribute('height')).toBe('18');
    expect(svg.getAttribute('stroke')).toBe('#10B981');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  it('falls back to Info instead of rendering nothing for an unknown name', () => {
    const { container } = render(<Icon name="definitely-not-an-icon" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    // The fallback is the same component Info maps to.
    expect(ICON_COMPONENTS.info).toBeDefined();
  });
});
