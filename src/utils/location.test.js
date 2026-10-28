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

  it('tells a PHONE to turn on GPS, and does not mention Wi-Fi', () => {
    // This is the exact case from the report: Wi-Fi connected, Location off.
    const text = describeGeolocationError(geoError(2), { device: 'phone' });
    expect(text).toMatch(/turn on location \(gps\)/i);
    expect(text).not.toMatch(/wi-fi/i);
  });

  it('tells a LAPTOP about Wi-Fi, because that is how it locates itself', () => {
    const text = describeGeolocationError(geoError(2), { device: 'desktop' });
    expect(text).toMatch(/wi-fi/i);
    expect(text).toMatch(/laptop/i);
    expect(text).not.toMatch(/turn on location \(gps\) on your phone/i);
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

  it('has a fallback for an error with no code at all', () => {
    expect(describeGeolocationError(null, { device: 'phone' })).toMatch(/could not determine your location/i);
    expect(describeGeolocationError({}, { device: 'phone' })).toMatch(/could not determine your location/i);
  });

  it('reads a stringified code, because some browsers hand one over', () => {
    expect(describeGeolocationError({ code: '2' }, { device: 'phone' })).toMatch(/turn on location \(gps\)/i);
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
  });

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
