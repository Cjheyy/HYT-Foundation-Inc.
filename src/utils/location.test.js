/**
 * Where the device gets its position from, and what we say when it can't.
 *
 * The bug this covers: a phone at home, Wi-Fi connected, Location switched off,
 * was told "Location unavailable. Please check your network/Wi-Fi connection."
 * Wrong twice - the app cannot even load without a network, and a phone locates
 * itself with GPS, not Wi-Fi. The person then went looking for a Wi-Fi problem
 * that did not exist.
 */
import {
  describeGeolocationError,
  fetchIpCoordinates,
  getCoordinatesWithFallback,
  isGeolocationError
} from './location';

const geoError = (code, message = '') => Object.assign(new Error(message), { code });

describe('describeGeolocationError', () => {
  it('tells the truth about a blocked permission', () => {
    const text = describeGeolocationError(geoError(1), { device: 'phone' });
    expect(text).toMatch(/blocked for this site/i);
    expect(text).toMatch(/allow/i);
    // Nothing about networks: permission is a browser setting.
    expect(text).not.toMatch(/wi-fi/i);
  });

  it('tells a PHONE to allow Chrome itself, not just Location, and never blames Wi-Fi', () => {
    // The second report: Location was already switched on and the message still
    // said "Turn on Location (GPS) on your phone". On Android the site
    // permission and the Chrome APP's own permission are different switches, so
    // advice that only names the first one sends the person in a circle.
    const text = describeGeolocationError(geoError(2), { device: 'phone' });
    expect(text).toMatch(/allow chrome/i);
    expect(text).toMatch(/settings > apps > chrome/i);
    expect(text).not.toMatch(/wi-fi/i);
  });

  it('tells a LAPTOP about Wi-Fi, because that is how it locates itself', () => {
    const text = describeGeolocationError(geoError(2), { device: 'desktop' });
    expect(text).toMatch(/wi-fi/i);
    expect(text).toMatch(/laptop/i);
    expect(text).not.toMatch(/settings > apps > chrome/i);
  });

  it('detects the device when no hint is passed', () => {
    // jsdom reports a desktop user agent, so the default must be the desktop
    // wording - never a phone instruction to a laptop user.
    const text = describeGeolocationError(geoError(2));
    expect(text).toMatch(/laptop/i);
  });

  it('never blames the network alone', () => {
    for (const code of [1, 2, 3, undefined]) {
      for (const device of ['phone', 'desktop']) {
        const text = describeGeolocationError(geoError(code), { device });
        expect(text).not.toMatch(/^Location unavailable\. Please check your network/i);
        expect(text.length).toBeGreaterThan(20);
      }
    }
  });

  it('gives timeout its own advice', () => {
    expect(describeGeolocationError(geoError(3), { device: 'phone' })).toMatch(/took too long/i);
  });

  it('tells a laptop where its position actually comes from on timeout', () => {
    // The reported failure: a Windows laptop timed out and was told to "move
    // near a window or step outside". A laptop has no GPS receiver, so that
    // advice cannot work - the switch that is actually off is Windows Location
    // Services. Sending someone to a window instead of to that setting is how a
    // location bug gets reported twice.
    const text = describeGeolocationError(geoError(3), { device: 'desktop' });
    expect(text).toMatch(/windows location services/i);
    expect(text).not.toMatch(/move near a window|step outside/i);
  });

  it('keeps the window advice for a phone, where it is true', () => {
    const text = describeGeolocationError(geoError(3), { device: 'phone' });
    expect(text).toMatch(/window|outside/i);
    expect(text).not.toMatch(/windows location services/i);
  });

  it('has a fallback for an error with no code at all', () => {
    expect(describeGeolocationError(null, { device: 'phone' })).toMatch(/could not determine your location/i);
    expect(describeGeolocationError({}, { device: 'phone' })).toMatch(/could not determine your location/i);
  });

  it('reads a stringified code, because some browsers hand one over', () => {
    expect(describeGeolocationError({ code: '2' }, { device: 'phone' })).toMatch(/allow chrome/i);
  });
});

