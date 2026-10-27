import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../config/supabase';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import {
  ABSENCE_REJECTION_MIN_NOTE,
  getAbsenceDecision,
  getAbsenceRequests,
  isAbsenceAccepted,
  isAbsenceRejected,
  isAbsencePending,
  resolveUserName,
  reviewAbsenceRequest
} from '../../services/supabaseService';
import { DASHBOARD_DATA_CHANGED_EVENT } from '../../components/AdminDashboardMetrics';
import { formatDate, formatRelativeTime, describeError } from '../../utils/helpers';
import { toast } from 'react-toastify';
import './Admin.css';

const POLL_INTERVAL_MS = 45_000;

/**
 * Administrator queue for absence reports.
 *
 * The trainee files "I cannot attend on <date>, because <reason>" from their
 * Attendance page.  Until this page existed the only reply available was
 * "Noted", which could not say no - and a refused absence still silently
 * counted as a working day.
 *
 * The answer is now a real decision:
 *
 *   Accept  the absence stands.  The projected OJT/training end date moves out
 *           by one working day for that date.
 *   Reject  the day is expected as normal.  A reason of at least
 *           ABSENCE_REJECTION_MIN_NOTE characters is mandatory, because the
 *           trainee has to know what to do differently.
 *
 * The reason is enforced three times over - in this form, in
 * reviewAbsenceRequest(), and by a CHECK constraint - so a request can never be
 * refused silently.
 */
