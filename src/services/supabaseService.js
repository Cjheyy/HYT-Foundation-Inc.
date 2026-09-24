import { supabase, toCamelCase, toSnakeCase } from '../config/supabase';

/* --------------------------------------------------------------------------
 * Shared status and date helpers
 * -------------------------------------------------------------------------- */

/**
 * Normalize values coming from different generations of the HYT schema.
 * The application has used both `Pending`/`PENDING_APPROVAL` and
 * `Clocked In`/`CLOCKED_IN` over time.  All verification code must compare
 * normalized values rather than relying on the casing returned by Postgres.
 */
export const normalizeStatus = (value) => String(value ?? '')
  .trim()
  .toUpperCase()
  .replace(/[\s-]+/g, '_');

export const normalizeRole = (value) => String(value ?? '')
  .trim()
  .toUpperCase()
  .replace(/[\s-]+/g, '_');

export const TRAINEE_ROLES = ['TRAINEE', 'OJT/INTERN', 'STUDENT'];
export const PENDING_ATTENDANCE_STATUSES = [
  'PENDING_CLOCK_IN',
  'PENDING_CLOCK_OUT',
  'PENDING_APPROVAL',
  'PENDING',
  'PENDING_APPROVE',
  'PENDING_OUT',
  'PENDING_REVIEW'
];
export const PENDING_APPLICATION_STATUSES = [
  'PENDING_APPROVAL',
  'PENDING_APPLICATION',
  'PENDING',
  'SUBMITTED',
  'APPLIED',
  'UNDER_REVIEW',
  'INTERVIEW'
];
export const PENDING_ACCOUNT_STATUSES = [
  'PENDING_APPROVAL',
  'PENDING_APPLICATION',
  'PENDING'
];
export const PENDING_REPORT_STATUSES = [
  'PENDING',
  'PENDING_APPROVAL',
  'SUBMITTED',
  'UNDER_REVIEW'
];

export const isTraineeRole = (role) => TRAINEE_ROLES.includes(normalizeRole(role));
export const isPendingAttendanceStatus = (status) =>
  PENDING_ATTENDANCE_STATUSES.includes(normalizeStatus(status));
export const isPendingReportStatus = (status) =>
  PENDING_REPORT_STATUSES.includes(normalizeStatus(status));
export const isPendingApplicationStatus = (status) =>
  PENDING_APPLICATION_STATUSES.includes(normalizeStatus(status));
export const isPendingAccountStatus = (status) =>
  PENDING_ACCOUNT_STATUSES.includes(normalizeStatus(status));
export const isApprovedAccountStatus = (status) =>
  ['APPROVED', 'ACCEPTED', 'ACTIVE', 'VERIFIED'].includes(normalizeStatus(status));
export const isPendingClockInStatus = (status) =>
  ['PENDING_CLOCK_IN', 'PENDING_CLOCK_IN_APPROVAL', 'PENDING'].includes(normalizeStatus(status));
export const isPendingClockOutStatus = (status) =>
  ['PENDING_CLOCK_OUT', 'PENDING_APPROVAL', 'PENDING_OUT', 'PENDING_REVIEW']
    .includes(normalizeStatus(status));
export const isFinalAttendanceStatus = (status) =>
  ['APPROVED', 'REJECTED', 'VOID', 'CANCELLED'].includes(normalizeStatus(status));

/** Resolve only explicit/legacy pending states to a lifecycle stage. */
export const getAttendanceStage = (log) => {
  if (!log) return null;
  const status = normalizeStatus(log.status);
  if (status === 'PENDING_CLOCK_IN' || status === 'PENDING_CLOCK_IN_APPROVAL') return 'CLOCK_IN';
  if (status === 'PENDING_CLOCK_OUT' || status === 'PENDING_OUT') return 'CLOCK_OUT';
  if (['PENDING', 'PENDING_APPROVAL', 'PENDING_REVIEW'].includes(status)) {
    return (log.timeIn ?? log.time_in) ? 'CLOCK_OUT' : 'CLOCK_IN';
  }
  return null;
};

export const todayISODate = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

/** A null deadline means that an event has no expiry date. */
export const isEventActive = (event, referenceDate = todayISODate()) => {
  if (!event) return false;
  if (event.isActive === false || event.is_active === false) return false;

  const status = normalizeStatus(event.status);
  if (!['PUBLISHED', 'ACTIVE', 'OPEN'].includes(status)) return false;
  if (['CLOSED', 'ARCHIVED', 'EXPIRED', 'DONE', 'COMPLETED', 'DEACTIVATED'].includes(status)) {
    return false;
  }

  const deadline = event.applicationDeadline || event.application_deadline || event.endDate;
  if (!deadline) return true;

  // ISO date strings compare safely without timezone drift.
  return String(deadline).slice(0, 10) >= String(referenceDate).slice(0, 10);
};

const requireSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase is not configured. Add REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY.');
  }
  return supabase;
};

const isMissingFunctionError = (error) => {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return [
    'pgrst202',
    '42883',
    '404',
    'function not found',
    'does not exist',
    'schema cache'
  ].some((part) => code.includes(part) || message.includes(part));
};

const isUuid = (value) => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const isMissingColumnError = (error) => {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return ['42703', 'pgrst204', 'column', 'does not exist'].some((part) =>
    code.includes(part) || message.includes(part)
  );
};

const mapRows = (rows) => toCamelCase(rows || []);

const statusOrFilter = (column, statuses) => statuses
  .map((status) => `${column}.eq.${status}`)
  .join(',');

