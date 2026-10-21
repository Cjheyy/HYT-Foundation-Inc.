import { computeExperienceSchedule, countAcceptedAbsenceDays } from './experience';

/**
 * Accepted absences and the projected end date.
 *
 * A placement is projected from the hours still to render. A day the trainee
 * was legitimately absent renders none of those hours, so it has to be added
 * back - otherwise the end date quietly assumes they will make up a day they
 * were excused from, and it drifts earlier with every illness.
 *
 * 2026-10-05 is a Monday; the fixtures below lean on that.
 */
const MONDAY = '2026-10-05';

const absence = (absenceDate, status = 'Accepted') => ({ id: absenceDate, absenceDate, status });

describe('countAcceptedAbsenceDays', () => {
  it('counts each accepted weekday once', () => {
    expect(countAcceptedAbsenceDays([
      absence('2026-10-05'),
      absence('2026-10-06'),
      absence('2026-10-07')
    ])).toBe(3);
  });

  it('ignores a request that has not been decided yet', () => {
    expect(countAcceptedAbsenceDays([absence('2026-10-05', 'Submitted')])).toBe(0);
  });

  it('ignores a rejected request - that day is a normal working day', () => {
    expect(countAcceptedAbsenceDays([absence('2026-10-05', 'Rejected')])).toBe(0);
  });

  it('counts the legacy "Noted" acknowledgement, which only ever meant yes', () => {
    expect(countAcceptedAbsenceDays([absence('2026-10-05', 'Noted')])).toBe(1);
  });

  it('never buys an extra working day for a Saturday or a Sunday', () => {
    expect(countAcceptedAbsenceDays([
      absence('2026-10-10'), // Saturday
      absence('2026-10-11')  // Sunday
    ])).toBe(0);
  });

  it('collapses the same date filed twice', () => {
    expect(countAcceptedAbsenceDays([
      absence('2026-10-05'),
      absence('2026-10-05')
    ])).toBe(1);
  });

  it('only counts absences inside the window it is given', () => {
    const rows = [
      absence('2026-09-28'), // before the placement
      absence('2026-10-05'),
      absence('2026-10-06'),
      absence('2026-10-30')  // after the projection
    ];

    expect(countAcceptedAbsenceDays(rows, { from: MONDAY, to: '2026-10-09' })).toBe(2);
  });

  it('survives an empty or malformed list', () => {
    expect(countAcceptedAbsenceDays()).toBe(0);
    expect(countAcceptedAbsenceDays([null, {}, { status: 'Accepted' }])).toBe(0);
  });
});

describe('computeExperienceSchedule with accepted absences', () => {
  const base = {
    startDate: MONDAY,
    requiredHours: 80,
    renderedHours: 0,
    hoursPerDay: 8,
    today: new Date(2026, 9, 5)
  };

  it('projects ten working days for eighty hours with no absences', () => {
    const schedule = computeExperienceSchedule(base);
    expect(schedule.workDaysRemaining).toBe(10);
    expect(schedule.absenceDays).toBe(0);
    // Mon 5 Oct + 10 working days = Mon 19 Oct.
    expect(schedule.endDate).toEqual(new Date(2026, 9, 19));
  });

  it('pushes the end date out by one working day per accepted absence', () => {
    const schedule = computeExperienceSchedule({ ...base, absenceDays: 2 });
    expect(schedule.absenceDays).toBe(2);
    // Two more working days: Wed 21 Oct.
    expect(schedule.endDate).toEqual(new Date(2026, 9, 21));
  });

  it('keeps the day count and the date telling the same story', () => {
    const schedule = computeExperienceSchedule({ ...base, absenceDays: 2 });
    // The number the page prints is the number the date was built from, so the
    // two can never contradict each other on screen.
    expect(schedule.workDaysRemaining).toBe(12);
    // The hours-derived figure stays separate and honest.
    expect(schedule.hoursWorkDaysRemaining).toBe(10);
  });

  it('is unchanged when there are no absences to add', () => {
    expect(computeExperienceSchedule({ ...base, absenceDays: 0 }))
      .toEqual(computeExperienceSchedule(base));
  });

  it('still reports a finished placement as finished, whatever the absences', () => {
    const schedule = computeExperienceSchedule({
      ...base,
      renderedHours: 80,
      absenceDays: 3
    });
    expect(schedule.isComplete).toBe(true);
    expect(schedule.absenceDays).toBe(3);
  });
});
