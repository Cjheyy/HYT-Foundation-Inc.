import React, { createContext, useCallback, useContext, useEffect, useReducer, useState } from 'react';
import { getCurrentUser, isAccountApproved, syncAuthMarker } from '../services/authService';
import { supabase, toCamelCase } from '../config/supabase';
import {
  getUsers,
  getPrograms,
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
  opportunities: [],
  applications: [],
  requirements: [],
  attendance: [],
  dailyReports: [],
  ojtRecords: [],
  certificates: [],
  announcements: [],
  notifications: [],
  settings: {},
  loading: true
};

function appReducer(state, action) {
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
    case 'LOAD_DATA':
      return { ...state, ...action.payload, loading: false };
    default:
      return state;
  }
}

const valueFromResult = (result, fallback) =>
  result.status === 'fulfilled' ? (result.value ?? fallback) : fallback;

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [authInitialized, setAuthInitialized] = useState(false);

  const loadPublicData = useCallback(async () => {
    if (!supabase) return;
    const [programs, opportunities, announcements, settings] = await Promise.allSettled([
      getPrograms({ includeInactive: false }),
      getOpportunities({ includeInactive: false }),
      getAnnouncements(),
      getSettings()
    ]);
    dispatch({
      type: 'LOAD_DATA',
      payload: {
        programs: valueFromResult(programs, []),
        opportunities: valueFromResult(opportunities, []),
        announcements: valueFromResult(announcements, []),
        settings: valueFromResult(settings, {})
      }
    });
  }, []);

  const fetchAllData = useCallback(async (user) => {
    if (!user) return;

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
        getSettings()
      ]);
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
          settings: valueFromResult(results[10], {})
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
      getOtRequests(user.id)
    ]);
    const ojtRecords = valueFromResult(results[3], []).filter((record) => record.studentId === user.id);
    const requirements = valueFromResult(results[6], []).filter((item) => item.studentId === user.id);
    const certificates = valueFromResult(results[7], []).filter((item) => item.studentId === user.id);
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
        otRequests: valueFromResult(results[11], [])
      }
    });
  }, []);

  const refreshData = useCallback(async () => {
    if (state.currentUser) await fetchAllData(state.currentUser);
    else await loadPublicData();
  }, [fetchAllData, loadPublicData, state.currentUser]);

  // Initialize the persisted Supabase session exactly once.  A transient
  // network error is not treated as a logout; only an actual SIGNED_OUT event
  // clears the application state.
  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      if (!supabase) {
        if (mounted) {
          dispatch({ type: 'SET_CURRENT_USER', payload: null });
          setAuthInitialized(true);
        }
        return;
      }

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        let session = sessionData?.session || null;

        if (sessionError) {
          console.warn('Session read failed; retaining local state until auth confirms it.', sessionError);
          const user = await getCurrentUser();
          session = user ? { user: { id: user.id } } : null;
        }

        if (session?.user?.id) {
          syncAuthMarker(session.user.id);
          let user = await getCurrentUser();
          // A profile is created by an auth trigger immediately after sign-up;
          // retry briefly to avoid a refresh racing that trigger.
          for (let attempt = 0; !user && attempt < 2; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, 250));
            user = await getCurrentUser();
          }
          if (user && !isAccountApproved(user)) {
            await supabase.auth.signOut().catch(() => undefined);
            syncAuthMarker(null);
            user = null;
          }
          if (mounted) {
            dispatch({ type: 'SET_CURRENT_USER', payload: user });
            if (user) fetchAllData(user).catch((error) => console.error('Initial data load failed.', error));
          }
        } else if (mounted) {
          syncAuthMarker(null);
          dispatch({ type: 'SET_CURRENT_USER', payload: null });
          loadPublicData().catch((error) => console.warn('Public data load failed.', error));
        }
      } catch (error) {
        console.error('App initialization failed:', error);
        if (mounted) dispatch({ type: 'SET_CURRENT_USER', payload: null });
      } finally {
        if (mounted) setAuthInitialized(true);
      }
    };

    initialize();
    return () => { mounted = false; };
  }, [fetchAllData, loadPublicData]);

  // Supabase persists and refreshes the session.  Do not perform network work
  // synchronously inside this callback; doing so can deadlock the auth client.
  useEffect(() => {
    if (!supabase) return undefined;
    let mounted = true;
    let timer = null;

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      syncAuthMarker(session?.user?.id || null);
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        if (!mounted) return;
        if (event === 'SIGNED_OUT' || !session) {
          dispatch({ type: 'LOGOUT' });
          return;
        }
        if (['SIGNED_IN', 'INITIAL_SESSION', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) {
          let user = await getCurrentUser();
          if (user && !isAccountApproved(user)) {
            await supabase.auth.signOut().catch(() => undefined);
            syncAuthMarker(null);
            user = null;
          }
          if (!mounted) return;
          if (user) {
            dispatch({ type: 'SET_CURRENT_USER', payload: user });
            fetchAllData(user).catch((error) => console.error('Auth data refresh failed.', error));
          }
        }
      }, 0);
    });

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
      listener?.subscription?.unsubscribe?.();
    };
  }, [fetchAllData]);

  // Supabase persists its token in localStorage. Listen for cross-tab
  // storage changes as well as onAuthStateChange so a refresh in a second tab
  // cannot observe a stale logged-in state.
  useEffect(() => {
    if (!supabase) return undefined;
    const onStorage = (event) => {
      if (event.key && !event.key.includes('auth-token')) return;
      supabase.auth.getSession().then(async ({ data: sessionData }) => {
        if (!sessionData?.session) {
          dispatch({ type: 'LOGOUT' });
          return;
        }
        const user = await getCurrentUser();
        if (user && isAccountApproved(user)) {
          dispatch({ type: 'SET_CURRENT_USER', payload: user });
          fetchAllData(user).catch(() => undefined);
        }
      }).catch(() => undefined);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [fetchAllData]);

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
          if (mounted && payload?.new) dispatch({ type: 'UPDATE_USER', payload: toCamelCase(payload.new) });
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [state.currentUser?.id]);

  const value = {
    state,
    dispatch,
    refreshData,
    authInitialized
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
}

export default AppContext;