const numericValue = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const normalizeEventForWrite = (event = {}, kind = 'program') => {
  const raw = {
    title: event.title,
    description: event.description,
    category: event.category,
    thrusts: event.thrusts,
    location: event.location,
    setup: event.setup,
    schedule: event.schedule,
    applicationDeadline: event.applicationDeadline,
    status: event.status === undefined ? undefined : (
      ['PUBLISHED', 'ACTIVE', 'OPEN'].includes(normalizeStatus(event.status))
        ? 'Published'
        : ['CLOSED', 'EXPIRED', 'DONE', 'COMPLETED'].includes(normalizeStatus(event.status))
          ? 'Closed'
          : 'Draft'
    ),
    image: event.image
  };

  if (kind === 'program') {
    raw.objectives = event.objectives;
    raw.requirements = event.requirements;
    raw.availableSlots = event.availableSlots === undefined
      ? undefined
      : Math.max(0, parseInt(event.availableSlots || 0, 10) || 0);
  } else {
    raw.organization = event.organization;
    raw.duration = event.duration;
    raw.requiredHours = event.requiredHours === undefined ? undefined : numericValue(event.requiredHours);
    raw.requirements = event.requirements;
    raw.availableSlots = event.availableSlots === undefined
      ? undefined
      : Math.max(0, parseInt(event.availableSlots || 0, 10) || 0);
  }

  const payload = toSnakeCase(raw);
  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) delete payload[key];
  });
  return payload;
};

const attendanceMigrationRequired = () => new Error(
  'Attendance workflow migration is required. Run OJT_TRACKING_PRODUCTION_MIGRATION.sql in Supabase before using Clock In/Clock Out.'
);

const getCurrentAuthUserId = async () => {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user?.id) return null;
  return data.user.id;
};

export const SAFE_USER_COLUMNS = [
  'id', 'email', 'role', 'full_name', 'first_name', 'last_name', 'profile_picture',
  'student_id', 'account_type', 'school', 'course', 'year_level', 'birthday', 'age',
  'address', 'contact_number', 'required_hours', 'rendered_hours', 'is_active',
  'application_status', 'reviewed_by', 'reviewed_at', 'rejection_reason',
  'created_at', 'updated_at', 'last_login'
].join(', ');

// ============================================
// USERS
// ============================================

export const getUsers = async () => {
  const client = requireSupabase();
  let result = await client
    .from('users')
    .select(SAFE_USER_COLUMNS)
    .order('created_at', { ascending: false });

  if (result.error) {
    result = await client.from('users').select('*').order('created_at', { ascending: false });
  }
  if (result.error) throw result.error;
  return mapRows(result.data);
};

export const getUserById = async (userId) => {
  const client = requireSupabase();
  let result = await client
    .from('users')
    .select(SAFE_USER_COLUMNS)
    .eq('id', userId)
    .maybeSingle();

  if (result.error) {
    result = await client.from('users').select('*').eq('id', userId).maybeSingle();
  }
  if (result.error) throw result.error;
  return result.data ? toCamelCase(result.data) : null;
};

export const updateUser = async (userId, updates) => {
  const client = requireSupabase();
  const { data, error } = await client
    .from('users')
    .update(toSnakeCase(updates))
    .eq('id', userId)
    .select(SAFE_USER_COLUMNS)
    .single();

  if (error) throw error;
  return toCamelCase(data);
};

// ==========================================================================
// PROGRAMS AND OPPORTUNITIES
// ==========================================================================

