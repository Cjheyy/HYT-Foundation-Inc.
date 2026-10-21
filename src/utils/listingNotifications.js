/**
 * Notifications for newly published listings.
 *
 * When an administrator publishes an **Event**, an **OJT Posting** or a
 * **Trainee Program**, the people who could act on it should not have to keep
 * refreshing the catalogue to find out. This module turns the listings already
 * in app state into notification items for the header bell.
 *
 * WHY THERE IS NO SQL HERE
 *
 * The `notifications` table exists, and `getNotifications()` reads it - but
 * nothing in the codebase has ever written to it, so it is empty by
 * construction.  Fanning out one row per trainee on publish would mean a
 * trigger, a per-user insert for every account, a read-receipt column, and a
 * migration the user has to run before any of it works.
 *
 * The listings are already loaded into state for every portal, and realtime
 * already keeps them fresh. So the notification is *derived*: "a published
 * listing I have not acknowledged yet, posted in the last two weeks".  Nothing
 * to migrate, nothing to keep in sync, and it cannot drift from the catalogue
 * because it is the catalogue.
 *
 * The trade-off is honest: read state is per browser (localStorage), the same
 * way announcement reads already work, so opening the portal on a second device
 * shows the new listings again. That is a much smaller problem than a bell that
 * is permanently empty.
 *
 * AUDIENCE
 *
 *   Events        both portals - anyone may attend one
 *   OJT Postings  OJT/Intern only - a Trainee is never offered a posting
 *   Programs      Trainee only    - an OJT/Intern is already placed
 *
 * This mirrors STUDENT_NAV / TRAINEE_NAV and the pages' own filters, so a
 * notification never links to a page that would hide the thing it announced.
 */
import { normalizeStatus } from '../services/supabaseService';
import { isTraineeRole } from './roleTerms';
import { getListingPosition } from './experience';
import { formatRelativeTime } from './helpers';
import { createSeenStore } from './seenIds';

/** How long a listing keeps counting as "new". */
export const NEW_LISTING_WINDOW_DAYS = 14;

/** How many new listings the bell will announce at once. */
export const MAX_LISTING_NOTIFICATIONS = 3;

export const listingReads = createSeenStore({
  prefix: 'hyt:listing-seen:',
  changeEvent: 'hyt:listing-seen-changed'
});

export const useListingReads = listingReads.useSeenIds;

const KINDS = {
  event: {
    label: 'event',
    icon: 'calendar',
    path: 'events',
    audience: 'all'
  },
  opportunity: {
    label: 'OJT posting',
    icon: 'target',
    path: 'opportunities',
    audience: 'ojt'
  },
  program: {
    label: 'Trainee program',
    icon: 'book',
    path: 'programs',
    audience: 'trainee'
  }
};

/**
 * Which audience does this role belong to?
 *
 * `isTraineeRole` here is the one from utils/roleTerms (TRAINEE / STUDENT), not
 * the one in supabaseService - that one groups OJT/Intern in with the trainees
 * because it is used to filter the admin Students table, so it would send every
 * OJT posting to the wrong audience.
 */
export const resolveListingAudience = (role) =>
  (isTraineeRole(role) ? 'trainee' : 'ojt');

const postedAtOf = (listing) =>
  listing?.createdAt || listing?.created_at || listing?.publishedAt || listing?.published_at || null;

const isPublished = (listing) => {
  if (!listing) return false;
  if (normalizeStatus(listing.status) !== 'PUBLISHED') return false;
  if (listing.isActive === false || listing.is_active === false) return false;
  return true;
};

const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Every published listing the viewer is allowed to see, newest first.
 * Returns `[{ id, kind, listing, postedAt }]`.
 */
export function getVisibleListings(state, role) {
  const audience = resolveListingAudience(role);
  const out = [];

  const push = (rows, kind) => {
    const meta = KINDS[kind];
    if (meta.audience !== 'all' && meta.audience !== audience) return;
    (rows || []).forEach((listing) => {
      if (!listing?.id || !isPublished(listing)) return;
      out.push({ id: listing.id, kind, listing, postedAt: toDate(postedAtOf(listing)) });
    });
  };

  push(state?.events, 'event');
  push(state?.opportunities, 'opportunity');
  push(state?.programs, 'program');

  return out.sort((a, b) => {
    const left = a.postedAt ? a.postedAt.getTime() : 0;
    const right = b.postedAt ? b.postedAt.getTime() : 0;
    return right - left;
  });
}

/**
 * The notifications themselves: published, not yet acknowledged, and posted
 * inside the newness window.
 *
 * An item is `{ id, tone, icon, title, detail, to, listingId }` - the same
 * shape `buildAttentionItems` produces, so the bell renders both the same way.
 */
export function buildListingNotifications({
  state,
  role,
  userId = null,
  basePath = '/student',
  seenIds = new Set(),
  now = new Date()
} = {}) {
  const reference = toDate(now) || new Date();
  const cutoff = reference.getTime() - NEW_LISTING_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  return getVisibleListings(state, role)
    .filter(({ id, postedAt }) => {
      if (seenIds.has(id)) return false;
      // A listing with no timestamp at all cannot be called "new" honestly, but
      // it also cannot be called old - so it is announced once and then marked
      // seen like any other.
      if (!postedAt) return true;
      return postedAt.getTime() >= cutoff;
    })
    .slice(0, MAX_LISTING_NOTIFICATIONS)
    .map(({ id, kind, listing, postedAt }) => {
      const meta = KINDS[kind];
      const position = getListingPosition(listing);
      const relative = postedAt ? formatRelativeTime(postedAt) : null;
      const detail = [position, relative ? `Posted ${relative}` : null]
        .filter(Boolean)
        .join(' · ');
      return {
        id: `listing-${id}`,
        listingId: id,
        tone: 'success',
        icon: meta.icon,
        title: `New ${meta.label} - ${listing.title || 'Untitled'}`,
        detail: detail || 'Open the catalogue to read the details',
        to: `${basePath}/${meta.path}`
      };
    });
}
