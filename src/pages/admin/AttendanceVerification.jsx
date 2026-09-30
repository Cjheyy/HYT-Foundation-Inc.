import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../config/supabase';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import {
  getAttendanceLogs,
  approveAttendance,
  rejectAttendance,
  isPendingAttendanceStatus,
  getAttendanceStage,
  normalizeStatus
} from '../../services/supabaseService';
import { formatDate, formatTime } from '../../utils/helpers';
import { toast } from 'react-toastify';
import { DASHBOARD_DATA_CHANGED_EVENT } from '../../components/AdminDashboardMetrics';
import './Admin.css';

const POLL_INTERVAL_MS = 45_000;

const formatDuration = (seconds) => {
  const total = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = Math.floor(total % 60);
  return [hours, minutes, remainder].map((value) => String(value).padStart(2, '0')).join(':');
};

// Fail closed: an unrecognised pending status must not be presented as a
// clock-in request, because approving it would start a timer incorrectly.
const getStage = (log) => getAttendanceStage(log);

const stageLabel = (stage) => stage === 'CLOCK_IN' ? 'Clock-in request' : 'Clock-out request';

const isAlreadyProcessed = (error) => /already processed|no longer pending|not found/i.test(String(error?.message || ''));

export function AttendanceVerification() {
  const { state, refreshData } = useApp();
  const { currentUser } = state;
  const [searchParams] = useSearchParams();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);
  const [modalAction, setModalAction] = useState(null);
  const [adminNote, setAdminNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const requestedStatus = searchParams.get('status');
  const requestedUser = searchParams.get('user');

  const loadLogs = useCallback(async ({ loader = false } = {}) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (loader) setLoading(true);
    try {
      const data = await getAttendanceLogs();
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setLogs(data || []);
    } catch (error) {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      console.error('Error loading attendance logs:', error);
      toast.error('Failed to load attendance logs');
    } finally {
      if (mountedRef.current && loader && requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadLogs({ loader: true });
    let refreshTimer;
    const refresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        if (mountedRef.current) loadLogs();
      }, 120);
    };
    let channel;
    if (supabase) {
      channel = supabase
        .channel(`admin-attendance-verification-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, refresh)
        .subscribe();
    }
    // Realtime is the fast path; polling and focus recovery guarantee the queue
    // still updates when the publication is missing or the socket dropped.
    const pollTimer = window.setInterval(() => loadLogs(), POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') loadLogs();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(refreshTimer);
      window.clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      if (channel) supabase.removeChannel(channel);
    };
  }, [loadLogs]);

  const pendingLogs = useMemo(() => logs.filter((log) => isPendingAttendanceStatus(log.status)), [logs]);
  const processedLogs = useMemo(() => logs.filter((log) =>
    ['APPROVED', 'REJECTED', 'VOID'].includes(normalizeStatus(log.status))
  ), [logs]);
  const filteredPending = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return pendingLogs.filter((log) => {
      const matchesUser = !requestedUser || requestedUser === log.userId || requestedUser === log.user?.id;
      if (!matchesUser) return false;
      if (!query) return true;
      return [log.user?.fullName, log.user?.email, log.user?.school, log.date]
        .some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [pendingLogs, requestedUser, searchTerm]);

  const openActionModal = (log, action) => {
    setSelectedLog(log);
    setModalAction(action);
    setAdminNote('');
    setNoteError('');
  };

  const closeModal = (force = false) => {
    if (actionLoading && !force) return;
    setSelectedLog(null);
    setModalAction(null);
    setAdminNote('');
    setNoteError('');
  };

  const handleApprove = async () => {
    if (!selectedLog || !currentUser?.id) return;
    const stage = getStage(selectedLog);
    try {
      setActionLoading(true);
      await approveAttendance(selectedLog.id, currentUser.id, adminNote.trim());
      toast.success(stage === 'CLOCK_IN'
        ? 'Clock-in approved. The trainee timer has started.'
        : 'Attendance approved and rendered hours credited.');
      closeModal(true);
      await loadLogs();
      await refreshData().catch(() => undefined);
      window.dispatchEvent(new Event(DASHBOARD_DATA_CHANGED_EVENT));
    } catch (error) {
      console.error('Approve attendance error:', error);
      if (isAlreadyProcessed(error)) {
        // Another admin already handled it: treat it as the outcome it is.
        toast.info('This request was already processed by another admin.');
        closeModal(true);
        await loadLogs();
        await refreshData().catch(() => undefined);
      } else {
        toast.error(error.message || 'Failed to approve attendance');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedLog || !currentUser?.id) return;
    if (adminNote.trim().length < 10) {
      setNoteError('Please provide a reason of at least 10 characters.');
      return;
    }
    try {
      setActionLoading(true);
      await rejectAttendance(selectedLog.id, currentUser.id, adminNote.trim());
      toast.warning('Attendance request rejected. No hours were credited.');
      closeModal(true);
      await loadLogs();
      await refreshData().catch(() => undefined);
      window.dispatchEvent(new Event(DASHBOARD_DATA_CHANGED_EVENT));
    } catch (error) {
      console.error('Reject attendance error:', error);
      if (isAlreadyProcessed(error)) {
        toast.info('This request was already processed by another admin.');
        closeModal(true);
        await loadLogs();
        await refreshData().catch(() => undefined);
      } else {
        toast.error(error.message || 'Failed to reject attendance');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const executeAction = () => (modalAction === 'approve' ? handleApprove() : handleReject());

  if (loading) {
    return <div className="admin-page"><div className="loading-spinner">Loading attendance requests...</div></div>;
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1 className="page-title">Attendance Verification</h1>
        <p className="page-subtitle">
          Review both clock-in and clock-out requests. The trainee timer never starts or credits hours before approval.
        </p>
      </div>

      {requestedStatus && (
        <div className="filter-notice">
          Showing pending requests{requestedUser ? ' for the selected trainee' : ''}. Counts update automatically when another request is processed.
        </div>
      )}

      <Card>
        <div className="card-header">
          <div>
            <h2 className="card-title">Pending Attendance Requests</h2>
            <p className="card-subtitle">Pending clock-in requests start the timer only after approval; pending clock-out requests keep the frozen duration.</p>
          </div>
          <Badge color="yellow">{pendingLogs.length} Pending</Badge>
        </div>
        <div className="table-toolbar">
          <input
            type="search"
            className="table-search-input"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Filter by student, email, school, or date..."
            aria-label="Filter attendance requests"
          />
          <Button variant="ghost" size="sm" onClick={() => loadLogs()} disabled={loading}>Refresh</Button>
        </div>

        {filteredPending.length > 0 ? (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Stage</th>
                  <th>Date</th>
                  <th>Time In</th>
                  <th>Frozen End</th>
                  <th>Duration / Hours</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPending.map((log) => {
                  const stage = getStage(log);
                  const isRequestedUser = !requestedUser || requestedUser === log.userId || requestedUser === log.user?.id;
                  return (
                    <tr key={log.id} className={isRequestedUser ? 'requested-row' : ''}>
                      <td>
                        <div className="student-info">
                          <div className="student-name">{log.user?.fullName || 'Unknown'}</div>
                          <div className="student-email">{log.user?.email || '--'}</div>
                        </div>
                      </td>
                      <td>
                        <Badge color={!stage ? 'gray' : stage === 'CLOCK_IN' ? 'blue' : 'yellow'}>
                          {stage ? stageLabel(stage) : 'Unrecognised status'}
                        </Badge>
                      </td>
                      <td>{formatDate(log.date)}</td>
                      <td>{log.timeIn ? formatTime(log.timeIn) : 'Not started'}</td>
                      <td>{log.pendingEndTime ? formatTime(log.pendingEndTime) : '--:--'}</td>
                      <td>
                        {!stage ? (
                          <span className="muted-cell" title="Normalise this legacy status before approving.">
                            Cannot be approved automatically
                          </span>
                        ) : stage === 'CLOCK_IN' ? <span className="muted-cell">Timer starts after approval</span> : (
                          <>
                            <div className="duration-display">{formatDuration(log.durationSeconds)}</div>
                            <strong className="hours-display">{Number(log.renderedHours || 0).toFixed(4)} hrs</strong>
                          </>
                        )}
                      </td>
                      <td><Badge status={log.status}>Pending</Badge></td>
                      <td>
                        <div className="action-buttons">
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => openActionModal(log, 'approve')}
                            disabled={!stage}
                            title={stage ? undefined : 'This status is not part of the approved attendance workflow.'}
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => openActionModal(log, 'reject')}
                            disabled={!stage}
                            title={stage ? undefined : 'This status is not part of the approved attendance workflow.'}
                          >
                            Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon"></div>
            <h3>All caught up!</h3>
            <p>No pending attendance requests match this filter.</p>
          </div>
        )}
      </Card>

      <Card style={{ marginTop: '24px' }}>
        <div className="card-header"><h2 className="card-title">Recently Processed</h2></div>
        {processedLogs.length > 0 ? (
          <div className="table-responsive">
            <table className="data-table">
              <thead><tr><th>Student</th><th>Date</th><th>Duration</th><th>Hours</th><th>Status</th><th>Admin note</th></tr></thead>
              <tbody>
                {processedLogs.slice(0, 15).map((log) => (
                  <tr key={log.id}>
                    <td>{log.user?.fullName || 'Unknown'}</td>
                    <td>{formatDate(log.date)}</td>
                    <td className="duration-display">{formatDuration(log.durationSeconds)}</td>
                    <td>{Number(log.renderedHours || 0).toFixed(4)} hrs</td>
                    <td><Badge status={log.status}>{log.status}</Badge></td>
                    <td>{log.adminNote || '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="empty-state-text">No processed attendance requests yet.</p>}
      </Card>

      <Modal
        isOpen={Boolean(selectedLog)}
        onClose={() => closeModal()}
        title={modalAction === 'approve' ? 'Accept attendance request' : 'Reject attendance request'}
      >
        {selectedLog && (
          <div>
            <div className="modal-info attendance-review-summary">
              <p><strong>Student:</strong> {selectedLog.user?.fullName || 'Unknown'}</p>
              <p>
                <strong>Stage:</strong>{' '}
                {getStage(selectedLog) ? stageLabel(getStage(selectedLog)) : `Unrecognised status (${selectedLog.status})`}
              </p>
              <p><strong>Date:</strong> {formatDate(selectedLog.date)}</p>
              {getStage(selectedLog) === 'CLOCK_OUT' && (
                <>
                  <p><strong>Frozen duration:</strong> {formatDuration(selectedLog.durationSeconds)}</p>
                  <p><strong>Hours to credit:</strong> {Number(selectedLog.renderedHours || 0).toFixed(4)} hrs</p>
                  {!selectedLog.pendingEndTime && (
                    <p className="form-error" style={{ marginTop: '8px' }}>
                      This request has no frozen end time. Reject it and ask the trainee to clock out again.
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="form-group" style={{ marginTop: '20px' }}>
              <label className="form-label" htmlFor="attendance-admin-note">
                Admin note {modalAction === 'reject' && <span className="required">*</span>}
              </label>
              <textarea
                id="attendance-admin-note"
                className={`form-textarea ${noteError ? 'error' : ''}`}
                value={adminNote}
                onChange={(event) => { setAdminNote(event.target.value); setNoteError(''); }}
                placeholder={modalAction === 'approve' ? 'Optional note for the trainee...' : 'Explain why this request is rejected...'}
                rows="4"
              />
              {noteError && <div className="form-error">{noteError}</div>}
              {modalAction === 'reject' && <div className="form-help">Minimum 10 characters.</div>}
            </div>
            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <Button variant={modalAction === 'approve' ? 'success' : 'danger'} onClick={executeAction} disabled={actionLoading}>
                {actionLoading ? 'Processing...' : modalAction === 'approve' ? 'Accept & apply' : 'Reject request'}
              </Button>
              <Button variant="ghost" onClick={closeModal} disabled={actionLoading}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
