import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';
import { showToast } from '../../utils/notifications';
import { approveDailyReport, rejectDailyReport, normalizeStatus } from '../../services/supabaseService';
import { formatDate } from '../../utils/helpers';
import {
  ENTRY_FIELDS,
  REPORT_SLOTS,
  dayHasSummary,
  daySlots,
  groupReportsByDay,
  rowDay,
  rowUserId
} from '../../utils/dailyReportSlots';
// The `.report-day-flag` pill (complete / "No 5 PM report") is shared with
// the trainee screen and lives in that stylesheet, so it is imported here
// rather than defined a second time and left to drift.
import '../student/DailyReports.css';
import './DailyReports.css';

/**
 * Admin → Daily Reports.
 *
 * A trainee files three updates a day (11:00, 15:00, 17:00) and all three land
 * in ONE row. This screen reads that row back as a single consolidated day.
 *
 * There is no per-filing approval queue. Approving a half-finished day would
 * mean approving the same report three times, and the earlier approvals would
 * be for a document that has since changed - so:
 *
 *   - the whole day is what gets reviewed, never an individual slot;
 *   - **Approve is locked until the 17:00 filing exists** (`complete`), because
 *     only then is the day final;
 *   - each day is approved ONCE, and that one action covers all three slots.
 *
 * A day is still LISTED before it is complete - the administrator can watch it
 * take shape and see what has been filed so far. Those days are grouped into an
 * "Incomplete" section instead of being mixed in with the approvable ones, so
 * the approve queue stays unambiguous and the gap stays visible.
 */
