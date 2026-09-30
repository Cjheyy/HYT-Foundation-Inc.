import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../config/supabase';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Badge } from '../../components/Badge';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { LiveTimeTracker } from '../../components/LiveTimeTracker';
import { Skeleton } from '../../components/Skeleton';
import { AttendanceStepper } from '../../components/AttendanceStepper';
import {
  getAttendanceLogs,
  getApplications,
  getUserById,
  clockIn,
  clockOut,
  getTodayAttendance,
  getOtRequests,
  createOtRequest,
  isFinalAttendanceStatus,
  getAttendanceStage,
  normalizeStatus
} from '../../services/supabaseService';
import { checkGeofence, GEOFENCE_RADIUS_METERS, GEOFENCE_ENFORCEMENT_ENABLED } from '../../utils/geofence';
import { describeGeolocationError as describeLocationError, getCoordinatesWithFallback, getQuickCoordinates, isGeolocationError } from '../../utils/location';
import { formatDate, formatTime } from '../../utils/helpers';
import { getRoleTerms } from '../../utils/roleTerms';
import { toast } from 'react-toastify';
import './Attendance.css';

const POLL_INTERVAL_MS = 60_000;

// Re-exported for unit tests and shared callers.
export const describeGeolocationError = describeLocationError;

// Enforcing the geofence needs a precise fix, so accept the slow two-tier
// lookup.  With enforcement off we only need *some* coordinates — and waiting
// up to 15 s for a high-accuracy fix is what made Clock In feel slow.
const getCoordinates = () => (GEOFENCE_ENFORCEMENT_ENABLED
  ? getCoordinatesWithFallback()
  : getQuickCoordinates());

export const hasApprovedOjtPosting = (applications = [], userId = null) => (applications || []).some((app) => {
  const owner = app.userId || app.studentId;
  if (userId && owner && owner !== userId) return false;
  const isOjtPosting = Boolean(app.opportunityId || app.opportunity_id || String(app.type || '').toUpperCase() === 'OPPORTUNITY');
  if (!isOjtPosting) return false;
  return ['APPROVED', 'ACCEPTED', 'ACTIVE'].includes(normalizeStatus(app.status));
});

const getWindowState = () => {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  return {
    minutes,
    isOpen: minutes >= 8 * 60 + 55 && minutes <= 18 * 60 + 5,
    message: minutes < 8 * 60 + 55
      ? 'Attendance window opens at 8:55 AM'
      : 'Attendance window closed at 6:05 PM'
  };
};

