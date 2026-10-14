import React, { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState } from 'react';
import {
  getCurrentUser,
  isAccountApproved,
  isRejectedAccount,
  logout,
  syncAuthMarker
} from '../services/authService';
import {
  clearPersistedSession,
  SUPABASE_CONFIG_ERROR,
  SUPABASE_STORAGE_KEY,
  supabase,
  toCamelCase
} from '../config/supabase';
import {
  getUsers,
  getPrograms,
  getEvents,
  getOpportunities,
  getApplications,
  getOjtRecords,
  getDailyReports,
  getRequirements,
  getCertificates,
  getAnnouncements,
  getNotifications,
  getSettings,
  getAttendanceLogs,
  getOtRequests,
  cleanupExpiredEvents
} from '../services/supabaseService';

const AppContext = createContext();

const initialState = {
  currentUser: null,
  users: [],
  programs: [],
  events: [],
  opportunities: [],
  applications: [],
  requirements: [],
  attendance: [],
  dailyReports: [],
  ojtRecords: [],
  certificates: [],
  announcements: [],
  notifications: [],
  otRequests: [],
  settings: {},
  loading: true,
  // Separate from `loading` (which gates ProtectedRoute): this tracks the
  // portal data fetch, so list pages can show skeletons instead of flashing an
  // empty state before their rows arrive.
  dataLoading: true
};