export const getPrograms = async ({ includeInactive = true } = {}) => {
  const client = requireSupabase();
  const { data, error } = await client
    .from('programs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  const programs = mapRows(data);
  return includeInactive ? programs : programs.filter((program) => isEventActive(program));
};

export const getActivePrograms = async () => {
  const programs = await getPrograms({ includeInactive: true });
  return programs.filter((program) => isEventActive(program));
};

export const createProgram = async (programData) => {
  const client = requireSupabase();
  const payload = normalizeEventForWrite(programData, 'program');
  const { data, error } = await client
    .from('programs')
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return toCamelCase(data);
};

export const updateProgram = async (programId, updates) => {
  const client = requireSupabase();
  const payload = normalizeEventForWrite(updates);
  const { data, error } = await client
    .from('programs')
    .update(payload)
    .eq('id', programId)
    .select()
    .single();

  if (error) throw error;
  return toCamelCase(data);
};

export const deleteProgram = async (programId) => {
  const client = requireSupabase();
  const { error } = await client.from('programs').delete().eq('id', programId);
  if (error) throw error;
  return true;
};

export const getOpportunities = async ({ includeInactive = true } = {}) => {
  const client = requireSupabase();
  const { data, error } = await client
    .from('opportunities')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  const opportunities = mapRows(data);
  return includeInactive ? opportunities : opportunities.filter((item) => isEventActive(item));
};

export const getActiveOpportunities = async () => {
  const opportunities = await getOpportunities({ includeInactive: true });
  return opportunities.filter((item) => isEventActive(item));
};

export const createOpportunity = async (opportunityData) => {
  const client = requireSupabase();
  const source = {
    ...opportunityData,
    // The database calls this field `category`; the old form called it `type`.
    category: opportunityData.category || opportunityData.type,
    // Keep only schema fields supported by both versions of the deployment.
    type: undefined
  };
  const payload = normalizeEventForWrite(source, 'opportunity');
  const { data, error } = await client
    .from('opportunities')
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return toCamelCase(data);
};

export const updateOpportunity = async (opportunityId, updates) => {
  const client = requireSupabase();
  const payload = normalizeEventForWrite(updates);
  const { data, error } = await client
    .from('opportunities')
    .update(payload)
    .eq('id', opportunityId)
    .select()
    .single();

  if (error) throw error;
  return toCamelCase(data);
};

export const deleteOpportunity = async (opportunityId) => {
  const client = requireSupabase();
  const { error } = await client.from('opportunities').delete().eq('id', opportunityId);
  if (error) throw error;
  return true;
};

/**
 * Close events whose application deadline has passed.  The database migration
 * also exposes an RPC for a scheduled job; the direct update is a safe
 * compatibility fallback for existing projects that have not installed it.
 */
export const cleanupExpiredEvents = async () => {
  const client = requireSupabase();
  const today = todayISODate();
  const result = { programs: 0, opportunities: 0 };

  const { data: rpcResult, error: rpcError } = await client.rpc('expire_hyt_events');
  if (!rpcError && rpcResult) {
    result.programs = Number(rpcResult.programs || rpcResult.program_count || 0);
    result.opportunities = Number(rpcResult.opportunities || rpcResult.opportunity_count || 0);
    return result;
  }

  const [programs, opportunities] = await Promise.allSettled([
    client
      .from('programs')
      .update({ status: 'Closed' })
      .eq('status', 'Published')
      .lt('application_deadline', today)
      .select('id'),
    client
      .from('opportunities')
      .update({ status: 'Closed' })
      .eq('status', 'Published')
      .lt('application_deadline', today)
      .select('id')
  ]);

  if (programs.status === 'fulfilled') result.programs = programs.value?.data?.length || 0;
  if (opportunities.status === 'fulfilled') result.opportunities = opportunities.value?.data?.length || 0;
  return result;
};

// ==========================================================================
// APPLICATIONS (program/opportunity applications)
// ==========================================================================

export const getApplications = async (userId = null) => {
  const client = requireSupabase();
  let query = client
    .from('applications')
    .select('*')
    .order('created_at', { ascending: false });

  if (userId) query = query.eq('user_id', userId);

  const { data, error } = await query;
  if (error) throw error;
  return mapRows(data);
};

export const createApplication = async (applicationData) => {
  const client = requireSupabase();
  const { data, error } = await client
    .from('applications')
    .insert([toSnakeCase(applicationData)])
    .select()
    .single();

  if (error) throw error;
  return toCamelCase(data);
};

/** Pending account sign-ups are stored as user profiles in this deployment. */
export const getPendingUserApplications = async (role = null) => {
  const client = requireSupabase();
  let query = client
    .from('users')
    .select('*')
    .or(statusOrFilter('application_status', ['PENDING_APPROVAL', 'Pending', 'pending', 'PENDING_APPLICATION']))
    .order('created_at', { ascending: true });

  if (role) {
    const roles = role === 'ojt'
      ? ['OJT/Intern', 'OJT_INTERN', 'ojt-student']
      : ['Trainee', 'TRAINEE', 'trainee', 'STUDENT'];
    query = query.in('role', roles);
  }

  const { data, error } = await query;
  if (error) {
    // Older installations have only application_status = 'Pending'.
    const fallback = await client
      .from('users')
      .select('*')
      .in('application_status', ['Pending', 'pending', 'PENDING_APPROVAL', 'PENDING_APPLICATION'])
      .order('created_at', { ascending: true });
    if (fallback.error) throw fallback.error;
    return mapRows(fallback.data).filter((user) =>
      isTraineeRole(user.role) && (!role || (role === 'ojt' ? normalizeRole(user.role) === 'OJT/INTERN' : ['TRAINEE', 'STUDENT'].includes(normalizeRole(user.role))))
    );
  }

  return mapRows(data).filter((user) => isTraineeRole(user.role) && isPendingAccountStatus(user.applicationStatus));
};

export const getUserApplicationsByStatus = async (status = 'PENDING_APPROVAL', role = null) => {
  const client = requireSupabase();
  const normalized = normalizeStatus(status);
  if (['PENDING', 'PENDING_APPROVAL', 'PENDING_APPLICATION'].includes(normalized)) {
    return getPendingUserApplications(role);
  }

  let query = client.from('users').select('*').order('created_at', { ascending: false });
  if (normalized === 'APPROVED') {
    query = query.or(statusOrFilter('application_status', ['APPROVED', 'Approved', 'approved']));
  } else if (['REJECTED', 'DECLINED'].includes(normalized)) {
    query = query.or(statusOrFilter('application_status', ['REJECTED', 'Rejected', 'rejected']));
  }
  if (role) {
    const roles = role === 'ojt' ? ['OJT/Intern', 'OJT_INTERN', 'ojt-student'] : ['Trainee', 'TRAINEE', 'trainee', 'STUDENT'];
    query = query.in('role', roles);
  }
  const { data, error } = await query;
  if (error) {
    if (isMissingColumnError(error)) {
      return getUsers().then((users) => users.filter((user) =>
        isTraineeRole(user.role) &&
        (normalized === 'APPROVED'
          ? isApprovedAccountStatus(user.applicationStatus)
          : ['REJECTED', 'DECLINED'].includes(normalized))
      ));
    }
    throw error;
  }
  return mapRows(data).filter((user) => isTraineeRole(user.role));
};

export const approveUserApplication = async (targetUserId, adminUserId = null, note = '') => {
  const client = requireSupabase();
  const resolvedAdminId = isUuid(adminUserId) ? adminUserId : await getCurrentAuthUserId();
  const { data, error } = await client.rpc('approve_user_application', {
    target_user_id: targetUserId,
    admin_id: resolvedAdminId
  });

  if (!error) {
    if (data && data.success === false) throw new Error(data.message || 'Application approval failed');
    return getUserById(targetUserId).catch(() => ({
      id: targetUserId,
      applicationStatus: 'APPROVED',
      isActive: true
    }));
  }

  // Compatibility fallback for projects that have not deployed the RPC yet.
  if (!isMissingFunctionError(error)) throw error;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Account approval migration is required. Run OJT_TRACKING_PRODUCTION_MIGRATION.sql in Supabase.');
  }
  let updateResult = await client
    .from('users')
    .update({
      application_status: 'APPROVED',
      is_active: true,
      reviewed_by: resolvedAdminId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: null
    })
    .eq('id', targetUserId)
    .in('application_status', ['PENDING_APPROVAL', 'PENDING', 'Pending', 'PENDING_APPLICATION'])
    .select()
    .single();
  if (updateResult.error) {
    // Older schemas constrained the column to title case.
    updateResult = await client
      .from('users')
      .update({
        application_status: 'Approved',
        is_active: true,
        reviewed_by: resolvedAdminId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: null
      })
      .eq('id', targetUserId)
      .in('application_status', ['Pending', 'pending', 'PENDING_APPROVAL', 'PENDING_APPLICATION'])
      .select()
      .single();
  }
  if (updateResult.error) throw updateResult.error;
  return toCamelCase(updateResult.data);
};

