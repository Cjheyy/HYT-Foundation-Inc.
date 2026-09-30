import { useEffect, useRef, useState } from 'react';
import { MAX_SHIFT_SECONDS, SHIFT_WARNING_SECONDS } from '../utils/geofence';
import './LiveTimeTracker.css';

const splitDuration = (totalSeconds) => {
  const total = Math.max(0, Math.min(MAX_SHIFT_SECONDS, Math.floor(Number(totalSeconds) || 0)));
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60
  };
};

const pad2 = (value) => String(value).padStart(2, '0');

export const formatTimerHMS = (totalSeconds) => {
  const parts = splitDuration(totalSeconds);
  return `${pad2(parts.hours)}:${pad2(parts.minutes)}:${pad2(parts.seconds)}`;
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
  const [capped, setCapped] = useState(false);
  const alarmPlayedRef = useRef(false);
  const audioRef = useRef(null);

  const playWarningAlarm = () => {
    try {
      if (!audioRef.current) {
        // Subtle two-tone warning using HTML5 Audio with a generated WAV.
        const sampleRate = 8000;
        const durationSec = 0.9;
        const total = Math.floor(sampleRate * durationSec);
        const buffer = new ArrayBuffer(44 + total * 2);
        const view = new DataView(buffer);
        const writeStr = (offset, str) => {
          for (let i = 0; i < str.length; i += 1) view.setUint8(offset + i, str.charCodeAt(i));
        };
        writeStr(0, 'RIFF');
        view.setUint32(4, 36 + total * 2, true);
        writeStr(8, 'WAVE');
        writeStr(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeStr(36, 'data');
        view.setUint32(40, total * 2, true);
        for (let i = 0; i < total; i += 1) {
          const t = i / sampleRate;
          const freq = t < 0.45 ? 880 : 660;
          const sample = Math.sin(2 * Math.PI * freq * t) * 0.4 * (1 - i / total);
          view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 32767, true);
        }
        const blob = new Blob([buffer], { type: 'audio/wav' });
        audioRef.current = new Audio(URL.createObjectURL(blob));
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => undefined);
    } catch (error) {
      // Audio must never break the timer.
    }
  };

  useEffect(() => {
    alarmPlayedRef.current = false;
    setCapped(false);
  }, [clockInTime]);

  useEffect(() => {
    if (showReset) {
      setElapsed({ hours: 0, minutes: 0, seconds: 0 });
      setCapped(false);
      alarmPlayedRef.current = false;
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
    const update = () => {
      const rawSeconds = Math.floor((Date.now() - start) / 1000);
      const elapsedSeconds = Math.min(MAX_SHIFT_SECONDS, Math.max(0, rawSeconds));
      setElapsed(splitDuration(elapsedSeconds));
      if (elapsedSeconds >= SHIFT_WARNING_SECONDS && !alarmPlayedRef.current) {
        alarmPlayedRef.current = true;
        playWarningAlarm();
      }
      setCapped(rawSeconds >= MAX_SHIFT_SECONDS);
    };
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [clockInTime, frozenDurationSeconds, frozenTime, isActive, isPaused, showReset]);

  useEffect(() => () => {
    if (audioRef.current) {
      try {
        const url = audioRef.current.src;
        audioRef.current.pause();
        if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
      } catch (error) {
        // Ignore cleanup errors.
      }
    }
  }, []);

  if (!clockInTime) return null;
  const pad = (value) => String(value).padStart(2, '0');

  const state = showReset
    ? 'reset'
    : isPaused
      ? 'paused'
      : capped
        ? 'capped'
        : isActive
          ? 'live'
          : 'idle';

  const { label, hint } = {
    reset: { label: 'Timer reset', hint: null },
    paused: {
      label: 'Awaiting admin approval',
      hint: 'Timer frozen at this value. An administrator will review your clock-out request.'
    },
    capped: {
      label: 'Shift complete - 8 hour cap',
      hint: 'Daily 8-hour limit reached. Extra time requires a separate OT request.'
    },
    live: { label: 'Timer running', hint: null },
    idle: { label: 'Timer stopped', hint: null }
  }[state];

  return (
    <div className={`live-time-tracker is-${state}`}>
      <div className="tracker-status">
        <span className="tracker-dot" aria-hidden="true" />
        <span className="tracker-status-label">{label}</span>
      </div>

      <div
        className="tracker-clock"
        role="timer"
        aria-label={`${pad(elapsed.hours)} hours, ${pad(elapsed.minutes)} minutes, ${pad(elapsed.seconds)} seconds`}
      >
        <div className="clock-unit">
          <span className="clock-value">{pad(elapsed.hours)}</span>
          <span className="clock-label">Hours</span>
        </div>
        <span className="clock-colon" aria-hidden="true">:</span>
        <div className="clock-unit">
          <span className="clock-value">{pad(elapsed.minutes)}</span>
          <span className="clock-label">Minutes</span>
        </div>
        <span className="clock-colon" aria-hidden="true">:</span>
        <div className="clock-unit">
          <span className="clock-value">{pad(elapsed.seconds)}</span>
          <span className="clock-label">Seconds</span>
        </div>
      </div>

      {hint && <p className="tracker-note">{hint}</p>}
    </div>
  );
}
