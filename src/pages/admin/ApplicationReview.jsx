import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../config/supabase';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import {
  getUserApplicationsByStatus,
  approveUserApplication,
  rejectUserApplication,
  isPendingAccountStatus,
  normalizeRole
} from '../../services/supabaseService';
import { DASHBOARD_DATA_CHANGED_EVENT } from '../../components/AdminDashboardMetrics';
import { formatDate } from '../../utils/helpers';
import { toast } from 'react-toastify';
import './Admin.css';

const calculateAge = (birthday) => {
  if (!birthday) return 'N/A';
  const birthDate = new Date(`${String(birthday).slice(0, 10)}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDifference = today.getMonth() - birthDate.getMonth();
  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) age -= 1;
  return age;
};

const roleMatches = (user, tab) => {
  const role = normalizeRole(user.role);
  return tab === 'ojt' ? role === 'OJT/INTERN' : ['TRAINEE', 'STUDENT'].includes(role);
};

export function ApplicationReview() {
  const { state, refreshData } = useApp();
  const { currentUser } = state;
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('role') === 'trainee' ? 'trainee' : 'ojt');
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalAction, setModalAction] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  const requestedStatus = searchParams.get('status') || 'PENDING_APPROVAL';
  const pendingView = ['PENDING_APPROVAL', 'PENDING', 'PENDING_APPLICATION'].includes(requestedStatus.toUpperCase());

  const loadApplications = useCallback(async ({ loader = false } = {}) => {
    if (loader) setLoading(true);
    try {
      const data = await getUserApplicationsByStatus(requestedStatus);
      setApplications((data || []).filter((user) =>
        pendingView
          ? isPendingAccountStatus(user.applicationStatus)
          : true
      ));
    } catch (error) {
      console.error('Error loading applications:', error);
      toast.error('Failed to load applications');
    } finally {
      if (loader) setLoading(false);
    }
  }, [requestedStatus, pendingView]);

  useEffect(() => {
    loadApplications({ loader: true });
    let timer;
    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => loadApplications(), 120);
    };
    const onLocalChange = () => refresh();
    window.addEventListener(DASHBOARD_DATA_CHANGED_EVENT, onLocalChange);
    let channel;
    if (supabase) {
      channel = supabase
        .channel(`admin-application-review-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, refresh)
        .subscribe();
    }
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(DASHBOARD_DATA_CHANGED_EVENT, onLocalChange);
      if (channel) supabase.removeChannel(channel);
    };
  }, [loadApplications]);

  useEffect(() => {
    const userId = searchParams.get('user');
    if (!userId) return;
    const match = applications.find((application) => application.id === userId);
    if (match) setActiveTab(roleMatches(match, 'ojt') ? 'ojt' : 'trainee');
  }, [applications, searchParams]);

  const visibleApplications = useMemo(() => {
    const selectedUser = searchParams.get('user');
    return applications.filter((application) =>
      (pendingView ? roleMatches(application, activeTab) : true) &&
      (!selectedUser || application.id === selectedUser)
    );
  }, [activeTab, applications, pendingView, searchParams]);

  const openActionModal = (application, action) => {
    setSelectedApp(application);
    setModalAction(action);
    setRejectionReason('');
    setReasonError('');
    setShowModal(true);
  };

  const closeModal = (force = false) => {
    if (actionLoading && !force) return;
    setShowModal(false);
    setSelectedApp(null);
    setModalAction(null);
    setRejectionReason('');
    setReasonError('');
  };

  const handleApprove = async () => {
    if (!selectedApp || !currentUser?.id) return;
    try {
      setActionLoading(true);
      await approveUserApplication(selectedApp.id, currentUser.id);
      toast.success(`Application approved for ${selectedApp.fullName}.`);
      closeModal(true);
      await loadApplications();
      await refreshData().catch(() => undefined);
      window.dispatchEvent(new Event(DASHBOARD_DATA_CHANGED_EVENT));
    } catch (error) {
      console.error('Approve application error:', error);
      toast.error(error.message || 'Failed to approve application');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApp || !currentUser?.id) return;
    if (rejectionReason.trim().length < 10) {
      setReasonError('Rejection reason must be at least 10 characters.');
      return;
    }
    try {
      setActionLoading(true);
      await rejectUserApplication(selectedApp.id, currentUser.id, rejectionReason.trim());
      toast.warning(`Application rejected for ${selectedApp.fullName}.`);
      closeModal(true);
      await loadApplications();
      await refreshData().catch(() => undefined);
      window.dispatchEvent(new Event(DASHBOARD_DATA_CHANGED_EVENT));
    } catch (error) {
      console.error('Reject application error:', error);
      toast.error(error.message || 'Failed to reject application');
    } finally {
      setActionLoading(false);
    }
  };

  const changeTab = (tab) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set('role', tab);
    next.delete('user');
    setSearchParams(next);
  };

  if (loading) return <div className="admin-page"><div className="loading-spinner">Loading applications...</div></div>;

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1 className="page-title">Application Review</h1>
        <p className="page-subtitle">Approve or reject new account registrations. Pending applicants cannot log in.</p>
      </div>

      <div className="filter-notice">
        {pendingView ? 'Pending registrations are shown here. Approval immediately activates the account.' : `Showing ${requestedStatus.toUpperCase()} account applications.`}
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'ojt' ? 'active' : ''}`} onClick={() => changeTab('ojt')}>
          🎓 OJT/Intern Applications
          <span className="tab-badge">{applications.filter((user) => roleMatches(user, 'ojt')).length}</span>
        </button>
        <button className={`tab ${activeTab === 'trainee' ? 'active' : ''}`} onClick={() => changeTab('trainee')}>
          🚀 Trainee Applications
          <span className="tab-badge">{applications.filter((user) => roleMatches(user, 'trainee')).length}</span>
        </button>
      </div>

      {visibleApplications.length > 0 ? (
        <div className="applications-grid">
          {visibleApplications.map((application) => (
            <Card key={application.id} className="application-card">
              <div className="application-header">
                <div className="applicant-info">
                  <div className="applicant-avatar">{application.fullName?.charAt(0) || 'U'}</div>
                  <div><h3 className="applicant-name">{application.fullName || 'Unknown'}</h3><p className="applicant-email">{application.email}</p></div>
                </div>
                <Badge status="PENDING_APPROVAL">Pending</Badge>
              </div>
              <div className="application-details">
                <div className="detail-row"><span className="detail-label">Role:</span><span className="detail-value">{application.role}</span></div>
                {application.school && <div className="detail-row"><span className="detail-label">School:</span><span className="detail-value">{application.school}</span></div>}
                {application.requiredHours > 0 && <div className="detail-row"><span className="detail-label">Required Hours:</span><span className="detail-value">{application.requiredHours} hrs</span></div>}
                {application.birthday && <div className="detail-row"><span className="detail-label">Age:</span><span className="detail-value">{calculateAge(application.birthday)} years old</span></div>}
                <div className="detail-row"><span className="detail-label">Applied:</span><span className="detail-value">{formatDate(application.createdAt)}</span></div>
              </div>
              {pendingView && (
                <div className="application-actions">
                  <Button size="sm" variant="success" onClick={() => openActionModal(application, 'approve')}>✓ Approve</Button>
                  <Button size="sm" variant="danger" onClick={() => openActionModal(application, 'reject')}>✗ Reject</Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card><div className="empty-state"><div className="empty-icon">✅</div><h3>{pendingView ? 'All caught up!' : 'No applications found'}</h3><p>{pendingView ? `No pending ${activeTab === 'ojt' ? 'OJT/Intern' : 'Trainee'} applications.` : `No ${requestedStatus.toUpperCase()} account applications.`}</p></div></Card>
      )}

      <Modal isOpen={showModal} onClose={() => closeModal()} title={modalAction === 'approve' ? 'Approve Application' : 'Reject Application'}>
        {selectedApp && (
          <div>
            <div className="modal-info">
              <p><strong>Applicant:</strong> {selectedApp.fullName}</p>
              <p><strong>Email:</strong> {selectedApp.email}</p>
              <p><strong>Role:</strong> {selectedApp.role}</p>
              {selectedApp.school && <p><strong>School:</strong> {selectedApp.school}</p>}
            </div>
            {modalAction === 'reject' ? (
              <div className="form-group" style={{ marginTop: '20px' }}>
                <label className="form-label" htmlFor="application-rejection-reason">Rejection Reason <span className="required">*</span></label>
                <textarea id="application-rejection-reason" className={`form-textarea ${reasonError ? 'error' : ''}`} value={rejectionReason} onChange={(event) => { setRejectionReason(event.target.value); setReasonError(''); }} rows="4" placeholder="Explain why this application is being rejected (minimum 10 characters)..." />
                {reasonError && <div className="form-error">{reasonError}</div>}
              </div>
            ) : <p style={{ marginTop: '18px', lineHeight: 1.6 }}>Approving this account will activate it and allow the applicant to sign in.</p>}
            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <Button variant={modalAction === 'approve' ? 'success' : 'danger'} onClick={modalAction === 'approve' ? handleApprove : handleReject} disabled={actionLoading}>{actionLoading ? 'Processing...' : modalAction === 'approve' ? '✓ Approve' : '✗ Reject'}</Button>
              <Button variant="ghost" onClick={closeModal} disabled={actionLoading}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
