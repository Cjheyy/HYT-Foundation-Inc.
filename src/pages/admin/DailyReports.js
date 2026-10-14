import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';
import { showToast } from '../../utils/notifications';
import { approveDailyReport, getPendingReports } from '../../services/dailyReportService';
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
 * A trainee files three updates a day (11:00, 15:00, 17:00).  This screen reads
 * the day back as ONE consolidated report rather than three separate ones — the
 * point of the 17:00 filing is that the administrator gets the whole day at
 * once, not a trickle.
 *
 * A day whose 17:00 filing is missing is **still listed**, flagged
 * "No 5 PM report".  Nothing is sent automatically and there is no
 * scheduler, so if the marker were dropped the gap would be invisible — the
 * administrator would simply never learn that the day was incomplete.
 */
export function AdminDailyReports() {
  const { state, dispatch } = useApp();
  const { dailyReports, users, attendance, ojtRecords } = state;
  const [selectedReport, setSelectedReport] = useState(null);
  const [remarks, setRemarks] = useState('');

  const days = useMemo(() => groupReportsByDay(dailyReports), [dailyReports]);
  const pendingIds = useMemo(
    () => new Set(getPendingReports(dailyReports).map((report) => report.id)),
    [dailyReports]
  );

  const nameOf = (userId) => {
    const person = users.find((item) => item.id === userId);
    return person?.fullName || person?.full_name || person?.email || userId;
  };

  const handleApprove = () => {
    try {
      const reportAttendance = attendance.find((row) =>
        (row.studentId || row.userId) === rowUserId(selectedReport)
        && new Date(row.date).toDateString() === new Date(rowDay(selectedReport)).toDateString()
      );
      const ojtRecord = ojtRecords.find((record) => record.id === selectedReport.ojtRecordId);

      const { updatedReport, updatedOjtRecord } = approveDailyReport(
        selectedReport,
        reportAttendance,
        ojtRecord
      );

      dispatch({ type: 'UPDATE_DAILY_REPORT', payload: updatedReport });
      if (updatedOjtRecord) dispatch({ type: 'UPDATE_OJT_RECORD', payload: updatedOjtRecord });

      showToast(
        `Daily report approved. ${selectedReport.hoursRendered || 0} verified hours added.`,
        'success'
      );
      setSelectedReport(null);
      setRemarks('');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const incomplete = days.filter((row) => !dayHasSummary(row)).length;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Daily Reports</h1>
        <p className="page-subtitle">
          {days.length} day{days.length === 1 ? '' : 's'} filed
          {incomplete > 0 ? ` · ${incomplete} without a 5 PM report` : ''}
        </p>
      </div>

      {days.length === 0 ? (
        <Card>
          <p style={{ textAlign: 'center', color: 'var(--muted-text)' }}>
            No daily reports submitted yet.
          </p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {days.map((row) => {
            const userId = rowUserId(row);
            const day = rowDay(row);
            const slots = daySlots(row);
            const complete = dayHasSummary(row);
            const isPending = pendingIds.has(row.id);

            return (
              <Card key={`${userId}-${day}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '16px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>
                      {nameOf(userId)}
                    </h3>
                    <p style={{ fontSize: '14px', color: 'var(--muted-text)', marginBottom: '12px' }}>
                      {formatDate(day)}
                    </p>

                    <div className="admin-report-day-grid">
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
                                  {entry[field.key] || '—'}
                                </p>
                              ))
                            ) : (
                              <p className="admin-report-day-line muted-cell">Nothing submitted</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px', flexShrink: 0 }}>
                    {complete ? (
                      <Badge status={row.status}>{row.status || 'Submitted'}</Badge>
                    ) : (
                      <span className="report-day-flag is-partial">No 5 PM report</span>
                    )}
                    {isPending && (
                      <Button size="sm" onClick={() => setSelectedReport(row)}>Review</Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        title="Review Daily Report"
        size="lg"
      >
        {selectedReport && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ marginBottom: '12px' }}>
                <strong>Trainee:</strong> {nameOf(rowUserId(selectedReport))}
              </div>
              <div style={{ marginBottom: '12px' }}>
                <strong>Date:</strong> {formatDate(rowDay(selectedReport))}
              </div>

              {daySlots(selectedReport).map((slot) => (
                <div key={slot.key} style={{ marginBottom: '14px' }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                    {slot.label} <span className="muted-cell">({slot.window})</span>
                  </div>
                  {slot.entry ? (
                    ENTRY_FIELDS.map((field) => (
                      <div key={field.key} style={{ marginBottom: '4px', fontSize: '14px' }}>
                        <strong>{field.label}:</strong> {slot.entry[field.key] || '—'}
                      </div>
                    ))
                  ) : (
                    <div className="muted-cell" style={{ fontSize: '14px' }}>Nothing submitted</div>
                  )}
                </div>
              ))}
            </div>
            <Textarea
              label="Admin Remarks (Optional)"
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              rows={3}
            />
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <Button variant="outline" onClick={() => setSelectedReport(null)}>Cancel</Button>
              <Button onClick={handleApprove}>Approve Report</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default AdminDailyReports;
