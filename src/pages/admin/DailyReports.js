import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';
import { showToast } from '../../utils/notifications';
import { approveDailyReport, getPendingReports } from '../../services/dailyReportService';
import { formatDate } from '../../utils/helpers';

export function AdminDailyReports() {
  const { state, dispatch } = useApp();
  const { dailyReports, users, attendance, ojtRecords } = state;
  const [selectedReport, setSelectedReport] = useState(null);
  const [remarks, setRemarks] = useState('');

  const pendingReports = getPendingReports(dailyReports);

  const handleApprove = () => {
    try {
      const reportAttendance = attendance.find(a => 
        a.studentId === selectedReport.studentId &&
        new Date(a.date).toDateString() === new Date(selectedReport.date).toDateString()
      );
      
      const ojtRecord = ojtRecords.find(o => o.id === selectedReport.ojtRecordId);

      const { updatedReport, updatedOjtRecord } = approveDailyReport(
        selectedReport,
        reportAttendance,
        ojtRecord
      );

      dispatch({ type: 'UPDATE_DAILY_REPORT', payload: updatedReport });
      dispatch({ type: 'UPDATE_OJT_RECORD', payload: updatedOjtRecord });

      showToast(`Daily report approved. ${selectedReport.hoursRendered} verified hours added.`, 'success');
      setSelectedReport(null);
      setRemarks('');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  return (
    <div>
      <h1 className="page-title">Daily Reports</h1>

      {pendingReports.length > 0 ? (
        <div style={{ display: 'grid', gap: '16px' }}>
          {pendingReports.map((report) => {
            const student = users.find(u => u.id === report.studentId);
            return (
              <Card key={report.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>{student?.fullName}</h3>
                    <p style={{ fontSize: '14px', color: 'var(--muted-text)', marginBottom: '8px' }}>
                      {formatDate(report.date)} - {report.hoursRendered} hours
                    </p>
                    <div style={{ fontSize: '14px', color: 'var(--muted-text)' }}>
                      <strong>Tasks:</strong> {report.tasksCompleted}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Badge status={report.status}>{report.status}</Badge>
                    <Button size="sm" onClick={() => setSelectedReport(report)}>Review</Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <p style={{ textAlign: 'center', color: 'var(--muted-text)' }}>No pending daily reports</p>
        </Card>
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
                <strong>Date:</strong> {formatDate(selectedReport.date)}
              </div>
              <div style={{ marginBottom: '12px' }}>
                <strong>Hours:</strong> {selectedReport.hoursRendered}
              </div>
              <div style={{ marginBottom: '12px' }}>
                <strong>Tasks:</strong> {selectedReport.tasksCompleted}
              </div>
              <div style={{ marginBottom: '12px' }}>
                <strong>Skills:</strong> {selectedReport.skillsLearned}
              </div>
              {selectedReport.problemsEncountered && (
                <div style={{ marginBottom: '12px' }}>
                  <strong>Problems:</strong> {selectedReport.problemsEncountered}
                </div>
              )}
            </div>
            <Textarea
              label="Admin Remarks (Optional)"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
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