export const rejectUserApplication = async (targetUserId, adminUserId = null, reason = '') => {
  const client = requireSupabase();
  const resolvedAdminId = isUuid(adminUserId) ? adminUserId : await getCurrentAuthUserId();
  const trimmedReason = String(reason || '').trim();
  if (trimmedReason.length < 10) throw new Error('Rejection reason must be at least 10 characters.');

  const { data, error } = await client.rpc('reject_user_application', {
    target_user_id: targetUserId,
    admin_id: resolvedAdminId,
    reason: trimmedReason
  });

  if (!error) {
    if (data && data.success === false) throw new Error(data.message || 'Application rejection failed');
    return getUserById(targetUserId).catch(() => ({
      id: targetUserId,
      applicationStatus: 'REJECTED',
      isActive: false
    }));
  }

  if (!isMissingFunctionError(error)) throw error;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Account approval migration is required. Run OJT_TRACKING_PRODUCTION_MIGRATION.sql in Supabase.');
  }
  let updateResult = await client
    .from('users')
    .update({
      application_status: 'REJECTED',
      is_active: false,
      reviewed_by: resolvedAdminId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: trimmedReason
    })
    .eq('id', targetUserId)
    .in('application_status', ['PENDING_APPROVAL', 'PENDING', 'Pending', 'PENDING_APPLICATION'])
    .select()
    .single();
  if (updateResult.error) {
    updateResult = await client
      .from('users')
      .update({
        application_status: 'Rejected',
        is_active: false,
        reviewed_by: resolvedAdminId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: trimmedReason
      })
      .eq('id', targetUserId)
      .in('application_status', ['Pending', 'pending', 'PENDING_APPROVAL', 'PENDING_APPLICATION'])
      .select()
      .single();
  }
  if (updateResult.error) throw updateResult.error;
  return toCamelCase(updateResult.data);
};

// ==========================================================================
// OJT RECORDS / LEGACY ATTENDANCE
// ==========================================================================

export const getOjtRecords = async () => {
  const client = requireSupabase();
  const { data, error } = await client
    .from('ojt_records')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return mapRows(data);
};

export const getAttendance = async () => {
  const client = requireSupabase();
  const { data, error } = await client
    .from('attendance')
    .select('*')
    .order('date', { ascending: false });
  if (error) throw error;
  return mapRows(data);
};

export const createAttendance = async (attendanceData) => {
  const client = requireSupabase();
  const { data, error } = await client
    .from('attendance')
    .insert([toSnakeCase(attendanceData)])
    .select()
    .single();
  if (error) throw error;
  return toCamelCase(data);
};

export const getDailyReportsOld = async () => {
  const client = requireSupabase();
  const { data, error } = await client
    .from('daily_reports')
    .select('*')
    .order('date', { ascending: false });
  if (error) throw error;
  return mapRows(data);
};

export const createDailyReportOld = async (reportData) => {
  const client = requireSupabase();
  const { data, error } = await client
    .from('daily_reports')
    .insert([toSnakeCase(reportData)])
    .select()
    .single();
  if (error) throw error;
  return toCamelCase(data);
};

export const getRequirements = async () => {
  const client = requireSupabase();
  const { data, error } = await client
    .from('requirements')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return mapRows(data);
};

export const getCertificates = async () => {
  const client = requireSupabase();
  const { data, error } = await client
    .from('certificates')
    .select('*')
    .order('issue_date', { ascending: false });
  if (error) throw error;
  return mapRows(data);
};

export const getAnnouncements = async () => {
  const client = requireSupabase();
  const { data, error } = await client
    .from('announcements')
    .select('*')
    .eq('status', 'Published')
    .order('published_at', { ascending: false });
  if (error) throw error;
  return mapRows(data);
};

export const getNotifications = async (userId) => {
  const client = requireSupabase();
  const { data, error } = await client
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return mapRows(data);
};

export const getSettings = async () => {
  const client = requireSupabase();
  const { data, error } = await client.from('settings').select('*');
  if (error) throw error;
  return (data || []).reduce((settings, setting) => {
    settings[setting.key] = setting.value;
    return settings;
  }, {});
};

// ==========================================================================
// ATTENDANCE_LOGS — dual approval state machine
// ==========================================================================

const attendanceUserSelect = `
  *,
  user:users(id, full_name, email, school, role, required_hours, rendered_hours)
`;

const getAttendanceLogById = async (attendanceId, client = requireSupabase()) => {
  let result = await client
    .from('attendance_logs')
    .select(attendanceUserSelect)
    .eq('id', attendanceId)
    .maybeSingle();

  // Some old deployments do not have all columns used in the relation select.
  if (result.error) {
    result = await client.from('attendance_logs').select('*').eq('id', attendanceId).maybeSingle();
  }
  if (result.error) throw result.error;
  return result.data ? toCamelCase(result.data) : null;
};

export const getAttendanceLogs = async (userId = null) => {
  const client = requireSupabase();
  let query = client
    .from('attendance_logs')
    .select(attendanceUserSelect)
    .order('date', { ascending: false });

  if (userId) query = query.eq('user_id', userId);

  let result = await query;
  if (result.error) {
    result = await client.from('attendance_logs').select('*').order('date', { ascending: false });
    if (result.error) throw result.error;
    return userId
      ? mapRows(result.data).filter((row) => row.userId === userId)
      : mapRows(result.data);
  }
  return mapRows(result.data);
};

export const createAttendanceLog = async (attendanceData) => {
  const client = requireSupabase();
  const { data, error } = await client
    .from('attendance_logs')
    .insert([toSnakeCase(attendanceData)])
    .select()
    .single();
  if (error) throw error;
  return toCamelCase(data);
};

export const updateAttendanceLog = async (attendanceId, updates) => {
  const client = requireSupabase();
  const { data, error } = await client
    .from('attendance_logs')
    .update(toSnakeCase(updates))
    .eq('id', attendanceId)
    .select()
    .single();
  if (error) throw error;
  return toCamelCase(data);
};

