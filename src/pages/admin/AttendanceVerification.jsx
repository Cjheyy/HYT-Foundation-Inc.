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
  normalizeStatus,
  resolveAttendanceUserName,
  getAttendancePhotoUrl
} from '../../services/supabaseService';
import { describeError, formatDate, formatHours, formatTime } from '../../utils/helpers';
import { GEOFENCE_TRUSTED_ACCURACY_METERS, nearestOffice } from '../../utils/geofence';
import { formatMeters, shortOfficeName } from '../../utils/stampLines';
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

/**
 * Statuses that mean "an administrator has already answered this request".
 *
 * `CLOCKED_IN` belongs here and its absence was a real bug.  Approving a
 * clock-in writes `CLOCKED_IN`, not `APPROVED` - the row is not finished yet,
 * the timer has only just started - so a request that had been accepted
 * vanished from BOTH lists: it was no longer pending, and the processed filter
 * only looked for APPROVED/REJECTED/VOID.  The administrator pressed Accept,
 * the row left the queue, and "Recently Processed" stayed empty.
 *
 * `APPROVED` is still listed because that is what a clock-out approval writes,
 * and `VOID`/`CANCELLED` are closed without a decision.
 */
const PROCESSED_STATUSES = ['APPROVED', 'REJECTED', 'VOID', 'CANCELLED', 'CLOCKED_IN'];

/** Readable label for a processed row, so "CLOCKED_IN" is not shown raw. */
const processedLabel = (status) => {
  const normalized = normalizeStatus(status);
  if (normalized === 'CLOCKED_IN') return 'Approved - clocked in';
  if (normalized === 'APPROVED') return 'Approved';
  if (normalized === 'REJECTED') return 'Rejected';
  if (normalized === 'VOID') return 'Void';
  if (normalized === 'CANCELLED') return 'Cancelled';
  return status || 'Unknown';
};

/**
 * Where the request came from, in the words an administrator needs.
 *
 * The fence is enforced server-side, so in theory every stored row is inside
 * the fence and the location is just decoration. It is not: the stored accuracy
 * is the evidence that the fence was measured against something real. A fix
 * good to +/-5000 m came from the network, not GPS, and is worth a second look
 * before hours are credited - that is what `weak` marks, at
 * GEOFENCE_TRUSTED_ACCURACY_METERS rather than at the fence's own ceiling, so a
 * merely coarse (but accepted) fix is still visible.
 *
 * The distance is recomputed from the stored coordinates rather than trusted
 * from any client field, so the number beside "HYT Building" cannot be a
 * figure the browser chose.
 */
function describeAttendanceLocation(log) {
  // `Number('')` and `Number(null)` are both 0, so an empty column would
  // otherwise be plotted as a real fix at 0,0 and reported as 10,000 km away.
  const hasCoordinates = log?.latitude !== null && log?.latitude !== undefined && log?.latitude !== ''
    && log?.longitude !== null && log?.longitude !== undefined && log?.longitude !== '';
  const nearest = hasCoordinates ? nearestOffice(log.latitude, log.longitude) : null;

  const accuracyValue = log?.accuracyMeters;
  const accuracy = accuracyValue === null || accuracyValue === undefined || accuracyValue === ''
    ? null
    : Number(accuracyValue);

  return {
    place: shortOfficeName(log?.locationName) || shortOfficeName(nearest?.name) || null,
    distance: nearest ? nearest.distance : null,
    accuracy: Number.isFinite(accuracy) ? accuracy : null,
    weak: Number.isFinite(accuracy) && accuracy > GEOFENCE_TRUSTED_ACCURACY_METERS,
    // `location_source = 'dev'` means the record was written from a localhost
    // development build, where the fence is skipped because a laptop has no
    // GPS. The coordinates are the office pin, not a measurement, so this must
    // never be read as evidence that anyone was on site.
    dev: String(log?.locationSource || '').toLowerCase() === 'dev',
    coordinates: hasCoordinates
      ? { latitude: Number(log.latitude), longitude: Number(log.longitude) }
      : null
  };
}

/**
 * One stored photo.
 *
 * The bucket is private, so this resolves a short-lived signed URL before it
 * can render anything. Every failure degrades to a label instead of an empty
 * box: "No photo" (none was taken) and "Unavailable" (one exists but could not
 * be signed) are different facts and an administrator deciding whether to
 * credit hours needs to tell them apart.
 */
