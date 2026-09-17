import { supabase, toCamelCase, toSnakeCase } from '../config/supabase';

// ============================================
// USERS
// ============================================
export const getUsers = async () => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return toCamelCase(data);
};

export const getUserById = async (userId) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) throw error;
  return toCamelCase(data);
};

export const updateUser = async (userId, updates) => {
  const { data, error } = await supabase
    .from('users')
    .update(toSnakeCase(updates))
    .eq('id', userId)
    .select()
    .single();
  
  if (error) throw error;
  return toCamelCase(data);
};

// ============================================
// PROGRAMS
// ============================================
export const getPrograms = async () => {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return toCamelCase(data);
};

// ============================================
// OPPORTUNITIES
// ============================================
export const getOpportunities = async () => {
  const { data, error } = await supabase
    .from('opportunities')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return toCamelCase(data);
};

// ============================================
// APPLICATIONS
// ============================================
export const getApplications = async () => {
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return toCamelCase(data);
};

export const createApplication = async (applicationData) => {
  const { data, error } = await supabase
    .from('applications')
    .insert([toSnakeCase(applicationData)])
    .select()
    .single();
  
  if (error) throw error;
  return toCamelCase(data);
};

// ============================================
// OJT RECORDS
// ============================================
export const getOjtRecords = async () => {
  const { data, error } = await supabase
    .from('ojt_records')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return toCamelCase(data);
};

// ============================================
// ATTENDANCE
// ============================================
export const getAttendance = async () => {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .order('date', { ascending: false });
  
  if (error) throw error;
  return toCamelCase(data);
};

export const createAttendance = async (attendanceData) => {
  const { data, error } = await supabase
    .from('attendance')
    .insert([toSnakeCase(attendanceData)])
    .select()
    .single();
  
  if (error) throw error;
  return toCamelCase(data);
};

// ============================================
// DAILY REPORTS
// ============================================
export const getDailyReportsOld = async () => {
  const { data, error } = await supabase
    .from('daily_reports')
    .select('*')
    .order('date', { ascending: false });
  
  if (error) throw error;
  return toCamelCase(data);
};

export const createDailyReportOld = async (reportData) => {
  const { data, error } = await supabase
    .from('daily_reports')
    .insert([toSnakeCase(reportData)])
    .select()
    .single();
  
  if (error) throw error;
  return toCamelCase(data);
};

// ============================================
// REQUIREMENTS
// ============================================
export const getRequirements = async () => {
  const { data, error } = await supabase
    .from('requirements')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return toCamelCase(data);
};

// ============================================
// CERTIFICATES
// ============================================
export const getCertificates = async () => {
  const { data, error } = await supabase
    .from('certificates')
    .select('*')
    .order('issue_date', { ascending: false });
  
  if (error) throw error;
  return toCamelCase(data);
};

// ============================================
// ANNOUNCEMENTS
// ============================================
export const getAnnouncements = async () => {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('status', 'Published')
    .order('published_at', { ascending: false });
  
  if (error) throw error;
  return toCamelCase(data);
};

// ============================================
// NOTIFICATIONS
// ============================================
export const getNotifications = async (userId) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (error) throw error;
  return toCamelCase(data);
};

// ============================================
// SETTINGS
// ============================================
export const getSettings = async () => {
  const { data, error } = await supabase
    .from('settings')
    .select('*');
  
  if (error) throw error;
  
  // Convert to object
  const settings = {};
  data.forEach(setting => {
    settings[setting.key] = setting.value;
  });
  
  return settings;
};


// ============================================
// ATTENDANCE LOGS (NEW)
// ============================================

