/**
 * The clock-out deadline, and the reminder that goes with it.
 *
 * The rule is one sentence: **a shift can be closed at any hour, but not after
 * 6:30 PM.**  A trainee who finishes at 2 PM closes at 2 PM; a trainee who
 * works until 6:20 PM still makes it.  There is no "the window opens at 6 PM"
 * any more - that made an early finish impossible and is not what a DTR means.
 *
 * The same cutoff is enforced again inside `request_clock_out`
 * (db/patches/PATCH_CLOCKOUT_CUTOFF.sql).  This file is the friendly half: it can tell the
 * trainee *before* they tap the button, and it can warn them five minutes
 * before the door shuts.  The database is the authority - if the two ever
 * disagree, the database wins and the request is refused.
 */

/** 6:30 PM, in minutes from midnight. */
export const CLOCK_OUT_CUTOFF_MINUTES = 18 * 60 + 30;

/** How long before the cutoff the reminder fires. */
export const CLOCK_OUT_REMINDER_LEAD_MINUTES = 5;

/** Minutes since midnight, in the browser's own time zone. */
export const minutesSinceMidnight = (date = new Date()) => {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return 0;
  return value.getHours() * 60 + value.getMinutes();
};

/** `1075 -> "5:55 PM"`; used in the reminder copy. */
export const formatMinutes = (minutes) => {
  const total = Math.max(0, Math.floor(Number(minutes) || 0));
  const hours24 = Math.floor(total / 60) % 24;
  const mins = total % 60;
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(mins).padStart(2, '0')} ${suffix}`;
};

/**
 * Can a clock-out be submitted right now?
 * Returns `{ isOpen, minutesLeft, cutoffLabel }`.
 */
export const getClockOutWindow = (now = new Date()) => {
  const minutes = minutesSinceMidnight(now);
  return {
    minutes,
    isOpen: minutes <= CLOCK_OUT_CUTOFF_MINUTES,
    minutesLeft: CLOCK_OUT_CUTOFF_MINUTES - minutes,
    cutoffLabel: formatMinutes(CLOCK_OUT_CUTOFF_MINUTES)
  };
};

/**
 * Should the "5 minutes left" reminder fire?
 *
 * True only when a shift is actually open AND the clock is inside the last
 * `leadMinutes` before the cutoff.  A trainee who is not clocked in has nothing
 * to close, so they are never nagged.
 *
 * `alreadyReminded` is the caller's own once-per-day flag - it lives outside
 * this function so the pure part stays pure and testable.
 */
export const getClockOutReminder = ({
  now = new Date(),
  isClockedIn = false,
  alreadyReminded = false,
  leadMinutes = CLOCK_OUT_REMINDER_LEAD_MINUTES,
  cutoffMinutes = CLOCK_OUT_CUTOFF_MINUTES
} = {}) => {
  const minutes = minutesSinceMidnight(now);
  const minutesLeft = cutoffMinutes - minutes;
  const windowStart = cutoffMinutes - Math.max(0, leadMinutes);

  const isDue =
    isClockedIn &&
    !alreadyReminded &&
    minutes >= windowStart &&
    minutes < cutoffMinutes;

  return {
    isDue,
    minutesLeft: Math.max(0, minutesLeft),
    cutoffLabel: formatMinutes(cutoffMinutes),
    message: isDue
      ? `Clock-out closes in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}. Submit your clock-out before ${formatMinutes(cutoffMinutes)}.`
      : ''
  };
};

/**
 * Raise a desktop notification when the browser allows it.
 *
 * Deliberately silent on failure: the in-app toast is the reminder that always
 * works, and a permissions prompt that the trainee dismisses must not turn into
 * a console error on every render.
 */
export const showDesktopNotification = (title, body) => {
  try {
    if (typeof window === 'undefined' || typeof window.Notification === 'undefined') return false;
    if (window.Notification.permission !== 'granted') return false;
    // eslint-disable-next-line no-new
    new window.Notification(title, { body });
    return true;
  } catch (error) {
    return false;
  }
};

/** Ask once, and only if the browser has not already been asked. */
export const requestDesktopNotificationPermission = () => {
  try {
    if (typeof window === 'undefined' || typeof window.Notification === 'undefined') return;
    if (window.Notification.permission !== 'default') return;
    window.Notification.requestPermission().catch(() => undefined);
  } catch (error) {
    /* not supported - the toast still fires */
  }
};
