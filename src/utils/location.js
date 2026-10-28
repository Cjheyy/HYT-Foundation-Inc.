/**
 * Two-tier geolocation for Clock In / Clock Out.
 *
 * Tier 1: precise browser fix `{ enableHighAccuracy: true, ... }`.
 * Tier 2: on TIMEOUT automatically retries coarse IP/Wi-Fi positioning
 * `{ enableHighAccuracy: false, timeout: 15000 }` - never a raw timeout.
 * Tier 3: IP-based lookup when GPS is unavailable entirely.
 * Permission denial (code 1) still surfaces its own message immediately.
 */

import { GEOFENCE_ENFORCEMENT_ENABLED, OFFICE_LOCATIONS } from './geofence';

export const GEOLOCATION_PRIMARY_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 60000
};

export const GEOLOCATION_FALLBACK_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 15000,
  maximumAge: 60000
};

/**
 * Fast path, used when the geofence is not enforced.
 *
 * Clock In felt slow because a high-accuracy fix is attempted first (15 s
 * timeout), then a coarse retry (another 15 s), then an IP lookup (10 s) - up to
 * ~40 s before the request is even sent.  When the server accepts any location,
 * precision buys nothing, so accept a recent cached fix and fail over quickly.
 */
export const GEOLOCATION_QUICK_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 4000,
  maximumAge: 300000
};

// Kept for callers importing the previous names.
export const GEOLOCATION_PRECISE_OPTIONS = GEOLOCATION_PRIMARY_OPTIONS;
export const GEOLOCATION_COARSE_OPTIONS = GEOLOCATION_FALLBACK_OPTIONS;
export const GEOLOCATION_RETRY_OPTIONS = GEOLOCATION_FALLBACK_OPTIONS;

// HTTPS only. `http://ip-api.com/json/` was the second provider and it could
// never work from the deployed site: the app is served over HTTPS, so the
// browser blocks the plain-HTTP request as mixed content before it leaves the
// device. It only ever "worked" on localhost, which is exactly where nobody
// needs it. ipwho.is is keyless, CORS-enabled and HTTPS.
const IP_PROVIDERS = ['https://ipapi.co/json/', 'https://ipwho.is/'];
const IP_FETCH_TIMEOUT_MS = 10000;
const IP_FETCH_TIMEOUT_QUICK_MS = 4000;

/**
 * Where a device is supposed to get its position from - the two platforms are
 * genuinely different, and saying the wrong one sends people to fix the wrong
 * thing.
 *
 * A phone has a GPS receiver: if it reports no position, the phone's Location
 * switch is off or the site is not allowed to use it. A laptop has no GPS at
 * all - Chrome locates it by asking Google about nearby Wi-Fi networks - so a
 * laptop with Wi-Fi off genuinely cannot produce a position, while its GPS is
 * not "off", it simply does not exist.
 */
const detectDeviceKind = () => {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = String(navigator.userAgent || '');
  if (/Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua)) return 'phone';
  try {
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return 'phone';
  } catch (error) {
    // matchMedia is not worth failing over.
  }
  return 'desktop';
};

const POSITION_HINT = {
  phone: 'Turn on Location (GPS) on your phone, then try again.',
  desktop: 'Keep Wi-Fi on and allow this site to use your location - a laptop has no GPS and locates itself from nearby networks.'
};

const positionHint = () => POSITION_HINT[detectDeviceKind()] || POSITION_HINT.desktop;

/**
 * Turn a geolocation failure into something the person can act on.
 *
 * The previous text for codes 2 and 3 was "Location unavailable. Please check
 * your network/Wi-Fi connection." on every device, which is wrong twice over:
 * a phone with Wi-Fi but Location switched off got told to fix its Wi-Fi, and
 * the app cannot even load without a network in the first place. The advice is
 * now chosen for the device actually in hand.
 */
export const describeGeolocationError = (error, { device = detectDeviceKind() } = {}) => {
  const code = Number(error?.code);
  const hint = POSITION_HINT[device] || POSITION_HINT.desktop;
  // 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
  if (code === 1) {
    return 'Location is blocked for this site. Open the padlock (or the info icon) in the address bar, set Location to Allow, then try again.';
  }
  if (code === 2) {
    return `This device could not get a position. ${hint}`;
  }
  if (code === 3) {
    return 'Getting your location took too long. Move near a window or step outside, then try again.';
  }
  return `We could not determine your location. ${hint}`;
};

/**
 * True only for real geolocation failures.
 *
 * Callers used to test `message.includes('permission')`, which also matched
 * database errors such as "permission denied for table attendance_logs" and
 * reported them as a browser location-permission problem - hiding the actual
 * fault.  Match on the geolocation error code (1/2/3, which both our own
 * errors and the native GeolocationPositionError carry) or on wording that only
 * a location failure uses.
 */
