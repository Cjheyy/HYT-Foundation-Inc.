/**
 * Two-tier geolocation for Clock In / Clock Out.
 *
 * Tier 1: precise browser fix `{ enableHighAccuracy: true, ... }`.
 * Tier 2: on TIMEOUT automatically retries coarse IP/Wi-Fi positioning
 * `{ enableHighAccuracy: false, timeout: 15000 }` - never a raw timeout.
 * Tier 3: IP-based lookup when GPS is unavailable entirely.
 * Permission denial (code 1) still surfaces its own message immediately.
 */

import { GEOFENCE_ENFORCEMENT_ENABLED } from './geofence';

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

/**
 * Third attempt, used only after both single-shot requests failed.
 *
 * `timeout` is deliberately generous here: this attempt exists because the
 * device was still acquiring a fix when the first two gave up, so cutting it
 * short would defeat the point. The wall-clock cap lives in `watchForPosition`.
 */
export const GEOLOCATION_WATCH_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 20000,
  maximumAge: 0
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
  // "Turn on Location (GPS)" was the whole advice, and it is not enough on
  // Android: the site permission and the Chrome APP's own permission are two
  // different switches, and the second one lives in Settings > Apps. Someone
  // who has already switched Location on - and still gets this message - has
  // hit the second switch, so it has to be named.
  phone: 'Allow Chrome itself to use Location - Settings > Apps > Chrome > Permissions > Location - and make sure Location is switched on. Then try again.',
  desktop: 'Keep Wi-Fi on and allow this site to use your location - a laptop has no GPS and locates itself from nearby networks.'
};

/**
 * What to do after a TIMEOUT (code 3), per platform.
 *
 * This used to be one sentence - "Move near a window or step outside, then try
 * again" - printed on every device. On a phone that is correct advice: no
 * satellite fix indoors is the usual cause. On a laptop it is nonsense, and
 * expensive nonsense: a laptop has no GPS receiver, so walking it to a window
 * changes nothing, while the thing that actually failed (Windows Location
 * Services, or Chrome's permission for it) stays off. The person follows the
 * advice, fails again, and concludes the app is broken.
 *
 * A Windows laptop gets its position from Windows Location Services, which is
 * off by default on many machines and is a separate switch from the browser
 * permission. Naming that switch is the whole fix.
 */
const TIMEOUT_HINT = {
  phone: 'Getting your location took too long. Move near a window or step outside, then try again.',
  desktop: 'This laptop could not get a position in time, so we cannot confirm you are on site. A laptop has no GPS - it locates itself from Wi-Fi and from Windows Location Services. Turn on Settings > Privacy & security > Location, allow Chrome to use it, keep Wi-Fi on, then try again.'
};

/**
 * True when the page is running inside another app's embedded browser.
 *
 * This is the case that looks exactly like a broken device and is not: the
 * Facebook, Messenger, Instagram, Viber and TikTok in-app browsers ship a
 * WebView whose geolocation is either disabled outright or fails with
 * POSITION_UNAVAILABLE and no prompt at all. The page cannot tell the
 * difference from inside - it only sees a failed request - so the advice
 * "turn on Location" is useless, and the person is sent to a setting that was
 * never the problem.
 *
 * The tell is the user-agent: an in-app browser appends its own token.
 * `; wv)` marks an Android WebView, which covers most of them even when the
 * host app does not identify itself.
 */
const detectInAppBrowser = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = String(navigator.userAgent || '');
  return /FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|Viber|musical_ly|BytedanceWebview|; wv\)/i.test(ua);
};

const IN_APP_HINT = 'This page is open inside another app\'s browser, and those usually cannot use your location. Tap the menu (three dots) and choose "Open in Chrome", then try again.';

const positionHint = () => (detectInAppBrowser()
  ? IN_APP_HINT
  : (POSITION_HINT[detectDeviceKind()] || POSITION_HINT.desktop));

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
  // An in-app browser is the one case where no setting on the device is the
  // answer, so it overrides the per-platform advice instead of being appended
  // to it. See detectInAppBrowser.
  const inApp = detectInAppBrowser();
  const hint = inApp ? IN_APP_HINT : (POSITION_HINT[device] || POSITION_HINT.desktop);
  const slowHint = inApp ? IN_APP_HINT : (TIMEOUT_HINT[device] || TIMEOUT_HINT.desktop);
  // 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
  if (code === 1) {
    if (inApp) return IN_APP_HINT;
    return 'Location is blocked for this site. Open the padlock (or the info icon) in the address bar, set Location to Allow, then try again.';
  }
  if (code === 2) {
    return `This device could not get a position. ${hint}`;
  }
  if (code === 3) {
    return slowHint;
  }
  return `We could not determine your location. ${hint}`;
};

