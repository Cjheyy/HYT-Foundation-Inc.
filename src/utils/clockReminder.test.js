import {
  CLOCK_OUT_CUTOFF_MINUTES,
  formatMinutes,
  getClockOutReminder,
  getClockOutWindow,
  minutesSinceMidnight
} from './clockReminder';

/** A Date at a given local wall-clock time, so the tests do not depend on TZ. */
const at = (hours, minutes = 0) => {
  const date = new Date(2026, 9, 21, hours, minutes, 0, 0);
  return date;
};

describe('minutesSinceMidnight / formatMinutes', () => {
  it('counts minutes from midnight', () => {
    expect(minutesSinceMidnight(at(0, 0))).toBe(0);
    expect(minutesSinceMidnight(at(9, 10))).toBe(550);
    expect(minutesSinceMidnight(at(18, 30))).toBe(1110);
  });

  it('formats a 12-hour clock, including noon and midnight', () => {
    expect(formatMinutes(0)).toBe('12:00 AM');
    expect(formatMinutes(555)).toBe('9:15 AM');
    expect(formatMinutes(720)).toBe('12:00 PM');
    expect(formatMinutes(CLOCK_OUT_CUTOFF_MINUTES)).toBe('6:30 PM');
  });
});

describe('getClockOutWindow', () => {
  it('is open early in the day - a shift that ends at 2 PM can be closed at 2 PM', () => {
    expect(getClockOutWindow(at(14, 0)).isOpen).toBe(true);
  });

  it('is still open one minute before the cutoff', () => {
    const window = getClockOutWindow(at(18, 29));
    expect(window.isOpen).toBe(true);
    expect(window.minutesLeft).toBe(1);
  });

  it('is open exactly at the cutoff', () => {
    expect(getClockOutWindow(at(18, 30)).isOpen).toBe(true);
  });

  it('is closed one minute after the cutoff', () => {
    const window = getClockOutWindow(at(18, 31));
    expect(window.isOpen).toBe(false);
    expect(window.minutesLeft).toBe(-1);
  });

  it('is closed late at night', () => {
    expect(getClockOutWindow(at(23, 0)).isOpen).toBe(false);
  });
});

describe('getClockOutReminder', () => {
  it('stays quiet before the five-minute window', () => {
    expect(getClockOutReminder({ now: at(18, 20), isClockedIn: true }).isDue).toBe(false);
  });

  it('fires at five minutes before the cutoff', () => {
    const reminder = getClockOutReminder({ now: at(18, 25), isClockedIn: true });
    expect(reminder.isDue).toBe(true);
    expect(reminder.minutesLeft).toBe(5);
    expect(reminder.message).toContain('5 minutes');
    expect(reminder.message).toContain('6:30 PM');
  });

  it('fires again one minute before the cutoff with the right count', () => {
    const reminder = getClockOutReminder({ now: at(18, 29), isClockedIn: true });
    expect(reminder.isDue).toBe(true);
    expect(reminder.message).toContain('1 minute.');
  });

  it('never fires for someone who is not clocked in', () => {
    expect(getClockOutReminder({ now: at(18, 26), isClockedIn: false }).isDue).toBe(false);
  });

  it('never fires twice on the same day', () => {
    expect(getClockOutReminder({ now: at(18, 26), isClockedIn: true, alreadyReminded: true }).isDue).toBe(false);
  });

  it('stops at the cutoff itself - it is a warning, not a second deadline', () => {
    expect(getClockOutReminder({ now: at(18, 30), isClockedIn: true }).isDue).toBe(false);
  });

  it('uses a singular "minute" only when there is exactly one', () => {
    expect(getClockOutReminder({ now: at(18, 28), isClockedIn: true }).message).toContain('2 minutes');
  });
});