export function AbsenceReview() {
  const { state, refreshData } = useApp();
  const { currentUser } = state;
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState(null);
  const [decision, setDecision] = useState(null);
  const [adminNote, setAdminNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  const loadRequests = useCallback(async ({ loader = false } = {}) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (loader) setLoading(true);
    try {
      const data = await getAbsenceRequests();
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      // Log the real cause, not "Object": Supabase rejects with a plain
      // { message, details, hint, code } object, which is unreadable in the
      // console and useless in a bug report.
      console.error('Error loading absence requests:', describeError(error), error);
      toast.error(`Failed to load absence reports: ${describeError(error)}`);
    } finally {
      if (mountedRef.current && loader && requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadRequests({ loader: true });

    let refreshTimer;
    const refresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        if (mountedRef.current) loadRequests();
      }, 120);
    };
    let channel;
    if (supabase) {
      channel = supabase
        .channel(`admin-absence-review-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'absence_requests' }, refresh)
        .subscribe();
    }
    const pollTimer = window.setInterval(() => loadRequests(), POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') loadRequests();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(refreshTimer);
      window.clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      if (channel) supabase.removeChannel(channel);
    };
  }, [loadRequests]);

  const pending = useMemo(() => requests.filter(isAbsencePending), [requests]);
  const reviewed = useMemo(
    () => requests.filter((request) => !isAbsencePending(request)),
    [requests]
  );

  const filteredPending = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return pending;
    return pending.filter((request) => [
      resolveUserName(request.user, request),
      request.user?.email,
      request.user?.school,
      request.reason,
      request.absenceDate
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [pending, searchTerm]);

  const openModal = (request, nextDecision) => {
    setSelected(request);
    setDecision(nextDecision);
    setAdminNote('');
    setNoteError('');
  };

  const closeModal = (force = false) => {
    if (actionLoading && !force) return;
    setSelected(null);
    setDecision(null);
    setAdminNote('');
    setNoteError('');
  };

  const submitDecision = async () => {
    if (!selected) return;
    const note = adminNote.trim();
    if (decision === 'Rejected' && note.length < ABSENCE_REJECTION_MIN_NOTE) {
      setNoteError(`Please explain the rejection (at least ${ABSENCE_REJECTION_MIN_NOTE} characters).`);
      return;
    }

    try {
      setActionLoading(true);
      await reviewAbsenceRequest({
        requestId: selected.id,
        decision,
        adminNote: note,
        adminUserId: currentUser?.id || null
      });
      toast.success(
        decision === 'Accepted'
          ? 'Absence accepted. The projected end date moves out by one working day.'
          : 'Absence rejected. The trainee has been given your reason.'
      );
      closeModal(true);
      await loadRequests();
      await refreshData().catch(() => undefined);
      window.dispatchEvent(new Event(DASHBOARD_DATA_CHANGED_EVENT));
    } catch (error) {
      console.error('Review absence error:', describeError(error), error);
      toast.error(describeError(error) || 'Failed to save the decision');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div className="admin-page"><div className="loading-spinner">Loading absence reports...</div></div>;
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1 className="page-title">Absence Reports</h1>
        <p className="page-subtitle">
          Accept an absence and the trainee&apos;s projected end date moves out by one working day.
          Reject it and the day is expected as normal - with a reason they can read.
        </p>
      </div>

      <Card>
        <div className="card-header">
          <div>
            <h2 className="card-title">Waiting for a decision</h2>
            <p className="card-subtitle">Filed by OJT/Interns and Trainees from their Attendance page.</p>
          </div>
          <Badge color="yellow">{pending.length} Pending</Badge>
        </div>

        <div className="table-toolbar">
          <input
            type="search"
            className="table-search-input"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Filter by trainee, school, reason, or date..."
            aria-label="Filter absence reports"
          />
          <Button variant="ghost" size="sm" onClick={() => loadRequests()} disabled={loading}>Refresh</Button>
        </div>

        {filteredPending.length > 0 ? (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Trainee</th>
                  <th>Absence date</th>
                  <th>Reason</th>
                  <th>Filed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPending.map((request) => (
                  <tr key={request.id}>
                    <td>
                      <div className="student-info">
                        <div className="student-name">{resolveUserName(request.user, request)}</div>
                        <div className="student-email">{request.user?.email || '--'}</div>
                      </div>
                    </td>
                    <td>{formatDate(request.absenceDate || request.createdAt)}</td>
                    <td className="admin-note-cell">{request.reason}</td>
                    <td>{formatRelativeTime(request.createdAt) || formatDate(request.createdAt)}</td>
                    <td>
                      <div className="action-buttons">
                        <Button size="sm" variant="success" onClick={() => openModal(request, 'Accepted')}>
                          Accept
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => openModal(request, 'Rejected')}>
                          Reject
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
            <div className="empty-icon"></div>
            <h3>Nothing waiting</h3>
            <p>No absence reports are waiting for a decision.</p>
          </div>
        )}
      </Card>

      <Card style={{ marginTop: '24px' }}>
        <div className="card-header">
          <h2 className="card-title">Recently reviewed</h2>
        </div>
        {reviewed.length > 0 ? (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Trainee</th>
                  <th>Absence date</th>
                  <th>Decision</th>
                  <th>Your reason</th>
                  <th>Reviewed</th>
                </tr>
              </thead>
              <tbody>
                {reviewed.slice(0, 20).map((request) => (
                  <tr key={request.id}>
                    <td>{resolveUserName(request.user, request)}</td>
                    <td>{formatDate(request.absenceDate || request.createdAt)}</td>
                    <td>
                      <Badge status={isAbsenceAccepted(request) ? 'APPROVED' : isAbsenceRejected(request) ? 'REJECTED' : 'PENDING'}>
                        {getAbsenceDecision(request)}
                      </Badge>
                    </td>
                    <td className="admin-note-cell">{request.adminNote || '--'}</td>
                    <td>{request.notedAt ? formatDate(request.notedAt) : '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state-text">No absence reports have been reviewed yet.</p>
        )}
      </Card>

      <Modal
        isOpen={Boolean(selected)}
        onClose={() => closeModal()}
        title={decision === 'Rejected' ? 'Reject absence report' : 'Accept absence report'}
      >
        {selected && (
          <div>
            <div className="modal-info">
              <p><strong>Trainee:</strong> {resolveUserName(selected.user, selected)}</p>
              <p><strong>Absence date:</strong> {formatDate(selected.absenceDate || selected.createdAt)}</p>
              <p><strong>Reason given:</strong> {selected.reason}</p>
              {decision === 'Accepted' ? (
                <p style={{ marginTop: '12px' }}>
                  Accepting this adds <strong>one working day</strong> to the projected end date.
                </p>
              ) : (
                <p style={{ marginTop: '12px' }}>
                  Rejecting this keeps the day as a normal working day. The trainee will read
                  what you write below, so say what they should do instead.
                </p>
              )}
            </div>

            <div className="form-group" style={{ marginTop: '20px' }}>
              <label className="form-label" htmlFor="absence-admin-note">
                Reason {decision === 'Rejected' ? <span className="required">*</span> : <span className="muted-cell">(optional)</span>}
              </label>
              <textarea
                id="absence-admin-note"
                className={`form-textarea ${noteError ? 'error' : ''}`}
                value={adminNote}
                onChange={(event) => { setAdminNote(event.target.value); setNoteError(''); }}
                placeholder={decision === 'Rejected'
                  ? 'Explain why the absence is not accepted, and what is expected instead...'
                  : 'Optional note for the trainee...'}
                rows="4"
              />
              {noteError && <div className="form-error">{noteError}</div>}
              {decision === 'Rejected' && (
                <div className="form-help">Minimum {ABSENCE_REJECTION_MIN_NOTE} characters.</div>
              )}
            </div>

            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <Button
                variant={decision === 'Rejected' ? 'danger' : 'success'}
                onClick={submitDecision}
                disabled={actionLoading}
              >
                {actionLoading ? 'Saving...' : decision === 'Rejected' ? 'Reject absence' : 'Accept absence'}
              </Button>
              <Button variant="ghost" onClick={closeModal} disabled={actionLoading}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default AbsenceReview;
