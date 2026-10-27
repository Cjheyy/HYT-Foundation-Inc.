/**
 * The text baked into an attendance photo.
 *
 * ## Why this is a pure function in its own file
 *
 * The same lines are shown in two places: as an HTML overlay while the camera
 * is open, and burned into the JPEG once the request has been submitted. If
 * those were written twice they would drift - the preview would promise
 * "HYT Building - 12 m" and the photo would carry something else. They both
 * read from `buildStampLines`, so there is one sentence, not two.
 *
 * Being pure also makes it testable. jsdom cannot lay out a canvas, so the
 * drawing half (`drawStamp.js`) can only be exercised by hand - but everything
 * that decides *what* is written can be asserted here.
 *
 * ## The clock is Manila's, not the device's
 *
 * `formatToParts` with an explicit `timeZone` is used instead of
 * `toLocaleString`. Without the explicit zone the output depends on whatever
 * timezone the phone or laptop happens to be set to, which would print a
 * different hour on the same photo depending on who took it. The zone is fixed
 * to Asia/Manila for every caller.
 *
 * Note that the *time itself* still comes from the caller, and the caller
 * passes the server's timestamp (`requested_at` / `pending_end_time`), not the
 * device clock. That is the point: the photo says what the database says.
 */

/** Printed at the top of every stamp. */
export const STAMP_BRAND = 'HYT FOUNDATION INC.';

/** Every stamp is expressed in the office's timezone, never the device's. */
export const STAMP_TIME_ZONE = 'Asia/Manila';

/** Brand orange, lightened so it stays legible over a dark photo gradient. */
export const STAMP_ACCENT = '#F0A085';

/** How many detail lines fit under the timestamp before the stamp gets busy. */
export const STAMP_MAX_DETAIL_LINES = 4;

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Wall-clock parts in Manila, regardless of the device's own timezone.
 *
 * Returns `null` for anything unparseable rather than throwing: a missing
 * timestamp must not stop a photo from being uploaded.
 */
export function manilaClock(value) {
  const date = toDate(value);
  if (!date) return null;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: STAMP_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).formatToParts(date);

  const pick = (type) => (parts.find((part) => part.type === type) || {}).value || '';
  const year = Number(pick('year'));
  const month = Number(pick('month'));
  const day = Number(pick('day'));
  const hour = Number(pick('hour'));
  const minute = pick('minute');
  // Some ICU builds hand back "am" rather than "AM".
  const period = (pick('dayPeriod') || (hour >= 12 ? 'PM' : 'AM')).toUpperCase();

  if (!year || !month || !day || !Number.isFinite(hour)) return null;
  return { year, month, day, hour, minute: minute || '00', period };
}

/** `Oct 27, 2026` - empty string when the timestamp is unusable. */
export function formatStampDate(value) {
  const clock = manilaClock(value);
  if (!clock) return '';
  return `${MONTH_LABELS[clock.month - 1]} ${clock.day}, ${clock.year}`;
}

/** `8:02 AM` - empty string when the timestamp is unusable. */
export function formatStampTime(value) {
  const clock = manilaClock(value);
  if (!clock) return '';
  return `${clock.hour}:${clock.minute} ${clock.period}`;
}

/**
 * `12 m`, `1.2 km`, or `null`.
 *
 * Negative and non-finite input returns null instead of "NaN m" - a distance
 * that cannot be measured should not be printed as if it had been.
 */
export function formatMeters(value) {
  if (value === null || value === undefined || value === '') return null;
  const meters = Number(value);
  if (!Number.isFinite(meters) || meters < 0) return null;
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * `HYT Foundation Building, Natividad, QC` -> `HYT Foundation Building`.
 *
 * The stored name is the full postal-ish string, which is far too long for a
 * stamp. The first comma-separated segment is the part that identifies the
 * site, and the rest is address detail nobody reads on a photo.
 */
export function shortOfficeName(name) {
  const text = String(name || '').split(',')[0].trim();
  return text || null;
}

/**
 * Everything the renderer needs, in reading order.
 *
 * `at` should be the SERVER's timestamp. The caller is responsible for
 * choosing it (`requested_at` for a clock-in, `pending_end_time` for a
 * clock-out); this function only formats what it is given.
 */
export function buildStampLines({
  action = 'clockIn',
  at = null,
  locationName = null,
  latitude = null,
  longitude = null,
  distanceMeters = null,
  accuracyMeters = null,
  userName = null,
  roleLabel = null,
  note = null
} = {}) {
  const isClockOut = String(action).toLowerCase().includes('out');

  const date = formatStampDate(at);
  const time = formatStampTime(at);

  const lines = [];

  // Where. Office first, because it is the part an administrator reads.
  const place = shortOfficeName(locationName);
  const distance = formatMeters(distanceMeters);
  if (place || distance) {
    lines.push([place, distance].filter(Boolean).join(' · '));
  }

  // Proof, not decoration: the raw fix and its own uncertainty. A ±5000 m
  // reading is the tell that the position came from the network, not GPS.
  //
  // The null/'' checks are not belt-and-braces: `Number(null)` is 0 and
  // `Number.isFinite(0)` is true, so a missing fix would otherwise be printed
  // as "0.00000, 0.00000" - a confident claim to be off the coast of Africa.
  const hasCoordinates = latitude !== null && latitude !== undefined && latitude !== ''
    && longitude !== null && longitude !== undefined && longitude !== '';
  const lat = Number(latitude);
  const lon = Number(longitude);
  const coordinates = hasCoordinates && Number.isFinite(lat) && Number.isFinite(lon)
    ? `${lat.toFixed(5)}, ${lon.toFixed(5)}`
    : null;
  const accuracy = formatMeters(accuracyMeters);
  if (coordinates) {
    lines.push(accuracy ? `${coordinates} · ±${accuracy}` : coordinates);
  } else if (accuracy) {
    lines.push(`±${accuracy}`);
  }

  // Who.
  const who = [String(userName || '').trim(), String(roleLabel || '').trim()]
    .filter(Boolean)
    .join(' · ');
  if (who) lines.push(who);

  // Anything the trainee typed, trimmed so one long note cannot swallow the
  // rest of the stamp.
  const noteText = String(note || '').trim();
  if (noteText) lines.push(noteText.slice(0, 60));

  return {
    brand: STAMP_BRAND,
    action: isClockOut ? 'CLOCK OUT' : 'CLOCK IN',
    date,
    time,
    timestamp: [date, time].filter(Boolean).join(' · '),
    lines: lines.slice(0, STAMP_MAX_DETAIL_LINES)
  };
}
