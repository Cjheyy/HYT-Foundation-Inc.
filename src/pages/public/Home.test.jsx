import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Home } from './Home';
import { HYT_THRUSTS } from '../../data/hytThrusts';
import { DA_ACCENTS, DA_UNITS } from '../../data/dreamAcademy';

// Swiper is stubbed globally through `jest.moduleNameMapper` in package.json
// (see src/__mocks__/swiper-react.jsx). Jest 27 cannot read swiper v14's
// `exports` map, and the real carousel needs ResizeObserver plus real layout —
// neither of which jsdom provides. None of these tests exercise the slider.

jest.mock('../../context/AppContext', () => ({
  useApp: () => ({ state: { opportunities: [], programs: [] } }),
}));

jest.mock('../../components/GalleryModal', () => ({
  GalleryModal: () => null,
}));

const renderHome = () => render(
  <MemoryRouter>
    <Home />
  </MemoryRouter>
);

// Headings are returned in document order, which is how the section-order
// assertions below are made without reaching into the DOM by hand.
const h2Texts = () => screen
  .getAllByRole('heading', { level: 2 })
  .map((node) => node.textContent.trim());

// A handful of assertions are about markup that carries no accessible role —
// the presence of a modifier class, or the absence of a legacy one. Testing
// Library deliberately has no query for those, so they are made against the
// serialised document instead.
const markup = () => document.body.innerHTML;
const countIn = (needle) => markup().split(needle).length - 1;
// Exact class-token count. `countIn('dial-node')` would also match `dial-nodes`,
// so this anchors on the whole attribute value.
const countClass = (name) => (markup().match(new RegExp(`class="${name}"`, 'g')) || []).length;
// The unit accents are inline custom properties, read off the serialised markup
// in document order: jsdom's CSSStyleDeclaration does not reliably reflect a
// custom property set through `style.setProperty`.
const accentValues = () => (markup().match(/--da-accent:\s*([^;"']+)/g) || [])
  .map((declaration) => declaration.split(':')[1].trim().toUpperCase());

describe('Home — section order', () => {
  test('puts Our Accomplishments above What We Do', () => {
    // The gallery is the highlight, so it must not sit at the bottom of the
    // page underneath every other section.
    renderHome();
    const headings = h2Texts();
    const accomplishments = headings.indexOf('Our Accomplishments');
    const whatWeDo = headings.indexOf('What We Do');

    expect(accomplishments).toBeGreaterThanOrEqual(0);
    expect(whatWeDo).toBeGreaterThanOrEqual(0);
    expect(accomplishments).toBeLessThan(whatWeDo);
  });

  test('makes Our Accomplishments the first section after the hero', () => {
    renderHome();
    expect(h2Texts()[0]).toBe('Our Accomplishments');
  });

  test('keeps every original section present', () => {
    renderHome();
    [
      'Our Accomplishments',
      'What We Do',
      'The 8 HYT Thrusts',
      'Your Journey with HYT',
      'Dream Academy',
    ].forEach((heading) => {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    });
  });

  test('folds the band copy into the one heading it kept', () => {
    // M2 merges the two stacked Thrusts sections into one, so "See how each
    // thrust shapes our work" is no longer its own h2 — the words survive as the
    // sub-line under the single heading, joined to the band's second sentence.
    renderHome();
    expect(
      screen.queryByRole('heading', { name: 'See how each thrust shapes our work' })
    ).toBeNull();

    const subline = screen.getByText(/See how each thrust shapes our work/i);
    expect(subline).toHaveTextContent('every programme we run maps back to one of the eight');
  });
});

describe('Home — the 8 HYT Thrusts (M2 "Seam")', () => {
  test('drops the rail and the detail pane entirely', () => {
    renderHome();
    // The pane carried each thrust's explanation, and that now lives on the
    // About page — which left the rail as a second, static copy of the same
    // eight names the marquees already run. So both are gone.
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByRole('tabpanel')).toBeNull();
    expect(markup()).not.toContain('thrust-rail');
    expect(markup()).not.toContain('thrust-pill');
    expect(markup()).not.toContain('thrust-pane');
  });

  test('sends the reader to the About page for the meaning instead', () => {
    renderHome();
    expect(screen.getByRole('link', { name: /What the 8 Thrusts mean/i }))
      .toHaveAttribute('href', '/about#thrusts');
  });

  test('replaces the emoji tiles with the marquees', () => {
    renderHome();

    // Seven of the eight old thrust emoji belonged to the tiles alone, so their
    // absence proves the tiles are gone.
    ['⚡', '💼', '💡', '💪', '🗺️', '🌟', '✨'].forEach((emoji) => {
      expect(screen.queryByText(emoji)).toBeNull();
    });

    // 📚 is the exception: it is also the "Skill Development" feature icon, so
    // exactly one must survive.
    expect(screen.getAllByText('📚')).toHaveLength(1);

    expect(markup()).not.toContain('thrusts-grid');
    expect(markup()).not.toContain('thrust-card');
  });
});

describe('Home — impact figures bento (B3)', () => {
  const LABELS = [
    'Youth Empowered',
    'Partner Organizations',
    'Opportunities Created',
    'Completion Rate',
  ];

  test('renders the four figures with their labels', () => {
    renderHome();
    LABELS.forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());
  });

  test('renders the real figures in order, each carrying its suffix', () => {
    renderHome();

    // getByText matches an element's *direct* text nodes only, so these find
    // the span holding the digits — the "+"/"%" lives in a nested <em>, which
    // is why the assertion is made on textContent.
    expect(screen.getByText('500', { exact: true }).textContent).toBe('500+');
    expect(screen.getByText('50', { exact: true }).textContent).toBe('50+');
    expect(screen.getByText('100', { exact: true }).textContent).toBe('100+');
    expect(screen.getByText('95', { exact: true }).textContent).toBe('95%');
  });

  test('gives the hero figure an explanatory note', () => {
    renderHome();
    expect(
      screen.getByText(/Young people who have completed at least one HYT programme/i)
    ).toBeInTheDocument();
  });

  test('applies the hero and wide modifiers to the right cells', () => {
    renderHome();
    expect(countIn('bento-cell')).toBe(4);
    // A modifier class has no role-based query, so it is asserted on the
    // serialised document. `\b` leaves room for anything appended at runtime.
    expect(markup()).toMatch(/class="bento-cell bento-hero\b/);
    expect(markup()).toMatch(/class="bento-cell bento-wide\b/);
  });

  test('drops the shared stat-card markup', () => {
    // `.stats-grid` / `.stat-card` are also declared in Impact.css,
    // Attendance.css and Dashboard.css, so reusing them here would collide
    // across CRA's single global bundle.
    renderHome();
    expect(markup()).not.toContain('stats-grid');
    expect(markup()).not.toContain('stat-card');
  });
});

describe('Home — the Thrusts section is merged (M2 "Seam")', () => {
  test('renders one section instead of two stacked ones', () => {
    renderHome();
    expect(countClass('thrusts-seam')).toBe(1);
    // The old standalone ribbon band is gone — and so is the emblem ring it was
    // briefly replaced with.
    expect(markup()).not.toContain('rib-band');
    expect(markup()).not.toContain('emblem-stage');
  });

  test('makes the ink floor the whole section', () => {
    renderHome();
    // Nothing but the heading is left above the seam.
    expect(countClass('thrust-rail-wrap')).toBe(0);
    expect(markup()).not.toContain('dial-node');
    expect(markup()).not.toContain('dial-ring');
    // The floor is the marquees and the one CTA, and nothing else. Both wrappers
    // also carry the `container` utility class, so these anchor on the attribute
    // prefix rather than the whole value.
    expect(countIn('class="seam-floor-cta')).toBe(1);
    expect(countIn('class="seam-cta-link')).toBe(1);
    // The "hover to pause" caption that used to sit above the ribbons is gone.
    expect(markup()).not.toContain('seam-floor-cap');
    expect(markup()).not.toContain('hover to pause');
  });

  test('runs the logo ramp along the seam, with the ink floor beneath it', () => {
    renderHome();
    expect(countClass('seam-ramp')).toBe(1);
    expect(countClass('seam-floor')).toBe(1);
    expect(countClass('seam-kicker')).toBe(1);
  });

  test('keeps both marquees inside the merged section', () => {
    renderHome();
    expect(countIn('ribbon-zone')).toBe(2);
    expect(countIn('ribbon-ink')).toBe(1);
    // The second ribbon carries the logo ramp rather than flat brand orange.
    expect(countIn('ribbon-tri')).toBe(1);
    expect(countIn('ribbon-brand')).toBe(0);
  });

  test('keeps exactly one heading in the merged section', () => {
    renderHome();
    expect(h2Texts().filter((t) => t === 'The 8 HYT Thrusts')).toHaveLength(1);
    // The band's own title is the one the seam replaced.
    expect(
      screen.queryByRole('heading', { name: 'See how each thrust shapes our work' })
    ).toBeNull();
  });

  test('keeps the eight names on screen, in the marquees', () => {
    renderHome();
    // Scoped by selector rather than by a container element: a couple of thrust
    // names ("Experience", "Exploration") are also Journey step titles elsewhere
    // on the page. Each marquee renders its track twice so the -50% loop is
    // seamless, so every thrust name appears exactly twice.
    HYT_THRUSTS.forEach(({ name }) => {
      expect(
        screen.getAllByText(name, { selector: '.thrusts-seam .ribbon-track span' })
      ).toHaveLength(2);
    });
  });

  test('keeps the marquees decorative, so nothing is announced twice', () => {
    renderHome();
    // The ribbons are aria-hidden: the names they carry are a visual echo of the
    // heading, and the real explanation is one link away on the About page.
    // Asserted on the serialised opening tags rather than by role — an
    // aria-hidden element is by definition absent from the accessibility tree,
    // so no query reaches it. Matching the tags keeps this independent of the
    // order React writes the attributes in.
    const zones = markup().match(/<div[^>]*class="ribbon-zone"[^>]*>/g) || [];
    expect(zones).toHaveLength(2);
    zones.forEach((tag) => expect(tag).toContain('aria-hidden="true"'));
  });
});

// The section carries `aria-labelledby`, so it is exposed as a real landmark
// (role="region", named by its heading). That is what lets everything below be
// scoped with `within()` rather than reaching into the DOM by hand.
const dreamAcademy = () => screen.getByRole('region', { name: 'Dream Academy' });

describe('Home — Dream Academy', () => {
  test('names the academy in a real, navigable heading', () => {
    renderHome();
    expect(screen.getByRole('heading', { name: 'Dream Academy', level: 2 })).toBeInTheDocument();
    expect(dreamAcademy()).toBeInTheDocument();
  });

  test('credits the partnership it is run with', () => {
    renderHome();
    expect(
      screen.getByText(/In partnership with Klassic Solutions Inc\./i)
    ).toBeInTheDocument();
  });

  test('keeps the four beats in the order the source copy reads', () => {
    renderHome();
    const beats = within(dreamAcademy())
      .getAllByRole('heading', { level: 3 })
      .map((node) => node.textContent.trim());

    expect(beats).toEqual([
      'About Dream Academy',
      'Training Program and Objectives',
      'Dreamer\u2019s Goals',
      'Unit Assignments',
    ]);
  });

  test('renders both panels of the training programme', () => {
    renderHome();
    const section = dreamAcademy();
    expect(
      within(section).getByRole('heading', { name: 'Training Program', level: 4 })
    ).toBeInTheDocument();
    expect(
      within(section).getByRole('heading', { name: 'Training Objectives', level: 4 })
    ).toBeInTheDocument();
  });

  test('renders all eight units, by name', () => {
    renderHome();
    const section = dreamAcademy();
    DA_UNITS.forEach(({ name }) => {
      expect(within(section).getByRole('heading', { name, level: 4 })).toBeInTheDocument();
    });
  });

  test('renders every duty of every unit — nothing lost in transcription', () => {
    renderHome();
    const expected = DA_UNITS.reduce((total, unit) => total + unit.duties.length, 0);
    // Guards the assertion itself: 9 + 4 + 5 + 4 + 5 + 3 + 5 + 7.
    expect(expected).toBe(42);
    expect(countIn('class="da-duty"')).toBe(expected);
  });

  test('gives every unit a deepened accent, never a vivid brand stop', () => {
    renderHome();
    const accents = accentValues();

    expect(accents).toHaveLength(8);
    // Each unit label is white ON its accent, and the vivid palette fails 4.5:1
    // against white — yellow #F3DB6E manages only 1.38:1. So none may appear.
    const VIVID = ['#D57156', '#E8763B', '#F3DB6E', '#279EB6', '#5BC0C8', '#B4E5F1', '#8DD0DE'];
    accents.forEach((accent) => expect(VIVID).not.toContain(accent));
  });

  test('never lets two units that share an edge look alike', () => {
    renderHome();
    const accents = accentValues();
    // Two columns, so the neighbours are the pairs across each row and the pairs
    // down each column.
    const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [2, 4], [3, 5], [4, 6], [5, 7]];
    EDGES.forEach(([a, b]) => {
      expect(accents[a]).not.toBe(accents[b]);
    });
  });

  test('uses the whole accent set rather than one flat colour', () => {
    renderHome();
    expect(new Set(accentValues()).size).toBe(Object.keys(DA_ACCENTS).length);
  });

  test('drops the old closing call to action', () => {
    renderHome();
    expect(screen.queryByRole('heading', { name: 'Ready to Start Your Journey?' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create Account' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Browse Opportunities' })).toBeNull();
    expect(markup()).not.toContain('cta-section');
    expect(markup()).not.toContain('glow-wrap');
    expect(markup()).not.toContain('glow-ring');
  });

  test('closes the page', () => {
    renderHome();
    const h2 = screen.getAllByRole('heading', { level: 2 });
    expect(h2[h2.length - 1].textContent.trim()).toBe('Dream Academy');
  });
});