/**
 * The sentence for the case that cannot be explained by the error code.
 *
 * REMOVED ON PURPOSE. This used to claim "Chrome did not ask you for
 * permission, so the browser app must be blocked by the OS" whenever a request
 * failed with a code it did not recognise. It was a guess, it was printed as a
 * fact, and it was wrong: Google Maps, in the same Chrome, on the same phone,
 * located the person perfectly at the same minute.
 *
 * A wrong diagnosis is worse than none - it sends someone to a setting that was
 * never the problem and makes the real fault harder to find. What replaced it
 * is `withDiagnostics` below: the raw code and permission state travel with the
 * error so they can be read from the console, and the sentence shown to the
 * person says only what is known.
 */

/**
 * What the browser already knows about our permission, WITHOUT asking.
 *
 * `getCurrentPosition` is the expensive way to discover that the site has been
 * blocked: Chrome answers a blocked request with PERMISSION_DENIED immediately,
 * but a request that merely cannot be resolved (Windows Location Services off,
 * no Wi-Fi scan yet) runs to the full timeout - twice, because the page retries
 * coarse, so 30 s of a spinner before the person is told anything.
 *
 * The Permissions API answers the "is this blocked?" half in a millisecond. It
 * is not a substitute for the real request: 'granted' and 'prompt' both still
 * need `getCurrentPosition`, and a browser without the API returns 'unknown',
 * which the caller treats as "carry on".
 */
export const getGeolocationPermission = async () => {
  try {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'unknown';
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status?.state || 'unknown';
  } catch (error) {
    // Firefox throws on some permission names; Safari has no query() at all.
    return 'unknown';
  }
};

/**
 * A failed request, re-worded only when we can name the cause with certainty.
 *
 * Left alone: PERMISSION_DENIED (the site is blocked, and the padlock sentence
 * is the right one) and TIMEOUT (the request ran its full course, so the
 * provider was reachable and merely slow).
 *
 * Everything else is passed through unchanged. An earlier version of this
 * function guessed "the browser app must be blocked by the OS" from a code-2
 * failure, and it was WRONG: the same browser located the same person
 * perfectly on Google Maps a minute later. A guess printed as fact is worse
 * than no guess at all - it sends the person to a setting that was never the
 * problem. So the code and the permission state travel with the error for the
 * console, and the sentence stays honest.
 */
const withDiagnostics = (error, permission) => Object.assign(error, { permission });

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
    || message.includes('did not ask you for permission')
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
  const onPosition = (position) => resolve({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    source: options.enableHighAccuracy ? 'gps' : 'coarse'
  });
  const onFailure = (geoError) => reject(Object.assign(
    new Error(describeGeolocationError(geoError)),
    { code: geoError?.code, geoName: geoError?.name }
  ));

  try {
    navigator.geolocation.getCurrentPosition(onPosition, onFailure, options);
  } catch (thrown) {
    // A synchronous throw is NOT a GeolocationPositionError. It means the
    // browser refused to make the call at all - a detached method, an options
    // object it will not accept, or a policy that blocks the API outright -
    // and its own message is the only clue there is.
    //
    // It used to be swallowed: the throw escaped the executor, the promise
    // rejected with a bare TypeError, and the page then re-described it as "we
    // could not determine your location". That turned the one useful sentence
    // into the same generic one, and hid the fault behind a location problem
    // that did not exist.
    const detail = thrown?.message ? ` ${thrown.message}` : '';
    reject(Object.assign(
      new Error(`The browser refused the location request.${detail}`),
      { syncThrow: true, cause: thrown }
    ));
  }
});

/**
 * A third, patient attempt: watch instead of ask once.
 *
 * `getCurrentPosition` gives up at its own `timeout` and reports TIMEOUT even
 * when a fix is seconds away - the request is closed, not the search. On a
 * phone indoors the first fix often lands at 16-25 s, which is exactly the
 * window a single-shot call throws away, and the trainee is told the device
 * "could not get a position" while it was actively acquiring one.
 *
 * `watchPosition` keeps the search open and hands over the first reading that
 * arrives, so this rescues the slow case without loosening anything: the fix
 * still has to pass the same accuracy gate and the same 100 m fence. It is
 * tried only after both single-shot attempts have failed, and it is bounded, so
 * a device with no provider still fails - just later and for the last time.
 */
