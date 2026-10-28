/**
 * Geofencing for HYT Foundation Inc.
 *
 * ## One number, one place
 *
 * The radius used to be written out three times - here, in
 * `supabaseService.clockIn`, and in the error copy on the Attendance page - and
 * the three could drift apart without anyone noticing. `GEOFENCE_RADIUS_METERS`
 * is now the only copy on the client; everything else imports it.
 *
 * The SERVER has its own copy of both the radius and the two centres, inside
 * `hyt_location_is_valid` and the two `request_clock_*` RPCs. Changing this file
 * alone does not move the server: `db/patches/PATCH_GEOFENCE_100M_AND_PLACES.sql` has to be
 * run too, or the client and the RPC will disagree about the same student.
 *
 * ## Why 100 m
 *
 * The fence only has to answer "is this person at one of the two sites", not
 * "which square metre". 20 m was tried and failed in the field: indoors a phone
 * reports 20-50 m of uncertainty, so the accuracy gate rejected real clock-ins
 * from people standing inside the building. 100 m still refuses the failure
 * this exists for - a 6.4 km clock-in from MOA - and the two sites are 5.2 km
 * apart, so the circles cannot overlap.
 *
 * Order: run `db/patches/PATCH_GEOFENCE_100M_AND_PLACES.sql`, then flip
 * `GEOFENCE_ENFORCEMENT_ENABLED` and the `geofence_enforcement_enabled` setting.
 *
 * ## Accuracy is part of the decision
 *
 * A radius is meaningless without the fix's own uncertainty. A device reporting
 * "+/- 250 m" cannot honestly be called inside or outside a 100 m circle, so it
 * is neither: it is rejected with `reason: 'imprecise'` and a message that asks
 * for a better fix, rather than a distance that implies precision we do not
 * have.
 */

/**
 * The two offices, measured on site (Google Maps pin at each entrance).
 *
 * `name` is the ONLY label the app ever prints - the stamp, the admin queue and
 * the database all use these two strings, so a row can never be filed under a
 * third place. It used to be the full postal-ish string
 * ("HYT Foundation Building, Natividad, QC" / "Atlanta Centre, San Juan") on the
 * client and a different one ("Atlanta Office") on the server, which is why the
 * same clock-in could read as two different sites depending on who rendered it.
 *
 * `address` keeps the postal detail for anything that needs it. Nothing reads
 * it today; it is here so the long form is not lost.
 *
 * These coordinates are the authoritative centres. `supabaseService.clockIn`
 * imports this list rather than keeping its own copy, and the RPCs in Postgres
 * carry the same two pairs - see db/patches/PATCH_GEOFENCE_100M_AND_PLACES.sql.
 */
export const OFFICE_LOCATIONS = [
  {
    name: 'HYT Building',
    address: 'HYT Foundation Building, Natividad, QC',
    latitude: 14.642625282062204,
    longitude: 121.02453106633574
  },
  {
    name: 'Atlanta San Juan Building',
    address: 'Atlanta Centre, San Juan',
    latitude: 14.604736146553744,
    longitude: 121.05314663304407
  }
];

/**
 * 100 m, not 20 m.
 *
 * 20 m was correct arithmetic and unusable field equipment. A phone outdoors
 * reports 3-10 m, but indoors - which is where a trainee actually stands when
 * clocking in - it reports 20-50 m, and the accuracy gate then refused the fix
 * before the distance was even measured. A real reading of 29 m was rejected
 * with "too rough to confirm you are on site" while the person was in the
 * building.
 *
 * 100 m still separates the two sites by a wide margin (they are ~5.2 km apart)
 * and still refuses the failure this whole fence exists for: the off-site
 * clock-in from MOA, which was 6.4 km away. The photo, the server timestamp and
 * the admin approval are the real controls; the fence only has to catch
 * "somewhere else entirely".
 *
 * The SERVER carries the same number inside request_clock_in and
 * request_clock_out - change one, change both.
 */
export const GEOFENCE_RADIUS_METERS = 100;

/**
 * A fix worse than this is refused outright: it cannot say anything useful
 * about a 100 m circle. Kept equal to the radius, so the two rules cannot drift
 * apart - a fix whose own uncertainty is wider than the fence cannot prove
 * anything about the fence.
 *
 * Roughly: a phone outdoors gives 3-10 m, a city street 10-25 m, indoors
 * 20-100 m - so this now admits an ordinary indoor reading and still rejects a
 * Wi-Fi/IP guess (which arrives as 5000 m, or as `source: 'ip'` and is refused
 * before it gets here).
 */
export const GEOFENCE_MAX_ACCURACY_METERS = GEOFENCE_RADIUS_METERS;