describe('isGeolocationError recognises the new wording', () => {
  it('matches by code', () => {
    expect(isGeolocationError(geoError(1))).toBe(true);
    expect(isGeolocationError(geoError(2))).toBe(true);
    expect(isGeolocationError(geoError(3))).toBe(true);
  });

  it('matches the messages it now produces', () => {
    for (const code of [1, 2, 3]) {
      const message = describeGeolocationError(geoError(code));
      expect(isGeolocationError(new Error(message))).toBe(true);
    }
  });

  it('does not swallow a database permission error', () => {
    expect(isGeolocationError({ code: '42501', message: 'permission denied for table attendance_logs' }))
      .toBe(false);
  });
});

describe('getCoordinatesWithFallback', () => {
  const originalGeolocation = navigator.geolocation;
  const originalPermissions = navigator.permissions;
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn(() => Promise.reject(new Error('network down')));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    Object.defineProperty(window.navigator, 'geolocation', {
      value: originalGeolocation,
      configurable: true,
      writable: true
    });
    Object.defineProperty(window.navigator, 'permissions', {
      value: originalPermissions,
      configurable: true,
      writable: true
    });
  });

  const stubPermission = (state) => {
    Object.defineProperty(window.navigator, 'permissions', {
      value: { query: () => Promise.resolve({ state }) },
      configurable: true,
      writable: true
    });
  };

  const stubGeolocation = (results) => {
    // Each call consumes the next result: { position } or { error }.
    const queue = [...results];
    const getCurrentPosition = jest.fn((success, failure) => {
      const next = queue.shift();
      if (next?.position) success(next.position);
      else failure(next?.error || geoError(2));
    });
    Object.defineProperty(window.navigator, 'geolocation', {
      value: { getCurrentPosition },
      configurable: true,
      writable: true
    });
    return getCurrentPosition;
  };

  it('retries coarse when the precise fix says POSITION_UNAVAILABLE', async () => {
    // The Android case: high-accuracy indoors returns code 2. The coarse retry
    // is exactly what used to be skipped, because only code 3 was retried.
    stubPermission('granted');
    const getCurrentPosition = stubGeolocation([
      { error: geoError(2) },
      { position: { coords: { latitude: 14.6, longitude: 121.0, accuracy: 40 } } }
    ]);

    const result = await getCoordinatesWithFallback();

    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(result.source).toBe('coarse');
    expect(result.latitude).toBeCloseTo(14.6);
    // No IP lookup: the coarse fix answered the question.
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does not retry a blocked permission', async () => {
    const getCurrentPosition = stubGeolocation([{ error: geoError(1) }]);

    await expect(getCoordinatesWithFallback()).rejects.toMatchObject({ code: 1 });

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fails with the real reason instead of an IP guess the fence would refuse', async () => {
    // Enforcement is ON in this build, so an IP fix is refused by the caller
    // anyway. Two dead IP lookups would only delay the error by ~20 s.
    stubGeolocation([{ error: geoError(2) }, { error: geoError(2) }]);

    await expect(getCoordinatesWithFallback()).rejects.toMatchObject({ code: 2 });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('keeps a synchronous throw instead of overwriting it', async () => {
    // The failure that hid itself: a browser refusing to make the call at all
    // used to reject with a bare TypeError, which the page then re-described as
    // "we could not determine your location" - the one generic sentence, for a
    // fault that had nothing to do with location settings. Its own words have
    // to survive.
    Object.defineProperty(window.navigator, 'geolocation', {
      value: {
        getCurrentPosition: () => {
          throw new TypeError('Illegal invocation');
        }
      },
      configurable: true,
      writable: true
    });

    const error = await getCoordinatesWithFallback().catch((thrown) => thrown);

    expect(error.message).toMatch(/illegal invocation/i);
    expect(error.syncThrow).toBe(true);
    expect(isGeolocationError(error)).toBe(false);
  });

  it('leaves a genuine timeout alone, because the provider was reachable', async () => {
    // A timeout means the request ran its full course. Re-wording that as a
    // permission or provider problem would send the person to the wrong setting.
    stubPermission('granted');
    stubGeolocation([{ error: geoError(3) }, { error: geoError(3) }]);

    const error = await getCoordinatesWithFallback().catch((thrown) => thrown);

    expect(error.code).toBe(3);
    expect(error.message).toMatch(/took too long|could not get a position in time/i);
  });

  it('falls back to watchPosition when both single-shot requests fail', async () => {
    // Reported as "walang GPS". A single `getCurrentPosition` closes its own
    // request at `timeout` and reports TIMEOUT even when a fix is a few seconds
    // away - ordinary on a phone indoors. Watching keeps the search open, so a
    // late fix is still used, and it goes through the same accuracy gate.
    stubPermission('granted');
    const watchPosition = jest.fn((success) => {
      success({ coords: { latitude: 14.6426, longitude: 121.0245, accuracy: 18 } });
      return 7;
    });
    const clearWatch = jest.fn();

    Object.defineProperty(window.navigator, 'geolocation', {
      value: {
        getCurrentPosition: jest.fn((success, failure) => failure(geoError(3))),
        watchPosition,
        clearWatch
      },
      configurable: true,
      writable: true
    });

    const fix = await getCoordinatesWithFallback();

    expect(watchPosition).toHaveBeenCalledTimes(1);
    expect(fix).toMatchObject({ latitude: 14.6426, source: 'gps' });
    // The watch must be released, or the GPS stays awake after the request.
    expect(clearWatch).toHaveBeenCalledWith(7);
  });

  it('does not invent a position when the browser has no watchPosition', async () => {
    // A stub, an old WebView, or any browser without the API must still report
    // the real reason rather than a manufactured "cannot report a position".
    stubPermission('granted');
    stubGeolocation([{ error: geoError(2) }, { error: geoError(2) }]);

    const error = await getCoordinatesWithFallback().catch((thrown) => thrown);

    expect(error.code).toBe(2);
    expect(error.message).toMatch(/could not get a position/i);
  });
});
describe('in-app browsers', () => {
  const originalUserAgent = navigator.userAgent;

  afterEach(() => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true
    });
  });

  const withUserAgent = (ua) => Object.defineProperty(window.navigator, 'userAgent', {
    value: ua,
    configurable: true
  });

  it('tells a Messenger user to open the page in Chrome', () => {
    // The case that looks like a broken phone: the Facebook/Messenger WebView
    // fails with POSITION_UNAVAILABLE and no prompt, so "turn on Location" is
    // advice for a setting that was never the problem.
    withUserAgent('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 [FBAN/FB4A;FBAV/400.0.0.1]');

    const text = describeGeolocationError({ code: 2 });

    expect(text).toMatch(/open in chrome/i);
    expect(text).not.toMatch(/settings > apps > chrome/i);
  });

  it('leaves ordinary Chrome on Android with the app-permission advice', () => {
    withUserAgent('Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');

    const text = describeGeolocationError({ code: 2 });

    expect(text).toMatch(/settings > apps > chrome/i);
    expect(text).not.toMatch(/open in chrome/i);
  });
});

describe('fetchIpCoordinates', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('accepts the ipwho.is shape', async () => {
    global.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true, latitude: 14.5, longitude: 121.1 })
    }));

    const fix = await fetchIpCoordinates(50);

    expect(fix).toMatchObject({ latitude: 14.5, longitude: 121.1, source: 'ip' });
  });

  it('rejects a provider that answers 200 with success:false', async () => {
    global.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: false, message: 'reserved range' })
    }));

    await expect(fetchIpCoordinates(50)).rejects.toMatchObject({ code: 2 });
  });

  it('falls through to the next provider', async () => {
    const calls = [];
    global.fetch = jest.fn((url) => {
      calls.push(url);
      if (calls.length === 1) return Promise.reject(new Error('rate limited'));
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ latitude: 1, longitude: 2 }) });
    });

    const fix = await fetchIpCoordinates(50);

    expect(fix).toMatchObject({ latitude: 1, longitude: 2 });
    expect(calls).toHaveLength(2);
  });
});