function AttendancePhoto({ path, label, onOpen, variant = 'thumb' }) {
  const [url, setUrl] = useState(null);
  const [status, setStatus] = useState(path ? 'loading' : 'missing');

  useEffect(() => {
    let alive = true;

    if (!path) {
      setUrl(null);
      setStatus('missing');
      return () => { alive = false; };
    }

    setStatus('loading');
    getAttendancePhotoUrl(path)
      .then((signed) => {
        if (!alive) return;
        setUrl(signed);
        setStatus(signed ? 'ready' : 'unavailable');
      })
      .catch(() => {
        if (alive) setStatus('unavailable');
      });

    return () => { alive = false; };
  }, [path]);

  if (status === 'missing') {
    return <span className="av-photo-empty" title="No photo was captured for this request.">No photo</span>;
  }
  if (status === 'loading') {
    return <span className="av-photo-empty">Loading...</span>;
  }
  if (status === 'unavailable' || !url) {
    return <span className="av-photo-empty" title="The photo exists but could not be opened.">Unavailable</span>;
  }

  if (variant === 'large') {
    return (
      <img
        className="av-photo-large"
        src={url}
        alt={label || 'Attendance photo'}
        onClick={() => onOpen?.({ url, label })}
      />
    );
  }

  return (
    <button
      type="button"
      className="av-photo-button"
      onClick={() => onOpen?.({ url, label })}
      title="Open the full photo"
    >
      <img className="av-photo-thumb" src={url} alt={label || 'Attendance photo'} loading="lazy" />
    </button>
  );
}

