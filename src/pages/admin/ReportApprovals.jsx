import { useState, useEffect } from 'react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { 
  getDailyReports, 
  approveDailyReport, 
  rejectDailyReport 
} from '../../services/supabaseService';
import { formatDate } from '../../utils/helpers';
import { toast } from 'react-toastify';
import './Admin.css';

export function ReportApprovals() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  const [selectedReport, setSelectedReport] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalAction, setModalAction] = useState(null);
  const [adminNote, setAdminNote] = useState('');
  const [noteError, setNoteError] = useState('');

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      // Get all daily reports (might want to enhance service to get all, not just by user)
      const data = await getDailyReports();
      setReports(data || []);
    } catch (error) {
      console.error('Error loading reports:', error);
      toast.error('Failed to load daily reports');
    } finally {
      setLoading(false);
    }
  };

  const openActionModal = (report, action) => {
    setSelectedReport(report);
    setModalAction(action);
    setAdminNote('');
    setNoteError('');
    setShowModal(true);
  };

  const handleApprove = async () => {
    if (!selectedReport) return;

    try {
      setActionLoading(true);
      await approveDailyReport(selectedReport.id, adminNote.trim() || null);
      toast.success('✅ Report approved successfully!');
      setShowModal(false);
      await loadReports();
    } catch (error) {
      console.error('Approve error:', error);
      toast.error(error.message || 'Failed to approve report');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedReport) return;

    // Rejection requires a note
    if (!adminNote || adminNote.trim().length < 10) {
      setNoteError('Rejection reason is required (at least 10 characters)');
      return;
    }

    try {
      setActionLoading(true);
      await rejectDailyReport(selectedReport.id, adminNote.trim());
      toast.success('Report rejected with feedback sent to student');
      setShowModal(false);
      await loadReports();
    } catch (error) {
      console.error('Reject error:', error);
      toast.error(error.message || 'Failed to reject report');
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

  const pendingReports = reports.filter(rep => rep.status === 'Pending');

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
        <h1 className="page-title">Daily Report Approvals</h1>
        <p className="page-subtitle">Review and approve daily accomplishment reports</p>
      </div>

      <Card>
        <div className="card-header">
          <h2 className="card-title">Pending Reports</h2>
          <Badge color="yellow">{pendingReports.length} Pending</Badge>
        </div>

        {pendingReports.length > 0 ? (
          <div className="reports-grid">
            {pendingReports.map((report) => (
              <Card key={report.id} className="report-card">
                <div className="report-header">
                  <div className="student-info">
                    <div className="student-name">{report.user?.fullName || 'Unknown'}</div>
                    <div className="student-email">{report.user?.email}</div>
                  </div>
                  <Badge status={report.status}>{report.status}</Badge>
                </div>

                <div className="report-meta">
                  <span>📅 {formatDate(report.reportDate)}</span>
                  <span>🕐 Submitted: {formatDate(report.createdAt)}</span>
                </div>

                <div className="report-content">
                  <h4 className="content-label">Accomplishments:</h4>
                  <p className="content-text">{report.accomplishments}</p>
                </div>

                <div className="action-buttons">
                  <Button 
                    size="sm" 
                    variant="success"
                    onClick={() => openActionModal(report, 'approve')}
                  >
                    ✓ Approve
                  </Button>
                  <Button 
                    size="sm" 
                    variant="danger"
                    onClick={() => openActionModal(report, 'reject')}
                  >
                    ✗ Reject
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">✅</div>
            <h3>All Caught Up!</h3>
            <p>No pending reports to review</p>
          </div>
        )}
      </Card>

      {/* Recent Processed Reports */}
      <Card style={{ marginTop: '24px' }}>
        <div className="card-header">
          <h2 className="card-title">Recently Processed</h2>
        </div>

        {reports.filter(rep => rep.status !== 'Pending').length > 0 ? (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Report Date</th>
                  <th>Status</th>
                  <th>Admin Note</th>
                  <th>Processed</th>
                </tr>
              </thead>
              <tbody>
                {reports
                  .filter(rep => rep.status !== 'Pending')
                  .slice(0, 10)
                  .map((report) => (
                    <tr key={report.id}>
                      <td>{report.user?.fullName || 'Unknown'}</td>
                      <td>{formatDate(report.reportDate)}</td>
                      <td><Badge status={report.status}>{report.status}</Badge></td>
                      <td className="admin-note-cell">{report.adminNote || '--'}</td>
                      <td>{formatDate(report.updatedAt || report.createdAt)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state-text">No processed reports yet</p>
        )}
      </Card>

      {/* Action Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={modalAction === 'approve' ? 'Approve Report' : 'Reject Report'}
      >
        {selectedReport && (
          <div>
            <div className="modal-info">
              <p><strong>Student:</strong> {selectedReport.user?.fullName}</p>
              <p><strong>Report Date:</strong> {formatDate(selectedReport.reportDate)}</p>
              <div style={{ marginTop: '12px' }}>
                <strong>Accomplishments:</strong>
                <div className="accomplishments-box" style={{ 
                  marginTop: '8px', 
                  padding: '12px', 
                  background: '#F3F4F6', 
                  borderRadius: '6px',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {selectedReport.accomplishments}
                </div>
              </div>
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
                    ? 'Optional: Add feedback or encouragement...' 
                    : 'Required: Explain what needs improvement or why this is rejected...'
                }
                rows="4"
              />
              {noteError && <div className="form-error">{noteError}</div>}
              {modalAction === 'reject' && (
                <div className="form-help">
                  Provide constructive feedback so the student can improve. Minimum 10 characters.
                </div>
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