/**
 * Where "acceptable" stops and "worth a second look" starts.
 *
 * The fence accepts a fix up to GEOFENCE_MAX_ACCURACY_METERS, but an
 * administrator deciding whether to credit hours should still see that the fix
 * was coarse. Anything above this is labelled "Imprecise fix" in the review
 * queue - accepted, not hidden.
 */
export const GEOFENCE_TRUSTED_ACCURACY_METERS = 50;

/**
 * Opt-in stricter rule: require the WHOLE uncertainty circle to fit inside the
 * fence (distance + accuracy <= radius) instead of judging the reported point
 * alone (distance <= radius).
 *
 * Left off because it rejects people standing at the door - a 30 m indoor fix
 * reading 12 m gives 42 m and fails at 100 m just as it did at 20 m. The
 * reported point is accepted, and the accuracy is stored alongside it so an
 * admin reviewing a disputed row can see how much doubt there was. Flip this to
 * true if you ever need the conservative reading.
 */
export const GEOFENCE_REQUIRE_ACCURACY_INSIDE_RADIUS = false;

/**
 * CLIENT-SIDE PRE-CHECK ONLY.
 *
 * This flag never decides whether a clock-in is accepted. The authoritative
 * check lives in Postgres, inside `request_clock_in`, and reads
 * `settings.geofence_enforcement_enabled`; the client cannot bypass it because
 * `attendance_logs` grants no INSERT to `authenticated`.
 *
 * - `false` = skip the local Haversine pre-check and let the server decide.
 * - `true` = also run the local pre-check, for a friendlier message without a
 *   round trip. Set both this flag and the settings row together.
 *
 * ## Why this is now `true` (it was `false` for months)
 *
 * While it was false, `Attendance.jsx` chose `getQuickCoordinates()` instead of
 * `getCoordinatesWithFallback()` - one short coarse attempt, then an IP lookup,
 * then a FABRICATED "you are standing on the office pin" fix with
 * `accuracy: null`. A real off-site clock-in was accepted that way: the server
 * switch was also off, so nothing anywhere said no.
 *
 * Flipping this to true is not cosmetic. It is what makes the client ask for a
 * high-accuracy fix, which is the only kind that can honestly satisfy the
 * fence. Leave it false and the server will reject legitimate on-site clock-ins
 * as `imprecise`, because a coarse or IP fix carries 5000 m of uncertainty.
 */
export const GEOFENCE_ENFORCEMENT_ENABLED = true;

/**
 * LOCAL DEVELOPMENT ONLY - false in every production build.
 *
 * A laptop has no GPS. Chrome answers `getCurrentPosition` from Wi-Fi or the IP
 * address, which is good to kilometres, so the fence can never be satisfied
 * reliably on localhost. That is not a defect: it is the same rule that stopped
 * the real off-site clock-in from MOA.
 *
 * The tempting fix - switch enforcement off to test - is exactly what reopened
 * that hole before. So the fence is skipped only when BOTH are true:
 *   1. the bundle is a development build (`NODE_ENV !== 'production'`), and
 *   2. the page is served from localhost / 127.0.0.1 / ::1.
 *
 * A deployed build on the real domain satisfies neither, and CRA inlines
 * `process.env.NODE_ENV` at build time, so this branch is dead code that
 * disappears from `build/`. Jest runs with NODE_ENV=test, which is excluded so
 * the test suite keeps exercising the real rule.
 *
 * Rows written this way carry `location_source = 'dev'`, and the admin table
 * labels them, so a fabricated fix can never be mistaken for a measured one.
 */