/**
 * Submit a clock-in request.  The timer must not start here.  The database
 * sets time_in only when an administrator approves PENDING_CLOCK_IN.
 */
export const clockIn = async (userId, latitude, longitude) => {
  const client = requireSupabase();
  if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
    throw new Error('A valid location is required before submitting a clock-in request.');
  }

  const params = {
    p_user_id: userId,
    p_latitude: Number(latitude),
    p_longitude: Number(longitude)
  };

  const { data, error } = await client.rpc('request_clock_in', params);
  if (!error) {
    if (!data?.success) throw new Error(data?.message || data?.error || 'Clock-in request failed');
    const record = await getAttendanceLogById(data.attendance_id, client);
    return { ...(record || {}), locationName: data.location || data.location_name || null };
  }

  if (!isMissingFunctionError(error)) throw error;
  if (process.env.NODE_ENV === 'production') throw attendanceMigrationRequired();

  // Development compatibility fallback for a database that has not installed
  // request_clock_in. Production writes are intentionally RPC-only.
  const today = todayISODate();
  const existingResult = await client
    .from('attendance_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .order('created_at', { ascending: false })
    .limit(1);
  if (existingResult.error) throw existingResult.error;

  const existing = existingResult.data?.[0];
  if (existing && isFinalAttendanceStatus(existing.status)) {
    throw new Error('Attendance for today has already been completed. Please try again tomorrow.');
  }
  if (existing && getAttendanceStage(existing) === 'CLOCK_OUT') {
    throw new Error('Your clock-out request is awaiting admin approval.');
  }
  if (existing && getAttendanceStage(existing) === 'CLOCK_IN') {
    throw new Error('Your clock-in request is awaiting admin approval.');
  }

  const payload = {
    user_id: userId,
    date: today,
    time_in: null,
    latitude: Number(latitude),
    longitude: Number(longitude),
    location_name: 'Pending geofence verification',
    status: 'PENDING_CLOCK_IN',
    requested_at: new Date().toISOString()
  };

  let result = existing
    ? await client.from('attendance_logs').update(payload).eq('id', existing.id).select().single()
    : await client.from('attendance_logs').insert([payload]).select().single();
  if (result.error && result.error.code === '23514') {
    const legacyPayload = { ...payload, status: 'Pending' };
    result = existing
      ? await client.from('attendance_logs').update(legacyPayload).eq('id', existing.id).select().single()
      : await client.from('attendance_logs').insert([legacyPayload]).select().single();
  }
  if (result.error) throw result.error;
  return toCamelCase(result.data);
};

/**
 * Submit a clock-out request and freeze the elapsed duration immediately.
 * No hours are credited until an administrator approves the request.
 */
export const clockOut = async (userId) => {
  const client = requireSupabase();
  const today = todayISODate();
  const existingResult = await client
    .from('attendance_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .order('created_at', { ascending: false })
    .limit(1);
  if (existingResult.error) throw existingResult.error;

  const existing = existingResult.data?.[0];
  const status = normalizeStatus(existing?.status);

  // Prefer the database transaction so the frozen timestamp and duration
  // are generated by the same clock as the approval.
  const { data: rpcData, error: rpcError } = await client.rpc('request_clock_out', {
    p_user_id: userId
  });
  if (!rpcError) {
    if (!rpcData?.success) throw new Error(rpcData?.message || 'Clock-out request failed');
    const record = await getAttendanceLogById(rpcData.attendance_id, client);
    return record || toCamelCase({
      ...existing,
      status: rpcData.status || 'PENDING_CLOCK_OUT',
      pending_end_time: rpcData.pending_end_time,
      duration_seconds: rpcData.duration_seconds,
      rendered_hours: rpcData.rendered_hours
    });
  }
  if (!isMissingFunctionError(rpcError)) throw rpcError;
  if (process.env.NODE_ENV === 'production') throw attendanceMigrationRequired();

  if (!existing || !existing.time_in || status !== 'CLOCKED_IN') {
    if (isPendingClockInStatus(status)) {
      throw new Error('Clock-in is still awaiting admin approval.');
    }
    throw new Error('No active clock-in was found. Please wait for clock-in approval first.');
  }

  const now = new Date();
  const start = new Date(existing.time_in);
  const durationSeconds = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 1000));
  const renderedHours = Math.round((durationSeconds / 3600) * 10000) / 10000;
  const payload = {
    status: 'PENDING_CLOCK_OUT',
    pending_end_time: now.toISOString(),
    duration_seconds: durationSeconds,
    rendered_hours: renderedHours
  };

  let result = await client
    .from('attendance_logs')
    .update(payload)
    .eq('id', existing.id)
    .eq('status', 'CLOCKED_IN')
    .select()
    .maybeSingle();

  if (result.error && result.error.code === '23514') {
    result = await client
      .from('attendance_logs')
      .update({ ...payload, status: 'PENDING_APPROVAL' })
      .eq('id', existing.id)
      .eq('status', 'CLOCKED_IN')
      .select()
      .maybeSingle();
  }
  if (result.error) throw result.error;
  if (!result.data) {
    throw new Error('This attendance request was changed by another process. Refresh and try again.');
  }
  return toCamelCase(result.data);
};

export const getTodayAttendance = async (userId) => {
  const client = requireSupabase();
  const { data, error } = await client
    .from('attendance_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('date', todayISODate())
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] ? toCamelCase(data[0]) : null;
};

/** All pending attendance states are normalized before they reach the UI. */
export const getPendingAttendance = async () => {
  const client = requireSupabase();
  let result = await client
    .from('attendance_logs')
    .select(attendanceUserSelect)
    .or(statusOrFilter('status', [
      'PENDING_CLOCK_IN',
      'PENDING_CLOCK_OUT',
      'PENDING_APPROVAL',
      'PENDING_REVIEW',
      'PENDING_OUT',
      'PENDING_APPROVE',
      'PENDING',
      'Pending'
    ]))
    .order('created_at', { ascending: true });

  if (result.error) {
    result = await client
      .from('attendance_logs')
      .select('*')
      .order('created_at', { ascending: true });
  }
  if (result.error) throw result.error;
  return mapRows(result.data).filter((log) => isPendingAttendanceStatus(log.status));
};