// Exported for unit tests: LOGOUT/LOAD_DATA reset semantics protect against
// leaking one identity's data into another session.
export function appReducer(state, action) {
  switch (action.type) {
    case 'SET_CURRENT_USER':
      return { ...state, currentUser: action.payload, loading: false };
    case 'LOGOUT':
      return { ...initialState, loading: false };

    case 'SET_USERS':
      return { ...state, users: action.payload };
    case 'ADD_USER':
      return { ...state, users: [action.payload, ...state.users] };
    case 'UPDATE_USER':
      return {
        ...state,
        users: state.users.map((user) =>
          user.id === action.payload.id
            ? { ...user, ...action.payload }
            : user
        ),
        currentUser: state.currentUser?.id === action.payload.id
          ? { ...state.currentUser, ...action.payload }
          : state.currentUser
      };

    case 'SET_PROGRAMS':
      return { ...state, programs: action.payload };
    case 'ADD_PROGRAM':
      return { ...state, programs: [action.payload, ...state.programs] };
    case 'UPDATE_PROGRAM':
      return {
        ...state,
        programs: state.programs.map((program) =>
          program.id === action.payload.id ? { ...program, ...action.payload } : program
        )
      };
    case 'DELETE_PROGRAM':
      return { ...state, programs: state.programs.filter((program) => program.id !== action.payload) };

    case 'SET_EVENTS':
      return { ...state, events: action.payload };
    case 'ADD_EVENT':
      return { ...state, events: [action.payload, ...state.events] };
    case 'UPDATE_EVENT':
      return {
        ...state,
        events: state.events.map((item) =>
          item.id === action.payload.id ? { ...item, ...action.payload } : item
        )
      };
    case 'DELETE_EVENT':
      return { ...state, events: state.events.filter((item) => item.id !== action.payload) };

    case 'SET_OPPORTUNITIES':
      return { ...state, opportunities: action.payload };
    case 'ADD_OPPORTUNITY':
      return { ...state, opportunities: [action.payload, ...state.opportunities] };
    case 'UPDATE_OPPORTUNITY':
      return {
        ...state,
        opportunities: state.opportunities.map((opportunity) =>
          opportunity.id === action.payload.id
            ? { ...opportunity, ...action.payload }
            : opportunity
        )
      };
    case 'DELETE_OPPORTUNITY':
      return {
        ...state,
        opportunities: state.opportunities.filter((opportunity) => opportunity.id !== action.payload)
      };

    case 'SET_APPLICATIONS':
      return { ...state, applications: action.payload };
    case 'ADD_APPLICATION':
      return { ...state, applications: [action.payload, ...state.applications] };
    case 'UPDATE_APPLICATION':
      return {
        ...state,
        applications: state.applications.map((application) =>
          application.id === action.payload.id
            ? { ...application, ...action.payload }
            : application
        )
      };

    case 'SET_REQUIREMENTS':
      return { ...state, requirements: action.payload };
    case 'ADD_REQUIREMENT':
      return { ...state, requirements: [action.payload, ...state.requirements] };
    case 'UPDATE_REQUIREMENT':
      return {
        ...state,
        requirements: state.requirements.map((requirement) =>
          requirement.id === action.payload.id
            ? { ...requirement, ...action.payload }
            : requirement
        )
      };

    case 'SET_ATTENDANCE':
      return { ...state, attendance: action.payload };
    case 'ADD_ATTENDANCE':
      return { ...state, attendance: [action.payload, ...state.attendance] };
    case 'UPDATE_ATTENDANCE':
      return {
        ...state,
        attendance: state.attendance.map((attendance) =>
          attendance.id === action.payload.id
            ? { ...attendance, ...action.payload }
            : attendance
        )
      };

    case 'SET_DAILY_REPORTS':
      return { ...state, dailyReports: action.payload };
    case 'ADD_DAILY_REPORT':
      return { ...state, dailyReports: [action.payload, ...state.dailyReports] };
    case 'UPDATE_DAILY_REPORT':
      return {
        ...state,
        dailyReports: state.dailyReports.map((report) =>
          report.id === action.payload.id
            ? { ...report, ...action.payload }
            : report
        )
      };

    case 'SET_OJT_RECORDS':
      return { ...state, ojtRecords: action.payload };
    case 'ADD_OJT_RECORD':
      return { ...state, ojtRecords: [action.payload, ...state.ojtRecords] };
    case 'UPDATE_OJT_RECORD':
      return {
        ...state,
        ojtRecords: state.ojtRecords.map((record) =>
          record.id === action.payload.id ? { ...record, ...action.payload } : record
        )
      };

    case 'SET_CERTIFICATES':
      return { ...state, certificates: action.payload };
    case 'ADD_CERTIFICATE':
      return { ...state, certificates: [action.payload, ...state.certificates] };
    case 'UPDATE_CERTIFICATE':
      return {
        ...state,
        certificates: state.certificates.map((certificate) =>
          certificate.id === action.payload.id
            ? { ...certificate, ...action.payload }
            : certificate
        )
      };

    case 'SET_ANNOUNCEMENTS':
      return { ...state, announcements: action.payload };
    case 'ADD_ANNOUNCEMENT':
      return { ...state, announcements: [action.payload, ...state.announcements] };
    case 'UPDATE_ANNOUNCEMENT':
      return {
        ...state,
        announcements: state.announcements.map((announcement) =>
          announcement.id === action.payload.id
            ? { ...announcement, ...action.payload }
            : announcement
        )
      };
    case 'DELETE_ANNOUNCEMENT':
      return { ...state, announcements: state.announcements.filter((item) => item.id !== action.payload) };

    case 'SET_NOTIFICATIONS':
      return { ...state, notifications: action.payload };
    case 'ADD_NOTIFICATION':
      return { ...state, notifications: [action.payload, ...state.notifications] };
    case 'MARK_NOTIFICATION_READ':
      return {
        ...state,
        notifications: state.notifications.map((notification) =>
          notification.id === action.payload ? { ...notification, read: true } : notification
        )
      };

    case 'SET_SETTINGS':
      return { ...state, settings: action.payload };
    case 'SET_DATA_LOADING':
      return { ...state, dataLoading: Boolean(action.payload) };
    case 'LOAD_DATA':
      // A snapshot load must replace every collection.  Merging partial payloads
      // previously let a previous user's rows survive a logout or an account
      // switch in another tab.
      return {
        ...initialState,
        currentUser: state.currentUser,
        loading: false,
        dataLoading: false,
        ...action.payload
      };
    case 'LOAD_PUBLIC_DATA':
      // The five world-readable collections, and ONLY those.
      //
      // `loadPublicData` used to dispatch LOAD_DATA, whose payload never carries
      // the user's own rows — so every realtime posting/announcement broadcast
      // reset `applications`, `attendance`, `requirements`, `certificates`,
      // `dailyReports`, `ojtRecords` and `otRequests` to `[]`, and a signed-in
      // user watched their dashboard empty itself until the next full load.
      // Merging is safe here precisely because none of these five keys is
      // user-scoped; LOAD_DATA keeps its replace-everything semantics.
      //
      // An absent key means "the fetch failed" — keep what is already on screen
      // rather than blanking a list over one transient error.
      return {
        ...state,
        programs: action.payload.programs ?? state.programs,
        events: action.payload.events ?? state.events,
        opportunities: action.payload.opportunities ?? state.opportunities,
        announcements: action.payload.announcements ?? state.announcements,
        settings: action.payload.settings ?? state.settings,
        loading: false,
        dataLoading: false
      };
    default:
      return state;
  }
}

