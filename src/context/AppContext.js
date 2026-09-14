import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { 
  loadFromLocalStorage, 
  saveToLocalStorage,
  initializeData 
} from '../services/storageService';

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
  settings: {}
};

function appReducer(state, action) {
  switch (action.type) {
    // Auth actions
    case 'SET_CURRENT_USER':
      return { ...state, currentUser: action.payload };
    case 'LOGOUT':
      return { ...state, currentUser: null };
    
    // User actions
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
    
    // Program actions
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
    
    // Opportunity actions
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
    
    // Application actions
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
    
    // Requirements actions
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
    
    // Attendance actions
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
    
    // Daily Report actions
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
    
    // OJT Record actions
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
    
    // Certificate actions
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
    
    // Announcement actions
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
    
    // Notification actions
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
    
    // Bulk data load
    case 'LOAD_DATA':
      return { ...state, ...action.payload };
    
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Load data from localStorage on mount
  useEffect(() => {
    const savedData = loadFromLocalStorage();
    if (savedData) {
      dispatch({ type: 'LOAD_DATA', payload: savedData });
    } else {
      // Initialize with demo data
      const initialData = initializeData();
      dispatch({ type: 'LOAD_DATA', payload: initialData });
    }
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (state.users.length > 0) { // Only save if data is loaded
      saveToLocalStorage(state);
    }
  }, [state]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