const normalizeAdminArgs = async (adminUserId, adminNote) => {
  if (isUuid(adminUserId)) {
    return { adminUserId, adminNote: String(adminNote || '') };
  }
  return {
    adminUserId: await getCurrentAuthUserId(),
    adminNote: String(adminUserId || adminNote || '')
  };
};

const updateAttendanceStatusAtomically = async (attendanceId, expectedStatuses, updates) => {
  const client = requireSupabase();
  const { data, error } = await client
    .from('attendance_logs')
    .update(updates)
    .eq('id', attendanceId)
    .in('status', expectedStatuses)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('This request was already processed or is no longer pending.');
  return toCamelCase(data);
};

/**
 * Approve either stage of attendance.  PENDING_CLOCK_IN starts the timer;
 * PENDING_CLOCK_OUT/PENDING_APPROVAL freezes then credits the hours.
 * The operation is idempotent for an already APPROVED request.
 */
export const approveAttendance = async (attendanceId, adminUserId = null, adminNote = '') => {
  const client = requireSupabase();
  const args = await normalizeAdminArgs(adminUserId, adminNote);
  const current = await getAttendanceLogById(attendanceId, client);
  if (!current) throw new Error('Attendance request not found.');

  const status = normalizeStatus(current.status);
  if (status === 'APPROVED') return current;

  const now = new Date().toISOString();
  const stage = getAttendanceStage(current);
  const isClockIn = stage === 'CLOCK_IN';

  if (!stage) {
    throw new Error(`Cannot approve attendance with status "${current.status}".`);
  }

  const payload = {
    status: isClockIn ? 'CLOCKED_IN' : 'APPROVED',
    approved_by: args.adminUserId,
    approved_at: now,
    admin_note: args.adminNote || null
  };

  if (isClockIn) {
    // The approval timestamp is the exact start of the live timer.
    payload.time_in = now;
  } else {
    payload.time_out = current.pendingEndTime || now;
    if (!current.pendingEndTime && current.timeIn) {
      const duration = Math.max(0, Math.floor((new Date(now).getTime() - new Date(current.timeIn).getTime()) / 1000));
      payload.pending_end_time = now;
      payload.duration_seconds = duration;
      payload.rendered_hours = Math.round((duration / 3600) * 10000) / 10000;
    }
  }

  const expected = isClockIn
    ? ['PENDING_CLOCK_IN', 'PENDING_APPROVAL', 'PENDING_REVIEW', 'PENDING', 'Pending']
    : ['PENDING_CLOCK_OUT', 'PENDING_OUT', 'PENDING_APPROVAL', 'PENDING_REVIEW', 'PENDING', 'Pending'];

  // Use the atomic RPC when installed.  It prevents two admins from crediting
  // the same session twice and applies the approval trigger in one transaction.
  const rpcName = isClockIn ? 'approve_clock_in_request' : 'approve_attendance_request';
  const { error: rpcError } = await client.rpc(rpcName, {
    p_attendance_id: attendanceId,
    p_admin_id: args.adminUserId,
    p_admin_note: args.adminNote || null
  });
  if (!rpcError) return getAttendanceLogById(attendanceId, client);

  if (!isMissingFunctionError(rpcError)) throw rpcError;
  if (process.env.NODE_ENV === 'production') throw attendanceMigrationRequired();
  await updateAttendanceStatusAtomically(attendanceId, expected, payload);
  return getAttendanceLogById(attendanceId, client);
};

export const rejectAttendance = async (attendanceId, adminUserId = null, adminNote = '') => {
  const client = requireSupabase();
  const args = await normalizeAdminArgs(adminUserId, adminNote);
  const note = String(args.adminNote || '').trim();
  if (note.length < 10) throw new Error('Admin note is required for rejection (minimum 10 characters).');

  const current = await getAttendanceLogById(attendanceId, client);
  if (!current) throw new Error('Attendance request not found.');
  const status = normalizeStatus(current.status);
  if (status === 'REJECTED') return current;

  const stage = getAttendanceStage(current);
  if (!stage) throw new Error(`Cannot reject attendance with status "${current.status}".`);
  const expected = stage === 'CLOCK_IN'
    ? ['PENDING_CLOCK_IN', 'PENDING_APPROVAL', 'PENDING_REVIEW', 'PENDING', 'Pending']
    : ['PENDING_CLOCK_OUT', 'PENDING_OUT', 'PENDING_APPROVAL', 'PENDING_REVIEW', 'PENDING', 'Pending'];

  const updates = {
    status: 'REJECTED',
    approved_by: args.adminUserId,
    approved_at: new Date().toISOString(),
    admin_note: note,
    time_out: null,
    rendered_hours: 0
  };

  const { error: rpcError } = await client.rpc('reject_attendance_request', {
    p_attendance_id: attendanceId,
    p_admin_id: args.adminUserId,
    p_admin_note: note
  });
  if (!rpcError) return getAttendanceLogById(attendanceId, client);
  if (!isMissingFunctionError(rpcError)) throw rpcError;
  if (process.env.NODE_ENV === 'production') throw attendanceMigrationRequired();

  await updateAttendanceStatusAtomically(attendanceId, expected, updates);
  return getAttendanceLogById(attendanceId, client);
};

// ==========================================================================
// OT REQUESTS
// ==========================================================================

export const getOtRequests = async (userId = null) => {
  const client = requireSupabase();
  let query = client
    .from('ot_requests')
    .select('*, attendance_logs(*), user:users(id, full_name, email, school)')
    .order('created_at', { ascending: false });
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;
  if (error) throw error;
  return mapRows(data);
};

export const createOtRequest = async (otRequestData) => {
  const client = requireSupabase();
  const { data, error } = await client
    .from('ot_requests')
    .insert([toSnakeCase(otRequestData)])
    .select()
    .single();
  if (error) throw error;
  return toCamelCase(data);
};

