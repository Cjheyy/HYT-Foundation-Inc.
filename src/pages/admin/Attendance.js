import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
// Badge import removed - not used in this component
import { showToast } from '../../utils/notifications';
import { updateAttendanceStatus, getPendingVerifications } from '../../services/attendanceService';
import { formatDate, formatTime } from '../../utils/helpers';

export function AdminAttendance() {
  const { state, dispatch } = useApp();
  const { attendance, users } = state;

  const pendingAttendance = getPendingVerifications(attendance);

  const handleConfirm = (att) => {
    const updated = updateAttendanceStatus(att, 'Verified', 'Attendance verified');
    dispatch({ type: 'UPDATE_ATTENDANCE', payload: updated });
    showToast('Attendance verified successfully!', 'success');
  };

  const handleReject = (att) => {
    const updated = updateAttendanceStatus(att, 'Rejected', 'Attendance rejected');
    dispatch({ type: 'UPDATE_ATTENDANCE', payload: updated });
    showToast('Attendance rejected', 'error');
  };

  return (
    <div>
      <h1 className="page-title">Attendance Verification</h1>

      {pendingAttendance.length > 0 ? (
        <div style={{ display: 'grid', gap: '16px' }}>
          {pendingAttendance.map((att) => {
            const student = users.find(u => u.id === att.studentId);
            return (
              <Card key={att.id}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>{student?.fullName}</h3>
                  <div style={{ display: 'grid', gap: '6px', marginBottom: '12px', fontSize: '14px', color: 'var(--muted-text)' }}>
                    <div>📅 {formatDate(att.date)}</div>
                    <div>🕐 Time In: {formatTime(att.timeIn)}</div>
                    <div>📍 {att.workplace}</div>
                    <div>🗺️ Location: {att.locationValid ? '✓ Valid' : '⚠ Outside area'}</div>
                    <div>📆 Schedule: {att.scheduleValid ? '✓ Valid' : '⚠ Outside schedule'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <Button size="sm" variant="success" onClick={() => handleConfirm(att)}>
                      Confirm Attendance
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleReject(att)}>
                      Reject
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <p style={{ textAlign: 'center', color: 'var(--muted-text)' }}>No pending attendance verifications</p>
        </Card>
      )}
    </div>
  );
}
