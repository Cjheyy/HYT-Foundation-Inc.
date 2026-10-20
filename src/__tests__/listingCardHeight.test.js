import fs from 'fs';
import path from 'path';

/**
 * The listing-card height contract.
 *
 * A grid gives every card in a row the same height, but that alone does NOT line
 * their content up: a card with a one-line title ends higher than one with a
 * two-line title, so the two CTA buttons sat at different heights and the row
 * read as broken. The fix is to make each card a flex column, let the body take
 * the slack, and push the last child to the foot with `margin-top: auto`.
 *
 * This suite guards that contract against the real files, because it is exactly
 * the kind of thing that regresses silently: a new card is added, or an inline
 * `marginTop` is reintroduced at a call site, and the CSS still looks fine on
 * its own. A DOM test cannot see it either - jsdom does not lay out flex, so
 * every element reports zero height and the bug is invisible.
 */

const ROOT = process.cwd();
const INDEX_CSS = path.join(ROOT, 'src', 'index.css');

/** Strip CSS block comments so a commented-out rule is not read as a live one. */
const stripBlockComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const INDEX = stripBlockComments(fs.readFileSync(INDEX_CSS, 'utf8'));

/** Every card class the shared rule has to cover, and who renders it. */
const CARD_CLASSES = [
  ['program-card', 'src/pages/public/Programs.jsx', 'src/pages/public/Events.jsx'],
  ['opportunity-card', 'src/pages/public/Opportunities.jsx'],
  ['card--posting', 'src/pages/student/Events.js', 'src/pages/student/Opportunities.js']
];

/** The JSX call sites that put a button at the foot of one of those cards. */
const CARD_CALL_SITES = [
  'src/pages/public/Programs.jsx',
  'src/pages/public/Events.jsx',
  'src/pages/public/Opportunities.jsx',
  'src/pages/student/Events.js',
  'src/pages/student/Opportunities.js'
];

/** Every `selector { body }` pair in the CSS, comments already stripped. */
const rules = (css) => {
  const found = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = re.exec(css)) !== null) {
    found.push({ selector: match[1].trim(), body: match[2] });
  }
  return found;
};

const INDEX_RULES = rules(INDEX);

/** The rule whose selector list mentions this class, or undefined. */
const ruleFor = (cardClass) =>
  INDEX_RULES.find((rule) => rule.selector.split(',').some(
    (part) => part.trim() === `.${cardClass}`
  ));

describe('listing cards line their CTA up', () => {
  test.each(CARD_CLASSES)('.%s is a flex column that fills its grid cell', (cardClass) => {
    // Each card class must appear in a shared rule that makes it a full-height
    // flex column - that is what lets the grid stretch it and what gives the
    // auto margin something to push against.
    const rule = ruleFor(cardClass);
    expect(rule).toBeDefined();
    expect(rule.body).toContain('flex-direction: column');
    expect(rule.body).toContain('height: 100%');
  });

  test('the CTA of every posting card is pinned with margin-top: auto', () => {
    // Find the rule whose body carries the auto margin, then assert its
    // selector covers every card and targets the last child.
    const pinning = INDEX_RULES.filter((rule) => /margin-top:\s*auto/.test(rule.body));
    expect(pinning.length).toBeGreaterThan(0);

    CARD_CLASSES.forEach(([cardClass]) => {
      const covered = pinning.some((rule) => rule.selector.includes(`.${cardClass}`));
      expect(covered).toBe(true);
    });
    expect(pinning.some((rule) => rule.selector.includes(':last-child'))).toBe(true);
  });

  test('a card body is the element that absorbs the slack', () => {
    // Without a flex: 1 body the auto margin has nothing to push against and
    // the button just sits directly under the text again.
    const flexOneIndex = INDEX.indexOf('flex: 1 1 auto');
    expect(flexOneIndex).toBeGreaterThan(-1);
  });

  test('a Badge used as the CTA is stretched to the Button footprint', () => {
    // Auto margin alone only lines the BOTTOM edges up. A badge is ~17px
    // shorter than a small button, so its TOP edge sat high and the row still
    // read as ragged. The badge rule has to widen it and match the button's box.
    const badgeRule = INDEX_RULES.find((rule) => /badge:last-child/.test(rule.selector));
    expect(badgeRule).toBeDefined();
    expect(badgeRule.body).toMatch(/align-self:\s*stretch/);
    // The badge's own padding is an inline style, so this must outrank it.
    expect(badgeRule.body).toMatch(/padding-top:.*!important/);
  });

  test('no call site re-introduces an inline marginTop on the CTA', () => {
    // An inline style beats the stylesheet, so a single `marginTop: '16px'`
    // silently undoes the whole contract at that one card.
    CARD_CALL_SITES.forEach((relative) => {
      const file = path.join(ROOT, relative);
      const source = stripBlockComments(fs.readFileSync(file, 'utf8'));
      // Allow the word only inside a comment; the stripped source should be clean.
      expect(source).not.toMatch(/marginTop/);
    });
  });
});
