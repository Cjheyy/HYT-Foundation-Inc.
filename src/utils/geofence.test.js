import {
  checkGeofence,
  describeGeofenceFailure,
  haversineDistanceMeters,
  nearestOffice,
  OFFICE_LOCATIONS,
  GEOFENCE_RADIUS_METERS,
  GEOFENCE_MAX_ACCURACY_METERS
} from './geofence';

/**
 * The fence itself.
 *
 * These tests pass `enforce = true` explicitly, because the shipped flag is
 * false and a bypassed fence always says yes. Testing through the flag would
 * have tested nothing.
 */

const OFFICE = OFFICE_LOCATIONS[0];

/** A point `metres` due north of the office. 1 degree of latitude ~= 111,320 m. */
const northOf = (metres) => ({
  lat: OFFICE.latitude + metres / 111320,
  lon: OFFICE.longitude
});

const atOffice = (metres = 0, accuracy = 5) => {
  const point = northOf(metres);
  return checkGeofence(point.lat, point.lon, GEOFENCE_RADIUS_METERS, accuracy, true);
};

describe('office centres', () => {
  // Pinned to the pins measured at each entrance. If these ever change, the
  // matching literals inside `request_clock_in` (see UPDATE_GEOFENCE_RADIUS_20M.sql)
  // have to change with them - a client and a server with different centres
  // judge the same student differently, which is the bug this replaced.
  it('HYT Building sits on its measured pin', () => {
    expect(OFFICE_LOCATIONS[0].latitude).toBeCloseTo(14.642625282062204, 9);
    expect(OFFICE_LOCATIONS[0].longitude).toBeCloseTo(121.02453106633574, 9);
  });

  it('Atlanta Centre sits on its measured pin', () => {
    expect(OFFICE_LOCATIONS[1].latitude).toBeCloseTo(14.604736146553744, 9);
    expect(OFFICE_LOCATIONS[1].longitude).toBeCloseTo(121.05314663304407, 9);
  });

  it('keeps the offices far enough apart that two 20 m fences cannot overlap', () => {
    const [hyt, atlanta] = OFFICE_LOCATIONS;
    const distance = haversineDistanceMeters(hyt.latitude, hyt.longitude, atlanta.latitude, atlanta.longitude);
    expect(distance).toBeGreaterThan(GEOFENCE_RADIUS_METERS * 100);
  });
});

describe('haversineDistanceMeters', () => {
  it('returns zero for the same point', () => {
    expect(haversineDistanceMeters(14.6433, 121.0125, 14.6433, 121.0125)).toBeCloseTo(0, 5);
  });

  it('matches a known short distance', () => {
    // ~111.32 m north of the same latitude.
    const distance = haversineDistanceMeters(OFFICE.latitude, OFFICE.longitude, OFFICE.latitude + 0.001, OFFICE.longitude);
    expect(distance).toBeGreaterThan(110);
    expect(distance).toBeLessThan(113);
  });

  it('measures the gap between the two offices in kilometres, not metres', () => {
    const [hyt, atlanta] = OFFICE_LOCATIONS;
    const distance = haversineDistanceMeters(hyt.latitude, hyt.longitude, atlanta.latitude, atlanta.longitude);
    expect(distance).toBeGreaterThan(5000);
  });
});

describe('nearestOffice', () => {
  it('picks the office the fix is closest to', () => {
    const [, atlanta] = OFFICE_LOCATIONS;
    const nearest = nearestOffice(atlanta.latitude, atlanta.longitude);
    expect(nearest.name).toBe(atlanta.name);
    expect(nearest.distance).toBeLessThan(1);
  });

  it('returns null for coordinates that are not numbers', () => {
    expect(nearestOffice('abc', 121)).toBeNull();
    expect(nearestOffice(undefined, undefined)).toBeNull();
  });
});

describe('checkGeofence - bypass', () => {
  it('allows everything and says so when enforcement is off', () => {
    const result = checkGeofence(0, 0);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('bypassed');
    expect(result.bypassed).toBe(true);
  });
});

describe('checkGeofence - enforced', () => {
  it('allows a precise fix standing on the office', () => {
    const result = atOffice(0, 5);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('inside');
    expect(result.location).toBe(OFFICE.name);
  });

  it('allows a fix just inside the radius', () => {
    const result = atOffice(GEOFENCE_RADIUS_METERS - 2, 5);
    expect(result.allowed).toBe(true);
  });

  it('refuses a fix just outside the radius', () => {
    const result = atOffice(GEOFENCE_RADIUS_METERS + 5, 5);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('outside');
  });

  it('reports the real distance so the message can carry it', () => {
    const result = atOffice(150, 5);
    expect(result.distance).toBeGreaterThan(140);
    expect(result.distance).toBeLessThan(160);
  });

  it('refuses a fix too vague to judge, even when the distance looks fine', () => {
    // Standing at the door, but the phone only knows where it is to within 45 m.
    const result = atOffice(0, 45);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('imprecise');
  });

  it('accepts a fix whose accuracy is exactly at the ceiling', () => {
    const result = atOffice(0, GEOFENCE_MAX_ACCURACY_METERS);
    expect(result.allowed).toBe(true);
  });

  it('judges the distance when no accuracy is supplied at all', () => {
    const point = northOf(0);
    const result = checkGeofence(point.lat, point.lon, GEOFENCE_RADIUS_METERS, null, true);
    expect(result.allowed).toBe(true);
    expect(result.accuracy).toBeNull();
  });

  it('refuses unusable coordinates', () => {
    const result = checkGeofence(NaN, NaN, GEOFENCE_RADIUS_METERS, 5, true);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('invalid');
  });

  it('uses the radius it is given, not the shipped one', () => {
    const point = northOf(40);
    expect(checkGeofence(point.lat, point.lon, 100, 5, true).allowed).toBe(true);
    expect(checkGeofence(point.lat, point.lon, 20, 5, true).allowed).toBe(false);
  });
});

describe('describeGeofenceFailure', () => {
  it('names the distance and the radius', () => {
    const message = describeGeofenceFailure(atOffice(150, 5), { action: 'clock in' });
    expect(message).toMatch(/15\d meters away/);
    expect(message).toContain(String(GEOFENCE_RADIUS_METERS));
  });

  it('does not claim a distance when the fix is merely vague', () => {
    const message = describeGeofenceFailure(atOffice(0, 45), { action: 'clock in' });
    expect(message).toMatch(/accurate to about 45 meters/i);
    expect(message).not.toMatch(/meters away/);
  });

  it('asks for location services when there are no coordinates', () => {
    const message = describeGeofenceFailure({ reason: 'invalid' });
    expect(message).toMatch(/location services/i);
  });

  it('uses the action it is given', () => {
    expect(describeGeofenceFailure(atOffice(150, 5), { action: 'clock out' })).toMatch(/to clock out/);
  });
});
