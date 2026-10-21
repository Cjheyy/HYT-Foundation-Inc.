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
  getAbsenceRequests,
  createAbsenceRequest,
  isAbsenceNoted,
  isFinalAttendanceStatus,
  getAttendanceStage,
  normalizeStatus
} from '../../services/supabaseService';
import { checkGeofence, describeGeofenceFailure, GEOFENCE_MAX_ACCURACY_METERS, GEOFENCE_RADIUS_METERS, GEOFENCE_ENFORCEMENT_ENABLED } from '../../utils/geofence';
import { describeGeolocationError as describeLocationError, getCoordinatesWithFallback, getQuickCoordinates, isGeolocationError } from '../../utils/location';
import { formatDate, formatTime } from '../../utils/helpers';
import { getRoleTerms } from '../../utils/roleTerms';
import { computeExperienceSchedule, getApplicationListingKind } from '../../utils/experience';
import { toast } from 'react-toastify';
import './Attendance.css';

const POLL_INTERVAL_MS = 60_000;

// Re-exported for unit tests and shared callers.
export const describeGeolocationError = describeLocationError;

// Enforcing the geofence needs a precise fix, so accept the slow two-tier
// lookup.  With enforcement off we only need *some* coordinates - and waiting
// up to 15 s for a high-accuracy fix is what made Clock In feel slow.
const getCoordinates = () => (GEOFENCE_ENFORCEMENT_ENABLED
  ? getCoordinatesWithFallback()
  : getQuickCoordinates());

/**
 * Whether the user has something to clock in FOR.
 *
 * The OJT/Intern portal is gated on an approved OJT posting - that placement is
 * what a DTR belongs to. A Trainee joins a PROGRAMME instead, so requiring a
 * posting locked them out of their own Attendance page with "apply for an OJT
 * Posting", even though `request_clock_in` already accepts an approved
 * programme application.
 *
 * So the rule is: an approved PLACEMENT of either kind. An approved EVENT is
 * deliberately not enough in either portal - an event is a diary entry, not a
 * placement, and the database gate excludes it (`event_id IS NULL`).
 *
 * This mirrors the server exactly. Where they disagreed, the client won and the
 * trainee could never get past the button.
 */
export const hasApprovedPlacement = (applications = [], userId = null) => (applications || []).some((app) => {
  const owner = app.userId || app.studentId || app.user_id;
  if (userId && owner && owner !== userId) return false;
  const kind = getApplicationListingKind(app);
  if (kind === 'event') return false;
  const isPlacement = kind === 'opportunity' || kind === 'program';
  if (!isPlacement) return false;
  return ['APPROVED', 'ACCEPTED', 'ACTIVE'].includes(normalizeStatus(app.status));
});

// Two SEPARATE clock windows, defined once.
//   In : 09:00 -> 09:10   (9 AM, with a 10-minute grace)
//   Out: 18:00 -> 18:10   (6 PM, with a 10-minute grace)
// These are not one continuous span - a clock-in at 3 PM is refused.
//
// NOTE: the database does NOT enforce these windows. request_clock_in and
// request_clock_out only check the geofence, approval state and (for clock-out)
// that a CLOCKED_IN row exists. This block is therefore the whole rule, not the
// friendly half of it - changing it here does change behaviour.
const CLOCK_IN_OPENS_MINUTES = 9 * 60;          // 09:00
const CLOCK_IN_CLOSES_MINUTES = 9 * 60 + 10;    // 09:10
const CLOCK_OUT_OPENS_MINUTES = 18 * 60;        // 18:00
const CLOCK_OUT_CLOSES_MINUTES = 18 * 60 + 10;  // 18:10

/**
 * Per-window kill switches.
 *
 * The clock-in window is OFF for testing: you can clock in at any hour. The
 * clock-out window stays ON, because that half is what keeps a shift from being
 * closed at 10 AM on the day it opened.
 *
 * Flip either one independently - they are read by getWindowState() below and
 * by the banner copy further down, so nothing else needs touching.
 */
export const CLOCK_WINDOW_ENFORCEMENT = {
  clockIn: false,   // TESTING: clock-in allowed any time
  clockOut: true    // still 6:00-6:10 PM only
};