export const isGeolocationError = (error) => {
  if (!error) return false;
  if (error.code === 1 || error.code === 2 || error.code === 3) return true;
  if (error.name === 'GeolocationPositionError') return true;
  const message = String(error.message || '').toLowerCase();
  return message.includes('geolocation')
    || message.includes('location is blocked')
    || message.includes('could not get a position')
    || message.includes('could not determine your location')
    || message.includes('location (gps)')
    || message.includes('location request timed out')
    || message.includes('getting your location took too long')
    || message.includes('must be within')
    || message.includes('approved hyt location');
};

const requestBrowserPosition = (options) => new Promise((resolve, reject) => {
  if (!navigator.geolocation) {
    reject(Object.assign(
      new Error(`This browser cannot report a position. ${positionHint()}`),
      { code: 2 }
    ));
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (position) => resolve({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      source: options.enableHighAccuracy ? 'gps' : 'coarse'
    }),
    (geoError) => reject(Object.assign(new Error(describeGeolocationError(geoError)), { code: geoError?.code })),
    options
  );
});

const fetchWithTimeout = async (url, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`IP lookup failed (${response.status})`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
};

/**
 * IP fallback: approximate city-level fix, never throws a raw timeout toast.
 * Throws only when every provider is unreachable.
 */
export const fetchIpCoordinates = async (timeoutMs = IP_FETCH_TIMEOUT_MS) => {
  let lastError = null;
  for (const url of IP_PROVIDERS) {
    try {
      const data = await fetchWithTimeout(url, timeoutMs);
      // ipapi.co: { latitude, longitude }
      // ipwho.is: { success, latitude, longitude } - and `success: false` with a
      // 200 status when it refuses, so the flag has to be checked explicitly.
      const latitude = Number(data.latitude ?? data.lat);
      const longitude = Number(data.longitude ?? data.lon);
      if (data.success === false || data.status === 'fail' || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error(data.message || 'IP lookup returned no coordinates.');
      }
      return { latitude, longitude, accuracy: 5000, source: 'ip' };
    } catch (error) {
      lastError = error;
    }
  }
  throw Object.assign(
    new Error(`We could not determine your location. ${positionHint()}`),
    { code: 2, cause: lastError }
  );
};

/**
 * High-accuracy first, coarse retry, IP lookup last.
 * Permission denial surfaces immediately; timeouts never surface raw.
 *
 * The coarse retry used to fire only on TIMEOUT (code 3).  POSITION_UNAVAILABLE
 * (code 2) is the commoner failure on Android - a high-accuracy GPS request
 * made indoors, or with Location on but no satellite fix - and a coarse
 * (network-based) request succeeds in precisely that situation.  Retrying only
 * on code 3 meant the one case a retry would have rescued went straight to the
 * IP fallback, which the geofence then refuses anyway.
 */
export const getCoordinatesWithFallback = async (
  primaryOptions = GEOLOCATION_PRIMARY_OPTIONS,
  fallbackOptions = GEOLOCATION_FALLBACK_OPTIONS
) => {
  try {
    return await requestBrowserPosition(primaryOptions);
  } catch (error) {
    if (error?.code === 1) throw error;
    try {
      return await requestBrowserPosition(fallbackOptions);
    } catch (retryError) {
      if (retryError?.code === 1) throw retryError;
      // With the fence enforced the caller refuses an IP fix outright - it is
      // city-level accuracy and can never prove 100 m - so spending another
      // 10-20 s on two lookups only delays the error and then blames the
      // network for it. Fail now, with the real reason.
      if (GEOFENCE_ENFORCEMENT_ENABLED) throw retryError;
      return fetchIpCoordinates();
    }
  }
};

/**
 * Fast coordinates for when the geofence is not enforced: one short coarse
 * attempt, then a short IP lookup, then the registered office as a last resort.
 *
 * Always resolves.  With enforcement off the server records the coordinates but
 * does not act on them, so blocking a trainee because GPS *and* the IP service
 * were both unavailable would be a self-inflicted failure.
 *
 * The office fallback is a FABRICATION - it reports a position the device never
 * measured - so it is only legal while enforcement is off. With enforcement on
 * it would hand the fence a perfect "standing on the pin" fix (distance 0) from
 * a device that knows nothing, and clock-ins would be approved from anywhere.
 * In that mode it throws instead, and the caller shows the location error.
 */
export const getQuickCoordinates = async () => {
  try {
    return await requestBrowserPosition(GEOLOCATION_QUICK_OPTIONS);
  } catch (browserError) {
    try {
      return await fetchIpCoordinates(IP_FETCH_TIMEOUT_QUICK_MS);
    } catch (ipError) {
      if (GEOFENCE_ENFORCEMENT_ENABLED) {
        throw Object.assign(
          new Error(describeGeolocationError(browserError)),
          { code: browserError?.code || 2, cause: ipError }
        );
      }
      return {
        latitude: OFFICE_LOCATIONS[0].latitude,
        longitude: OFFICE_LOCATIONS[0].longitude,
        accuracy: null,
        source: 'fallback'
      };
    }
  }
};
