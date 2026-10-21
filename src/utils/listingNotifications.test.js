import {
  MAX_LISTING_NOTIFICATIONS,
  NEW_LISTING_WINDOW_DAYS,
  buildListingNotifications,
  getVisibleListings,
  listingReads,
  resolveListingAudience
} from './listingNotifications';

const NOW = new Date(2026, 9, 21, 10, 0, 0);

/** A listing published `daysAgo` days before NOW. */
const listing = (id, over = {}) => ({
  id,
  title: `Listing ${id}`,
  status: 'PUBLISHED',
  isActive: true,
  createdAt: new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  ...over
});

const state = (over = {}) => ({
  events: [],
  opportunities: [],
  programs: [],
  ...over
});

describe('resolveListingAudience', () => {
  it('splits the two portals', () => {
    expect(resolveListingAudience('OJT/Intern')).toBe('ojt');
    expect(resolveListingAudience('Trainee')).toBe('trainee');
    expect(resolveListingAudience('STUDENT')).toBe('trainee');
  });
});

describe('getVisibleListings', () => {
  it('gives an OJT/Intern the postings and the events, never the programmes', () => {
    const visible = getVisibleListings(state({
      events: [listing('e1')],
      opportunities: [listing('o1')],
      programs: [listing('p1')]
    }), 'OJT/Intern');

    expect(visible.map((entry) => entry.kind).sort()).toEqual(['event', 'opportunity']);
  });

  it('gives a Trainee the programmes and the events, never the postings', () => {
    const visible = getVisibleListings(state({
      events: [listing('e1')],
      opportunities: [listing('o1')],
      programs: [listing('p1')]
    }), 'Trainee');

    expect(visible.map((entry) => entry.kind).sort()).toEqual(['event', 'program']);
  });

  it('ignores anything that is not published', () => {
    const visible = getVisibleListings(state({
      events: [listing('draft', { status: 'DRAFT' }), listing('ok')]
    }), 'OJT/Intern');

    expect(visible.map((entry) => entry.id)).toEqual(['ok']);
  });

  it('ignores a published listing that has been switched off', () => {
    const visible = getVisibleListings(state({
      events: [listing('off', { isActive: false }), listing('on')]
    }), 'OJT/Intern');

    expect(visible.map((entry) => entry.id)).toEqual(['on']);
  });

  it('sorts newest first', () => {
    const visible = getVisibleListings(state({
      events: [
        listing('older', { createdAt: new Date(NOW.getTime() - 5 * 86400000).toISOString() }),
        listing('newer', { createdAt: new Date(NOW.getTime() - 1 * 86400000).toISOString() })
      ]
    }), 'OJT/Intern');

    expect(visible.map((entry) => entry.id)).toEqual(['newer', 'older']);
  });
});

describe('buildListingNotifications', () => {
  it('announces a newly published posting with a working in-portal link', () => {
    const items = buildListingNotifications({
      state: state({ opportunities: [listing('o1', { title: 'Backend Intern', position: 'Software Engineer' })] }),
      role: 'OJT/Intern',
      basePath: '/student',
      now: NOW
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'listing-o1',
      listingId: 'o1',
      icon: 'target',
      to: '/student/opportunities',
      tone: 'success'
    });
    expect(items[0].title).toContain('Backend Intern');
    expect(items[0].title).toContain('OJT posting');
    expect(items[0].detail).toContain('Software Engineer');
  });

  it('routes each kind to its own page in the right portal', () => {
    const trainee = buildListingNotifications({
      state: state({ events: [listing('e1')], programs: [listing('p1')] }),
      role: 'Trainee',
      basePath: '/trainee',
      now: NOW
    });
    expect(trainee.map((item) => item.to).sort()).toEqual(['/trainee/events', '/trainee/programs']);
  });

  it('never re-announces something already seen', () => {
    const items = buildListingNotifications({
      state: state({ events: [listing('e1')] }),
      role: 'OJT/Intern',
      seenIds: new Set(['e1']),
      now: NOW
    });

    expect(items).toEqual([]);
  });

  it('stops calling a listing new once the window has passed', () => {
    const old = new Date(NOW.getTime() - (NEW_LISTING_WINDOW_DAYS + 1) * 86400000).toISOString();
    const items = buildListingNotifications({
      state: state({ events: [listing('old', { createdAt: old })] }),
      role: 'OJT/Intern',
      now: NOW
    });

    expect(items).toEqual([]);
  });

  it('still announces a listing that is inside the window', () => {
    const recent = new Date(NOW.getTime() - (NEW_LISTING_WINDOW_DAYS - 1) * 86400000).toISOString();
    const items = buildListingNotifications({
      state: state({ events: [listing('recent', { createdAt: recent })] }),
      role: 'OJT/Intern',
      now: NOW
    });

    expect(items).toHaveLength(1);
  });

  it('caps the list so the bell cannot become a wall of text', () => {
    const items = buildListingNotifications({
      state: state({
        events: ['a', 'b', 'c', 'd', 'e'].map((id) => listing(id))
      }),
      role: 'OJT/Intern',
      now: NOW
    });

    expect(items).toHaveLength(MAX_LISTING_NOTIFICATIONS);
  });

  it('announces a listing with no timestamp once, rather than never', () => {
    const items = buildListingNotifications({
      state: state({ events: [listing('undated', { createdAt: null })] }),
      role: 'OJT/Intern',
      now: NOW
    });

    expect(items).toHaveLength(1);
  });
});

describe('the per-user seen store', () => {
  beforeEach(() => {
    listingReads.clearSeen('user-a');
    listingReads.clearSeen('user-b');
  });

  it('remembers ids per user', () => {
    listingReads.markSeen('user-a', 'listing-1');
    expect(listingReads.getSeenIds('user-a')).toContain('listing-1');
    expect(listingReads.getSeenIds('user-b')).toEqual([]);
  });

  it('does not store the same id twice', () => {
    listingReads.markManySeen('user-a', ['listing-1', 'listing-1']);
    listingReads.markSeen('user-a', 'listing-1');
    expect(listingReads.getSeenIds('user-a')).toEqual(['listing-1']);
  });
});