const getWindowState = () => {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const inClockInWindow = minutes >= CLOCK_IN_OPENS_MINUTES && minutes <= CLOCK_IN_CLOSES_MINUTES;
  const inClockOutWindow = minutes >= CLOCK_OUT_OPENS_MINUTES && minutes <= CLOCK_OUT_CLOSES_MINUTES;
  return {
    minutes,
    inClockInWindow,
    inClockOutWindow,
    isClockInOpen: CLOCK_WINDOW_ENFORCEMENT.clockIn ? inClockInWindow : true,
    isClockOutOpen: CLOCK_WINDOW_ENFORCEMENT.clockOut ? inClockOutWindow : true,
    clockInMessage: minutes < CLOCK_IN_OPENS_MINUTES
      ? 'The clock-in window opens at 9:00 AM.'
      : 'The clock-in window closed at 9:10 AM. You cannot clock in for today.',
    clockOutMessage: minutes < CLOCK_OUT_OPENS_MINUTES
      ? 'The clock-out window opens at 6:00 PM.'
      : 'The clock-out window closed at 6:10 PM. Today will be recorded as void.'
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
  const [absenceRequests, setAbsenceRequests] = useState([]);
  const [showAbsenceForm, setShowAbsenceForm] = useState(false);
  const [absenceForm, setAbsenceForm] = useState({ absenceDate: '', reason: '' });
  const [absenceErrors, setAbsenceErrors] = useState({});
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

  // Trainees get a plain time-in / time-out record: no approval pipeline
  // tracker, no overtime/extension request.  Absence reporting stays available
  // to both roles.
  const showApprovalPipeline = !terms.isTrainee;

  const loadAttendanceData = useCallback(async ({ showLoader = false } = {}) => {
    if (!currentUser?.id) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (showLoader) setLoading(true);
    try {
      const [todayResult, historyResult, requestsResult, profileResult, applicationsResult, absenceResult] = await Promise.allSettled([
        getTodayAttendance(currentUser.id),
        getAttendanceLogs(currentUser.id),
        getOtRequests(currentUser.id),
        getUserById(currentUser.id),
        getApplications(currentUser.id),
        getAbsenceRequests(currentUser.id)
      ]);
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      if (todayResult.status === 'rejected') throw todayResult.reason;
      if (historyResult.status === 'rejected') throw historyResult.reason;

      setTodayAttendance(todayResult.value || null);
      setAttendanceHistory(historyResult.value || []);
      setOtRequests(requestsResult.status === 'fulfilled' ? (requestsResult.value || []) : []);
      setAbsenceRequests(absenceResult.status === 'fulfilled' ? (absenceResult.value || []) : []);
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

    // The administrator's "Noted" reply arrives without a manual refresh.
    const absenceChannel = supabase
      ?.channel(`trainee-absence-${currentUser.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'absence_requests', filter: `user_id=eq.${currentUser.id}` },
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
      if (absenceChannel) supabase.removeChannel(absenceChannel);
    };
  }, [currentUser?.id, loadAttendanceData]);

  const status = normalizeStatus(todayAttendance?.status);
  const stage = getAttendanceStage(todayAttendance);
  const pendingClockIn = stage === 'CLOCK_IN';
  const pendingClockOut = stage === 'CLOCK_OUT';
  const activeClock = status === 'CLOCKED_IN';
  const finalState = isFinalAttendanceStatus(status);

  // Only the window that is actually switched on can produce a "closed"
  // sentence. With the clock-in limit off, printing "the clock-in window closed
  // at 9:10 AM" next to "clock-in is open any time" was both wrong and the only
  // thing a trainee would read.
  const windowNotice = activeClock
    ? (CLOCK_WINDOW_ENFORCEMENT.clockOut && !windowState.inClockOutWindow
      ? windowState.clockOutMessage
      : null)
    : (CLOCK_WINDOW_ENFORCEMENT.clockIn && !windowState.inClockInWindow
      ? windowState.clockInMessage
      : null);
  // A clock-in request is stamped by created_at (the row is born with the
  // request).  A clock-out request freezes pending_end_time at the moment it was
  // submitted, so that is the honest timestamp for that stage.
  const submittedAt = pendingClockOut
    ? (todayAttendance?.pendingEndTime || todayAttendance?.updatedAt || todayAttendance?.createdAt)
    : (todayAttendance?.createdAt || todayAttendance?.requestedAt || todayAttendance?.timeIn);
  const approvedPlacement = useMemo(
    () => hasApprovedPlacement(applications, currentUser?.id),
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

  /**
   * Days already attended, counted as distinct calendar days with an approved
   * log - a rejected or still-pending day must not inflate the figure.
   */
  const daysAttended = useMemo(() => {
    const approvedDates = new Set();
    (attendanceHistory || []).forEach((log) => {
      if (normalizeStatus(log.status) !== 'APPROVED') return;
      const day = String(log.date || '').slice(0, 10);
      if (day) approvedDates.add(day);
    });
    return approvedDates.size;
  }, [attendanceHistory]);

  /**
   * Start date: the profile's own start date when present, otherwise the
   * earliest approved attendance day.  The end date is derived from the hours
   * still to render, so it tracks the approved hours automatically.
   */
  const schedule = useMemo(() => {
    const dated = (attendanceHistory || [])
      .map((log) => String(log.date || '').slice(0, 10))
      .filter(Boolean)
      .sort();
    const startDate =
      currentUser?.startDate ||
      currentUser?.start_date ||
      dated[0] ||
      null;

    return computeExperienceSchedule({
      startDate,
      requiredHours: progress.required,
      renderedHours: progress.rendered
    });
  }, [attendanceHistory, currentUser?.startDate, currentUser?.start_date, progress]);

  const handleClockIn = () => {
    if (!approvedPlacement) {
      // Role-aware: a Trainee is told to join a programme, an OJT/Intern to
      // apply for a posting. The old hard-coded OJT sentence was shown to both.
      toast.warning(terms.attendanceLockedCopy);
      return;
    }
    if (!windowState.isClockInOpen) {
      toast.error(windowState.clockInMessage);
      return;
    }
    setShowClockInConfirm(true);
  };

  const executeClockIn = async () => {
    setActionLoading(true);
    try {
      if (!approvedPlacement) {
        throw new Error(terms.attendanceLockedCopy);
      }
      // Strict geofencing: browser fix first, IP fallback automatic. No dev override.
      const coordinates = await getCoordinates();

      if (coordinates.source !== 'ip' && coordinates.accuracy > GEOFENCE_MAX_ACCURACY_METERS) {
        toast.warning(`Location accuracy is ${Math.round(coordinates.accuracy)} meters.`);
      }
      // An IP lookup is a city-level guess (kilometres, not metres). It can
      // never satisfy a 20 m fence honestly, so it is refused outright instead
      // of being run through the distance check and passing by luck.
      if (GEOFENCE_ENFORCEMENT_ENABLED && coordinates.source === 'ip') {
        throw new Error(
          'We could only estimate your location from your network, which is not precise enough to confirm you are on site. Turn on location services (GPS) and try again.'
        );
      }
      const geofence = checkGeofence(
        coordinates.latitude,
        coordinates.longitude,
        GEOFENCE_RADIUS_METERS,
        coordinates.accuracy
      );
      // TESTING BYPASS: skip the distance block while GEOFENCE_ENFORCEMENT_ENABLED is false.
      // Re-enable by flipping the flag in src/utils/geofence.js before production.
      if (GEOFENCE_ENFORCEMENT_ENABLED && !geofence.allowed) {
        throw new Error(describeGeofenceFailure(geofence, { action: 'clock in' }));
      }
      const result = await clockIn(
        currentUser.id,
        coordinates.latitude,
        coordinates.longitude,
        coordinates.accuracy,
        coordinates.source
      );
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
    if (!windowState.isClockOutOpen) {
      toast.error(windowState.clockOutMessage);
      return;
    }
    setShowClockOutConfirm(true);
  };

  const executeClockOut = async () => {
    setActionLoading(true);
    try {
      // Clock-out is fenced too: the same 20 m rule that opens a shift closes
      // it. Coordinates go to request_clock_out, which re-checks them - the
      // client check below is the friendly half, not the authority.
      const frozenCoordinates = await getCoordinates();
      if (GEOFENCE_ENFORCEMENT_ENABLED && frozenCoordinates.source === 'ip') {
        throw new Error(
          'We could only estimate your location from your network, which is not precise enough to confirm you are on site. Turn on location services (GPS) and try again.'
        );
      }
      const geofence = checkGeofence(
        frozenCoordinates.latitude,
        frozenCoordinates.longitude,
        GEOFENCE_RADIUS_METERS,
        frozenCoordinates.accuracy
      );
      if (GEOFENCE_ENFORCEMENT_ENABLED && !geofence.allowed) {
        throw new Error(describeGeofenceFailure(geofence, { action: 'clock out' }));
      }
      const result = await clockOut(
        currentUser.id,
        frozenCoordinates.latitude,
        frozenCoordinates.longitude,
        frozenCoordinates.accuracy,
        frozenCoordinates.source
      );
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

  const validateAbsenceForm = () => {
    const nextErrors = {};
    if (!absenceForm.reason.trim() || absenceForm.reason.trim().length < 10) {
      nextErrors.reason = 'Please describe the reason (at least 10 characters).';
    }
    return nextErrors;
  };

  const handleAbsenceSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validateAbsenceForm();
    if (Object.keys(nextErrors).length) {
      setAbsenceErrors(nextErrors);
      return;
    }
    try {
      setActionLoading(true);
      await createAbsenceRequest({
        userId: currentUser.id,
        absenceDate: absenceForm.absenceDate || null,
        reason: absenceForm.reason.trim()
      });
      toast.success('Absence request sent to the administrator.');
      setShowAbsenceForm(false);
      setAbsenceForm({ absenceDate: '', reason: '' });
      setAbsenceErrors({});
      await loadAttendanceData();
    } catch (error) {
      toast.error(error.message || 'Failed to send the absence request');
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

        {!approvedPlacement && (
          <div className="alert alert-warning" style={{ marginBottom: '20px' }}>
            <strong>{terms.approvalRequiredTitle}</strong>
            <p style={{ margin: '8px 0 0', fontSize: '14px' }}>{terms.attendanceLockedCopy}</p>
          </div>
        )}

        {(!windowState.isClockInOpen || !windowState.isClockOutOpen) && (
          <div className="alert alert-warning" style={{ marginBottom: '20px' }}>
            <strong>Attendance windows</strong>
            <p style={{ margin: '8px 0 0', fontSize: '14px' }}>
              {CLOCK_WINDOW_ENFORCEMENT.clockIn
                ? 'Clock in between 9:00 AM and 9:10 AM'
                : 'Clock-in is open any time while the window limit is switched off'}
              {', and '}
              {CLOCK_WINDOW_ENFORCEMENT.clockOut
                ? 'clock out between 6:00 PM and 6:10 PM.'
                : 'clock-out is open any time.'}
              {' '}A day with no clock-out is recorded as void.
            </p>
            {windowNotice && (
              <p style={{ margin: '6px 0 0', fontSize: '14px' }}>{windowNotice}</p>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------
            Dashboard layout - the trainee's own summary rail.

            Ordering is chosen so the reading order stays: TODAY'S ATTENDANCE,
            the OT-progress card, OJT PROGRESS, the absence card, the OT
            request card, then attendance history.
            ------------------------------------------------------------------- */}
        <div className="attendance-dash">
          <div className="attendance-col">
          <Card className="today-attendance-card">
            <div className="card-header">
              <h2 className="card-title">Today's Attendance</h2>
              <span className="card-idx">01 / LIVE</span>
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

                <div className="today-live-row">
                  <div className="today-live-timer">
                    {todayAttendance.timeIn && (
                      <LiveTimeTracker
                        clockInTime={todayAttendance.timeIn}
                        isActive={activeClock}
                        isPaused={pendingClockOut}
                        frozenTime={todayAttendance.pendingEndTime}
                        frozenDurationSeconds={todayAttendance.durationSeconds}
                        showReset={finalState}
                      />
                    )}
                  </div>
                  <div className="today-live-status">
                    <span className="status-label">Status</span>
                    <Badge status={todayAttendance.status}>{statusLabel}</Badge>
                  </div>
                </div>

                <div className="today-kv">                  <div className="kv">
                    <span className="kv-k">Time In</span>
                    <span className="kv-v">
                      {todayAttendance.timeIn
                        ? formatTime(todayAttendance.timeIn)
                        : pendingClockIn ? 'Not started yet' : '-'}
                    </span>
                  </div>
                  <div className="kv">
                    <span className="kv-k">Time Out</span>
                    <span className="kv-v">
                      {pendingClockOut && todayAttendance.pendingEndTime
                        ? `${formatTime(todayAttendance.pendingEndTime)} (frozen)`
                        : todayAttendance.timeOut ? formatTime(todayAttendance.timeOut) : '--:--'}
                    </span>
                  </div>
                  <div className="kv">
                    <span className="kv-k">Hours Rendered</span>
                    <span className="kv-v is-strong">
                      {Number(todayAttendance.renderedHours || 0).toFixed(4)} hrs{pendingClockOut ? ' (pending)' : ''}
                    </span>
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

            <div className="attendance-actions">
              {!approvedPlacement ? (
                <div className="attendance-locked-message">
                  <strong>{terms.approvalRequiredTitle}</strong>
                  <span>{terms.attendanceLockedCopy}</span>
                </div>
              ) : !todayAttendance ? (
                <span className="today-cta"><Button onClick={handleClockIn} disabled={actionLoading || !windowState.isClockInOpen} size="lg">Clock In</Button></span>
              ) : activeClock ? (
                <span className="today-cta"><Button onClick={handleClockOut} disabled={actionLoading || !windowState.isClockOutOpen} variant="success" size="lg">Clock Out</Button></span>
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
            <div className="card-header">
              <h2 className="card-title">{terms.hoursTitle}</h2>
              <span className="card-idx">02</span>
            </div>
            {/* A Trainee is measured by the hours they have banked, not by a
                contractual target - so the Required / Remaining breakdown is
                hidden for that portal and only the approved milestone (plus
                the bar below) is shown.  The OJT/Intern portal still needs all
                three, so this stays role-aware rather than deleting them. */}
            <div className="progress-stats">
              {!terms.isTrainee && (
                <div className="stat-item"><span className="stat-label">Required Hours:</span><span className="stat-value">{progress.required.toFixed(2)} hrs</span></div>
              )}
              <div className="stat-item"><span className="stat-label">Approved Hours:</span><span className="stat-value success">{progress.rendered.toFixed(4)} hrs</span></div>
              {!terms.isTrainee && (
                <div className="stat-item"><span className="stat-label">Remaining Hours:</span><span className="stat-value warning">{progress.remaining.toFixed(4)} hrs</span></div>
              )}
            </div>
            {/* No target, no percentage. A Trainee has no required hours at
                all, and an OJT/Intern whose target has not been set yet had the
                same problem: the bar sat at 0% beside hours they had actually
                earned, which reads as "you have done nothing". Both now show
                only the banked figure until a target exists. */}
            {progress.required > 0 ? (
              <>
                <div className="progress-line">
                  <span className="progress-line-label">Progress</span>
                  <span className="progress-line-value">{progress.percentage.toFixed(1)}%</span>
                </div>
                <div className="progress-bar-container">
                  <div className="progress-bar" style={{ width: `${progress.percentage}%` }}><span className="progress-text">{progress.percentage.toFixed(1)}%</span></div>
                </div>
              </>
            ) : (
              <p className="summary-hint">
                {terms.isTrainee
                  ? 'Trainees have no target hours - every approved hour is simply banked.'
                  : 'No target hours have been set for you yet, so there is no percentage to show.'}
              </p>
            )}
          </Card>

          <Card className="attendance-history-card">
            <div className="card-header">
              <h2 className="card-title">Attendance History</h2>
              <span className="card-idx">06 / DTR</span>
            </div>
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

          <div className="attendance-col">
          <Card className="attendance-summary-card">
            <div className="card-header">
              <h2 className="card-title">{terms.progressLabel}</h2>
              <span className="card-idx">03</span>
            </div>
            <div className="attendance-summary-grid">
              <div className="summary-item">
                <span className="summary-label">Start Date</span>
                <span className="summary-value">
                  {schedule.startDate ? formatDate(schedule.startDate) : '--'}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Days Attended</span>
                <span className="summary-value">{daysAttended}</span>
              </div>
              {/* An end date is projected from the hours still to render, so it
                  only exists when there IS a target. A Trainee never has one,
                  and printing "--" plus "your required hours have not been set"
                  read like a fault on their account. */}
              {!terms.isTrainee && (
                <div className="summary-item">
                  <span className="summary-label">
                    {schedule.isComplete ? 'End Date' : 'Projected End Date'}
                  </span>
                  <span className="summary-value">
                    {schedule.endDate ? formatDate(schedule.endDate) : '--'}
                  </span>
                </div>
              )}
              {!terms.isTrainee && schedule.hasSchedule && !schedule.isComplete && (
                <div className="summary-item">
                  <span className="summary-label">Working Days Left</span>
                  <span className="summary-value">{schedule.workDaysRemaining}</span>
                </div>
              )}
            </div>
            {terms.isTrainee ? (
              <p className="summary-hint">
                Your {terms.progressNoun} is measured in approved hours only - there is no target to finish.
              </p>
            ) : !schedule.hasSchedule && (
              <p className="summary-hint">
                Your required hours have not been set yet, so an end date cannot be projected.
              </p>
            )}
          </Card>

          <Card className="absence-request-card">
            <div className="card-header">
              <h2 className="card-title">Report an Absence</h2>
              {!showAbsenceForm && <span className="card-idx">04</span>}
              {!showAbsenceForm && <Button onClick={() => setShowAbsenceForm(true)} size="sm">+ Report Absence</Button>}
            </div>
            <p className="absence-intro">
              Tell the administrator in advance that you cannot attend, and why. This is for
              their awareness only - they will reply <strong>Noted</strong> once they have seen it,
              and nothing is deducted from your hours.
            </p>

            {showAbsenceForm && (
              <form onSubmit={handleAbsenceSubmit} className="absence-form">
                <Input
                  label="Date of absence"
                  type="date"
                  value={absenceForm.absenceDate}
                  onChange={(event) => setAbsenceForm({ ...absenceForm, absenceDate: event.target.value })}
                />
                <div className="form-group">
                  <label className="form-label" htmlFor="absence-reason">Reason *</label>
                  <textarea
                    id="absence-reason"
                    className={`form-textarea ${absenceErrors.reason ? 'error' : ''}`}
                    value={absenceForm.reason}
                    onChange={(event) => {
                      setAbsenceForm({ ...absenceForm, reason: event.target.value });
                      setAbsenceErrors({ ...absenceErrors, reason: '' });
                    }}
                    rows="4"
                    placeholder="Explain briefly why you will not be able to attend."
                    required
                  />
                  {absenceErrors.reason && <div className="form-error">{absenceErrors.reason}</div>}
                </div>
                <div className="form-actions">
                  <Button type="submit" disabled={actionLoading}>Send to Administrator</Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowAbsenceForm(false);
                      setAbsenceForm({ absenceDate: '', reason: '' });
                      setAbsenceErrors({});
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            {absenceRequests.length > 0 ? (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr><th>Date</th><th>Reason</th><th>Status</th><th>Admin reply</th></tr>
                  </thead>
                  <tbody>
                    {absenceRequests.map((request) => (
                      <tr key={request.id}>
                        <td>{formatDate(request.absenceDate || request.createdAt)}</td>
                        <td>{request.reason}</td>
                        <td>
                          <Badge status={isAbsenceNoted(request) ? 'APPROVED' : 'PENDING'}>
                            {isAbsenceNoted(request) ? 'Noted' : 'Waiting for admin'}
                          </Badge>
                        </td>
                        <td>{request.adminNote || '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-state">No absence requests filed yet.</p>
            )}
          </Card>

          {showApprovalPipeline && (
          <Card className="ot-request-card">
            <div className="card-header">
              <h2 className="card-title">Overtime / Extension Request</h2>
              {!showOtForm && <span className="card-idx">05</span>}
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
          )}

          <RecentActivity logs={attendanceHistory} />
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Presentation-only digest of the attendance history.
 *
 * Reads the SAME `attendanceHistory` rows the DTR table already renders and
 * re-expresses them as a short log - it derives nothing new and touches no
 * request flow.  The label is the stored status verbatim, so no copy that the
 * submission/approval path produces is invented here.
 */
function RecentActivity({ logs }) {
  const rows = (logs || []).slice(0, 6);
  if (!rows.length) return null;

  return (
    <Card className="attendance-activity-card">
      <div className="card-header">
        <h2 className="card-title">Recent activity</h2>
        <span className="card-idx">LOG</span>
      </div>
      <ul className="activity-list">
        {rows.map((log) => (
          <li key={log.id} className="activity-row">
            <span className="activity-date">
              {formatDate(log.date)}
              {' · '}
              {log.timeIn ? formatTime(log.timeIn) : '--:--'}
            </span>
            <span className="activity-tag">
              <Badge status={log.status}>{log.status || 'UNKNOWN'}</Badge>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