export function AttendanceNew() {
  const { state, dispatch } = useApp();
  const { currentUser } = state;
  // This page is shared by the OJT/Intern and Trainee portals, so every label
  // that mentions "OJT" comes from the role terms map.
  const terms = getRoleTerms(currentUser?.role);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [applications, setApplications] = useState(state.applications || []);
  const [otRequests, setOtRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showClockInConfirm, setShowClockInConfirm] = useState(false);
  const [showClockOutConfirm, setShowClockOutConfirm] = useState(false);
  const [showOtForm, setShowOtForm] = useState(false);
  const [otFormData, setOtFormData] = useState({ requestedHours: '', reason: '' });
  const [otErrors, setOtErrors] = useState({});
  const [windowState, setWindowState] = useState(getWindowState);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  const loadAttendanceData = useCallback(async ({ showLoader = false } = {}) => {
    if (!currentUser?.id) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (showLoader) setLoading(true);
    try {
      const [todayResult, historyResult, requestsResult, profileResult, applicationsResult] = await Promise.allSettled([
        getTodayAttendance(currentUser.id),
        getAttendanceLogs(currentUser.id),
        getOtRequests(currentUser.id),
        getUserById(currentUser.id),
        getApplications(currentUser.id)
      ]);
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      if (todayResult.status === 'rejected') throw todayResult.reason;
      if (historyResult.status === 'rejected') throw historyResult.reason;

      setTodayAttendance(todayResult.value || null);
      setAttendanceHistory(historyResult.value || []);
      setOtRequests(requestsResult.status === 'fulfilled' ? (requestsResult.value || []) : []);
      if (applicationsResult.status === 'fulfilled') {
        setApplications(applicationsResult.value || []);
      } else if (Array.isArray(state.applications)) {
        setApplications(state.applications);
      }
      if (profileResult.status === 'fulfilled' && profileResult.value) {
        dispatch({ type: 'UPDATE_USER', payload: profileResult.value });
      }
    } catch (error) {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      console.error('Error loading attendance:', error);
      toast.error('Failed to load attendance data');
    } finally {
      if (mountedRef.current && showLoader && requestId === requestIdRef.current) setLoading(false);
    }
  }, [currentUser?.id, dispatch, state.applications]);

  useEffect(() => {
    if (!currentUser?.id) return undefined;
    mountedRef.current = true;
    loadAttendanceData({ showLoader: true });
    let refreshTimer;
    const refresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        if (mountedRef.current) loadAttendanceData();
      }, 120);
    };
    const attendanceChannel = supabase
      ?.channel(`trainee-attendance-${currentUser.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_logs', filter: `user_id=eq.${currentUser.id}` },
        refresh
      )
      .subscribe();
    const userChannel = supabase
      ?.channel(`trainee-hours-${currentUser.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${currentUser.id}` },
        refresh
      )
      .subscribe();

    // Realtime alone can leave a stale status behind when the publication is
    // missing, the socket drops, or the tab was asleep during an approval.
    const pollTimer = window.setInterval(() => loadAttendanceData(), POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') loadAttendanceData();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(refreshTimer);
      window.clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      if (attendanceChannel) supabase.removeChannel(attendanceChannel);
      if (userChannel) supabase.removeChannel(userChannel);
    };
  }, [currentUser?.id, loadAttendanceData]);

  const status = normalizeStatus(todayAttendance?.status);
  const stage = getAttendanceStage(todayAttendance);
  const pendingClockIn = stage === 'CLOCK_IN';
  const pendingClockOut = stage === 'CLOCK_OUT';
  const activeClock = status === 'CLOCKED_IN';
  const finalState = isFinalAttendanceStatus(status);
  // A clock-in request is stamped by created_at (the row is born with the
  // request).  A clock-out request freezes pending_end_time at the moment it was
  // submitted, so that is the honest timestamp for that stage.
  const submittedAt = pendingClockOut
    ? (todayAttendance?.pendingEndTime || todayAttendance?.updatedAt || todayAttendance?.createdAt)
    : (todayAttendance?.createdAt || todayAttendance?.requestedAt || todayAttendance?.timeIn);
  const approvedOjtPosting = useMemo(
    () => hasApprovedOjtPosting(applications, currentUser?.id),
    [applications, currentUser?.id]
  );
  useEffect(() => {
    const timer = window.setInterval(() => setWindowState(getWindowState()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const progress = useMemo(() => {
    const required = Number(currentUser?.requiredHours || 0);
    const rendered = Number(currentUser?.renderedHours || 0);
    const remaining = Math.max(0, required - rendered);
    const percentage = required > 0 ? Math.min(100, (rendered / required) * 100) : 0;
    return { required, rendered, remaining, percentage };
  }, [currentUser?.requiredHours, currentUser?.renderedHours]);

  const handleClockIn = () => {
    if (!approvedOjtPosting) {
      toast.warning('Please apply for an OJT Posting and wait for Admin acceptance before clocking in.');
      return;
    }
    if (!windowState.isOpen) {
      toast.error(windowState.message);
      return;
    }
    setShowClockInConfirm(true);
  };

  const executeClockIn = async () => {
    setActionLoading(true);
    try {
      if (!approvedOjtPosting) {
        throw new Error('Please apply for an OJT Posting and wait for Admin approval before clocking in.');
      }
      // Strict geofencing: browser fix first, IP fallback automatic. No dev override.
      const coordinates = await getCoordinates();

      if (coordinates.source !== 'ip' && coordinates.accuracy > 50) {
        toast.warning(`Location accuracy is ${Math.round(coordinates.accuracy)} meters.`);
      }
      const geofence = checkGeofence(coordinates.latitude, coordinates.longitude, GEOFENCE_RADIUS_METERS);
      // TESTING BYPASS: skip the distance block while GEOFENCE_ENFORCEMENT_ENABLED is false.
      // Re-enable by flipping the flag in src/utils/geofence.js before production.
      if (GEOFENCE_ENFORCEMENT_ENABLED && !geofence.allowed) {
        const away = geofence.distance != null ? Math.round(geofence.distance) : null;
        throw new Error(
          away != null
            ? `You are currently ${away} meters away from the nearest approved office.`
            : 'You must be within 100 meters of an approved HYT location to clock in.'
        );
      }
      const result = await clockIn(currentUser.id, coordinates.latitude, coordinates.longitude);
      setTodayAttendance(result);
      toast.success('Application submitted successfully.');
      await loadAttendanceData();
    } catch (error) {
      // Geolocation hints are toasted once by ConfirmationModal; every other
      // failure (geofence, approval, database) is reported here with its real
      // message.
      if (!isGeolocationError(error)) {
        toast.error(error.message || 'Failed to submit clock-in request');
      }
      // Re-throw so ConfirmationModal keeps the dialog open for a retry.
      throw error;
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = () => {
    if (!activeClock) return;
    setShowClockOutConfirm(true);
  };

  const executeClockOut = async () => {
    setActionLoading(true);
    try {
      // TESTING BYPASS: skip the distance block while GEOFENCE_ENFORCEMENT_ENABLED is false.
      const frozenCoordinates = await getCoordinates();
      const geofence = checkGeofence(frozenCoordinates.latitude, frozenCoordinates.longitude, GEOFENCE_RADIUS_METERS);
      if (GEOFENCE_ENFORCEMENT_ENABLED && !geofence.allowed) {
        const away = geofence.distance != null ? Math.round(geofence.distance) : null;
        throw new Error(
          away != null
            ? `You are currently ${away} meters away from the nearest approved office.`
            : 'You must be within 100 meters of an approved HYT location to clock in.'
        );
      }
      const result = await clockOut(currentUser.id);
      setTodayAttendance(result);
      toast.success('Application submitted successfully.');
      await loadAttendanceData();
    } catch (error) {
      if (!isGeolocationError(error)) {
        toast.error(error.message || 'Failed to submit clock-out request');
      }
      // Re-throw so ConfirmationModal keeps the dialog open for a retry.
      throw error;
    } finally {
      setActionLoading(false);
    }
  };

  const validateOtForm = () => {
    const nextErrors = {};
    const hours = Number(otFormData.requestedHours);
    if (!otFormData.requestedHours || hours < 0.5 || hours > 8) {
      nextErrors.requestedHours = 'Hours must be between 0.5 and 8';
    }
    if (!otFormData.reason.trim() || otFormData.reason.trim().length < 10) {
      nextErrors.reason = 'Please provide a detailed reason (at least 10 characters)';
    }
    return nextErrors;
  };

  const handleOtSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validateOtForm();
    if (Object.keys(nextErrors).length) {
      setOtErrors(nextErrors);
      return;
    }
    try {
      setActionLoading(true);
      await createOtRequest({
        userId: currentUser.id,
        attendanceId: todayAttendance?.id || null,
        requestedHours: Number(otFormData.requestedHours),
        reason: otFormData.reason.trim()
      });
      toast.success('Overtime/extension request submitted.');
      setShowOtForm(false);
      setOtFormData({ requestedHours: '', reason: '' });
      setOtErrors({});
      await loadAttendanceData();
    } catch (error) {
      toast.error(error.message || 'Failed to submit request');
    } finally {
      setActionLoading(false);
    }
  };

  if (!currentUser) return null;
  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <Skeleton width="40%" height={28} style={{ marginBottom: 8 }} />
          <Skeleton width="60%" height={14} />
        </div>
        <Card className="today-attendance-card">
          <Skeleton width="35%" height={20} style={{ marginBottom: 16 }} />
          <Skeleton width="100%" height={72} style={{ marginBottom: 12 }} />
          <Skeleton width="60%" height={44} />
        </Card>
      </div>
    );
  }

  const statusLabel = pendingClockIn
    ? 'Pending Admin Approval'
    : pendingClockOut
      ? 'Clock-out pending approval'
      : status || 'NOT STARTED';

  return (
    <>
      <ConfirmationModal
        isOpen={showClockInConfirm}
        onClose={() => setShowClockInConfirm(false)}
        onConfirm={executeClockIn}
        title="Submit Clock-in Request"
        message="Your timer will not start until an administrator approves this request."
        confirmText="Submit Request"
        cancelText="Cancel"
        type="info"
        loading={actionLoading}
      />
      <ConfirmationModal
        isOpen={showClockOutConfirm}
        onClose={() => setShowClockOutConfirm(false)}
        onConfirm={executeClockOut}
        title="Submit Clock-out Request"
        message="Your running timer will freeze immediately. Hours are credited only after administrator approval."
        confirmText="Freeze & Submit"
        cancelText="Cancel"
        type="success"
        loading={actionLoading}
      />

      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">Attendance & DTR</h1>
          <p className="page-subtitle">{terms.attendanceSubtitle}</p>
        </div>

        {!approvedOjtPosting && (
          <div className="alert alert-warning" style={{ marginBottom: '20px' }}>
            <strong>{terms.approvalRequiredTitle}</strong>
            <p style={{ margin: '8px 0 0', fontSize: '14px' }}>{terms.attendanceLockedCopy}</p>
          </div>
        )}

        {!windowState.isOpen && (
          <div className="alert alert-warning" style={{ marginBottom: '20px' }}>
            <strong>{windowState.message}</strong>
            <p style={{ margin: '8px 0 0', fontSize: '14px' }}>Attendance requests are accepted between 8:55 AM and 6:05 PM.</p>
          </div>
        )}

        <Card className="today-attendance-card">
          <div className="card-header">
            <h2 className="card-title">Today's Attendance</h2>
            <span className="card-date">{formatDate(new Date())}</span>
          </div>

          {todayAttendance ? (
            <div className="attendance-status">
              {(pendingClockIn || pendingClockOut) && (
                <AttendanceStepper
                  submittedAt={submittedAt}
                  stage={pendingClockOut ? 'CLOCK_OUT' : 'CLOCK_IN'}
                />
              )}
              <div className="status-grid">
                <div className="status-item">
                  <span className="status-label">Time In:</span>
                  <span className="status-value">
                    {todayAttendance.timeIn
                      ? formatTime(todayAttendance.timeIn)
                      : pendingClockIn ? 'Not started yet' : '—'}
                  </span>
                </div>
                <div className="status-item">
                  <span className="status-label">Time Out:</span>
                  <span className="status-value">
                    {pendingClockOut && todayAttendance.pendingEndTime
                      ? `${formatTime(todayAttendance.pendingEndTime)} (frozen)`
                      : todayAttendance.timeOut ? formatTime(todayAttendance.timeOut) : '--:--'}
                  </span>
                </div>
                <div className="status-item">
                  <span className="status-label">Hours Rendered:</span>
                  <span className="status-value highlight">
                    {Number(todayAttendance.renderedHours || 0).toFixed(4)} hrs{pendingClockOut ? ' (pending)' : ''}
                  </span>
                </div>
                <div className="status-item">
                  <span className="status-label">Status:</span>
                  <Badge status={todayAttendance.status}>{statusLabel}</Badge>
                </div>
              </div>

              {pendingClockIn && (
                <div className="attendance-notice pending-notice">
                  <strong>Clock-in request submitted. Waiting for Admin approval.</strong>
                  <div>Your timer has not started. It will start automatically after the request is accepted.</div>
                </div>
              )}
              {activeClock && (
                <div className="attendance-notice active-notice">
                  <strong>You are currently clocked in</strong>
                  <div>Your live timer is running. Clock out when your work shift is complete.</div>
                </div>
              )}
              {pendingClockOut && (
                <div className="attendance-notice pending-notice">
                  <strong>Clock-out request submitted. Waiting for Admin approval.</strong>
                  <div>Your timer is frozen at <strong>{Number(todayAttendance.renderedHours || 0).toFixed(4)} hours</strong>. Approved hours will be added to your {terms.progressNoun} after review.</div>
                </div>
              )}
              {status === 'APPROVED' && (
                <div className="attendance-notice approved-notice">
                  <strong>Attendance approved</strong>
                  <div>Your approved hours have been added to {terms.progressNoun}. Your live timer is reset for the next day.</div>
                </div>
              )}
              {status === 'REJECTED' && (
                <div className="attendance-notice rejected-notice">
                  <strong>Attendance rejected</strong>
                  <div>{todayAttendance.adminNote || 'No hours were credited. Please contact an administrator.'}</div>
                </div>
              )}
              {status === 'VOID' && (
                <div className="attendance-notice rejected-notice">
                  <strong>Attendance voided</strong>
                  <div>This request was closed automatically and no hours were credited.</div>
                </div>
              )}
            </div>
          ) : <p className="no-attendance">No attendance request submitted today.</p>}

          {todayAttendance?.timeIn && (
            <LiveTimeTracker
              clockInTime={todayAttendance.timeIn}
              isActive={activeClock}
              isPaused={pendingClockOut}
              frozenTime={todayAttendance.pendingEndTime}
              frozenDurationSeconds={todayAttendance.durationSeconds}
              showReset={finalState}
            />
          )}

          <div className="attendance-actions">
            {!approvedOjtPosting ? (
              <div className="attendance-locked-message">
                <strong>{terms.approvalRequiredTitle}</strong>
                <span>{terms.attendanceLockedCopy}</span>
              </div>
            ) : !todayAttendance ? (
              <Button onClick={handleClockIn} disabled={actionLoading || !windowState.isOpen} size="lg">Clock In</Button>
            ) : activeClock ? (
              <Button onClick={handleClockOut} disabled={actionLoading} variant="success" size="lg">Clock Out</Button>
            ) : pendingClockIn || pendingClockOut ? (
              <div className="attendance-locked-message">
                <strong>Timer waiting for Admin approval</strong>
                <span>You cannot submit another attendance request today.</span>
              </div>
            ) : (
              <div className="attendance-locked-message final-message">
                <strong>{status === 'APPROVED' ? 'Attendance approved' : status === 'REJECTED' ? 'Attendance rejected' : 'Attendance closed'}</strong>
                <span>Clock-in is locked until the next calendar day.</span>
              </div>
            )}
          </div>
        </Card>

        <Card className="hours-progress-card">
          <div className="card-header"><h2 className="card-title">{terms.hoursTitle}</h2></div>
          <div className="progress-stats">
            <div className="stat-item"><span className="stat-label">Required Hours:</span><span className="stat-value">{progress.required.toFixed(2)} hrs</span></div>
            <div className="stat-item"><span className="stat-label">Approved Hours:</span><span className="stat-value success">{progress.rendered.toFixed(4)} hrs</span></div>
            <div className="stat-item"><span className="stat-label">Remaining Hours:</span><span className="stat-value warning">{progress.remaining.toFixed(4)} hrs</span></div>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${progress.percentage}%` }}><span className="progress-text">{progress.percentage.toFixed(1)}%</span></div>
          </div>
        </Card>

        <Card className="ot-request-card">
          <div className="card-header">
            <h2 className="card-title">Overtime / Extension Request</h2>
            {!showOtForm && <Button onClick={() => setShowOtForm(true)} size="sm">+ Request OT</Button>}
          </div>
          {showOtForm && (
            <form onSubmit={handleOtSubmit} className="ot-form">
              <Input
                label="Requested Hours"
                type="number"
                step="0.5"
                min="0.5"
                max="8"
                value={otFormData.requestedHours}
                onChange={(event) => { setOtFormData({ ...otFormData, requestedHours: event.target.value }); setOtErrors({ ...otErrors, requestedHours: '' }); }}
                error={otErrors.requestedHours}
                required
              />
              <div className="form-group">
                <label className="form-label" htmlFor="ot-reason">Reason for Extension *</label>
                <textarea id="ot-reason" className={`form-textarea ${otErrors.reason ? 'error' : ''}`} value={otFormData.reason} onChange={(event) => { setOtFormData({ ...otFormData, reason: event.target.value }); setOtErrors({ ...otErrors, reason: '' }); }} rows="4" required />
                {otErrors.reason && <div className="form-error">{otErrors.reason}</div>}
              </div>
              <div className="form-actions">
                <Button type="submit" disabled={actionLoading}>Submit Request</Button>
                <Button type="button" variant="ghost" onClick={() => { setShowOtForm(false); setOtFormData({ requestedHours: '', reason: '' }); setOtErrors({}); }}>Cancel</Button>
              </div>
            </form>
          )}
          {otRequests.length > 0 ? (
            <div className="table-responsive">
              <table className="data-table">
                <thead><tr><th>Date</th><th>Hours</th><th>Reason</th><th>Status</th><th>Admin note</th></tr></thead>
                <tbody>{otRequests.map((request) => <tr key={request.id}><td>{formatDate(request.createdAt)}</td><td>+{request.requestedHours} hrs</td><td>{request.reason}</td><td><Badge status={request.status}>{request.status}</Badge></td><td>{request.adminNote || '--'}</td></tr>)}</tbody>
              </table>
            </div>
          ) : <p className="empty-state">No OT requests yet.</p>}
        </Card>

        <Card className="attendance-history-card">
          <div className="card-header"><h2 className="card-title">Attendance History</h2></div>
          {attendanceHistory.length > 0 ? (
            <div className="table-responsive">
              <table className="data-table">
                <thead><tr><th>Date</th><th>Time In</th><th>Time Out</th><th>Hours</th><th>Status</th><th>Admin note</th></tr></thead>
                <tbody>{attendanceHistory.map((log) => <tr key={log.id}><td>{formatDate(log.date)}</td><td>{log.timeIn ? formatTime(log.timeIn) : '--:--'}</td><td>{log.timeOut ? formatTime(log.timeOut) : '--:--'}</td><td>{Number(log.renderedHours || 0).toFixed(4)} hrs</td><td><Badge status={log.status}>{log.status}</Badge></td><td>{log.adminNote || '--'}</td></tr>)}</tbody>
              </table>
            </div>
          ) : <p className="empty-state">No attendance records yet.</p>}
        </Card>
      </div>
    </>
  );
}
