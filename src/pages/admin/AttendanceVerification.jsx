import { useState, useEffect } from 'react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { 
  getAttendanceLogs, 
  approveAttendance, 
  rejectAttendance 
} from '../../services/supabaseService';
import { formatDate, formatTime } from '../../utils/helpers';
import { toast } from 'react-toastify';
import './Admin.css';

export function AttendanceVerification() {
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  const [selectedLog, setSelectedLog] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalAction, setModalAction] = useState(null);
  const [adminNote, setAdminNote] = useState('');
  const [noteError, setNoteError] = useState('');

  useEffect(() => {
    loadAttendanceLogs();
  }, []);

  const loadAttendanceLogs = async () => {
    try {
      setLoading(true);
      // Get all pending attendance logs (you might want to filter by status='Pending' in the service)
      const logs = await getAttendanceLogs();
      setAttendanceLogs(logs || []);
    } catch (error) {
      console.error('Error loading attendance logs:', error);
      toast.error('Failed to load attendance logs');
    } finally {
      setLoading(false);
    }
  };

  const openActionModal = (log, action) => {
    setSelectedLog(log);
    setModalAction(action);
    setAdminNote('');
    setNoteError('');
    setShowModal(true);
  };

  const handleApprove = async () => {
    if (!selectedLog) return;

    try {
      setActionLoading(true);
      await approveAttendance(selectedLog.id, adminNote.trim() || null);
      toast.success('✅ Attendance approved successfully!');
      setShowModal(false);
      await loadAttendanceLogs();
    } catch (error) {
      console.error('Approve error:', error);
      toast.error(error.message || 'Failed to approve attendance');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedLog) return;

    // Rejection requires a note
    if (!adminNote || adminNote.trim().length < 10) {
      setNoteError('Rejection reason is required (at least 10 characters)');
      return;
    }

    try {
      setActionLoading(true);
      await rejectAttendance(selectedLog.id, adminNote.trim());
      toast.success('Attendance rejected');
      setShowModal(false);
      await loadAttendanceLogs();
    } catch (error) {
      console.error('Reject error:', error);
      toast.error(error.message || 'Failed to reject attendance');
    } finally {
      setActionLoading(false);
    }
  };

  const executeAction = () => {
    if (modalAction === 'approve') {
      handleApprove();
    } else if (modalAction === 'reject') {
      handleReject();
    }
  };

  const pendingLogs = attendanceLogs.filter(log => log.status === 'Pending');

  if (loading) {
    return (
      <div className="admin-page">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1 className="page-title">Attendance Verification</h1>
        <p className="page-subtitle">Review and approve daily attendance logs</p>
      </div>

      <Card>
        <div className="card-header">
          <h2 className="card-title">Pending Attendance Logs</h2>
          <Badge color="yellow">{pendingLogs.length} Pending</Badge>
        </div>

        {pendingLogs.length > 0 ? (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Date</th>
                  <th>Time In</th>
                  <th>Time Out</th>
                  <th>Hours</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingLogs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <div className="student-info">
                        <div className="student-name">{log.user?.fullName || 'Unknown'}</div>
                        <div className="student-email">{log.user?.email}</div>
                      </div>
                    </td>
                    <td>{formatDate(log.date)}</td>
                    <td>{log.timeIn ? formatTime(log.timeIn) : '--:--'}</td>
                    <td>{log.timeOut ? formatTime(log.timeOut) : '--:--'}</td>
                    <td>
                      <span className="hours-badge">
                        {log.renderedHours?.toFixed(2) || '0.00'} hrs
                      </span>
                    </td>
                    <td><Badge status={log.status}>{log.status}</Badge></td>
                    <td>
                      <div className="action-buttons">
                        <Button 
                          size="sm" 
                          variant="success"
                          onClick={() => openActionModal(log, 'approve')}
                        >
                          ✓ Approve
                        </Button>
                        <Button 
                          size="sm" 
                          variant="danger"
                          onClick={() => openActionModal(log, 'reject')}
                        >
                          ✗ Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">✅</div>
            <h3>All Caught Up!</h3>
            <p>No pending attendance logs to review</p>
          </div>
        )}
      </Card>

      {/* Recent Processed Logs */}
      <Card style={{ marginTop: '24px' }}>
        <div className="card-header">
          <h2 className="card-title">Recently Processed</h2>
        </div>

        {attendanceLogs.filter(log => log.status !== 'Pending').length > 0 ? (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Date</th>
                  <th>Hours</th>
                  <th>Status</th>
                  <th>Admin Note</th>
                </tr>
              </thead>
              <tbody>
                {attendanceLogs
                  .filter(log => log.status !== 'Pending')
                  .slice(0, 10)
                  .map((log) => (
                    <tr key={log.id}>
                      <td>{log.user?.fullName || 'Unknown'}</td>
                      <td>{formatDate(log.date)}</td>
                      <td>{log.renderedHours?.toFixed(2) || '0.00'} hrs</td>
                      <td><Badge status={log.status}>{log.status}</Badge></td>
                      <td className="admin-note-cell">{log.adminNote || '--'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state-text">No processed logs yet</p>
        )}
      </Card>

      {/* Action Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={modalAction === 'approve' ? 'Approve Attendance' : 'Reject Attendance'}
      >
        {selectedLog && (
          <div>
            <div className="modal-info">
              <p><strong>Student:</strong> {selectedLog.user?.fullName}</p>
              <p><strong>Date:</strong> {formatDate(selectedLog.date)}</p>
              <p><strong>Hours:</strong> {selectedLog.renderedHours?.toFixed(2)} hrs</p>
            </div>

            <div className="form-group" style={{ marginTop: '20px' }}>
              <label className="form-label">
                Admin Note {modalAction === 'reject' && <span style={{color: 'red'}}>*</span>}
              </label>
              <textarea
                className={`form-textarea ${noteError ? 'error' : ''}`}
                value={adminNote}
                onChange={(e) => {
                  setAdminNote(e.target.value);
                  setNoteError('');
                }}
                placeholder={
                  modalAction === 'approve' 
                    ? 'Optional note for approval...' 
                    : 'Required: Explain why this attendance is being rejected...'
                }
                rows="4"
              />
              {noteError && <div className="form-error">{noteError}</div>}
              {modalAction === 'reject' && (
                <div className="form-help">Minimum 10 characters required</div>
              )}
            </div>

            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <Button 
                variant={modalAction === 'approve' ? 'success' : 'danger'}
                onClick={executeAction}
                disabled={actionLoading}
              >
                {modalAction === 'approve' ? '✓ Approve' : '✗ Reject'}
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setShowModal(false)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
