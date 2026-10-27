import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../config/supabase';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Badge } from '../../components/Badge';
import { TimestampCamera } from '../../components/TimestampCamera';
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
  getAbsenceDecision,
  getAbsenceDecisionTone,
  isFinalAttendanceStatus,
  getAttendanceStage,
  normalizeStatus,
  uploadAttendancePhoto
} from '../../services/supabaseService';
import { checkGeofence, describeGeofenceFailure, GEOFENCE_MAX_ACCURACY_METERS, GEOFENCE_RADIUS_METERS, GEOFENCE_ENFORCEMENT_ENABLED, GEOFENCE_DEV_BYPASS, DEV_BYPASS_FIX, OFFICE_LOCATIONS } from '../../utils/geofence';
import { describeGeolocationError as describeLocationError, getCoordinatesWithFallback, getQuickCoordinates, isGeolocationError } from '../../utils/location';
import { stampPhotoBlob } from '../../utils/attendancePhoto';
import { buildStampLines } from '../../utils/stampLines';
import { formatDate, formatTime } from '../../utils/helpers';
import { getRoleTerms } from '../../utils/roleTerms';
import {
  computeExperienceSchedule,
  countAcceptedAbsenceDays,
  hasApprovedPlacement
} from '../../utils/experience';
import {
  getClockOutReminder,
  getClockOutWindow,
  requestDesktopNotificationPermission,
  showDesktopNotification
} from '../../utils/clockReminder';
import { toast } from 'react-toastify';
import './Attendance.css';

const POLL_INTERVAL_MS = 60_000;
// The reminder has to land inside a five-minute window, so the clock is checked
// more often than the data is.
const REMINDER_TICK_MS = 30_000;
const REMINDER_FLAG_PREFIX = 'hyt:clockout-reminded:';

// Re-exported for unit tests and shared callers.
export const describeGeolocationError = describeLocationError;

// Enforcing the geofence needs a precise fix, so accept the slow two-tier
// lookup.  With enforcement off we only need *some* coordinates - and waiting
// up to 15 s for a high-accuracy fix is what made Clock In feel slow.
const getCoordinates = () => (GEOFENCE_ENFORCEMENT_ENABLED
  ? getCoordinatesWithFallback()
  : getQuickCoordinates());

// Re-exported for unit tests and shared callers.  The rule itself now lives in
// utils/experience so the Daily Reports page can gate on exactly the same thing
// without importing this page.
export { hasApprovedPlacement };

// Two SEPARATE rules, defined once.
//   In : 09:00 -> 09:10   (9 AM, with a 10-minute grace)
//   Out: any time -> 18:30  (a shift may be closed whenever it ends, but never
//                            after 6:30 PM)
//
// Clock-out used to be a 6:00-6:10 PM window, which made an early finish
// impossible: someone who worked 9-2 had to sit and wait until 6 PM to close a
// shift that had already ended. The cutoff is the real rule - the start of the
// window never was.
//
// NOTE: the database now enforces the 6:30 PM cutoff too, inside
// request_clock_out (see PATCH_CLOCKOUT_CUTOFF.sql). This block is the friendly
// half - it can say no before the button is pressed. The database is the
// authority, and it cannot be bypassed from the browser or by changing the
// system clock.
const CLOCK_IN_OPENS_MINUTES = 9 * 60;          // 09:00
const CLOCK_IN_CLOSES_MINUTES = 9 * 60 + 10;    // 09:10

/**
 * Per-window kill switches.
 *
 * The clock-in window is OFF for testing: you can clock in at any hour. The
 * clock-out cutoff stays ON, because that half is what keeps a shift from being
 * closed at 10 AM on the day it opened - and it is the half the database
 * enforces.
 *
 * Flip either one independently - they are read by getWindowState() below and
 * by the banner copy further down, so nothing else needs touching.
 */
export const CLOCK_WINDOW_ENFORCEMENT = {
  clockIn: false,   // TESTING: clock-in allowed any time
  clockOut: true    // still a hard 6:30 PM cutoff
};

