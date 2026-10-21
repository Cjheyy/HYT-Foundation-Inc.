import fs from 'fs';
import path from 'path';

/**
 * The dashboard list-height contract.
 *
 * The "Active Application" / "Events" cards cap their list with a scroll. That
 * cap used to be a flat `max-height: 264px`, which is three rows and 50px of a
 * fourth: the last card was sliced in half right under the "View my
 * applications" button, so the list read as broken rather than scrollable.
 *
 * The cap is now derived from the row height and gap, and `grid-auto-rows` pins
 * every row to that same height - which is what makes the arithmetic true. If
 * either half of that pair is changed on its own, rows get shaved again, and
 * jsdom cannot see it (no layout). Hence a source-level guard.
 */

const CSS_PATH = path.join(process.cwd(), 'src', 'pages', 'student', 'Dashboard.css');
const CSS = fs.readFileSync(CSS_PATH, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Every `selector { body }` pair, comments already stripped. */
const rules = (css) => {
  const found = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = re.exec(css)) !== null) {
    found.push({ selector: match[1].trim(), body: match[2] });
  }
  return found;
};

const RULES = rules(CSS);

const ruleFor = (selector) =>
  RULES.find((rule) => rule.selector.split(',').some((part) => part.trim() === selector));

describe('the dashboard scroll cap is a whole number of rows', () => {
  const list = ruleFor('.active-app-list');

  test('the list rule exists', () => {
    expect(list).toBeDefined();
  });

  test('the row height, the gap and the visible count are named variables', () => {
    // Named, not inlined, because the cap below has to be built from the same
    // numbers - three copies of "66" is how they drift apart.
    expect(list.body).toMatch(/--active-row-height:\s*\d+px/);
    expect(list.body).toMatch(/--active-row-gap:\s*\d+px/);
    expect(list.body).toMatch(/--active-visible-rows:\s*\d+/);
  });

  test('every row is pinned to that height', () => {
    // Without this the rows size themselves and the cap stops being exact.
    expect(list.body).toMatch(/grid-auto-rows:\s*var\(--active-row-height\)/);
  });

  test('the cap is computed from the row height, not a magic pixel value', () => {
    expect(list.body).toMatch(/max-height:\s*calc\(/);
    expect(list.body).toMatch(/var\(--active-row-height\)\s*\*\s*var\(--active-visible-rows\)/);
    expect(list.body).toMatch(/var\(--active-row-gap\)/);
  });

  test('no bare max-height in pixels survives on the list', () => {
    // This is the exact regression: someone restores `max-height: 264px`.
    const maxHeights = list.body.match(/max-height:[^;]+;/g) || [];
    expect(maxHeights.length).toBeGreaterThan(0);
    maxHeights.forEach((declaration) => {
      expect(declaration).not.toMatch(/\d+px\s*;/);
    });
  });

  test('the row fills the height the grid gave it', () => {
    const row = ruleFor('.active-app-row');
    expect(row).toBeDefined();
    expect(row.body).toMatch(/height:\s*100%/);
  });

  test('the list actually scrolls, and does not drag the page with it', () => {
    expect(list.body).toMatch(/overflow-y:\s*auto/);
    expect(list.body).toMatch(/overscroll-behavior:\s*contain/);
  });
});
