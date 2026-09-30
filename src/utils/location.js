/**
 * Two-tier geolocation for Clock In / Clock Out.
 *
 * Tier 1: precise browser fix `{ enableHighAccuracy: true, ... }`.
 * Tier 2: on TIMEOUT automatically retries coarse IP/Wi-Fi positioning
 * `{ enableHighAccuracy: false, timeout: 15000 }` — never a raw timeout.
 * Tier 3: IP-based lookup when GPS is unavailable entirely.
 * Permission denial (code 1) still surfaces its own message immediately.
 */

import { OFFICE_LOCATIONS } from './geofence';

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
 * timeout), then a coarse retry (another 15 s), then an IP lookup (10 s) — up to
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

const IP_PROVIDERS = ['https://ipapi.co/json/', 'http://ip-api.com/json/'];
const IP_FETCH_TIMEOUT_MS = 10000;
const IP_FETCH_TIMEOUT_QUICK_MS = 4000;

export const describeGeolocationError = (error) => {
  const code = error?.code;
  // 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
  if (code === 1) return 'Location permission denied. Please allow location access in browser settings.';
  if (code === 2) return 'Location unavailable. Please check your network/Wi-Fi connection.';
  if (code === 3) return 'Location request timed out. Please try again.';
  return 'Location unavailable. Please check your network/Wi-Fi connection.';
};

/**
 * True only for real geolocation failures.
 *
 * Callers used to test `message.includes('permission')`, which also matched
 * database errors such as "permission denied for table attendance_logs" and
 * reported them as a browser location-permission problem — hiding the actual
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
    || message.includes('location permission')
    || message.includes('location unavailable')
    || message.includes('location request timed out')
    || message.includes('must be within')
    || message.includes('approved hyt location');
};

const requestBrowserPosition = (options) => new Promise((resolve, reject) => {
  if (!navigator.geolocation) {
    reject(Object.assign(
      new Error('Location unavailable. Please check your network/Wi-Fi connection.'),
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
      // ipapi.co: { latitude, longitude } — ip-api.com: { lat, lon, status }
      const latitude = Number(data.latitude ?? data.lat);
      const longitude = Number(data.longitude ?? data.lon);
      if (data.status === 'fail' || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error(data.message || 'IP lookup returned no coordinates.');
      }
      return { latitude, longitude, accuracy: 5000, source: 'ip' };
    } catch (error) {
      lastError = error;
    }
  }
  throw Object.assign(
    new Error('Location unavailable. Please check your network/Wi-Fi connection.'),
    { code: 2, cause: lastError }
  );
};

/**
 * High-accuracy first, coarse retry on TIMEOUT, IP lookup last.
 * Permission denial surfaces immediately; timeouts never surface raw.
 */
export const getCoordinatesWithFallback = async (
  primaryOptions = GEOLOCATION_PRIMARY_OPTIONS,
  fallbackOptions = GEOLOCATION_FALLBACK_OPTIONS
) => {
  try {
    return await requestBrowserPosition(primaryOptions);
  } catch (error) {
    if (error?.code === 1) throw error;
    if (error?.code === 3) {
      try {
        return await requestBrowserPosition(fallbackOptions);
      } catch (retryError) {
        if (retryError?.code === 1) throw retryError;
        return fetchIpCoordinates();
      }
    }
    return fetchIpCoordinates();
  }
};

/**
 * Fast coordinates for when the geofence is not enforced: one short coarse
 * attempt, then a short IP lookup, then the registered office as a last resort.
 *
 * Always resolves.  With enforcement off the server records the coordinates but
 * does not act on them, so blocking a trainee because GPS *and* the IP service
 * were both unavailable would be a self-inflicted failure.
 */
export const getQuickCoordinates = async () => {
  try {
    return await requestBrowserPosition(GEOLOCATION_QUICK_OPTIONS);
  } catch (browserError) {
    try {
      return await fetchIpCoordinates(IP_FETCH_TIMEOUT_QUICK_MS);
    } catch (ipError) {
      return {
        latitude: OFFICE_LOCATIONS[0].latitude,
        longitude: OFFICE_LOCATIONS[0].longitude,
        accuracy: null,
        source: 'fallback'
      };
    }
  }
};