const getWindowState = () => {
  const now = new Date();
  const clockOut = getClockOutWindow(now);
  const minutes = clockOut.minutes;
  const inClockInWindow = minutes >= CLOCK_IN_OPENS_MINUTES && minutes <= CLOCK_IN_CLOSES_MINUTES;
  return {
    minutes,
    inClockInWindow,
    inClockOutWindow: clockOut.isOpen,
    isClockInOpen: CLOCK_WINDOW_ENFORCEMENT.clockIn ? inClockInWindow : true,
    isClockOutOpen: CLOCK_WINDOW_ENFORCEMENT.clockOut ? clockOut.isOpen : true,
    clockInMessage: minutes < CLOCK_IN_OPENS_MINUTES
      ? 'The clock-in window opens at 9:00 AM.'
      : 'The clock-in window closed at 9:10 AM. You cannot clock in for today.',
    clockOutMessage: `Clock-out closed at ${clockOut.cutoffLabel}. Today can no longer be closed from the portal - ask an administrator to record it for you.`
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
  // Which request the camera is currently collecting a photo for.  `null` means
  // the dialog is closed.  The coordinates are resolved BEFORE the camera opens
  // so an off-site attempt is refused without asking for a selfie first.
  const [cameraAction, setCameraAction] = useState(null);
  const [pendingCoordinates, setPendingCoordinates] = useState(null);
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
   *
   * Accepted absences are added back on top.  A day the administrator has
   * accepted as absent renders no hours, so the projection has to move out by
   * that day - otherwise the end date quietly assumes the trainee will make up
   * time they were excused from, and it drifts earlier with every illness.
   *
   * The count depends on the window, and the window depends on the count, so
   * this settles in two passes: project once, count the accepted absences that
   * fall inside that projection, project again with them included. Two passes
   * is enough - each one can only move the date later, and the second pass
   * already covers everything the first one revealed.
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

    const project = (absenceDays) => computeExperienceSchedule({
      startDate,
      requiredHours: progress.required,
      renderedHours: progress.rendered,
      absenceDays
    });

    const first = project(0);
    const firstPass = countAcceptedAbsenceDays(absenceRequests, {
      from: first.startDate,
      to: first.endDate
    });
    if (!firstPass) return first;

    const second = project(firstPass);
    const secondPass = countAcceptedAbsenceDays(absenceRequests, {
      from: second.startDate,
      to: second.endDate
    });
    return secondPass === firstPass ? second : project(secondPass);
  }, [absenceRequests, attendanceHistory, currentUser?.startDate, currentUser?.start_date, progress]);

  /**
   * The 5-minutes-to-6:30 reminder.
   *
   * Fires once per day per browser, only while a shift is actually open. The
   * flag is stored per user and per date so a reload, a route change or a
   * second tab cannot turn it into a loop. A ref mirrors it so the interval is
   * not rebuilt every time the flag flips.
   */
  const reminderFiredRef = useRef(false);

  useEffect(() => {
    if (!currentUser?.id) return undefined;
    const today = new Date();
    const flagKey = `${REMINDER_FLAG_PREFIX}${currentUser.id}:${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    let alreadyReminded = reminderFiredRef.current;
    try {
      alreadyReminded = alreadyReminded || window.localStorage.getItem(flagKey) === '1';
    } catch (error) {
      // Private browsing: the in-memory flag still stops a repeat this session.
      alreadyReminded = reminderFiredRef.current;
    }
    reminderFiredRef.current = alreadyReminded;
    requestDesktopNotificationPermission();

    const tick = () => {
      const reminder = getClockOutReminder({
        now: new Date(),
        isClockedIn: activeClock,
        alreadyReminded: reminderFiredRef.current
      });
      if (!reminder.isDue) return;

      reminderFiredRef.current = true;
      try {
        window.localStorage.setItem(flagKey, '1');
      } catch (error) {
        /* the in-memory flag still stops a repeat this session */
      }
      toast.warning(reminder.message, { autoClose: 12000 });
      showDesktopNotification('Clock-out closes soon', reminder.message);
    };

    tick();
    const timer = window.setInterval(tick, REMINDER_TICK_MS);
    return () => window.clearInterval(timer);
  }, [activeClock, currentUser?.id]);

  /**
   * Resolve the fix and apply the fence, BEFORE the camera opens.
   *
   * Order matters for two reasons. First, asking someone standing in MOA for a
   * selfie and only then telling them they are 10 km away wastes their time.
   * Second, the coordinates are needed for the stamp, so they have to exist
   * before the photo is taken rather than after.
   *
   * Throws with the sentence the trainee should read; the caller decides
   * whether to toast it or let it bubble.
   */
  const resolveCoordinates = async (actionLabel) => {
    // Localhost only (see GEOFENCE_DEV_BYPASS). A laptop reports a Wi-Fi/IP fix
    // good to kilometres, so the fence cannot pass reliably here and the camera
    // and admin flow below could never be exercised. The deployed build has
    // this branch removed at compile time.
    //
    // Deliberately silent: a banner on every dev clock-in is noise. The row is
    // labelled "Dev test" in the admin queue, which is where it matters.
    if (GEOFENCE_DEV_BYPASS) {
      return {
        coordinates: { ...DEV_BYPASS_FIX },
        geofence: {
          allowed: true,
          distance: 0,
          location: OFFICE_LOCATIONS[0].name,
          accuracy: DEV_BYPASS_FIX.accuracy,
          reason: 'dev-bypass',
          bypassed: true
        }
      };
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
    // Enforcement is ON (src/utils/geofence.js). The server applies the same
    // rule inside request_clock_in, driven by
    // settings.geofence_enforcement_enabled - this is the friendly half only.
    if (GEOFENCE_ENFORCEMENT_ENABLED && !geofence.allowed) {
      throw new Error(describeGeofenceFailure(geofence, { action: actionLabel }));
    }

    return { coordinates, geofence };
  };

  const openCamera = async (action, actionLabel) => {
    setActionLoading(true);
    try {
      const resolved = await resolveCoordinates(actionLabel);
      setPendingCoordinates(resolved);
      setCameraAction(action);
    } catch (error) {
      toast.error(isGeolocationError(error)
        ? describeLocationError(error)
        : error.message || 'Could not confirm your location.');
    } finally {
      setActionLoading(false);
    }
  };

  const closeCamera = () => {
    setCameraAction(null);
    setPendingCoordinates(null);
  };

  /**
   * Stamp the captured frame with SERVER facts and store it.
   *
   * Runs after the request has already been accepted, which is what lets the
   * stamp carry `requested_at` / `pending_end_time` instead of the device
   * clock. Every failure here is swallowed: the attendance record is already
   * written, and telling the trainee "failed" would invite a duplicate
   * submission for a day that is already logged.
   */
  const saveAttendancePhoto = async ({ attendanceId, photoBlob, action, resolved, at }) => {
    if (!photoBlob || !attendanceId) return;
    try {
      const stamp = buildStampLines({
        action,
        at: at || new Date(),
        locationName: resolved?.geofence?.location || null,
        latitude: resolved?.coordinates?.latitude,
        longitude: resolved?.coordinates?.longitude,
        distanceMeters: resolved?.geofence?.distance,
        accuracyMeters: resolved?.coordinates?.accuracy,
        userName: currentUser?.fullName,
        roleLabel: terms.roleLabel
      });
      const stamped = await stampPhotoBlob(photoBlob, stamp);
      const { recorded } = await uploadAttendancePhoto({
        userId: currentUser.id,
        attendanceId,
        stage: action,
        blob: stamped
      });
      if (!recorded) {
        toast.info('Attendance submitted. The photo was saved but could not be attached to the record yet.');
      }
    } catch (error) {
      console.warn('[attendance] the photo could not be stored', error);
      toast.warning('Attendance submitted, but the photo could not be saved.');
    }
  };

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
    openCamera('clockIn', 'clock in');
  };

  const executeClockIn = async (resolved, photoBlob) => {
    setActionLoading(true);
    try {
      if (!approvedPlacement) {
        throw new Error(terms.attendanceLockedCopy);
      }
      const result = await clockIn(
        currentUser.id,
        resolved.coordinates.latitude,
        resolved.coordinates.longitude,
        resolved.coordinates.accuracy,
        resolved.coordinates.source
      );
      setTodayAttendance(result);
      toast.success('Clock-in request submitted. Waiting for admin approval.');
      await saveAttendancePhoto({
        attendanceId: result?.id,
        photoBlob,
        action: 'clockIn',
        resolved,
        // The server's own timestamp, not this device's.
        at: result?.requestedAt || result?.createdAt || result?.timeIn
      });
      await loadAttendanceData();
    } catch (error) {
      toast.error(error.message || 'Failed to submit clock-in request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = () => {
    if (!activeClock) return;
    // A shift can only belong to a placement. Without one there is nothing to
    // close, and the database would refuse it anyway.
    if (!approvedPlacement) {
      toast.warning(terms.attendanceLockedCopy);
      return;
    }
    if (!windowState.isClockOutOpen) {
      toast.error(windowState.clockOutMessage);
      return;
    }
    openCamera('clockOut', 'clock out');
  };

  const executeClockOut = async (resolved, photoBlob) => {
    setActionLoading(true);
    try {
      // Clock-out is fenced too: the same 20 m rule that opens a shift closes
      // it. Coordinates go to request_clock_out, which re-checks them - the
      // client check in resolveCoordinates is the friendly half, not the
      // authority.
      const result = await clockOut(
        currentUser.id,
        resolved.coordinates.latitude,
        resolved.coordinates.longitude,
        resolved.coordinates.accuracy,
        resolved.coordinates.source
      );
      setTodayAttendance(result);
      toast.success('Clock-out request submitted. Waiting for admin approval.');
      await saveAttendancePhoto({
        attendanceId: result?.id,
        photoBlob,
        action: 'clockOut',
        resolved,
        // The frozen end time the server wrote, which is also the duration the
        // administrator will review.
        at: result?.pendingEndTime || result?.requestedAt
      });
      await loadAttendanceData();
    } catch (error) {
      toast.error(error.message || 'Failed to submit clock-out request');
    } finally {
      setActionLoading(false);
    }
  };

  /** Called by the camera dialog with the captured frame, or `null` when skipped. */
  const submitClockPhoto = async (photoBlob) => {
    const resolved = pendingCoordinates;
    const action = cameraAction;
    setCameraAction(null);
    setPendingCoordinates(null);
    if (!resolved || !action) return;
    if (action === 'clockIn') await executeClockIn(resolved, photoBlob);
    else await executeClockOut(resolved, photoBlob);
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
    if (!approvedPlacement) {
      toast.warning(terms.attendanceLockedCopy);
      return;
    }
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
      {/* Replaces the old yes/no confirmation dialog. The camera step is the
          confirmation now: the request is not sent until a photo is captured
          (or the camera is unavailable and the trainee is offered the way
          through without one). */}
      <TimestampCamera
        isOpen={Boolean(cameraAction)}
        action={cameraAction || 'clockIn'}
        stampBase={{
          locationName: pendingCoordinates?.geofence?.location || null,
          latitude: pendingCoordinates?.coordinates?.latitude ?? null,
          longitude: pendingCoordinates?.coordinates?.longitude ?? null,
          distanceMeters: pendingCoordinates?.geofence?.distance ?? null,
          accuracyMeters: pendingCoordinates?.coordinates?.accuracy ?? null,
          userName: currentUser?.fullName || null,
          roleLabel: terms.roleLabel || null
        }}
        submitting={actionLoading}
        onCancel={closeCamera}
        onSubmit={submitClockPhoto}
        onSkip={() => submitClockPhoto(null)}
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
              {', and clock out '}
              {CLOCK_WINDOW_ENFORCEMENT.clockOut
                ? `any time before ${getClockOutWindow().cutoffLabel} - no earlier window to wait for.`
                : 'at any time.'}
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
              {/* Only shown when there is something to explain.  An accepted
                  absence is already folded into the end date above; without
                  this line the date would look later than the arithmetic
                  suggests and read like an error. */}
              {!terms.isTrainee && schedule.absenceDays > 0 && (
                <div className="summary-item">
                  <span className="summary-label">Accepted Absences</span>
                  <span className="summary-value">{schedule.absenceDays}</span>
                </div>
              )}
            </div>
            {!terms.isTrainee && schedule.absenceDays > 0 && (
              <p className="summary-hint">
                Your projected end date already includes {schedule.absenceDays} accepted
                absence{schedule.absenceDays === 1 ? '' : 's'} - one working day each. You are
                not expected to make those days up.
              </p>
            )}
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
              {!showAbsenceForm && <Button onClick={() => setShowAbsenceForm(true)} size="sm">+ Report Absence</Button>}
            </div>
            <p className="absence-intro">
              Tell the administrator in advance that you cannot attend, and why. They will
              <strong> accept </strong> or <strong>reject </strong> it.
              An accepted day is added to your projected end date, so you are never asked to
              make up a day you were excused from. A rejected day counts as a normal working
              day, and their reason is shown below.
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
                          <Badge status={getAbsenceDecisionTone(request)}>
                            {getAbsenceDecision(request)}
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
              {!showOtForm && approvedPlacement && <Button onClick={() => setShowOtForm(true)} size="sm">+ Request OT</Button>}
            </div>
            {/* Overtime is hours on top of an attendance day, so it cannot exist
                before there is a placement to attend. Offering the button only
                produced requests an administrator had to reject. */}
            {!approvedPlacement && (
              <p className="empty-state">{terms.attendanceLockedCopy}</p>
            )}
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