export const getAttendanceLogs = async (userId = null) => {
  let query = supabase
    .from('attendance_logs')
    .select(`
      *,
      user:users(id, full_name, email, school, required_hours, rendered_hours)
    `)
    .order('date', { ascending: false });
  
  if (userId) {
    query = query.eq('user_id', userId);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return toCamelCase(data);
};

export const createAttendanceLog = async (attendanceData) => {
  const { data, error} = await supabase
    .from('attendance_logs')
    .insert([toSnakeCase(attendanceData)])
    .select()
    .single();
  
  if (error) throw error;
  return toCamelCase(data);
};

export const updateAttendanceLog = async (attendanceId, updates) => {
  const { data, error } = await supabase
    .from('attendance_logs')
    .update(toSnakeCase(updates))
    .eq('id', attendanceId)
    .select()
    .single();
  
  if (error) throw error;
  return toCamelCase(data);
};

export const clockIn = async (userId) => {
  const today = new Date().toISOString().split('T')[0];
  
  // Check if already clocked in today
  const { data: existing } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();
  
  if (existing && existing.time_in) {
    throw new Error('Already clocked in today');
  }
  
  if (existing) {
    // Update existing record
    const { data, error } = await supabase
      .from('attendance_logs')
      .update({ time_in: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();
    
    if (error) throw error;
    return toCamelCase(data);
  } else {
    // Create new record
    const { data, error } = await supabase
      .from('attendance_logs')
      .insert([{
        user_id: userId,
        date: today,
        time_in: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (error) throw error;
    return toCamelCase(data);
  }
};

export const clockOut = async (userId) => {
  const today = new Date().toISOString().split('T')[0];
  
  const { data: existing } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();
  
  if (!existing || !existing.time_in) {
    throw new Error('Must clock in first');
  }
  
  if (existing.time_out) {
    throw new Error('Already clocked out today');
  }
  
  const { data, error } = await supabase
    .from('attendance_logs')
    .update({ time_out: new Date().toISOString() })
    .eq('id', existing.id)
    .select()
    .single();
  
  if (error) throw error;
  return toCamelCase(data);
};

export const getTodayAttendance = async (userId) => {
  const today = new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();
  
  if (error) throw error;
  return data ? toCamelCase(data) : null;
};

export const approveAttendance = async (attendanceId, adminNote = '') => {
  return updateAttendanceLog(attendanceId, {
    status: 'Approved',
    adminNote
  });
};

export const rejectAttendance = async (attendanceId, adminNote) => {
  if (!adminNote) {
    throw new Error('Admin note is required for rejection');
  }
  
  return updateAttendanceLog(attendanceId, {
    status: 'Rejected',
    adminNote
  });
};

// ============================================
// OT REQUESTS (NEW)
// ============================================

export const getOtRequests = async (userId = null) => {
  let query = supabase
    .from('ot_requests')
    .select(`
      *,
      attendance_logs(*),
      user:users(id, full_name, email, school)
    `)
    .order('created_at', { ascending: false });
  
  if (userId) {
    query = query.eq('user_id', userId);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return toCamelCase(data);
};

export const createOtRequest = async (otRequestData) => {
  const { data, error } = await supabase
    .from('ot_requests')
    .insert([toSnakeCase(otRequestData)])
    .select()
    .single();
  
  if (error) throw error;
  return toCamelCase(data);
};

export const updateOtRequest = async (otRequestId, updates) => {
  const { data, error } = await supabase
    .from('ot_requests')
    .update(toSnakeCase(updates))
    .eq('id', otRequestId)
    .select()
    .single();
  
  if (error) throw error;
  return toCamelCase(data);
};

export const approveOtRequest = async (otRequestId, adminNote = '') => {
  return updateOtRequest(otRequestId, {
    status: 'Approved',
    adminNote
  });
};

export const rejectOtRequest = async (otRequestId, adminNote) => {
  if (!adminNote) {
    throw new Error('Admin note is required for rejection');
  }
  
  return updateOtRequest(otRequestId, {
    status: 'Rejected',
    adminNote
  });
};

// ============================================
// DAILY REPORTS (NEW)
// ============================================

export const getDailyReports = async (userId = null) => {
  let query = supabase
    .from('daily_reports')
    .select(`
      *,
      user:users(id, full_name, email, school)
    `)
    .order('report_date', { ascending: false });
  
  if (userId) {
    query = query.eq('user_id', userId);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return toCamelCase(data);
};

export const createDailyReport = async (reportData) => {
  const { data, error } = await supabase
    .from('daily_reports')
    .insert([toSnakeCase(reportData)])
    .select()
    .single();
  
  if (error) throw error;
  return toCamelCase(data);
};

export const updateDailyReport = async (reportId, updates) => {
  const { data, error } = await supabase
    .from('daily_reports')
    .update(toSnakeCase(updates))
    .eq('id', reportId)
    .select()
    .single();
  
  if (error) throw error;
  return toCamelCase(data);
};

export const approveDailyReport = async (reportId, adminNote = '') => {
  return updateDailyReport(reportId, {
    status: 'Approved',
    adminNote
  });
};

export const rejectDailyReport = async (reportId, adminNote) => {
  if (!adminNote) {
    throw new Error('Admin note is required for rejection');
  }
  
  return updateDailyReport(reportId, {
    status: 'Rejected',
    adminNote
  });
};

// ============================================
// ADMIN DASHBOARD STATS (NEW)
// ============================================

export const getAdminDashboardStats = async () => {
  try {
    // Get counts
    const [usersCount, pendingAttendance, pendingOtRequests, pendingReports] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('attendance_logs').select('id', { count: 'exact', head: true }).eq('status', 'Pending'),
      supabase.from('ot_requests').select('id', { count: 'exact', head: true }).eq('status', 'Pending'),
      supabase.from('daily_reports').select('id', { count: 'exact', head: true }).eq('status', 'Pending')
    ]);
    
    return {
      totalUsers: usersCount.count || 0,
      pendingAttendance: pendingAttendance.count || 0,
      pendingOtRequests: pendingOtRequests.count || 0,
      pendingReports: pendingReports.count || 0
    };
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return {
      totalUsers: 0,
      pendingAttendance: 0,
      pendingOtRequests: 0,
      pendingReports: 0
    };
  }
};

export const getOjtProgressView = async () => {
  const { data, error } = await supabase
    .from('ojt_progress_view')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return toCamelCase(data);
};

export const getPendingApprovalsForUser = async (userId) => {
  try {
    const [attendance, otRequests, dailyReports] = await Promise.all([
      supabase
        .from('attendance_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'Pending')
        .order('date', { ascending: false }),
      supabase
        .from('ot_requests')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'Pending')
        .order('created_at', { ascending: false }),
      supabase
        .from('daily_reports')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'Pending')
        .order('report_date', { ascending: false })
    ]);
    
    return {
      attendance: toCamelCase(attendance.data || []),
      otRequests: toCamelCase(otRequests.data || []),
      dailyReports: toCamelCase(dailyReports.data || [])
    };
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    return {
      attendance: [],
      otRequests: [],
      dailyReports: []
    };
  }
};
