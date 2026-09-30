import { useEffect, useState } from 'react';
import { Icon } from './icons';
import { formatRelativeTime, formatTime } from '../utils/helpers';

// Re-render often enough that "submitted 4 minutes ago" stays honest without
// waking the page up on every second.
const TICK_MS = 30_000;

/**
 * Progress tracker for an attendance request that is waiting on an admin.
 *
 * The Attendance page used to print the literal string "Pending approval" in
 * the Time In slot, so a trainee could not tell whether the request had been
 * received, when, or what happens next.  This shows the three-step pipeline,
 * the submission time and how long they have been waiting.
 *
 * Props:
 *   submittedAt — ISO timestamp of the request (see the call site for which
 *                 column is authoritative for clock-in vs clock-out).
 *   stage       — 'CLOCK_IN' | 'CLOCK_OUT'.
 */
export function AttendanceStepper({ submittedAt, stage = 'CLOCK_IN' }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const isClockOut = stage === 'CLOCK_OUT';
  const submittedTime = formatTime(submittedAt);
  const elapsed = formatRelativeTime(submittedAt, now);

  const steps = [
    {
      key: 'submitted',
      status: 'done',
      marker: '✓',
      label: isClockOut ? 'Clock-out sent' : 'Clock-in sent',
      detail: submittedTime || 'submitted'
    },
    { key: 'review', status: 'current', marker: '2', label: 'Admin review', detail: 'in progress' },
    {
      key: 'approved',
      status: 'todo',
      marker: '3',
      label: isClockOut ? 'Hours credited' : 'Timer starts',
      detail: 'after approval'
    }
  ];

  return (
    <div className="attendance-stepper">
      <ol className="attendance-stepper-steps">
        {steps.map((step) => (
          <li className={`attendance-stepper-step ${step.status}`} key={step.key}>
            <span className="attendance-stepper-marker" aria-hidden="true">{step.marker}</span>
            <span className="attendance-stepper-text">
              <strong>{step.label}</strong>
              <span>{step.detail}</span>
            </span>
          </li>
        ))}
      </ol>
      {elapsed && (
        <p className="attendance-stepper-elapsed">
          <Icon name="clock" size={14} />
          <span>Submitted {elapsed}. No action needed from you.</span>
        </p>
      )}
    </div>
  );
}
