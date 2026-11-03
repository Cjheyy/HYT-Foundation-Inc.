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
  describeProviderBlock,
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

describe('describeProviderBlock', () => {
  it('names the app-level switch on a phone, not the system one', () => {
    // The third report, and the one that finally said the useful thing: "it
    // does not even ask for location". No prompt + a failure = the browser app
    // is not allowed to use Location by the OS, so the request dies before the
    // site can be asked. Telling this person to "turn on Location" is what made
    // them report the same bug three times.
    const text = describeProviderBlock({ device: 'phone' });
    expect(text).toMatch(/did not ask you for permission/i);
    expect(text).toMatch(/settings > apps > chrome/i);
    expect(text).toMatch(/different switch/i);
  });

  it('names the Geolocation Service on a laptop', () => {
    const text = describeProviderBlock({ device: 'desktop' });
    expect(text).toMatch(/geolocation service/i);
    expect(text).toMatch(/windows/i);
    expect(text).not.toMatch(/settings > apps > chrome/i);
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

  it('explains an app-level block when the site was never refused and no prompt appeared', async () => {
    // The phone report: Location on, and the browser never asked. A failure
    // with the site permission still 'prompt' means the request died before
    // the prompt could be shown - the browser app is blocked by the OS.
    stubPermission('prompt');
    stubGeolocation([{ error: geoError(2) }, { error: geoError(2) }]);

    await expect(getCoordinatesWithFallback()).rejects.toThrow(/did not ask you for permission/i);
  });

  it('leaves a genuine timeout alone, because the provider was reachable', async () => {
    // A timeout means the request ran its full course. Rewriting that into
    // "Chrome is blocked" would send the person to the wrong setting.
    stubPermission('granted');
    stubGeolocation([{ error: geoError(3) }, { error: geoError(3) }]);

    const error = await getCoordinatesWithFallback().catch((thrown) => thrown);

    expect(error.message).not.toMatch(/did not ask you for permission/i);
    expect(error.code).toBe(3);
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