const watchForPosition = (options, maxWaitMs = 12000) => new Promise((resolve, reject) => {
  if (typeof navigator === 'undefined' || !navigator.geolocation?.watchPosition) {
    reject(Object.assign(new Error(`This browser cannot report a position. ${positionHint()}`), { code: 2 }));
    return;
  }

  let settled = false;
  let watchId = null;
  let timer = null;

  const finish = (settle, value) => {
    if (settled) return;
    settled = true;
    if (timer) clearTimeout(timer);
    if (watchId !== null) {
      try { navigator.geolocation.clearWatch(watchId); } catch (error) { /* already gone */ }
    }
    settle(value);
  };

  timer = setTimeout(() => finish(reject, Object.assign(
    new Error(describeGeolocationError({ code: 3 })),
    { code: 3 }
  )), maxWaitMs);

  try {
    watchId = navigator.geolocation.watchPosition(
      (position) => finish(resolve, {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        source: options.enableHighAccuracy ? 'gps' : 'coarse'
      }),
      (geoError) => finish(reject, Object.assign(
        new Error(describeGeolocationError(geoError)),
        { code: geoError?.code, geoName: geoError?.name }
      )),
      options
    );
    // A cached fix can arrive before `watchPosition` even returns its id, in
    // which case `finish` ran with `watchId === null` and could not stop the
    // watch. Release it now that the id exists, or the GPS stays awake.
    if (settled && watchId !== null) {
      try { navigator.geolocation.clearWatch(watchId); } catch (error) { /* already gone */ }
    }
  } catch (thrown) {
    const detail = thrown?.message ? ` ${thrown.message}` : '';
    finish(reject, Object.assign(
      new Error(`The browser refused the location request.${detail}`),
      { syncThrow: true, cause: thrown }
    ));
  }
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
  // NOTHING is awaited before the first `getCurrentPosition`. The permission
  // prompt is tied to the click that started this, and an `await` in between -
  // a Permissions API query, for instance - moves the request into a later
  // task. Chrome will then sometimes fail the request instead of prompting,
  // which looks exactly like a blocked site. The permission state is only
  // wanted for the error message, so it is fetched in parallel and read in the
  // catch, where being late costs nothing.
  const permissionPromise = getGeolocationPermission();
  try {
    return await requestBrowserPosition(primaryOptions);
  } catch (error) {
    if (error?.code === 1) throw error;
    try {
      return await requestBrowserPosition(fallbackOptions);
    } catch (retryError) {
      if (retryError?.code === 1) throw retryError;
      // Third attempt: stop asking once and start watching. A single-shot
      // request closes at its timeout even when a fix is a few seconds away,
      // which is the ordinary case on a phone indoors.
      //
      // Skipped entirely when the browser has no `watchPosition`, so a stub or
      // an old WebView still reports the real reason for the failure instead of
      // a manufactured "this browser cannot report a position".
      let lastError = retryError;
      if (typeof navigator !== 'undefined' && navigator.geolocation?.watchPosition) {
        try {
          return await watchForPosition(GEOLOCATION_WATCH_OPTIONS);
        } catch (watchError) {
          if (watchError?.code === 1) throw watchError;
          lastError = watchError;
        }
      }
      // With the fence enforced the caller refuses an IP fix outright - it is
      // city-level accuracy and can never prove 100 m - so spending another
      // 10-20 s on two lookups only delays the error and then blames the
      // network for it. Fail now, with the real reason.
      if (GEOFENCE_ENFORCEMENT_ENABLED) {
        throw withDiagnostics(lastError, await permissionPromise);
      }
      return fetchIpCoordinates();
    }
  }
};

/**
 * Fast coordinates for when the geofence is not enforced: one short coarse
 * attempt, then a short IP lookup.
 *
 * ## The fabricated fallback is gone, on purpose
 *
 * This used to end with `{ ...OFFICE_LOCATIONS[0], accuracy: null,
 * source: 'fallback' }` - the office pin, reported for a device that had
 * measured nothing. It was guarded by `if (GEOFENCE_ENFORCEMENT_ENABLED)`, so
 * it was only reachable with the fence off, which made it look harmless.
 *
 * It was not harmless. It was the same class of bug as the localhost bypass: a
 * fabricated position is indistinguishable from a measured one once it reaches
 * the fence, because the fence only ever sees numbers. `distance: 0` from a
 * device with no idea where it is looks exactly like `distance: 0` from someone
 * standing at the door. Any future flip of the enforcement flag - or any
 * caller that forgets to check it - turned every clock-in into an on-site one.
 *
 * So this now never invents a position. If the browser cannot produce a fix and
 * the IP lookup cannot either, the caller gets an error and the trainee is told
 * to turn location services on. That is the honest answer, and it is the only
 * one that keeps the fence meaningful.
 */
export const getQuickCoordinates = async () => {
  try {
    return await requestBrowserPosition(GEOLOCATION_QUICK_OPTIONS);
  } catch (browserError) {
    try {
      return await fetchIpCoordinates(IP_FETCH_TIMEOUT_QUICK_MS);
    } catch (ipError) {
      throw Object.assign(
        new Error(describeGeolocationError(browserError)),
        { code: browserError?.code || 2, cause: ipError }
      );
    }
  }
};
