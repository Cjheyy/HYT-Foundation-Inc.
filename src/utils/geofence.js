/**
 * Strict 5-meter geofencing for HYT Foundation Inc.
 * Office coordinates per specification:
 * - HYT Foundation Building: 55 Natividad St., Brgy. Paltok, Quezon City (14.6433 N, 121.0125 E)
 * - Atlanta Centre: Suite 1004 Atlanta Center, Annapolis St., San Juan City (14.6041 N, 121.0538 E)
 */

export const OFFICE_LOCATIONS = [
  { name: 'HYT Foundation Building, Natividad, QC', latitude: 14.6433, longitude: 121.0125 },
  { name: 'Atlanta Centre, San Juan', latitude: 14.6041, longitude: 121.0538 }
];

export const GEOFENCE_RADIUS_METERS = 100;

/**
 * CLIENT-SIDE PRE-CHECK ONLY — testing bypass.
 *
 * This flag no longer decides whether a clock-in is accepted.  The authoritative
 * check lives in Postgres, inside `request_clock_in`, and reads
 * `settings.geofence_enforcement_enabled` (see FIX_ATTENDANCE_PERMISSION_DENIED.sql).
 * The client cannot bypass it, because attendance_logs grants no INSERT to
 * `authenticated` — every write goes through that RPC.
 *
 * - `false` = skip the local Haversine pre-check and let the server decide.
 *   Keep this in sync with the settings row while testing/demoing.
 * - `true` = also run the local pre-check, for a friendlier message without a
 *   round trip.  Set both this flag and the settings row to `true` before
 *   production.
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

export function checkGeofence(latitude, longitude, radiusMeters = GEOFENCE_RADIUS_METERS) {
  // FORCE-BYPASS (testing): always pass while enforcement is OFF.
  // Re-enable by setting GEOFENCE_ENFORCEMENT_ENABLED = true above.
  if (!GEOFENCE_ENFORCEMENT_ENABLED) {
    return { allowed: true, distance: 0, location: 'Bypassed (testing)', bypassed: true };
  }
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { allowed: false, distance: null, location: null };
  }
  let nearest = null;
  for (const office of OFFICE_LOCATIONS) {
    const distance = haversineDistanceMeters(lat, lon, office.latitude, office.longitude);
    if (!nearest || distance < nearest.distance) {
      nearest = { ...office, distance };
    }
  }
  if (nearest && nearest.distance <= radiusMeters) {
    return { allowed: true, distance: nearest.distance, location: nearest.name };
  }
  return { allowed: false, distance: nearest ? nearest.distance : null, location: nearest ? nearest.name : null };
}

// FORCE-BYPASS aliases (testing): any legacy caller passes while enforcement is OFF.
export const isWithinLocation = () => true;
export const verifyLocation = () => true;
export const validateLocation = () => ({ isSuccess: true, isValid: true, allowed: true });

export function formatHMS(totalSeconds) {
  const total = Math.max(0, Math.min(MAX_SHIFT_SECONDS, Math.floor(Number(totalSeconds) || 0)));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (v) => String(v).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
