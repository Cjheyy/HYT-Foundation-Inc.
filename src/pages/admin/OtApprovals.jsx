import { useState, useEffect } from 'react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { 
  getOtRequests, 
  approveOtRequest, 
  rejectOtRequest 
} from '../../services/supabaseService';
import { formatDate } from '../../utils/helpers';
import { toast } from 'react-toastify';
import './Admin.css';

export function OtApprovals() {
  const [otRequests, setOtRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalAction, setModalAction] = useState(null);
  const [adminNote, setAdminNote] = useState('');
  const [noteError, setNoteError] = useState('');

  useEffect(() => {
    loadOtRequests();
  }, []);

  const loadOtRequests = async () => {
    try {
      setLoading(true);
      // Get all OT requests (might want to enhance service to get all, not just by user)
      const requests = await getOtRequests();
      setOtRequests(requests || []);
    } catch (error) {
      console.error('Error loading OT requests:', error);
      toast.error('Failed to load OT requests');
    } finally {
      setLoading(false);
    }
  };

  const openActionModal = (request, action) => {
    setSelectedRequest(request);
    setModalAction(action);
    setAdminNote('');
    setNoteError('');
    setShowModal(true);
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;

    try {
      setActionLoading(true);
      await approveOtRequest(selectedRequest.id, adminNote.trim() || null);
      toast.success('✅ OT request approved! Hours added to student record.');
      setShowModal(false);
      await loadOtRequests();
    } catch (error) {
      console.error('Approve error:', error);
      toast.error(error.message || 'Failed to approve OT request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;

    // Rejection requires a note
    if (!adminNote || adminNote.trim().length < 10) {
      setNoteError('Rejection reason is required (at least 10 characters)');
      return;
    }

    try {
      setActionLoading(true);
      await rejectOtRequest(selectedRequest.id, adminNote.trim());
      toast.success('OT request rejected');
      setShowModal(false);
      await loadOtRequests();
    } catch (error) {
      console.error('Reject error:', error);
      toast.error(error.message || 'Failed to reject OT request');
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

  const pendingRequests = otRequests.filter(req => req.status === 'Pending');

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
        <h1 className="page-title">OT/Extension Approvals</h1>
        <p className="page-subtitle">Review and approve overtime/extension requests</p>
      </div>

      <Card>
        <div className="card-header">
          <h2 className="card-title">Pending OT Requests</h2>
          <Badge color="yellow">{pendingRequests.length} Pending</Badge>
        </div>

        {pendingRequests.length > 0 ? (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Date Requested</th>
                  <th>Hours Requested</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingRequests.map((request) => (
                  <tr key={request.id}>
                    <td>
                      <div className="student-info">
                        <div className="student-name">{request.user?.fullName || 'Unknown'}</div>
                        <div className="student-email">{request.user?.email}</div>
                      </div>
                    </td>
                    <td>{formatDate(request.createdAt)}</td>
                    <td>
                      <span className="hours-badge highlight">
                        +{request.requestedHours} hrs
                      </span>
                    </td>
                    <td className="reason-cell">
                      <div className="reason-text">{request.reason}</div>
                    </td>
                    <td><Badge status={request.status}>{request.status}</Badge></td>
                    <td>
                      <div className="action-buttons">
                        <Button 
                          size="sm" 
                          variant="success"
                          onClick={() => openActionModal(request, 'approve')}
                        >
                          ✓ Approve
                        </Button>
                        <Button 
                          size="sm" 
                          variant="danger"
                          onClick={() => openActionModal(request, 'reject')}
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
            <p>No pending OT requests to review</p>
          </div>
        )}
      </Card>

      {/* Recent Processed Requests */}
      <Card style={{ marginTop: '24px' }}>
        <div className="card-header">
          <h2 className="card-title">Recently Processed</h2>
        </div>

        {otRequests.filter(req => req.status !== 'Pending').length > 0 ? (
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
                {otRequests
                  .filter(req => req.status !== 'Pending')
                  .slice(0, 10)
                  .map((request) => (
                    <tr key={request.id}>
                      <td>{request.user?.fullName || 'Unknown'}</td>
                      <td>{formatDate(request.createdAt)}</td>
                      <td>+{request.requestedHours} hrs</td>
                      <td><Badge status={request.status}>{request.status}</Badge></td>
                      <td className="admin-note-cell">{request.adminNote || '--'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state-text">No processed requests yet</p>
        )}
      </Card>

      {/* Action Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={modalAction === 'approve' ? 'Approve OT Request' : 'Reject OT Request'}
      >
        {selectedRequest && (
          <div>
            <div className="modal-info">
              <p><strong>Student:</strong> {selectedRequest.user?.fullName}</p>
              <p><strong>Requested Hours:</strong> +{selectedRequest.requestedHours} hrs</p>
              <p><strong>Reason:</strong></p>
              <div className="reason-box">{selectedRequest.reason}</div>
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
                    : 'Required: Explain why this OT request is being rejected...'
                }
                rows="4"
              />
              {noteError && <div className="form-error">{noteError}</div>}
              {modalAction === 'reject' && (
                <div className="form-help">Minimum 10 characters required</div>
              )}
            </div>

            {modalAction === 'approve' && (
              <div className="approval-note" style={{ marginTop: '16px', padding: '12px', background: '#E0F2FE', borderRadius: '6px', color: '#075985' }}>
                <strong>Note:</strong> Approving will automatically add {selectedRequest.requestedHours} hours to the student's rendered hours.
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <Button 
                variant={modalAction === 'approve' ? 'success' : 'danger'}
                onClick={executeAction}
                disabled={actionLoading}
              >
                {modalAction === 'approve' ? '✓ Approve & Add Hours' : '✗ Reject'}
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