export function shouldBypassGeofence({
  env = process.env.NODE_ENV,
  host = typeof window !== 'undefined' ? window.location.hostname : ''
} = {}) {
  if (env === 'production' || env === 'test') return false;
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

export const GEOFENCE_DEV_BYPASS = shouldBypassGeofence();

/**
 * The shape of the fix the dev bypass submits: the office pin, flagged as `dev`.
 *
 * The COORDINATES here are only the fallback used when the laptop cannot produce
 * any position at all. Normally the page snaps to whichever office the machine's
 * Wi-Fi/IP guess is nearest, so a developer testing from Atlanta gets "Atlanta
 * San Juan Building" rather than a stamp that always says HYT.
 *
 * `accuracy` and `source` are always taken from here. The accuracy is small
 * because the server applies the same fence inside `request_clock_in` - a
 * client-only bypass would simply be rejected there instead.
 */
export const DEV_BYPASS_FIX = {
  latitude: OFFICE_LOCATIONS[0].latitude,
  longitude: OFFICE_LOCATIONS[0].longitude,
  accuracy: 5,
  source: 'dev'
};

/**
 * Which office a dev-bypass run should be filed under.
 *
 * Extracted from the page so it can be tested: the bug it fixes was that the
 * bypass always submitted `OFFICE_LOCATIONS[0]`, so a developer testing from
 * Atlanta got a stamp reading "HYT Building · 0 m" and concluded the location
 * was broken. It never was - the bypass simply did not look.
 *
 * A Wi-Fi/IP guess is good enough to choose between two sites 5.2 km apart,
 * which is all this needs. Anything unusable falls back to the first office so
 * a dev run is never blocked.
 */
export function snapToNearestOffice(latitude, longitude, fallback = OFFICE_LOCATIONS[0]) {
  return nearestOffice(latitude, longitude) || fallback;
}

export const MAX_SHIFT_SECONDS = 8 * 60 * 60; // 08:00:00 hard cap
export const SHIFT_WARNING_SECONDS = (7 * 60 + 55) * 60; // 07:55:00 alarm

export function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (Number(deg) * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** The office nearest a fix, with its distance, or null when the fix is unusable. */
export function nearestOffice(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  let nearest = null;
  for (const office of OFFICE_LOCATIONS) {
    const distance = haversineDistanceMeters(lat, lon, office.latitude, office.longitude);
    if (!nearest || distance < nearest.distance) {
      nearest = { ...office, distance };
    }
  }
  return nearest;
}

/**
 * Decide whether a fix is inside the fence.
 *
 * `reason` is the useful part:
 *   'bypassed'  - enforcement is off, nothing was checked
 *   'inside'    - within the radius
 *   'outside'   - beyond the radius
 *   'imprecise' - the fix is too vague to judge, retry somewhere with a view of the sky
 *   'invalid'   - no usable coordinates at all
 *
 * `enforce` exists so the decision can be exercised in tests while the shipped
 * flag stays false; production callers never pass it.
 */
export function checkGeofence(
  latitude,
  longitude,
  radiusMeters = GEOFENCE_RADIUS_METERS,
  accuracyMeters = null,
  enforce = GEOFENCE_ENFORCEMENT_ENABLED
) {
  if (!enforce) {
    return {
      allowed: true,
      // null, not 0. Returning 0 claimed the caller was standing on the pin,
      // and any UI that rendered the number would have said "0 meters away".
      distance: null,
      location: null,
      accuracy: accuracyMeters,
      reason: 'bypassed',
      bypassed: true
    };
  }

  const nearest = nearestOffice(latitude, longitude);
  if (!nearest) {
    return { allowed: false, distance: null, location: null, accuracy: accuracyMeters, reason: 'invalid' };
  }

  const accuracy = Number(accuracyMeters);
  const hasAccuracy = Number.isFinite(accuracy) && accuracy > 0;
  const base = {
    distance: nearest.distance,
    location: nearest.name,
    accuracy: hasAccuracy ? accuracy : null
  };

  if (hasAccuracy && accuracy > GEOFENCE_MAX_ACCURACY_METERS) {
    return { ...base, allowed: false, reason: 'imprecise' };
  }

  if (nearest.distance > radiusMeters) {
    return { ...base, allowed: false, reason: 'outside' };
  }

  // Optional conservative reading: the reported point is inside, but is the
  // whole uncertainty circle? Only meaningful when the fix carries an accuracy.
  if (GEOFENCE_REQUIRE_ACCURACY_INSIDE_RADIUS && hasAccuracy
      && nearest.distance + accuracy > radiusMeters) {
    return { ...base, allowed: false, reason: 'imprecise' };
  }

  return { ...base, allowed: true, reason: 'inside' };
}

/**
 * The sentence the student actually reads when the fence says no.
 *
 * Kept here rather than in the page because clock-in and clock-out both need
 * it, and because the wording has to carry the real number: "within 100 meters"
 * was hard-coded in two places and would have kept saying 100 after the radius
 * changed to 20.
 */
export function describeGeofenceFailure(result, { action = 'clock in' } = {}) {
  const radius = GEOFENCE_RADIUS_METERS;
  if (!result) return `You must be within ${radius} meters of an approved HYT location to ${action}.`;

  if (result.reason === 'imprecise') {
    const accuracy = result.accuracy != null ? Math.round(result.accuracy) : null;
    return accuracy != null
      ? `Your location is only accurate to about ${accuracy} meters, which is too rough to confirm you are on site. Move somewhere with a clearer view of the sky and try again.`
      : `Your location is too rough to confirm you are on site. Try again with location services on.`;
  }

  if (result.reason === 'invalid') {
    return 'We could not read your location. Turn on location services and try again.';
  }

  if (result.distance != null) {
    return `You are currently ${Math.round(result.distance)} meters away from the nearest approved office. You must be within ${radius} meters to ${action}.`;
  }

  return `You must be within ${radius} meters of an approved HYT location to ${action}.`;
}
