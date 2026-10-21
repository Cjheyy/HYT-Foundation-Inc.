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
 * `hyt_location_is_valid` and `request_clock_in`. Changing this file alone does
 * not move the server: `UPDATE_GEOFENCE_RADIUS_20M.sql` has to be run too, or
 * the client and the RPC will disagree about the same student.
 *
 * ## Why 20 m, and what has to happen before it is switched on
 *
 * 20 m only behaves sensibly when the fence is measured against the SAME
 * coordinates the server uses. The centres here are now the real ones, measured
 * at each entrance; the ones they replaced were wrong by 1.2 km (HYT) and 5.9 km
 * (Atlanta). At 100 m that went unnoticed because the circles still overlapped.
 * At 20 m they do not, so the SQL must be run before enforcement is switched on.
 *
 * Order: run `UPDATE_GEOFENCE_RADIUS_20M.sql`, then flip
 * `GEOFENCE_ENFORCEMENT_ENABLED` and the `geofence_enforcement_enabled` setting.
 *
 * ## Accuracy is part of the decision
 *
 * A radius is meaningless without the fix's own uncertainty. At 20 m, a device
 * reporting "+/- 45 m" cannot honestly be called inside or outside, so it is
 * neither: it is rejected with `reason: 'imprecise'` and a message that asks
 * for a better fix, rather than a distance that implies precision we do not
 * have.
 */

/**
 * The two offices, measured on site (Google Maps pin at each entrance).
 *
 * These are the authoritative centres. `supabaseService.clockIn` imports this
 * list rather than keeping its own copy, and `request_clock_in` in Postgres
 * must carry the same two pairs - see UPDATE_GEOFENCE_RADIUS_20M.sql.
 *
 * The previous values were wrong by 1.2 km (HYT) and 5.9 km (Atlanta), which
 * did not matter at a 100 m radius but decides everything at 20 m.
 */
export const OFFICE_LOCATIONS = [
  {
    name: 'HYT Foundation Building, Natividad, QC',
    latitude: 14.642625282062204,
    longitude: 121.02453106633574
  },
  {
    name: 'Atlanta Centre, San Juan',
    latitude: 14.604736146553744,
    longitude: 121.05314663304407
  }
];

export const GEOFENCE_RADIUS_METERS = 20;

/**
 * A fix worse than this cannot be judged against a 20 m fence.
 *
 * This used to be 30 while the fence was 20, which cannot be right: a fix that
 * is only good to +/-30 m cannot place someone inside a 20 m circle. The doubt
 * was 1.5x wider than the thing being measured, and the comment claimed the
 * opposite.
 *
 * The ceiling is now the radius itself - a fix can only prove you are inside a
 * 20 m fence if its own uncertainty is smaller than 20 m. It must never exceed
 * GEOFENCE_RADIUS_METERS; `geofence.test.js` asserts that.
 *
 * Roughly: a phone outdoors gives 3-10 m, a city street 10-25 m, indoors
 * 20-100 m - so indoors the honest answer is "go somewhere with a view of the
 * sky", which is what describeGeofenceFailure() already says.
 */
export const GEOFENCE_MAX_ACCURACY_METERS = GEOFENCE_RADIUS_METERS;

/**
 * Opt-in stricter rule: require the WHOLE uncertainty circle to fit inside the
 * fence (distance + accuracy <= radius) instead of judging the reported point
 * alone (distance <= radius).
 *
 * Left off because at a 20 m radius it rejects people standing at the door -
 * a 15 m indoor fix reading 12 m gives 27 m and fails. The reported point is
 * accepted, and the accuracy is stored alongside it so an admin reviewing a
 * disputed row can see how much doubt there was. Flip this to true if you ever
 * need the conservative reading.
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
 */
export const GEOFENCE_ENFORCEMENT_ENABLED = false;

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
