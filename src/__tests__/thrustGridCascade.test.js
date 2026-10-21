import fs from 'fs';
import path from 'path';

/**
 * The About page's thrust grid must own `.thrusts-list` alone.
 *
 * CRA bundles every stylesheet into one global scope, so two pages sharing a
 * class name is a cascade, not a scoping problem. That is exactly what happened
 * here: `Detail.css` used `.thrusts-list` for a row of thrust chips
 * (`display: flex; flex-wrap: wrap; gap: 8px`) and loaded AFTER `About.css`, so
 * on the About page it replaced the grid. The eight cards collapsed to their
 * content width, wrapped two per row, sat left-aligned with a dead gutter on
 * the right - and the About CSS looked perfectly correct the whole time.
 *
 * jsdom cannot catch this (it does not lay out), and neither can reading one
 * stylesheet in isolation, so this suite reads the real files and asserts the
 * name is unique.
 */

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');

const stripBlockComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Every stylesheet under src, as `{ file, css }`. */
const stylesheets = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  if (entry.isDirectory()) return stylesheets(full);
  if (!entry.name.endsWith('.css')) return [];
  return [{ file: path.relative(ROOT, full).replace(/\\/g, '/'), css: stripBlockComments(fs.readFileSync(full, 'utf8')) }];
});

const ALL = stylesheets(SRC);
const ABOUT = ALL.find((sheet) => sheet.file.endsWith('pages/public/About.css'));
const DETAIL = ALL.find((sheet) => sheet.file.endsWith('pages/public/Detail.css'));

/** `selector { ... }` blocks whose selector list contains `className`. */
const blocksFor = (css, className) => {
  const pattern = new RegExp(`([^{}]*\\.${className}\\b[^{}]*)\\{([^}]*)\\}`, 'g');
  return [...css.matchAll(pattern)].map((match) => ({ selector: match[1].trim(), body: match[2] }));
};

describe('the thrust grid is not overridden by another page', () => {
  test('only About.css declares .thrusts-list', () => {
    const owners = ALL.filter((sheet) => blocksFor(sheet.css, 'thrusts-list').length > 0)
      .map((sheet) => sheet.file);

    expect(owners).toEqual(['src/pages/public/About.css']);
  });

  test('the base rule is the 4-across grid, centred in its container', () => {
    const base = blocksFor(ABOUT.css, 'thrusts-list')[0];
    expect(base).toBeDefined();
    expect(base.body).toContain('display: grid');
    expect(base.body).toContain('repeat(4, minmax(0, 1fr))');
    expect(base.body).toContain('margin: 0 auto');
  });

  test('the detail pages use their own class, not the grid one', () => {
    const chips = blocksFor(DETAIL.css, 'detail-thrusts');
    expect(chips).toHaveLength(1);
    expect(chips[0].body).toContain('flex-wrap: wrap');

    ['src/pages/public/OpportunityDetail.jsx', 'src/pages/public/ProgramDetail.jsx'].forEach((file) => {
      const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
      expect(source).toContain('className="detail-thrusts"');
      expect(source).not.toContain('className="thrusts-list"');
    });
  });
});
