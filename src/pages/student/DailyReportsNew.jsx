import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Skeleton } from '../../components/Skeleton';
import { showToast } from '../../utils/notifications';
import { formatDate } from '../../utils/helpers';
import { toDateValue, todayParts } from '../../utils/dateParts';
import {
  ENTRY_FIELDS,
  REPORT_SLOTS,
  SLOT_KEYS,
  dayHasSummary,
  daySlots,
  emptyEntry,
  entryIsFilled,
  groupReportsByDay,
  rowDay,
  rowUserId
} from '../../utils/dailyReportSlots';
import { getDailyReports, reportSlotsReady, submitReportSlot } from '../../services/supabaseService';
import './DailyReports.css';

/**
 * Student / trainee -> Daily Accomplishment Reports.
 *
 * Three updates a day, at 11:00, 15:00 and 17:00, and each one carries the same
 * three boxes: **Accomplished · In-Progress · Pending**.
 *
 * The windows are enforced by the UI, not by the database: the field for a slot
 * is offered only during that slot's hour, and a slot whose hour has passed
 * without a filing is shown as Missed. A trainee who wants to get around that
 * can; the same is true of the OJT/training/event application limits. Making it
 * a real gate would need a trigger on `daily_reports`, which is a separate
 * change.
 *
 * The **17:00 filing is what releases the day**: the administrator reads one
 * consolidated report for the day, and only once that filing exists. Nothing is
 * sent automatically and there is no scheduler — the trainee sends and the
 * administrator reads. A day whose 17:00 is missing shows up to the
 * administrator as "No 5 PM report" instead of quietly vanishing.
 */

const CLOCK_TICK_MS = 30000;

/** The blank draft for one slot. */
const blankDraft = () => ({ ...emptyEntry() });