export const updateOtRequest = async (otRequestId, updates) => {
  const client = requireSupabase();
  const { data, error } = await client
    .from('ot_requests')
    .update(toSnakeCase(updates))
    .eq('id', otRequestId)
    .select()
    .single();
  if (error) throw error;
  return toCamelCase(data);
};

export const approveOtRequest = async (otRequestId, adminNote = '') =>
  updateOtRequest(otRequestId, { status: 'APPROVED', adminNote });

export const rejectOtRequest = async (otRequestId, adminNote) => {
  if (!adminNote || String(adminNote).trim().length < 10) {
    throw new Error('Admin note is required for rejection (minimum 10 characters).');
  }
  return updateOtRequest(otRequestId, { status: 'REJECTED', adminNote });
};

// ==========================================================================
// DAILY REPORTS
// ==========================================================================

const normalizeReportRow = (row) => {
  const report = toCamelCase(row || {});
  const userId = report.userId || report.studentId;
  const reportDate = report.reportDate || report.date;
  const accomplishments = report.accomplishments || report.tasksCompleted || report.notes || '';
  return {
    ...report,
    userId,
    studentId: report.studentId || userId,
    reportDate,
    date: report.date || reportDate,
    accomplishments,
    tasksCompleted: report.tasksCompleted || accomplishments,
    status: report.status || 'PENDING'
  };
};

export const getDailyReports = async (userId = null) => {
  const client = requireSupabase();
  let query = client
    .from('daily_reports')
    .select('*, user:users(id, full_name, email, school)')
    .order('report_date', { ascending: false });
  if (userId) query = query.eq('user_id', userId);

  let result = await query;
  if (result.error) {
    // The original schema used student_id/date/tasks_completed.  Read the
    // table without naming the newer columns so the UI can still operate
    // while the compatibility migration is being applied.
    let legacyQuery = client.from('daily_reports').select('*').order('created_at', { ascending: false });
    if (userId) legacyQuery = legacyQuery.eq('student_id', userId);
    result = await legacyQuery;
    if (result.error) {
      result = await client.from('daily_reports').select('*').order('created_at', { ascending: false });
    }
  }
  if (result.error) throw result.error;
  const rows = (result.data || []).map(normalizeReportRow);
  return userId ? rows.filter((report) => report.userId === userId) : rows;
};

export const getPendingDailyReports = async () => {
  const reports = await getDailyReports();
  return reports.filter((report) => isPendingReportStatus(report.status));
};

export const createDailyReport = async (reportData) => {
  const client = requireSupabase();
  const payload = {
    ...toSnakeCase(reportData),
    status: 'PENDING',
    created_at: reportData.createdAt || new Date().toISOString()
  };
  let result = await client
    .from('daily_reports')
    .insert([payload])
    .select()
    .single();

  if (result.error && (isMissingColumnError(result.error) || result.error.code === '23514')) {
    // First try the current column set with the title-case status accepted by
    // older deployments.  Only then fall back to the legacy column names.
    if (result.error.code === '23514') {
      const titleCaseResult = await client
        .from('daily_reports')
        .insert([{ ...payload, status: 'Pending' }])
        .select()
        .single();
      if (!titleCaseResult.error) {
        result = titleCaseResult;
      }
    }
    if (result.error && isMissingColumnError(result.error)) {
      const legacyPayload = {
        student_id: reportData.userId || reportData.studentId,
        ojt_id: reportData.ojtId || reportData.ojt_id,
        date: reportData.reportDate || reportData.date,
        tasks_completed: reportData.accomplishments || '',
        status: 'Submitted',
        created_at: reportData.createdAt || new Date().toISOString()
      };
      result = await client.from('daily_reports').insert([legacyPayload]).select().single();
    }
  }
  if (result.error) throw result.error;
  return normalizeReportRow(result.data);
};

export const updateDailyReport = async (reportId, updates) => {
  const client = requireSupabase();
  let result = await client
    .from('daily_reports')
    .update(toSnakeCase(updates))
    .eq('id', reportId)
    .select()
    .single();

  if (result.error && (isMissingColumnError(result.error) || result.error.code === '23514')) {
    const legacyUpdates = {
      status: normalizeStatus(updates.status) === 'APPROVED' ? 'Reviewed' : 'Reviewed',
      feedback: updates.adminNote || updates.feedback || null,
      reviewed_at: updates.reviewedAt || new Date().toISOString()
    };
    result = await client.from('daily_reports').update(legacyUpdates).eq('id', reportId).select().single();
  }
  if (result.error) throw result.error;
  return normalizeReportRow(result.data);
};

export const approveDailyReport = async (reportId, adminNote = '') => {
  const client = requireSupabase();
  const { error } = await client.rpc('review_daily_report', {
    p_report_id: reportId,
    p_status: 'APPROVED',
    p_admin_note: adminNote || null
  });
  if (!error) return getDailyReports().then((rows) => rows.find((row) => row.id === reportId));
  if (!isMissingFunctionError(error)) throw error;
  if (process.env.NODE_ENV === 'production') throw new Error('Daily report review migration is required. Run OJT_TRACKING_PRODUCTION_MIGRATION.sql in Supabase.');

  const report = await getDailyReports().then((rows) => rows.find((row) => row.id === reportId));
  if (report && !isPendingReportStatus(report.status) && normalizeStatus(report.status) !== 'APPROVED') {
    throw new Error(`Cannot approve report with status "${report.status}".`);
  }
  return updateDailyReport(reportId, {
    status: 'APPROVED',
    adminNote,
    reviewedAt: new Date().toISOString()
  });
};

