import React, { createContext, useContext, useReducer, useEffect, useState } from 'react';
import { getCurrentUser } from '../services/authService';
import { supabase } from '../config/supabase';
import {
  getUsers,
  getPrograms,
  getOpportunities,
  getApplications,
  getOjtRecords,
  getAttendance,
  getDailyReports,
  getRequirements,
  getCertificates,
  getAnnouncements,
  getNotifications,
  getSettings
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
      return { ...state, users: [...state.users, action.payload] };
    case 'UPDATE_USER':
      return {
        ...state,
        users: state.users.map(user =>
          user.id === action.payload.id ? action.payload : user
        ),
        currentUser: state.currentUser?.id === action.payload.id ? action.payload : state.currentUser
      };
    
    case 'SET_PROGRAMS':
      return { ...state, programs: action.payload };
    case 'ADD_PROGRAM':
      return { ...state, programs: [...state.programs, action.payload] };
    case 'UPDATE_PROGRAM':
      return {
        ...state,
        programs: state.programs.map(program =>
          program.id === action.payload.id ? action.payload : program
        )
      };
    case 'DELETE_PROGRAM':
      return {
        ...state,
        programs: state.programs.filter(program => program.id !== action.payload)
      };
    
    case 'SET_OPPORTUNITIES':
      return { ...state, opportunities: action.payload };
    case 'ADD_OPPORTUNITY':
      return { ...state, opportunities: [...state.opportunities, action.payload] };
    case 'UPDATE_OPPORTUNITY':
      return {
        ...state,
        opportunities: state.opportunities.map(opp =>
          opp.id === action.payload.id ? action.payload : opp
        )
      };
    case 'DELETE_OPPORTUNITY':
      return {
        ...state,
        opportunities: state.opportunities.filter(opp => opp.id !== action.payload)
      };
    
    case 'SET_APPLICATIONS':
      return { ...state, applications: action.payload };
    case 'ADD_APPLICATION':
      return { ...state, applications: [...state.applications, action.payload] };
    case 'UPDATE_APPLICATION':
      return {
        ...state,
        applications: state.applications.map(app =>
          app.id === action.payload.id ? action.payload : app
        )
      };
    
    case 'SET_REQUIREMENTS':
      return { ...state, requirements: action.payload };
    case 'ADD_REQUIREMENT':
      return { ...state, requirements: [...state.requirements, action.payload] };
    case 'UPDATE_REQUIREMENT':
      return {
        ...state,
        requirements: state.requirements.map(req =>
          req.id === action.payload.id ? action.payload : req
        )
      };
    
    case 'SET_ATTENDANCE':
      return { ...state, attendance: action.payload };
    case 'ADD_ATTENDANCE':
      return { ...state, attendance: [...state.attendance, action.payload] };
    case 'UPDATE_ATTENDANCE':
      return {
        ...state,
        attendance: state.attendance.map(att =>
          att.id === action.payload.id ? action.payload : att
        )
      };
    
    case 'SET_DAILY_REPORTS':
      return { ...state, dailyReports: action.payload };
    case 'ADD_DAILY_REPORT':
      return { ...state, dailyReports: [...state.dailyReports, action.payload] };
    case 'UPDATE_DAILY_REPORT':
      return {
        ...state,
        dailyReports: state.dailyReports.map(report =>
          report.id === action.payload.id ? action.payload : report
        )
      };
    
    case 'SET_OJT_RECORDS':
      return { ...state, ojtRecords: action.payload };
    case 'ADD_OJT_RECORD':
      return { ...state, ojtRecords: [...state.ojtRecords, action.payload] };
    case 'UPDATE_OJT_RECORD':
      return {
        ...state,
        ojtRecords: state.ojtRecords.map(record =>
          record.id === action.payload.id ? action.payload : record
        )
      };
    
    case 'SET_CERTIFICATES':
      return { ...state, certificates: action.payload };
    case 'ADD_CERTIFICATE':
      return { ...state, certificates: [...state.certificates, action.payload] };
    case 'UPDATE_CERTIFICATE':
      return {
        ...state,
        certificates: state.certificates.map(cert =>
          cert.id === action.payload.id ? action.payload : cert
        )
      };
    
    case 'SET_ANNOUNCEMENTS':
      return { ...state, announcements: action.payload };
    case 'ADD_ANNOUNCEMENT':
      return { ...state, announcements: [...state.announcements, action.payload] };
    case 'UPDATE_ANNOUNCEMENT':
      return {
        ...state,
        announcements: state.announcements.map(ann =>
          ann.id === action.payload.id ? action.payload : ann
        )
      };
    case 'DELETE_ANNOUNCEMENT':
      return {
        ...state,
        announcements: state.announcements.filter(ann => ann.id !== action.payload)
      };
    
    case 'SET_NOTIFICATIONS':
      return { ...state, notifications: action.payload };
    case 'ADD_NOTIFICATION':
      return { ...state, notifications: [...state.notifications, action.payload] };
    case 'MARK_NOTIFICATION_READ':
      return {
        ...state,
        notifications: state.notifications.map(notif =>
          notif.id === action.payload ? { ...notif, read: true } : notif
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

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [authInitialized, setAuthInitialized] = useState(false);

  // Initialize app
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const user = await getCurrentUser();
        
        if (mounted) {
          if (user) {
            dispatch({ type: 'SET_CURRENT_USER', payload: user });
            await fetchAllData(user);
          } else {
            dispatch({ type: 'SET_CURRENT_USER', payload: null });
          }
          setAuthInitialized(true);
        }
      } catch (error) {
        console.error('Init error:', error);
        if (mounted) {
          dispatch({ type: 'SET_CURRENT_USER', payload: null });
          setAuthInitialized(true);
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  // Listen to auth changes
  useEffect(() => {
    if (!supabase) {
      console.warn('Supabase not initialized - skipping auth listener');
      return;
    }
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const user = await getCurrentUser();
        dispatch({ type: 'SET_CURRENT_USER', payload: user });
        if (user) await fetchAllData(user);
      } else if (event === 'SIGNED_OUT') {
        dispatch({ type: 'LOGOUT' });
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Fetch all data from Supabase
  async function fetchAllData(user) {
    try {
      if (user.role === 'ADMIN') {
        // Admin sees everything
        const [
          users,
          programs,
          opportunities,
          applications,
          ojtRecords,
          attendance,
          dailyReports,
          requirements,
          certificates,
          announcements,
          settings
        ] = await Promise.all([
          getUsers(),
          getPrograms(),
          getOpportunities(),
          getApplications(),
          getOjtRecords(),
          getAttendance(),
          getDailyReports(),
          getRequirements(),
          getCertificates(),
          getAnnouncements(),
          getSettings()
        ]);

        dispatch({
          type: 'LOAD_DATA',
          payload: {
            users,
            programs,
            opportunities,
            applications,
            ojtRecords,
            attendance,
            dailyReports,
            requirements,
            certificates,
            announcements,
            settings
          }
        });
      } else {
        // Students see limited data
        const [programs, opportunities, announcements, settings] = await Promise.all([
          getPrograms(),
          getOpportunities(),
          getAnnouncements(),
          getSettings()
        ]);

        // Student-specific data
        const applications = await getApplications();
        const myApplications = applications.filter(a => a.userId === user.id);
        
        const ojtRecords = await getOjtRecords();
        const myOjtRecords = ojtRecords.filter(o => o.studentId === user.id);
        
        const attendance = await getAttendance();
        const myAttendance = attendance.filter(a => a.studentId === user.id);
        
        const dailyReports = await getDailyReports();
        const myReports = dailyReports.filter(r => r.studentId === user.id);
        
        const requirements = await getRequirements();
        const myRequirements = requirements.filter(r => r.studentId === user.id);
        
        const certificates = await getCertificates();
        const myCertificates = certificates.filter(c => c.studentId === user.id);
        
        const notifications = await getNotifications(user.id);

        dispatch({
          type: 'LOAD_DATA',
          payload: {
            users: [user],
            programs,
            opportunities,
            applications: myApplications,
            ojtRecords: myOjtRecords,
            attendance: myAttendance,
            dailyReports: myReports,
            requirements: myRequirements,
            certificates: myCertificates,
            announcements,
            notifications,
            settings
          }
        });
      }
    } catch (error) {
      console.error('Fetch data error:', error);
    }
  }

  const refreshData = async () => {
    if (state.currentUser) {
      await fetchAllData(state.currentUser);
    }
  };

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
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

export default AppContext;
