import {
  STAMP_BRAND,
  STAMP_MAX_DETAIL_LINES,
  buildStampLines,
  formatMeters,
  formatStampDate,
  formatStampTime,
  manilaClock,
  shortOfficeName
} from './stampLines';

/**
 * The stamp is the only part of the photo flow that can be tested in jsdom -
 * `drawStamp` needs a real canvas, so everything that decides WHAT is written
 * has to be provable here instead.
 */

describe('manilaClock', () => {
  it('reads the time in Manila, not the device timezone', () => {
    // 00:02 UTC on 27 Oct 2026 is 08:02 on the same day in Manila (UTC+8).
    expect(manilaClock('2026-10-27T00:02:00Z')).toMatchObject({
      year: 2026,
      month: 10,
      day: 27,
      hour: 8,
      minute: '02',
      period: 'AM'
    });
  });

  it('rolls the date over when Manila is already the next day', () => {
    // 17:30 UTC on 26 Oct is 01:30 on 27 Oct in Manila.
    expect(manilaClock('2026-10-26T17:30:00Z')).toMatchObject({ day: 27, hour: 1, period: 'AM' });
  });

  it('uses noon and midnight correctly', () => {
    expect(manilaClock('2026-10-27T04:00:00Z')).toMatchObject({ hour: 12, period: 'PM' });
    expect(manilaClock('2026-10-27T16:00:00Z')).toMatchObject({ hour: 12, period: 'AM' });
  });

  it('returns null instead of throwing for junk input', () => {
    expect(manilaClock(null)).toBeNull();
    expect(manilaClock('')).toBeNull();
    expect(manilaClock('not a date')).toBeNull();
    expect(manilaClock(new Date('nope'))).toBeNull();
  });
});

describe('formatStampDate and formatStampTime', () => {
  it('formats a real instant', () => {
    expect(formatStampDate('2026-10-27T00:02:00Z')).toBe('Oct 27, 2026');
    expect(formatStampTime('2026-10-27T00:02:00Z')).toBe('8:02 AM');
  });

  it('prints an empty string rather than "Invalid Date"', () => {
    expect(formatStampDate(null)).toBe('');
    expect(formatStampTime('garbage')).toBe('');
  });
});

describe('formatMeters', () => {
  it('rounds metres below a kilometre', () => {
    expect(formatMeters(0)).toBe('0 m');
    expect(formatMeters(12.4)).toBe('12 m');
    expect(formatMeters(999)).toBe('999 m');
  });

  it('switches to kilometres at 1000 m', () => {
    expect(formatMeters(1000)).toBe('1.0 km');
    expect(formatMeters(6444)).toBe('6.4 km');
  });

  it('refuses to print a number it does not have', () => {
    expect(formatMeters(null)).toBeNull();
    expect(formatMeters(undefined)).toBeNull();
    expect(formatMeters('')).toBeNull();
    expect(formatMeters('abc')).toBeNull();
    expect(formatMeters(-5)).toBeNull();
  });
});

describe('shortOfficeName', () => {
  it('keeps the site name and drops the address', () => {
    expect(shortOfficeName('HYT Foundation Building, Natividad, QC')).toBe('HYT Foundation Building');
    expect(shortOfficeName('Atlanta Centre, San Juan')).toBe('Atlanta Centre');
  });

  it('returns null for nothing', () => {
    expect(shortOfficeName(null)).toBeNull();
    expect(shortOfficeName('   ')).toBeNull();
  });
});

describe('buildStampLines', () => {
  const base = {
    at: '2026-10-27T00:02:00Z',
    locationName: 'HYT Foundation Building, Natividad, QC',
    latitude: 14.642625282062204,
    longitude: 121.02453106633574,
    distanceMeters: 12,
    accuracyMeters: 8,
    userName: 'Jhonas Elsisura',
    roleLabel: 'OJT / Intern'
  };

  it('builds a complete clock-in stamp', () => {
    const stamp = buildStampLines({ ...base, action: 'clockIn' });

    expect(stamp.brand).toBe(STAMP_BRAND);
    expect(stamp.action).toBe('CLOCK IN');
    expect(stamp.date).toBe('Oct 27, 2026');
    expect(stamp.time).toBe('8:02 AM');
    expect(stamp.timestamp).toBe('Oct 27, 2026 · 8:02 AM');
    expect(stamp.lines).toEqual([
      'HYT Foundation Building · 12 m',
      '14.64263, 121.02453 · ±8 m',
      'Jhonas Elsisura · OJT / Intern'
    ]);
  });

  it('says CLOCK OUT for anything that mentions out', () => {
    expect(buildStampLines({ ...base, action: 'clockOut' }).action).toBe('CLOCK OUT');
    expect(buildStampLines({ ...base, action: 'CLOCK-OUT' }).action).toBe('CLOCK OUT');
  });

  it('degrades line by line when facts are missing', () => {
    const stamp = buildStampLines({ action: 'clockIn', at: base.at });
    expect(stamp.lines).toEqual([]);
    expect(stamp.timestamp).toBe('Oct 27, 2026 · 8:02 AM');
  });

  it('still prints the accuracy when there are no coordinates', () => {
    const stamp = buildStampLines({ action: 'clockIn', accuracyMeters: 9 });
    expect(stamp.lines).toEqual(['±9 m']);
  });

  it('adds the trainee note, trimmed and length-capped', () => {
    const long = `  ${'x'.repeat(120)}  `;
    const stamp = buildStampLines({ ...base, action: 'clockIn', note: long });
    const noteLine = stamp.lines[stamp.lines.length - 1];
    expect(noteLine.length).toBe(60);
    expect(noteLine.trim()).toBe(noteLine);
  });

  it('ignores a blank note', () => {
    const stamp = buildStampLines({ ...base, action: 'clockIn', note: '   ' });
    expect(stamp.lines).toHaveLength(3);
  });

  it('never exceeds the line budget', () => {
    const stamp = buildStampLines({ ...base, action: 'clockIn', note: 'Site visit' });
    expect(stamp.lines.length).toBeLessThanOrEqual(STAMP_MAX_DETAIL_LINES);
  });

  it('does not print NaN for an unusable timestamp', () => {
    const stamp = buildStampLines({ ...base, action: 'clockIn', at: 'nope' });
    expect(stamp.date).toBe('');
    expect(stamp.time).toBe('');
    expect(stamp.timestamp).toBe('');
  });
});