const valueFromResult = (result, fallback) =>
  result.status === 'fulfilled' ? (result.value ?? fallback) : fallback;

const VERIFY_ERROR_NOTICE = {
  tone: 'error',
  message: 'We could not verify your account right now. Check your connection and try again.',
  retryable: true
};

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [authStatus, setAuthStatus] = useState('initializing');
  const [authNotice, setAuthNotice] = useState(null);
  const [recoveryUserId, setRecoveryUserId] = useState(null);

  // Supabase emits SIGNED_OUT while older profile requests can still be in
  // flight.  Every async auth job captures an epoch and must re-check it before
  // touching React state, otherwise a signed-out tab can be resurrected with
  // the previous user's profile and data.
  const authEpochRef = useRef(0);
  const authStatusRef = useRef('initializing');
  const activeUserIdRef = useRef(null);
  const pendingNoticeRef = useRef(null);
  const recoveryUserIdRef = useRef(null);

  const setStatus = useCallback((status) => {
    authStatusRef.current = status;
    setAuthStatus(status);
  }, []);

  const setRecovery = useCallback((userId) => {
    recoveryUserIdRef.current = userId || null;
    setRecoveryUserId(userId || null);
  }, []);

  const clearAuthNotice = useCallback(() => {
    pendingNoticeRef.current = null;
    setAuthNotice(null);
  }, []);

  const endLocalSession = useCallback((notice = null) => {
    authEpochRef.current += 1;
    activeUserIdRef.current = null;
    pendingNoticeRef.current = null;
    syncAuthMarker(null);
    setAuthNotice(notice);
    setStatus('anonymous');
    setRecovery(null);
    dispatch({ type: 'LOGOUT' });
  }, [setRecovery, setStatus]);

  const loadPublicData = useCallback(async (isStale, { silent = false } = {}) => {
    if (!supabase) return;
    // A background refresh (realtime event) must not flip the loading flag:
    // that would flash a skeleton over data the user is already reading.
    if (!silent) dispatch({ type: 'SET_DATA_LOADING', payload: true });
    const [programs, events, opportunities, announcements, settings] = await Promise.allSettled([
      getPrograms({ includeInactive: false }),
      getEvents({ includeInactive: false }),
      getOpportunities({ includeInactive: false }),
      getAnnouncements(),
      getSettings()
    ]);
    if (typeof isStale === 'function' && isStale()) return;
    // `undefined` (not `[]`) for a rejected fetch: LOAD_PUBLIC_DATA keeps the
    // rows already on screen for an absent key, so one transient failure during
    // a realtime refresh cannot empty a list the user is reading.
    const loaded = (result) => (result.status === 'fulfilled' ? result.value : undefined);
    dispatch({
      type: 'LOAD_PUBLIC_DATA',
      payload: {
        programs: loaded(programs),
        events: loaded(events),
        opportunities: loaded(opportunities),
        announcements: loaded(announcements),
        settings: loaded(settings)
      }
    });
  }, []);

  const fetchAllData = useCallback(async (user, isStale) => {
    if (!user) return;
    const stale = () => (typeof isStale === 'function' ? isStale() : false);
    dispatch({ type: 'SET_DATA_LOADING', payload: true });

    if (String(user.role || '').toUpperCase() === 'ADMIN') {
      // Expiry cleanup is best effort; the SQL migration can also schedule it.
      cleanupExpiredEvents().catch((error) => console.warn('Event cleanup skipped.', error));
      const results = await Promise.allSettled([
        getUsers(),
        getPrograms({ includeInactive: true }),
        getOpportunities({ includeInactive: true }),
        getApplications(),
        getOjtRecords(),
        getAttendanceLogs(),
        getDailyReports(),
        getRequirements(),
        getCertificates(),
        getAnnouncements(),
        getSettings(),
        // Appended (not inserted) so the positional indexes above stay valid.
        getEvents({ includeInactive: true })
      ]);
      if (stale()) return;
      dispatch({
        type: 'LOAD_DATA',
        payload: {
          users: valueFromResult(results[0], []),
          programs: valueFromResult(results[1], []),
          opportunities: valueFromResult(results[2], []),
          applications: valueFromResult(results[3], []),
          ojtRecords: valueFromResult(results[4], []),
          attendance: valueFromResult(results[5], []),
          dailyReports: valueFromResult(results[6], []),
          requirements: valueFromResult(results[7], []),
          certificates: valueFromResult(results[8], []),
          announcements: valueFromResult(results[9], []),
          settings: valueFromResult(results[10], {}),
          events: valueFromResult(results[11], [])
        }
      });
      return;
    }

    const results = await Promise.allSettled([
      getPrograms({ includeInactive: false }),
      getOpportunities({ includeInactive: false }),
      getApplications(user.id),
      getOjtRecords(),
      getAttendanceLogs(user.id),
      getDailyReports(user.id),
      getRequirements(),
      getCertificates(),
      getAnnouncements(),
      getNotifications(user.id),
      getSettings(),
      getOtRequests(user.id),
      // Appended (not inserted) so the positional indexes above stay valid.
      getEvents({ includeInactive: false })
    ]);
    if (stale()) return;
    const ojtRecords = valueFromResult(results[3], []).filter((record) => record.studentId === user.id);
    const requirements = valueFromResult(results[6], []).filter((item) => item.studentId === user.id);
    const userEmail = String(user.email || '').trim().toLowerCase();
    const certificates = valueFromResult(results[7], []).filter((item) => {
      if (item.studentId === user.id) return true;
      const itemEmail = String(item.recipientEmail || item.recipient_email || item.email || '').trim().toLowerCase();
      return Boolean(userEmail && itemEmail && itemEmail === userEmail);
    });
    dispatch({
      type: 'LOAD_DATA',
      payload: {
        users: [user],
        programs: valueFromResult(results[0], []),
        opportunities: valueFromResult(results[1], []),
        applications: valueFromResult(results[2], []),
        ojtRecords,
        attendance: valueFromResult(results[4], []),
        dailyReports: valueFromResult(results[5], []),
        requirements,
        certificates,
        announcements: valueFromResult(results[8], []),
        notifications: valueFromResult(results[9], []),
        settings: valueFromResult(results[10], {}),
        otRequests: valueFromResult(results[11], []),
        events: valueFromResult(results[12], [])
      }
    });
  }, []);

  const refreshData = useCallback(async () => {
    if (state.currentUser) await fetchAllData(state.currentUser);
    else await loadPublicData();
  }, [fetchAllData, loadPublicData, state.currentUser]);

  /**
   * Turn a live Supabase session into an authorized application session.
   * `force` re-reads the profile for the same identity (USER_UPDATED,
   * PASSWORD_RECOVERY, an explicit retry).  `loadData: false` refreshes only
   * the profile, so a token rotation never re-downloads the whole portal.
   */
  const reconcileSession = useCallback(async (session, options = {}) => {
    const { force = false, loadData = true, profile: prefetchedProfile = null } = options;

    if (!supabase) {
      endLocalSession({ tone: 'error', message: SUPABASE_CONFIG_ERROR, retryable: false });
      return;
    }

    // A session whose `user` cannot be read is NOT an absent session.  auth-js
    // substitutes `userNotAvailableProxy()` when it restores a session but
    // cannot resolve the user (`_recoverAndRefresh`), and `user.id` then reads
    // as undefined.  Treating that as "no session" signed a valid user out on
    // reload, so resolve the identity first and only give up if the stored
    // token is genuinely gone.
    let resolvedProfile = prefetchedProfile;
    if (session && !session?.user?.id) {
      try {
        resolvedProfile = await getCurrentUser();
      } catch (error) {
        console.warn('Profile recovery failed.', error);
      }
      if (!resolvedProfile?.id) {
        // The token is still in storage, so this is a transient read failure
        // rather than a logout: report it and let the user retry.
        setStatus('error');
        setAuthNotice(VERIFY_ERROR_NOTICE);
        return;
      }
    }

    const userId = session?.user?.id || resolvedProfile?.id || null;
    if (!userId) {
      endLocalSession();
      return;
    }

    if (!force && activeUserIdRef.current === userId && authStatusRef.current === 'authenticated') return;

    if (activeUserIdRef.current !== userId) {
      authEpochRef.current += 1;
      setStatus('verifying');
    }

    const epoch = authEpochRef.current;
    const isStale = () => epoch !== authEpochRef.current;

    let profile = resolvedProfile;
    if (!profile) {
      try {
        profile = await getCurrentUser();
      } catch (error) {
        console.warn('Profile read failed.', error);
      }
      if (isStale()) return;
    }

    if (!profile || profile.id !== userId) {
      // A missing profile and a transient database failure must be separated:
      // only a genuinely absent session may clear the persisted token.
      let liveSession = null;
      let sessionError = null;
      try {
        const { data, error } = await supabase.auth.getSession();
        liveSession = data?.session || null;
        sessionError = error || null;
      } catch (error) {
        sessionError = error;
      }
      if (isStale()) return;

      if (sessionError || liveSession?.user?.id === userId) {
        setStatus('error');
        setAuthNotice(VERIFY_ERROR_NOTICE);
        return;
      }

      endLocalSession();
      return;
    }

    if (!isAccountApproved(profile)) {
      const notice = {
        tone: 'error',
        message: isRejectedAccount(profile)
          ? 'Your application was not approved. Please contact HYT support for more information.'
          : 'Your account is not active. Please contact HYT support.'
      };
      // Direct login is allowed for pending accounts; only rejected or
      // deactivated accounts are signed out here.
      pendingNoticeRef.current = notice;
      try {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) clearPersistedSession();
      } catch (error) {
        clearPersistedSession();
      }
      if (!isStale()) endLocalSession(notice);
      return;
    }

    if (isStale()) return;
    activeUserIdRef.current = profile.id;
    setAuthNotice(null);
    pendingNoticeRef.current = null;
    setStatus('authenticated');
    dispatch({ type: 'SET_CURRENT_USER', payload: profile });
    if (loadData) {
      fetchAllData(profile, isStale).catch((error) => console.error('Auth data refresh failed.', error));
    }
  }, [endLocalSession, fetchAllData, setStatus]);

  const retryAuth = useCallback(async () => {
    if (!supabase) {
      endLocalSession({ tone: 'error', message: SUPABASE_CONFIG_ERROR, retryable: false });
      return;
    }
    setStatus('verifying');
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setStatus('error');
        setAuthNotice(VERIFY_ERROR_NOTICE);
        return;
      }
      await reconcileSession(data?.session, { force: true, loadData: true });
    } catch (error) {
      console.error('Session retry failed.', error);
      setStatus('error');
      setAuthNotice(VERIFY_ERROR_NOTICE);
    }
  }, [endLocalSession, reconcileSession, setStatus]);

  const signOut = useCallback(async () => {
    setStatus('verifying');
    try {
      await logout();
    } finally {
      endLocalSession();
    }
  }, [endLocalSession, setStatus]);

  // Supabase owns session persistence and token refresh.  The listener is the
  // single place where an auth event becomes application state; async work is
  // deferred with setTimeout so it never blocks Supabase's emitter.
  useEffect(() => {
    if (!supabase) {
      endLocalSession({ tone: 'error', message: SUPABASE_CONFIG_ERROR, retryable: false });
      return undefined;
    }

    let disposed = false;
    let timer = null;

    const schedule = (task) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (!disposed) task();
      }, 0);
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (disposed) return;

      if (event === 'SIGNED_OUT') {
        schedule(() => endLocalSession());
        return;
      }

      if (event === 'TOKEN_REFRESHED') {
        // The SDK already rotated and persisted the token.  Never turn a
        // refresh into a full portal reload; only reconcile a changed identity.
        schedule(() => {
          const userId = session?.user?.id;
          if (!userId) {
            retryAuth();
            return;
          }
          if (activeUserIdRef.current !== userId || authStatusRef.current !== 'authenticated') {
            reconcileSession(session, { force: true, loadData: false });
          }
        });
        return;
      }

      if (!['INITIAL_SESSION', 'SIGNED_IN', 'USER_UPDATED', 'PASSWORD_RECOVERY'].includes(event)) return;

      schedule(() => {
        if (event === 'PASSWORD_RECOVERY') {
          // Keep the Supabase recovery session (ResetPassword needs it) but do
          // not treat it as a signed-in portal session.  Supabase immediately
          // follows PASSWORD_RECOVERY with SIGNED_IN, which is ignored here
          // until the recovery flow finishes and signs out.
          endLocalSession();
          setRecovery(session?.user?.id || null);
          return;
        }

        if (!session?.user?.id) {
          if (event !== 'INITIAL_SESSION') {
            retryAuth();
            return;
          }
          // Supabase emits INITIAL_SESSION with a null session when the token
          // read itself failed (for example a transient network error).  Only a
          // confirmed empty session may clear state, otherwise a reload during
          // a flaky connection would sign a valid user out.
          supabase.auth.getSession().then(({ data, error }) => {
            if (disposed) return;
            if (!error && data?.session) {
              reconcileSession(data.session, { force: true, loadData: true });
              return;
            }
            if (error) {
              setStatus('error');
              setAuthNotice(VERIFY_ERROR_NOTICE);
              return;
            }
            endLocalSession();
            loadPublicData().catch((loadError) => console.warn('Public data load failed.', loadError));
          }).catch(() => {
            if (disposed) return;
            setStatus('error');
            setAuthNotice(VERIFY_ERROR_NOTICE);
          });
          return;
        }

        if (recoveryUserIdRef.current === session.user.id) return;

        const sameIdentity = activeUserIdRef.current === session.user.id;
        if (sameIdentity && authStatusRef.current === 'authenticated' && event === 'SIGNED_IN') {
          // Supabase re-emits SIGNED_IN on tab focus; there is nothing to do.
          return;
        }

        reconcileSession(session, {
          force: event !== 'SIGNED_IN',
          loadData: event !== 'USER_UPDATED'
        });
      });
    });

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      listener?.subscription?.unsubscribe?.();
    };
  }, [endLocalSession, loadPublicData, reconcileSession, retryAuth, setRecovery, setStatus]);

  // Supabase already broadcasts cross-tab auth changes through
  // BroadcastChannel.  Only fall back to the raw storage event when that API
  // is unavailable, and match the single configured storage key exactly so
  // PKCE verifiers and unrelated entries never trigger a reload.
  useEffect(() => {
    if (!supabase || typeof window === 'undefined') return undefined;
    if (typeof window.BroadcastChannel === 'function') return undefined;

    const onStorage = (event) => {
      if (event.key !== SUPABASE_STORAGE_KEY) return;
      if (event.storageArea && event.storageArea !== window.localStorage) return;
      supabase.auth.getSession().then(({ data }) => {
        if (!data?.session) {
          endLocalSession();
          return;
        }
        reconcileSession(data.session, { force: true });
      }).catch(() => undefined);
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [endLocalSession, reconcileSession]);

  // Keep the signed-in profile and hour totals live after approvals.
  useEffect(() => {
    const userId = state.currentUser?.id;
    if (!supabase || !userId) return undefined;
    let mounted = true;
    const channel = supabase
      .channel(`profile_updates_${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${userId}` },
        (payload) => {
          if (!mounted || !payload?.new) return;
          const updated = toCamelCase(payload.new);
          dispatch({ type: 'UPDATE_USER', payload: updated });
          if (!isAccountApproved(updated)) {
            const notice = { tone: 'error', message: 'Your account is not active. Please contact HYT support.' };
            endLocalSession(notice);
            supabase.auth.signOut().catch(() => clearPersistedSession());
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
    // endLocalSession is stable; state.currentUser.id is the subscription key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentUser?.id]);

  // Postings must appear ON TIME, with no manual refresh.  Publishing a program,
  // an event or an opportunity writes to `programs` / `events` /
  // `opportunities`, and every listing surface (public Programs/Opportunities,
  // student OJT/Events, trainee Programs/Events, dashboard) reads
  // `state.programs` / `state.events` / `state.opportunities`.  Re-running the
  // public load on that broadcast keeps all of them in step the moment an admin
  // publishes — silently, so nothing flashes a skeleton.
  //
  // `announcements` rides the same broadcast because posting an event now
  // auto-publishes one: the Announcements page and the header bell's unread
  // count both have to move without a refresh.
  useEffect(() => {
    if (!supabase) return undefined;
    let mounted = true;
    let timer;
    const scheduleReload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!mounted) return;
        loadPublicData(undefined, { silent: true })
          .catch((error) => console.warn('Posting refresh failed.', error));
      }, 250);
    };

    const channel = supabase
      .channel('public_postings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'programs' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'opportunities' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, scheduleReload)
      .subscribe();

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [loadPublicData]);

  const value = {
    state,
    dispatch,
    refreshData,
    authInitialized: authStatus !== 'initializing',
    authStatus,
    authNotice,
    clearAuthNotice,
    retryAuth,
    signOut,
    recoveryUserId
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
}

export default AppContext;
