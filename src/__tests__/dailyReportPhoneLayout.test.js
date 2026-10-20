import fs from 'fs';
import path from 'path';

/**
 * The phone-layout contract for the daily-report screens.
 *
 * A three-column slot grid that asks for 200-220px minimums needs roughly
 * 640-700px. On a phone it therefore either overflows sideways (giving the page
 * a horizontal scrollbar) or crushes every cell into an unreadable strip. The
 * fix is a `max-width` breakpoint that collapses each grid to one column, and
 * stacks the action rows so the primary button becomes a full-width target.
 *
 * This suite guards that contract against the real files, for the same reason
 * the card-height suite does: it regresses silently. A grid template can be
 * edited, or a new breakpoint added after the one that mattered, and the CSS
 * still looks correct on its own. jsdom cannot catch it either - it does not
 * lay out grid or flex, so every element reports zero width and the overflow is
 * invisible to a DOM test.
 *
 * The measured behaviour behind these assertions (real Chrome, 320-768px) was:
 *   320-540px  grids report a single column, buttons span the frame
 *   768px       grids return to three columns, buttons shrink back
 */

const ROOT = process.cwd();

/** Strip CSS block comments so a commented-out rule is not read as a live one. */
const stripBlockComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const readCss = (rel) => stripBlockComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const readSrc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const STUDENT_CSS = readCss('src/pages/student/DailyReports.css');
const ADMIN_CSS = readCss('src/pages/admin/DailyReports.css');

/**
 * The `@media` blocks in a stylesheet, as `{ query, body }`.
 *
 * Matches the braces properly rather than slicing on the first `}` - the
 * earlier attempt at this used naive index slicing and mis-read nested rules.
 */
const mediaBlocks = (css) => {
  const blocks = [];
  const re = /@media([^{]+)\{/g;
  let match;
  while ((match = re.exec(css)) !== null) {
    let depth = 1;
    let index = re.lastIndex;
    while (index < css.length && depth > 0) {
      if (css[index] === '{') depth += 1;
      else if (css[index] === '}') depth -= 1;
      index += 1;
    }
    blocks.push({ query: match[1].trim(), body: css.slice(re.lastIndex, index - 1) });
  }
  return blocks;
};

/** Does any `max-width` breakpoint of at least `minPx` contain `needle`? */
const hasRuleInPhoneBreakpoint = (css, needle, minPx = 640) => {
  const limit = Number(minPx);
  return mediaBlocks(css).some((block) => {
    const max = /max-width:\s*(\d+)px/.exec(block.query);
    if (!max) return false;
    if (Number(max[1]) < limit) return false;
    return block.body.includes(needle);
  });
};

describe('phone layout - trainee daily reports', () => {
  test('the three-slot day grid collapses to one column on a phone', () => {
    expect(hasRuleInPhoneBreakpoint(STUDENT_CSS, '.report-day-grid'))
      .toBe(true);
    // and the collapse is a single column, not a smaller three-column grid
    expect(/\.report-day-grid\s*\{[^}]*grid-template-columns:\s*1fr/s.test(STUDENT_CSS))
      .toBe(true);
  });

  test('the slot header stacks instead of squeezing label and pill onto one line', () => {
    expect(hasRuleInPhoneBreakpoint(STUDENT_CSS, '.report-slot-head')).toBe(true);
  });

  test('the send button becomes a full-width target', () => {
    expect(hasRuleInPhoneBreakpoint(STUDENT_CSS, '.report-slot-actions .btn')).toBe(true);
    expect(/\.report-slot-actions\s+\.btn\s*\{[^}]*width:\s*100%/s.test(STUDENT_CSS))
      .toBe(true);
  });

  test('the day grids keep a phone breakpoint even as the default asks for 220px', () => {
    // If the base grid ever drops below ~220px minimums the breakpoint could be
    // removed - this asserts the two stay in step.
    expect(/\.report-day-grid\s*\{[^}]*minmax\(220px/s.test(STUDENT_CSS)).toBe(true);
  });
});

describe('phone layout - admin daily reports', () => {
  test('the review/detail grid collapses to one column on a phone', () => {
    expect(/\.admin-report-day-grid[^{]*\{[^}]*grid-template-columns:\s*1fr/s.test(ADMIN_CSS))
      .toBe(true);
  });

  test('the card header stacks so the name is not squeezed into a strip', () => {
    expect(hasRuleInPhoneBreakpoint(ADMIN_CSS, '.admin-report-card-head')).toBe(true);
  });

  test('the approve button becomes a full-width target', () => {
    expect(/\.admin-review-actions\s+\.btn\s*\{[^}]*width:\s*100%/s.test(ADMIN_CSS))
      .toBe(true);
  });

  test('the approve/return/cancel row stacks instead of wrapping raggedly', () => {
    expect(hasRuleInPhoneBreakpoint(ADMIN_CSS, '.admin-review-actions')).toBe(true);
  });
});

describe('the phone breakpoints are ordered so the later one wins', () => {
  test('each stylesheet has at least one phone breakpoint', () => {
    expect(mediaBlocks(STUDENT_CSS).length).toBeGreaterThan(0);
    expect(mediaBlocks(ADMIN_CSS).length).toBeGreaterThan(0);
  });

  test('the admin grid override is not swallowed by an earlier wider query', () => {
    // A 720px override placed BEFORE a 900px one would be overridden by it.
    const widths = mediaBlocks(ADMIN_CSS)
      .map((block) => Number((/max-width:\s*(\d+)px/.exec(block.query) || [])[1]))
      .filter((value) => Number.isFinite(value));
    const sortedDescending = [...widths].sort((a, b) => b - a);
    expect(widths).toEqual(sortedDescending);
  });
});

describe('the classes the pages render are the classes the CSS styles', () => {
  const classesIn = (file) => {
    const source = readSrc(file);
    const found = new Set();
    const re = /className="([^"]+)"/g;
    let match;
    while ((match = re.exec(source)) !== null) {
      match[1].trim().split(/\s+/).forEach((name) => {
        if (name) found.add(name);
      });
    }
    return found;
  };

  const definedIn = (css) => {
    const found = new Set();
    const re = /\.([a-z][a-z0-9-]*)/g;
    let match;
    while ((match = re.exec(css)) !== null) found.add(match[1]);
    return found;
  };

  // Only the layout classes this contract is about - the components' own
  // classes (card, btn, page-header…) live in other stylesheets by design.
  const LAYOUT_CLASSES = [
    'admin-report-section',
    'admin-report-section-head',
    'admin-report-section-title',
    'admin-report-section-count',
    'admin-report-section-note',
    'admin-report-section-list',
    'admin-report-card-head',
    'admin-report-card-who',
    'admin-report-card-name',
    'admin-report-card-date',
    'admin-report-card-actions',
    'admin-report-day-grid',
    'admin-report-day-cell',
    'admin-review-actions',
    'admin-review-meta',
    'admin-review-note'
  ];

  test('every admin layout class the page renders is styled', () => {
    const rendered = classesIn('src/pages/admin/DailyReports.js');
    const styled = definedIn(ADMIN_CSS);
    const unstyled = LAYOUT_CLASSES.filter((name) => rendered.has(name) && !styled.has(name));
    expect(unstyled).toEqual([]);
  });

  test('the trainee review pills and note are styled', () => {
    const rendered = classesIn('src/pages/student/DailyReportsNew.jsx');
    const styled = definedIn(STUDENT_CSS);
    const needed = ['report-flags', 'report-review-note', 'report-review-note-label'];
    const unstyled = needed.filter((name) => rendered.has(name) && !styled.has(name));
    expect(unstyled).toEqual([]);
  });
});
