import fs from 'fs';
import path from 'path';

/**
 * The no-horizontal-scroll contract for the admin Attendance Verification page.
 *
 * This page has failed the same way twice, so the two causes are pinned here.
 *
 * 1. THE PAGE, NOT THE TABLE, GOT THE SCROLLBAR.
 *    `.portal-layout` is a flex row and `.main-content` is its flex child. A
 *    flex item's `min-width` defaults to `auto`, so it refuses to shrink below
 *    its content's min-content width. One wide table was therefore enough to
 *    stretch the whole layout past the window - the scrollbar appeared at the
 *    bottom of the BROWSER, and `.table-responsive { overflow-x: auto }` never
 *    engaged, because the wrapper had already grown to fit.
 *
 * 2. THE BREAKPOINT MEASURED THE WRONG THING.
 *    The first fix stacked the table below `max-width: 1180px` of the VIEWPORT.
 *    But the table does not live in the viewport - it lives in a card that is
 *    already ~280px narrower (the sidebar) and narrower again after padding. On
 *    the 1920px screen it was reported broken on, the card is ~1570px, so the
 *    query never fired and nothing changed.
 *
 * The fix is now width-agnostic: `.av-stack` turns each row into a card whose
 * fields sit in an auto-fitting grid, with no media query at all. jsdom cannot
 * verify that (it does not lay out flex or grid), so this suite guards the
 * source instead. The measured behaviour behind it - real Chrome, 390 to
 * 1920px - was `document.scrollWidth === document.clientWidth` and
 * `table.scrollWidth === wrapper.clientWidth` at every width.
 */

const ROOT = process.cwd();

const stripBlockComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const readCss = (rel) => stripBlockComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const readSrc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const PORTAL_CSS = readCss('src/layouts/PortalLayout.css');
const ADMIN_CSS = readCss('src/pages/admin/Admin.css');
const PAGE_JSX = readSrc('src/pages/admin/AttendanceVerification.jsx');

/** The body of a top-level rule, by selector. Null when the selector is absent. */
const ruleBody = (css, selector) => {
  const at = css.indexOf(`${selector} {`);
  if (at === -1) return null;
  const open = css.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  return null;
};

/** Every `@media` block body in the stylesheet. */
const mediaBodies = (css) => {
  const bodies = [];
  const re = /@media[^{]*\{/g;
  let match;
  while ((match = re.exec(css)) !== null) {
    const open = match.index + match[0].length - 1;
    let depth = 0;
    for (let i = open; i < css.length; i += 1) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          bodies.push(css.slice(open + 1, i));
          re.lastIndex = i;
          break;
        }
      }
    }
  }
  return bodies;
};

describe('admin attendance table - no horizontal scroll', () => {
  test('the portal column may shrink below its content', () => {
    // Cause 1. Without this the whole page grows and the wrapper never scrolls.
    ['.main-content', '.content-area'].forEach((selector) => {
      const body = ruleBody(PORTAL_CSS, selector);
      expect(body).not.toBeNull();
      expect(body).toMatch(/min-width:\s*0/);
    });
  });

  test('the stacked table is not held open by the shared 640px minimum', () => {
    // index.css sets `.table-responsive > .data-table { min-width: 640px }`.
    // The override has to be in Admin.css, which CRA emits after index.css.
    const body = ruleBody(ADMIN_CSS, '.av-stack .data-table');
    expect(body).not.toBeNull();
    expect(body).toMatch(/min-width:\s*0/);
  });

  test('the stacked layout is not hidden behind a viewport media query', () => {
    // Cause 2. Any @media wrapper around `.av-stack` re-introduces the bug,
    // because the width that matters is the card's, not the viewport's.
    mediaBodies(ADMIN_CSS).forEach((body) => {
      expect(body).not.toMatch(/\.av-stack/);
    });
  });

  test('the header row is hidden and the cells print their own labels', () => {
    expect(ruleBody(ADMIN_CSS, '.av-stack .data-table thead')).toMatch(/display:\s*none/);
    expect(ruleBody(ADMIN_CSS, '.av-stack .data-table td::before')).toMatch(
      /content:\s*attr\(data-label\)/
    );
  });

  test('every cell in the page carries a data-label', () => {
    // A column added without one renders an unlabelled value in the card.
    const cells = PAGE_JSX.match(/<td\b[^>]*>/g) || [];
    expect(cells.length).toBeGreaterThan(0);
    cells.forEach((cell) => expect(cell).toMatch(/data-label=/));
  });

  test('both review tables opt in to the stacked layout', () => {
    const wrappers = PAGE_JSX.match(/className="table-responsive av-stack"/g) || [];
    expect(wrappers).toHaveLength(2);
  });
});
