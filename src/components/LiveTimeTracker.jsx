import { useEffect, useState } from 'react';
import './LiveTimeTracker.css';

const splitDuration = (totalSeconds) => {
  const total = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60
  };
};

const splitDates = (startValue, endValue) => {
  const start = new Date(startValue).getTime();
  const end = new Date(endValue).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return splitDuration((end - start) / 1000);
};

/**
 * Timer display for the attendance state machine:
 * - CLOCKED_IN: live counting
 * - PENDING_CLOCK_OUT: frozen at the server-calculated duration
 * - APPROVED/REJECTED/VOID: reset
 */
export function LiveTimeTracker({
  clockInTime,
  isActive = false,
  isPaused = false,
  frozenTime = null,
  frozenDurationSeconds = null,
  showReset = false
}) {
  const [elapsed, setElapsed] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (showReset) {
      setElapsed({ hours: 0, minutes: 0, seconds: 0 });
      return undefined;
    }

    if (isPaused) {
      const frozen = frozenDurationSeconds !== null && frozenDurationSeconds !== undefined
        ? splitDuration(frozenDurationSeconds)
        : (clockInTime && frozenTime ? splitDates(clockInTime, frozenTime) : null);
      if (frozen) setElapsed(frozen);
      return undefined;
    }

    if (!isActive || !clockInTime) return undefined;
    const start = new Date(clockInTime).getTime();
    if (!Number.isFinite(start)) return undefined;
    const update = () => setElapsed(splitDuration((Date.now() - start) / 1000));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [clockInTime, frozenDurationSeconds, frozenTime, isActive, isPaused, showReset]);

  if (!clockInTime) return null;
  const pad = (value) => String(value).padStart(2, '0');
  const statusLabel = showReset
    ? 'Timer Reset'
    : isPaused
      ? 'Paused - Awaiting Admin Approval'
      : isActive
        ? 'Time Elapsed (Live)'
        : 'Timer Stopped';
  const statusColor = showReset ? '#6B7280' : isPaused ? '#F59E0B' : isActive ? '#10B981' : '#6B7280';

  return (
    <div className="live-time-tracker">
      <div className="tracker-header">
        {isActive && !isPaused && !showReset && <div className="pulse-indicator" />}
        <span className="tracker-label" style={{ color: statusColor }}>{statusLabel}</span>
      </div>
      <div
        className="tracker-display"
        style={{
          opacity: showReset ? '0.5' : isPaused ? '0.9' : '1',
          border: isPaused ? '2px solid #F59E0B' : undefined,
          background: isPaused ? 'rgba(245, 158, 11, 0.05)' : undefined
        }}
      >
        <div className="time-segment"><span className="time-value">{pad(elapsed.hours)}</span><span className="time-label">Hours</span></div>
        <span className="time-separator">:</span>
        <div className="time-segment"><span className="time-value">{pad(elapsed.minutes)}</span><span className="time-label">Minutes</span></div>
        <span className="time-separator">:</span>
        <div className="time-segment"><span className="time-value">{pad(elapsed.seconds)}</span><span className="time-label">Seconds</span></div>
      </div>
      {isPaused && <div className="tracker-frozen-note">Timer frozen at this value. The admin will review your clock-out request.</div>}
    </div>
  );
}