/** The Location cell: site, distance from the pin, and the fix's own doubt. */
function AttendanceLocationCell({ log }) {
  const info = describeAttendanceLocation(log);

  if (!info.place && info.distance === null && info.accuracy === null) {
    return <span className="av-photo-empty">Not recorded</span>;
  }

  return (
    <span className="av-location">
      <span className="av-location-place">{info.place || 'Unnamed site'}</span>
      <span className={`av-location-meta${info.weak ? ' is-weak' : ''}`}>
        {info.distance !== null && <span>{formatMeters(info.distance)} from the pin</span>}
        {info.accuracy !== null && (
          <span>
            {info.distance !== null ? ' · ' : ''}
            {`±${formatMeters(info.accuracy)}`}
          </span>
        )}
      </span>
      {info.weak && (
        <span className="av-location-warn" title="This fix is coarser than the fence, so it could not have proven anyone was inside it.">
          Imprecise fix
        </span>
      )}
      {info.dev && (
        <span className="av-location-warn" title="Written from a localhost development build. The fence was skipped and the coordinates are the office pin, not a measurement.">
          Dev test
        </span>
      )}
    </span>
  );
}

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
  // Full-size photo, opened from a thumbnail or from the review dialog.
  const [photoViewer, setPhotoViewer] = useState(null);
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
      console.error('Error loading attendance logs:', describeError(error), error);
      toast.error(`Failed to load attendance logs: ${describeError(error)}`);
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
    PROCESSED_STATUSES.includes(normalizeStatus(log.status))
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
      console.error('Approve attendance error:', describeError(error), error);
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
      console.error('Reject attendance error:', describeError(error), error);
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

  // Everything the review dialog needs about the selected row, resolved once
  // rather than inline in the JSX where it would be recomputed on every render.
  const selectedStage = selectedLog ? getStage(selectedLog) : null;
  const selectedLocation = selectedLog ? describeAttendanceLocation(selectedLog) : null;
  const selectedPhotoPath = selectedLog
    ? (selectedStage === 'CLOCK_OUT' ? selectedLog.photoOutPath : selectedLog.photoInPath)
    : null;
  const selectedPhotoLabel = selectedLog
    ? `${resolveAttendanceUserName(selectedLog)} - ${selectedStage === 'CLOCK_OUT' ? 'clock-out' : 'clock-in'}`
    : '';

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
          <div className="table-responsive av-stack">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Photo</th>
                  <th>Stage</th>
                  <th>Date</th>
                  <th>Time In</th>
                  <th>Frozen End</th>
                  <th>Location</th>
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
                      <td data-label="Student">
                        <div className="student-info">
                          <div className="student-name">{resolveAttendanceUserName(log)}</div>
                          <div className="student-email">{log.user?.email || '--'}</div>
                        </div>
                      </td>
                      <td data-label="Photo">
                        <AttendancePhoto
                          path={stage === 'CLOCK_OUT' ? log.photoOutPath : log.photoInPath}
                          label={`${resolveAttendanceUserName(log)} - ${stage === 'CLOCK_OUT' ? 'clock-out' : 'clock-in'}`}
                          onOpen={setPhotoViewer}
                        />
                      </td>
                      <td data-label="Stage">
                        <Badge color={!stage ? 'gray' : stage === 'CLOCK_IN' ? 'blue' : 'yellow'}>
                          {stage ? stageLabel(stage) : 'Unrecognised status'}
                        </Badge>
                      </td>
                      <td data-label="Date">{formatDate(log.date)}</td>
                      <td data-label="Time In">{log.timeIn ? formatTime(log.timeIn) : 'Not started'}</td>
                      <td data-label="Frozen End">{log.pendingEndTime ? formatTime(log.pendingEndTime) : '--:--'}</td>
                      <td data-label="Location"><AttendanceLocationCell log={log} /></td>
                      <td data-label="Duration / Hours">
                        {!stage ? (
                          <span className="muted-cell" title="Normalise this legacy status before approving.">
                            Cannot be approved automatically
                          </span>
                        ) : stage === 'CLOCK_IN' ? <span className="muted-cell">Timer starts after approval</span> : (
                          <>
                            <div className="duration-display">{formatDuration(log.durationSeconds)}</div>
                            <strong className="hours-display">{formatHours(log.renderedHours)} hrs</strong>
                          </>
                        )}
                      </td>
                      <td data-label="Status"><Badge status={log.status}>Pending</Badge></td>
                      <td data-label="Actions">
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
        <div className="card-header">
          <div>
            <h2 className="card-title">Recently Processed</h2>
            <p className="card-subtitle">
              Requests an administrator has already answered. An accepted clock-in shows as
              &ldquo;Approved - clocked in&rdquo; until its clock-out is approved and the hours are credited.
            </p>
          </div>
          <Badge color="green">{processedLogs.length} Processed</Badge>
        </div>
        {processedLogs.length > 0 ? (
          <div className="table-responsive av-stack">
            <table className="data-table">
              <thead><tr><th>Student</th><th>Photo</th><th>Date</th><th>Duration</th><th>Hours</th><th>Status</th><th>Admin note</th></tr></thead>
              <tbody>
                {processedLogs.slice(0, 15).map((log) => (
                  <tr key={log.id}>
                    <td data-label="Student">{resolveAttendanceUserName(log)}</td>
                    <td data-label="Photo">
                      <AttendancePhoto
                        path={log.photoOutPath || log.photoInPath}
                        label={`${resolveAttendanceUserName(log)} - attendance photo`}
                        onOpen={setPhotoViewer}
                      />
                    </td>
                    <td data-label="Date">{formatDate(log.date)}</td>
                    <td data-label="Duration" className="duration-display">{formatDuration(log.durationSeconds)}</td>
                    <td data-label="Hours">{formatHours(log.renderedHours)} hrs</td>
                    <td data-label="Status"><Badge status={log.status}>{processedLabel(log.status)}</Badge></td>
                    <td data-label="Admin note">{log.adminNote || '--'}</td>
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
            {/* The photo is the reason the request is reviewable at all, so it
                sits above the text rather than behind a link. */}
            <div className="av-review-photo">
              <AttendancePhoto
                variant="large"
                path={selectedPhotoPath}
                label={selectedPhotoLabel}
                onOpen={setPhotoViewer}
              />
              {!selectedPhotoPath && (
                <p className="av-photo-warning">
                  No photo was captured for this request. Accept it only if you can confirm the trainee was on site.
                </p>
              )}
            </div>
            <div className="modal-info attendance-review-summary">
              <p><strong>Student:</strong> {resolveAttendanceUserName(selectedLog)}</p>
              <p>
                <strong>Stage:</strong>{' '}
                {getStage(selectedLog) ? stageLabel(getStage(selectedLog)) : `Unrecognised status (${selectedLog.status})`}
              </p>
              <p><strong>Date:</strong> {formatDate(selectedLog.date)}</p>
              <p><strong>Location:</strong> <AttendanceLocationCell log={selectedLog} /></p>
              {selectedLocation?.coordinates && (
                <p>
                  <strong>Coordinates:</strong>{' '}
                  {selectedLocation.coordinates.latitude.toFixed(5)},{' '}
                  {selectedLocation.coordinates.longitude.toFixed(5)}{' '}
                  <a
                    className="av-map-link"
                    href={`https://www.google.com/maps?q=${selectedLocation.coordinates.latitude},${selectedLocation.coordinates.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Maps
                  </a>
                </p>
              )}
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

      {/* Full-size view, opened from any thumbnail. */}
      <Modal
        isOpen={Boolean(photoViewer)}
        onClose={() => setPhotoViewer(null)}
        title={photoViewer?.label || 'Attendance photo'}
        size="lg"
      >
        {photoViewer && (
          <img
            className="av-photo-full"
            src={photoViewer.url}
            alt={photoViewer.label || 'Attendance photo'}
          />
        )}
      </Modal>
    </div>
  );
}