export function DailyReportsNew() {
  const { state } = useApp();
  const { currentUser } = state;

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [slotsReady, setSlotsReady] = useState(true);
  const [savingSlot, setSavingSlot] = useState('');
  const [errors, setErrors] = useState({});
  const [drafts, setDrafts] = useState({});
  const mountedRef = useRef(true);

  // The clock is state, not a render-time `new Date()`, so a window opens while
  // the page is open instead of only on a reload.
  const [now, setNow] = useState(() => new Date());  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const todayIso = toDateValue(todayParts(now));

  const loadReports = useCallback(async () => {
    if (!currentUser?.id) {
      setReports([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [data, ready] = await Promise.all([
        getDailyReports(currentUser.id),
        reportSlotsReady()
      ]);
      if (!mountedRef.current) return;
      setReports(Array.isArray(data) ? data : []);
      setSlotsReady(ready);
    } catch (error) {
      if (mountedRef.current) showToast('Could not load your daily reports.', 'error');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    mountedRef.current = true;
    loadReports();
    return () => { mountedRef.current = false; };
  }, [loadReports]);

  // The row for today, if anything has been filed yet.
  const todayRow = useMemo(
    () => reports.find((report) => rowDay(report) === todayIso) || null,
    [reports, todayIso]
  );

  const todaySlots = useMemo(
    () => daySlots(todayRow || { reportDate: todayIso, userId: currentUser?.id }, now),
    [currentUser?.id, now, todayIso, todayRow]
  );

  const history = useMemo(
    () => groupReportsByDay(
      reports.filter((report) => rowUserId(report) === currentUser?.id && rowDay(report) < todayIso)
    ),
    [currentUser?.id, reports, todayIso]
  );

  const draftFor = (key) => drafts[key] || blankDraft();

  const updateDraft = (key, field, value) => {
    setDrafts((previous) => ({
      ...previous,
      [key]: { ...(previous[key] || blankDraft()), [field]: value }
    }));
    setErrors((previous) => ({ ...previous, [key]: '' }));
  };

  const handleSubmit = async (slot) => {
    const draft = draftFor(slot.key);
    if (!entryIsFilled(draft)) {
      setErrors((previous) => ({
        ...previous,
        [slot.key]: `Write at least one box for the ${slot.label} report.`
      }));
      return;
    }

    try {
      setSavingSlot(slot.key);
      await submitReportSlot({
        userId: currentUser?.id,
        reportDate: todayIso,
        slot: slot.key,
        entry: draft
      });
      setDrafts((previous) => ({ ...previous, [slot.key]: blankDraft() }));
      setErrors((previous) => ({ ...previous, [slot.key]: '' }));
      showToast(
        slot.key === '17:00'
          ? 'The 5:00 PM report is in — the admin can now see the whole day.'
          : `The ${slot.label} report is in.`,
        'success'
      );
      await loadReports();
    } catch (error) {
      console.error('Submit report slot error:', error);
      showToast(error.message || 'The report could not be sent.', 'error');
    } finally {
      setSavingSlot('');
    }
  };

  if (loading) {
    return (
      <div className="page-container daily-reports-page">
        <div className="page-header">
          <Skeleton width="40%" height={28} style={{ marginBottom: 8 }} />
          <Skeleton width="60%" height={14} />
        </div>
        <Card className="submit-report-card">
          <Skeleton width="35%" height={20} style={{ marginBottom: 16 }} />
          <Skeleton width="100%" height={72} style={{ marginBottom: 12 }} />
          <Skeleton width="40%" height={40} />
        </Card>
      </div>
    );
  }

  return (
    <div className="page-container daily-reports-page">
      <div className="page-header">
        <h1 className="page-title">Daily Accomplishment Reports</h1>
        <p className="page-subtitle">
          Three updates a day — 11:00 AM, 3:00 PM and 5:00 PM. Each one carries
          an Accomplished, an In-Progress and a Pending note.
        </p>
      </div>

      {!slotsReady && (
        <Card className="report-slot-warning">
          <strong>The database setup is incomplete.</strong> Run
          {' '}<code>ADD_REPORT_SLOTS.sql</code> in the Supabase SQL Editor before
          sending a three-slot report. The old one-report-per-day form is no
          longer used.
        </Card>
      )}

      <Card className="submit-report-card">
        <div className="card-header">
          <h2 className="card-title">Today — {formatDate(todayIso)}</h2>
          {dayHasSummary(todayRow || {}) && (
            <span className="report-day-complete">Day complete</span>
          )}
        </div>

        <div className="report-slot-list">
          {todaySlots.map((slot) => (
            <div key={slot.key} className={`report-slot is-${slot.status}`}>
              <div className="report-slot-head">
                <div className="report-slot-when">
                  <strong>{slot.label}</strong>
                  <span className="report-slot-window">{slot.window}</span>
                </div>
                <span className={`report-slot-status is-${slot.status}`}>
                  {slot.status === 'submitted' && 'Submitted'}
                  {slot.status === 'open' && 'Open now'}
                  {slot.status === 'missed' && 'Missed'}
                  {slot.status === 'upcoming' && 'Not yet open'}
                </span>
              </div>

              {slot.status === 'submitted' && (
                <div className="report-slot-readonly">
                  {ENTRY_FIELDS.map((field) => (
                    <div key={field.key} className="report-entry">
                      <span className="report-entry-label">{field.label}</span>
                      <p className="report-entry-text">
                        {slot.entry?.[field.key] || <span className="muted-cell">—</span>}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {slot.status === 'open' && (
                <div className="report-slot-form">
                  {ENTRY_FIELDS.map((field) => (
                    <div key={field.key} className="form-group">
                      <label className="form-label" htmlFor={`slot-${slot.key}-${field.key}`}>
                        {field.label}
                      </label>
                      <textarea
                        id={`slot-${slot.key}-${field.key}`}
                        className="form-textarea report-slot-input"
                        value={draftFor(slot.key)[field.key]}
                        onChange={(event) => updateDraft(slot.key, field.key, event.target.value)}
                        rows={2}
                        placeholder={
                          field.key === 'accomplished' ? 'What you finished in this window…'
                            : field.key === 'inProgress' ? 'What you are still working on…'
                              : 'What is still outstanding…'
                        }
                      />
                    </div>
                  ))}

                  {errors[slot.key] && (
                    <div className="form-error" role="alert">{errors[slot.key]}</div>
                  )}

                  <div className="report-slot-actions">
                    <Button
                      onClick={() => handleSubmit(slot)}
                      disabled={savingSlot === slot.key}
                    >
                      {savingSlot === slot.key ? 'Sending…' : `Send the ${slot.label} report`}
                    </Button>
                    <span className="form-help">
                      {slot.key === '17:00'
                        ? 'This is the final update — it is what sends the whole day to the admin.'
                        : 'This is only saved. The 5:00 PM report is what sends the whole day to the admin.'}
                    </span>
                  </div>
                </div>
              )}

              {slot.status === 'missed' && (
                <p className="report-slot-note">
                  The {slot.label} report was not submitted. It is still part of the
                  day the admin sees.
                </p>
              )}

              {slot.status === 'upcoming' && (
                <p className="report-slot-note">The form opens at {slot.window}.</p>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="reports-history-card">
        <div className="card-header">
          <h2 className="card-title">Previous days</h2>
        </div>

        {history.length > 0 ? (
          <div className="reports-list">
            {history.map((row) => {
              const slots = daySlots(row, now);
              const complete = dayHasSummary(row);
              return (
                <div key={`${rowUserId(row)}-${rowDay(row)}`} className="report-item">
                  <div className="report-header">
                    <div className="report-date">
                      <strong>{formatDate(rowDay(row))}</strong>
                    </div>
                    <span className={`report-day-flag ${complete ? 'is-complete' : 'is-partial'}`}>
                      {complete ? 'Complete' : 'No 5 PM report'}
                    </span>
                  </div>

                  <div className="report-day-grid">
                    {SLOT_KEYS.map((key) => {
                      const slot = slots.find((item) => item.key === key);
                      const entry = slot?.entry;
                      return (
                        <div key={key} className="report-day-cell">
                          <span className="report-day-cell-head">
                            {REPORT_SLOTS.find((item) => item.key === key)?.label}
                          </span>
                          {entry ? (
                            ENTRY_FIELDS.map((field) => (
                              <p key={field.key} className="report-day-line">
                                <span className="report-entry-label">{field.label}:</span>{' '}
                                {entry[field.key] || '—'}
                              </p>
                            ))
                          ) : (
                            <p className="report-day-line muted-cell">Nothing submitted</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <h3>No reports yet</h3>
            <p>The days you submit will appear here.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

export default DailyReportsNew;