export const rejectDailyReport = async (reportId, adminNote) => {
  const note = String(adminNote || '').trim();
  if (note.length < 10) {
    throw new Error('Admin note is required for rejection (minimum 10 characters).');
  }
  const client = requireSupabase();
  const { error } = await client.rpc('review_daily_report', {
    p_report_id: reportId,
    p_status: 'REJECTED',
    p_admin_note: note
  });
  if (!error) return getDailyReports().then((rows) => rows.find((row) => row.id === reportId));
  if (!isMissingFunctionError(error)) throw error;
  if (process.env.NODE_ENV === 'production') throw new Error('Daily report review migration is required. Run OJT_TRACKING_PRODUCTION_MIGRATION.sql in Supabase.');

  return updateDailyReport(reportId, {
    status: 'REJECTED',
    adminNote: note,
    reviewedAt: new Date().toISOString()
  });
};

// ==========================================================================
// ADMIN DASHBOARD
// ==========================================================================

const mapRpcDashboardStats = (data) => {
  const source = Array.isArray(data) ? data[0] : data;
  if (!source || typeof source !== 'object') return null;
  const totalStudents = Number(source.total_students ?? source.totalStudents ?? 0);
  const totalApplications = Number(source.total_applications ?? source.totalApplications ?? 0);
  const acceptedApplications = Number(source.accepted_applications ?? source.acceptedApplications ?? 0);
  const completedOJT = Number(source.completed_ojt ?? source.completedOJT ?? 0);
  const activePrograms = Number(source.active_programs ?? source.activePrograms ?? 0);
  const activeOpportunities = Number(source.active_opportunities ?? source.activeOpportunities ?? 0);
  const pendingAttendance = Number(source.pending_attendance ?? source.pendingAttendance ?? 0);
  const pendingReports = Number(source.pending_reports ?? source.pendingReports ?? source.pending_daily_reports ?? 0);
  return {
    totalStudents,
    totalApplications,
    acceptedApplications,
    completedOJT,
    activePrograms,
    activeOpportunities,
    totalProgramsOpportunities: Number(source.total_programs_opportunities ?? source.totalProgramsOpportunities ?? activePrograms + activeOpportunities),
    pendingAttendance,
    pendingReports,
    pendingDailyReports: pendingReports
  };
};

/**
 * Fetch all dashboard counters from the database.  A server RPC is preferred;
 * the row-based fallback is kept for older Supabase projects and still gives
 * exact counts (including mixed-case legacy statuses).
 */
export const getAdminDashboardStats = async () => {
  const client = requireSupabase();

  try {
    const { data, error } = await client.rpc('get_admin_dashboard_stats');
    if (!error) {
      const mapped = mapRpcDashboardStats(data);
      if (mapped) return mapped;
    }
  } catch (error) {
    console.warn('Dashboard stats RPC unavailable; using compatible queries.', error);
  }

  const [usersResult, programsResult, opportunitiesResult, attendanceResult, reportsResult] =
    await Promise.allSettled([
      client.from('users').select('id, role, application_status, is_active, required_hours, rendered_hours'),
      client.from('programs').select('id, status, application_deadline'),
      client.from('opportunities').select('id, status, application_deadline'),
      client.from('attendance_logs').select('id, status'),
      client.from('daily_reports').select('id, status')
    ]);

  const users = usersResult.status === 'fulfilled' ? usersResult.value.data || [] : [];
  const programs = programsResult.status === 'fulfilled' ? programsResult.value.data || [] : [];
  const opportunities = opportunitiesResult.status === 'fulfilled' ? opportunitiesResult.value.data || [] : [];
  const attendance = attendanceResult.status === 'fulfilled' ? attendanceResult.value.data || [] : [];
  const reports = reportsResult.status === 'fulfilled' ? reportsResult.value.data || [] : [];

  // Older projects may not have the approval columns yet.  A broad read is
  // safer than displaying false zeroes and lets the migration be deployed
  // independently of the frontend.
  let effectiveUsers = users;
  if ((!effectiveUsers.length && usersResult.status === 'rejected') ||
      usersResult.value?.error) {
    const fallback = await client.from('users').select('*');
    if (!fallback.error) effectiveUsers = fallback.data || [];
    else if (usersResult.status === 'rejected') throw usersResult.reason;
    else throw usersResult.value.error;
  }

  const totalStudents = effectiveUsers.filter((user) => isTraineeRole(user.role)).length;
  const totalApplications = effectiveUsers.filter((user) =>
    isTraineeRole(user.role) &&
    isPendingAccountStatus(user.application_status ?? user.applicationStatus)
  ).length;
  const acceptedApplications = effectiveUsers.filter((user) =>
    isTraineeRole(user.role) &&
    isApprovedAccountStatus(user.application_status ?? user.applicationStatus) &&
    (user.is_active ?? user.isActive) === true
  ).length;
  const completedOJT = effectiveUsers.filter((user) => {
    if (!isTraineeRole(user.role)) return false;
    const required = numericValue(user.required_hours);
    return required > 0 && numericValue(user.rendered_hours) >= required;
  }).length;

  const activePrograms = programs.filter((program) => isEventActive(program)).length;
  const activeOpportunities = opportunities.filter((opportunity) => isEventActive(opportunity)).length;
  const pendingAttendance = attendance.filter((log) => isPendingAttendanceStatus(log.status)).length;
  const pendingReports = reports.filter((report) => isPendingReportStatus(report.status)).length;

  return {
    totalStudents,
    totalApplications,
    acceptedApplications,
    completedOJT,
    activePrograms,
    activeOpportunities,
    totalProgramsOpportunities: activePrograms + activeOpportunities,
    pendingAttendance,
    pendingReports,
    pendingDailyReports: pendingReports
  };
};

export const getOjtProgressView = async () => {
  const client = requireSupabase();
  const { data, error } = await client
    .from('ojt_progress_view')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return mapRows(data);
};

export const getPendingApprovalsForUser = async (userId) => {
  const [attendance, otRequests, dailyReports] = await Promise.all([
    getAttendanceLogs(userId),
    getOtRequests(userId),
    getDailyReports(userId)
  ]);
  return {
    attendance: attendance.filter((log) => isPendingAttendanceStatus(log.status)),
    otRequests: otRequests.filter((request) => isPendingApplicationStatus(request.status)),
    dailyReports: dailyReports.filter((report) => isPendingReportStatus(report.status))
  };
};