export function AdminDailyReports() {
  const { state, dispatch } = useApp();
  const { dailyReports, users } = state;
  const [selectedReport, setSelectedReport] = useState(null);
  const [remarks, setRemarks] = useState('');

  const days = useMemo(() => groupReportsByDay(dailyReports), [dailyReports]);

  // Split rather than filter-and-forget: a day without its 5 PM filing is not
  // approvable, but it is still information the administrator needs.
  const ready = useMemo(() => days.filter((row) => dayHasSummary(row)), [days]);
  const incomplete = useMemo(() => days.filter((row) => !dayHasSummary(row)), [days]);

  const nameOf = (userId) => {
    const person = users.find((item) => item.id === userId);
    return person?.fullName || person?.full_name || person?.email || userId;
  };

  // Same normalisation the service uses, so "Approved" / "approved" / "APPROVED"
  // all read the same way here as they do everywhere else.
  const isApproved = (row) => normalizeStatus(row?.status) === 'APPROVED';

  const openReview = (row) => {
    setSelectedReport(row);
    setRemarks('');
  };

  const closeReview = () => {
    setSelectedReport(null);
    setRemarks('');
  };

  const applyStatus = (updated) => {
    if (updated) dispatch({ type: 'UPDATE_DAILY_REPORT', payload: updated });
  };

  const handleApprove = async () => {
    try {
      // The database is the source of truth here, not the local row: the RPC
      // also carries the mentor's note back to the trainee.
      const updated = await approveDailyReport(selectedReport.id, remarks.trim());
      applyStatus(updated);
      showToast('The day was approved.', 'success');
      closeReview();
    } catch (error) {
      showToast(error.message || 'The day could not be approved.', 'error');
    }
  };

  const handleReject = async () => {
    const note = remarks.trim();
    if (note.length < 10) {
      showToast('A reason is required when returning a report (at least 10 characters).', 'warning');
      return;
    }
    try {
      const updated = await rejectDailyReport(selectedReport.id, note);
      applyStatus(updated);
      showToast('The report was returned to the trainee.', 'success');
      closeReview();
    } catch (error) {
      showToast(error.message || 'The report could not be returned.', 'error');
    }
  };

  /**
   * One day, read back whole. Used by both the list card and the review modal,
   * so what the administrator approves cannot drift from what was on the card.
   */
  const renderDay = (row, { compact = false } = {}) => {
    const slots = daySlots(row);
    return (
      <div className={compact ? 'admin-report-day-grid is-compact' : 'admin-report-day-grid'}>
        {REPORT_SLOTS.map((slot) => {
          const filed = slots.find((item) => item.key === slot.key);
          const entry = filed?.entry;
          return (
            <div key={slot.key} className="admin-report-day-cell">
              <span className="admin-report-day-head">
                {slot.label}
                <span className={`admin-report-day-tag is-${filed?.status}`}>
                  {filed?.status === 'submitted' ? 'Submitted'
                    : filed?.status === 'missed' ? 'Missed'
                      : filed?.status === 'open' ? 'Open now' : 'Not yet open'}
                </span>
              </span>
              {entry ? (
                ENTRY_FIELDS.map((field) => (
                  <p key={field.key} className="admin-report-day-line">
                    <span className="admin-report-field">{field.label}:</span>{' '}
                    {entry[field.key] || '-'}
                  </p>
                ))
              ) : (
                <p className="admin-report-day-line muted-cell">Nothing submitted</p>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderDayCard = (row) => {
    const userId = rowUserId(row);
    const day = rowDay(row);
    const complete = dayHasSummary(row);
    const approved = isApproved(row);

    return (
      <Card key={`${userId}-${day}`} className="admin-report-card">
        <div className="admin-report-card-head">
          <div className="admin-report-card-who">
            <h3 className="admin-report-card-name">{nameOf(userId)}</h3>
            <p className="admin-report-card-date">{formatDate(day)}</p>
          </div>

          <div className="admin-report-card-actions">
            {complete ? (
              approved
                ? <span className="report-day-flag is-complete">Approved</span>
                : <span className="report-day-flag is-complete">Ready to approve</span>
            ) : (
              <span className="report-day-flag is-partial">No 5 PM report</span>
            )}

            {complete && !approved && (
              <Button size="sm" onClick={() => openReview(row)}>Review</Button>
            )}
            {complete && approved && (
              <Button size="sm" variant="outline" onClick={() => openReview(row)}>View</Button>
            )}
          </div>
        </div>

        {renderDay(row)}
      </Card>
    );
  };

  const approveDisabled = !dayHasSummary(selectedReport || {});

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Daily Reports</h1>
        <p className="page-subtitle">
          {days.length} day{days.length === 1 ? '' : 's'} filed
          {ready.length > 0 ? ` · ${ready.length} ready` : ''}
          {incomplete.length > 0 ? ` · ${incomplete.length} incomplete` : ''}
        </p>
      </div>

      {days.length === 0 ? (
        <Card>
          <p className="empty-state-text">No daily reports submitted yet.</p>
        </Card>
      ) : (
        <>
          {ready.length > 0 && (
            <section className="admin-report-section">
              <div className="admin-report-section-head">
                <h2 className="admin-report-section-title">Ready to approve</h2>
                <span className="admin-report-section-count">{ready.length}</span>
              </div>
              <p className="admin-report-section-note">
                The 5 PM report is in, so the whole day is final. One approval
                covers all three updates.
              </p>
              <div className="admin-report-section-list">
                {ready.map(renderDayCard)}
              </div>
            </section>
          )}

          {incomplete.length > 0 && (
            <section className="admin-report-section">
              <div className="admin-report-section-head">
                <h2 className="admin-report-section-title">Incomplete - no 5 PM report</h2>
                <span className="admin-report-section-count">{incomplete.length}</span>
              </div>
              <p className="admin-report-section-note">
                The trainee filed part of the day but not the 5 PM update, so the
                day is not final and cannot be approved yet.
              </p>
              <div className="admin-report-section-list">
                {incomplete.map(renderDayCard)}
              </div>
            </section>
          )}
        </>
      )}

      <Modal
        isOpen={!!selectedReport}
        onClose={closeReview}
        title="Review the day"
        size="lg"
      >
        {selectedReport && (
          <div>
            <div className="admin-review-meta">
              <div><strong>Trainee:</strong> {nameOf(rowUserId(selectedReport))}</div>
              <div><strong>Date:</strong> {formatDate(rowDay(selectedReport))}</div>
            </div>

            {/* The whole day, not one slot - this is what "one approval" is
                approving, so it is shown exactly as the list shows it. */}
            {renderDay(selectedReport)}

            {isApproved(selectedReport) ? (
              <p className="admin-review-note">
                This day has already been approved.
              </p>
            ) : (
              <>
                <Textarea
                  label="Mentor's note (optional)"
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  rows={3}
                  placeholder="Optional feedback for the trainee…"
                />

                {!dayHasSummary(selectedReport) && (
                  <p className="admin-review-note is-warning">
                    The 5 PM report is missing, so this day cannot be approved yet.
                  </p>
                )}

                <div className="admin-review-actions">
                  <Button variant="outline" onClick={closeReview}>Cancel</Button>
                  <Button
                    variant="danger"
                    onClick={handleReject}
                    disabled={approveDisabled}
                  >
                    Return for revision
                  </Button>
                  <Button onClick={handleApprove} disabled={approveDisabled}>
                    Approve the day
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default AdminDailyReports;
