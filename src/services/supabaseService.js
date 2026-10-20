import { supabase, toCamelCase, toSnakeCase } from '../config/supabase';
import {
  GEOFENCE_ENFORCEMENT_ENABLED,
  GEOFENCE_RADIUS_METERS,
  OFFICE_LOCATIONS,
  haversineDistanceMeters
} from '../utils/geofence';
import {
  mergeSlotEntry,
  readSlotEntries,
  summariseForAccomplishments
} from '../utils/dailyReportSlots';

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
  'PENDING_CLOCK_IN_APPROVAL',
  'PENDING_IN',
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
  ['PENDING_CLOCK_IN', 'PENDING_CLOCK_IN_APPROVAL', 'PENDING_IN', 'PENDING_APPROVE', 'PENDING']
    .includes(normalizeStatus(status));
export const isPendingClockOutStatus = (status) =>
  ['PENDING_CLOCK_OUT', 'PENDING_OUT', 'PENDING_APPROVAL', 'PENDING_REVIEW', 'PENDING_APPROVE', 'PENDING']
    .includes(normalizeStatus(status));
export const isFinalAttendanceStatus = (status) =>
  ['APPROVED', 'REJECTED', 'VOID', 'CANCELLED'].includes(normalizeStatus(status));

/**
 * Resolve only explicit/legacy pending states to a lifecycle stage.
 *
 * Returns null for anything that is not a known pending state, so callers fail
 * closed instead of guessing.  `PENDING` / `PENDING_APPROVAL` are ambiguous
 * legacy values and are resolved from the presence of `time_in`.
 */
export const getAttendanceStage = (log) => {
  if (!log) return null;
  const status = normalizeStatus(log.status);
  if (['PENDING_CLOCK_IN', 'PENDING_CLOCK_IN_APPROVAL', 'PENDING_IN', 'PENDING_APPROVE'].includes(status)) {
    return 'CLOCK_IN';
  }
  if (['PENDING_CLOCK_OUT', 'PENDING_OUT'].includes(status)) return 'CLOCK_OUT';
  if (['PENDING', 'PENDING_APPROVAL', 'PENDING_REVIEW'].includes(status)) {
    return (log.timeIn ?? log.time_in) ? 'CLOCK_OUT' : 'CLOCK_IN';
  }
  return null;
};

/** Human label for a stage, including the legacy/ambiguous states. */
export const describeAttendanceStage = (log) => {
  const stage = getAttendanceStage(log);
  if (stage) return stage;
  return (log?.timeIn ?? log?.time_in) ? 'CLOCK_OUT' : 'CLOCK_IN';
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

// ==========================================================================
// THE THREE LISTING KINDS
// ==========================================================================
//
// `programs` (Dream Academy training), `events` (one-off events) and
// `opportunities` (OJT postings) are three separate tables, but they share one
// shape: a title, a deadline, a slot count and a status.  `kind` is the single
// discriminator the application path keys off, so the table name and the
// foreign-key column on `applications` are derived from it in ONE place rather
// than in a chain of ternaries.
//
// Adding a fourth kind means adding one line to each map - and nothing else.

export const LISTING_TABLE_BY_KIND = {
  program: 'programs',
  event: 'events',
  opportunity: 'opportunities'
};

export const LISTING_ID_COLUMN_BY_KIND = {
  program: 'program_id',
  event: 'event_id',
  opportunity: 'opportunity_id'
};

export const LISTING_KINDS = Object.keys(LISTING_TABLE_BY_KIND);

/** A Trainee may hold at most this many live event applications at once. */
export const MAX_ACTIVE_EVENT_APPLICATIONS = 3;

/** Parse a timestamp defensively; returns null when there is no usable value. */
const toTimestamp = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
};

/**
 * A listing's occupied window as epoch millis.
 *
 * An event with only a start is treated as a single instant.  A listing with NO
 * structured time at all returns null - and two nulls never clash, so legacy
 * rows and programs without timestamps can never block an application.
 */
export const eventWindow = (row) => {
  const start = toTimestamp(row?.startsAt ?? row?.starts_at);
  if (start === null) return null;
  const end = toTimestamp(row?.endsAt ?? row?.ends_at);
  return { start, end: end === null ? start : end };
};

/**
 * Whether two listings' windows collide.
 *
 * The comparison is INCLUSIVE: an event that ends at 10:00 and another that
 * starts at 10:00 count as a clash.  That is the conservative reading of
 * "no overlap" - a back-to-back pair usually still needs travel time, and a
 * whole-day event (00:00-23:59) must block anything else on that date.
 */
export const eventWindowsOverlap = (a, b) => {
  const left = eventWindow(a);
  const right = eventWindow(b);
  if (!left || !right) return false;
  return left.start <= right.end && right.start <= left.end;
};

const requireSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase is not configured. Add REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY.');
  }
  return supabase;
};

// The RPCs this app calls.  A "does not exist" error only means the RPC was
// never installed when it names one of these.  If it names an inner helper
// (e.g. hyt_close_previous_attendance) then the RPC DOES exist and its real
// error must surface - masking it as "migration required" hides the cause and
// sends you chasing a migration that already ran.
const ATTENDANCE_RPC_NAMES = [
  'request_clock_in',
  'request_clock_out',
  'approve_clock_in_request',
  'approve_attendance_request',
  'reject_attendance_request'
];

const isMissingFunctionError = (error, functionName = null) => {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();

  // PostgREST's own "not in the schema cache" answer (surfaces as HTTP 404).
  if (code === 'PGRST202') return true;

  // 42883 / "does not exist" - counts only when the missing function is the RPC
  // that was actually called, never when it is a helper that RPC calls.
  if (code === '42883' || message.includes('does not exist')) {
    const names = functionName ? [functionName] : ATTENDANCE_RPC_NAMES;
    return names.some((name) => message.includes(name));
  }

  return message.includes('function not found') || message.includes('schema cache');
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
  const slotInput = event.totalSlots ?? event.total_slots ?? event.availableSlots ?? event.available_slots;
  const parsedSlots = slotInput === undefined || slotInput === ''
    ? undefined
    : Math.max(0, parseInt(slotInput || 0, 10) || 0);
  const availableInput = event.availableSlots ?? event.available_slots ?? slotInput;
  const parsedAvailable = availableInput === undefined || availableInput === ''
    ? parsedSlots
    : Math.max(0, parseInt(availableInput || 0, 10) || 0);

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
    image: event.image,
    totalSlots: parsedSlots,
    availableSlots: parsedAvailable
  };

  if (kind === 'program') {
    raw.objectives = event.objectives;
    raw.requirements = event.requirements;
  } else if (kind === 'event') {
    // An EVENT keeps the program-shaped columns (so isEventActive /
    // getEventSlotState / readEventSlots work unchanged) and adds the two
    // structured timestamps the overlap rule needs.  `schedule` stays the
    // human-readable string the admin form previews.
    raw.objectives = event.objectives;
    raw.requirements = event.requirements;
    raw.startsAt = event.startsAt ?? event.starts_at;
    raw.endsAt = event.endsAt ?? event.ends_at;
  } else {
    raw.organization = event.organization;
    raw.duration = event.duration;
    raw.requiredHours = event.requiredHours === undefined ? undefined : numericValue(event.requiredHours);
    raw.requirements = event.requirements;
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

export const getUserByEmail = async (email) => {
  const client = requireSupabase();
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  const { data, error } = await client
    .from('users')
    .select(SAFE_USER_COLUMNS)
    .ilike('email', normalized)
    .maybeSingle();
  if (error) throw error;
  return data ? toCamelCase(data) : null;
};

/**
 * Activate / deactivate an account.
 *
 * `users.is_active` is not in the client's column-level UPDATE grant, and DELETE
 * is revoked outright, so a direct write is refused with 42501 -> HTTP 403
 * ("permission denied for table users").  The admin RPC is the supported path;
 * the direct write remains only as a development fallback for a database that
 * has not installed it.
 */
export const setUserActiveStatus = async (userId, isActive) => {
  const client = requireSupabase();
  const nextActive = Boolean(isActive);

  const { error } = await client.rpc('set_user_active', {
    p_user_id: userId,
    p_is_active: nextActive
  });

  if (error) {
    if (!isMissingFunctionError(error, 'set_user_active')) throw error;

    const { data, error: updateError } = await client
      .from('users')
      .update({ is_active: nextActive, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select(SAFE_USER_COLUMNS)
      .single();
    if (updateError) throw updateError;
    return toCamelCase(data);
  }

  // The RPC returns a summary only; re-read for the canonical row.  A failed
  // re-read must never make a committed change look like a failure.
  try {
    const fresh = await getUserById(userId);
    if (fresh) return fresh;
  } catch (readError) {
    console.warn('Account status changed but the row could not be re-read.', readError);
  }
  return { id: userId, isActive: nextActive };
};

export const deleteUserAccount = async (userId) => {
  const client = requireSupabase();

  const { error } = await client.rpc('delete_user_account', { p_user_id: userId });
  if (!error) return true;
  if (!isMissingFunctionError(error, 'delete_user_account')) throw error;

  const { error: deleteError } = await client.from('users').delete().eq('id', userId);
  if (deleteError) throw deleteError;
  return true;
};

// ==========================================================================
// PROGRAMS AND OPPORTUNITIES
// ==========================================================================

export const getPrograms = async ({ includeInactive = true } = {}) => {
  const client = requireSupabase();
  // Use select('*') to avoid 400s on deployments missing newer columns.
  // Slot fields are normalized in JS via getEventSlotState.
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
  let result = await client
    .from('programs')
    .insert([payload])
    .select()
    .single();

  if (result.error && isMissingColumnError(result.error)) {
    // Retry with only core columns present in every deployment.
    const minimal = {
      title: payload.title,
      description: payload.description,
      status: payload.status || 'Draft'
    };
    if (payload.category !== undefined) minimal.category = payload.category;
    if (payload.location !== undefined) minimal.location = payload.location;
    if (payload.schedule !== undefined) minimal.schedule = payload.schedule;
    if (payload.application_deadline !== undefined) minimal.application_deadline = payload.application_deadline;
    Object.keys(minimal).forEach((k) => { if (minimal[k] === undefined) delete minimal[k]; });
    result = await client.from('programs').insert([minimal]).select().single();
  }

  if (result.error) throw result.error;
  return toCamelCase(result.data);
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

// ==========================================================================
// EVENTS - the third listing kind, separate from Programs and Opportunities
// ==========================================================================

export const getEvents = async ({ includeInactive = true } = {}) => {
  const client = requireSupabase();
  // `select('*')` keeps this working on a deployment whose `events` table is
  // older than the client; slot fields are normalised in JS by
  // getEventSlotState.
  const { data, error } = await client
    .from('events')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  const events = mapRows(data);
  return includeInactive ? events : events.filter((item) => isEventActive(item));
};

export const getActiveEvents = async () => {
  const events = await getEvents({ includeInactive: true });
  return events.filter((item) => isEventActive(item));
};

export const createEvent = async (eventData) => {
  const client = requireSupabase();
  const payload = normalizeEventForWrite(eventData, 'event');
  const { data, error } = await client
    .from('events')
    .insert([payload])
    .select()
    .single();
  if (error) throw error;
  return toCamelCase(data);
};

export const updateEvent = async (eventId, updates) => {
  const client = requireSupabase();
  const payload = normalizeEventForWrite(updates, 'event');
  const { data, error } = await client
    .from('events')
    .update(payload)
    .eq('id', eventId)
    .select()
    .single();
  if (error) throw error;
  return toCamelCase(data);
};

export const deleteEvent = async (eventId) => {
  const client = requireSupabase();
  const { error } = await client.from('events').delete().eq('id', eventId);
  if (error) throw error;
  return true;
};

/** Read-only preview of the #3 rules, so the UI can disable Apply up front. */
export const getEventApplicationState = async (userId, targetRow) => {
  const client = requireSupabase();
  const state = { heldCount: 0, limit: MAX_ACTIVE_EVENT_APPLICATIONS, atLimit: false, clash: null };
  if (!userId) return state;

  const { data, error } = await client
    .from('applications')
    .select('id, status, event_id')
    .eq('user_id', userId)
    .not('event_id', 'is', null);
  if (error && error.code !== 'PGRST116') throw error;

  const held = (data || []).filter((row) => !applicationReleasesSlot(row.status));
  state.heldCount = held.length;
  state.atLimit = held.length >= MAX_ACTIVE_EVENT_APPLICATIONS;

  const heldIds = held.map((row) => row.event_id).filter(Boolean);
  if (!heldIds.length || !targetRow) return state;

  const { data: heldEvents, error: heldError } = await client
    .from('events')
    .select('id, title, starts_at, ends_at')
    .in('id', heldIds);
  if (heldError && heldError.code !== 'PGRST116') throw heldError;

  state.clash = (heldEvents || []).find((row) => eventWindowsOverlap(targetRow, row)) || null;
  return state;
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
  let result = await client
    .from('opportunities')
    .insert([payload])
    .select()
    .single();

  if (result.error && isMissingColumnError(result.error)) {
    const minimal = {
      title: payload.title,
      description: payload.description,
      status: payload.status || 'Draft'
    };
    if (payload.category !== undefined) minimal.category = payload.category;
    if (payload.location !== undefined) minimal.location = payload.location;
    if (payload.organization !== undefined) minimal.organization = payload.organization;
    if (payload.schedule !== undefined) minimal.schedule = payload.schedule;
    if (payload.duration !== undefined) minimal.duration = payload.duration;
    if (payload.application_deadline !== undefined) minimal.application_deadline = payload.application_deadline;
    Object.keys(minimal).forEach((k) => { if (minimal[k] === undefined) delete minimal[k]; });
    result = await client.from('opportunities').insert([minimal]).select().single();
    if (result.error && isMissingColumnError(result.error)) {
      const core = { title: payload.title, description: payload.description, status: payload.status || 'Draft' };
      result = await client.from('opportunities').insert([core]).select().single();
    }
  }

  if (result.error && result.error.code === '23514') {
    // Old CHECK constraint only allows Internship/OJT/Training/etc.
    // Map new generic categories to a legacy-safe value.
    const safePayload = { ...payload, category: 'Training' };
    // Strip slot columns that may not exist in old deployments.
    delete safePayload.total_slots;
    delete safePayload.available_slots;
    delete safePayload.required_hours;
    const retry = await client.from('opportunities').insert([safePayload]).select().single();
    if (!retry.error) result = retry;
    else {
      const coreRetry = await client.from('opportunities').insert([{
        title: payload.title,
        description: payload.description,
        category: 'Training',
        status: payload.status || 'Draft'
      }]).select().single();
      if (!coreRetry.error) result = coreRetry;
    }
  }

  if (result.error) throw result.error;
  return toCamelCase(result.data);
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
  const result = { programs: 0, opportunities: 0, events: 0 };

  // `events` is swept here, ALWAYS, before the RPC short-circuit below: the SQL
  // `expire_hyt_events` function may predate the events table, and a missed
  // sweep would leave a stale event Published - and therefore applyable - // forever.  A missing table simply returns an error object, never a throw.
  const eventsSweep = await client
    .from('events')
    .update({ status: 'Closed' })
    .eq('status', 'Published')
    .lt('application_deadline', today)
    .select('id');
  if (!eventsSweep.error) result.events = eventsSweep.data?.length || 0;

  const { data: rpcResult, error: rpcError } = await client.rpc('expire_hyt_events');
  if (!rpcError && rpcResult) {
    result.programs = Number(rpcResult.programs || rpcResult.program_count || 0);
    result.opportunities = Number(rpcResult.opportunities || rpcResult.opportunity_count || 0);
    result.events = Number(rpcResult.events || rpcResult.event_count || result.events);
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
  const run = async (selectClause) => {
    let query = client.from('applications').select(selectClause).order('created_at', { ascending: false });
    if (userId) query = query.eq('user_id', userId);
    return query;
  };
  let result = await run('*');
  if (result.error && isMissingColumnError(result.error)) {
    result = await run('id, user_id, program_id, opportunity_id, type, status, applied_at, reviewed_at, reviewed_by, notes, created_at, updated_at');
  }
  if (result.error) throw result.error;
  return mapRows(result.data);
};

export const createApplication = async (applicationData) => {
  const client = requireSupabase();
  let result = await client
    .from('applications')
    .insert([toSnakeCase(applicationData)])
    .select('*')
    .single();

  if (result.error && isMissingColumnError(result.error)) {
    result = await client
      .from('applications')
      .insert([toSnakeCase(applicationData)])
      .select('id, user_id, program_id, opportunity_id, type, status, applied_at, reviewed_at, reviewed_by, notes, created_at, updated_at')
      .single();
  }
  if (result.error) throw result.error;
  return toCamelCase(result.data);
};

export const getEventSlotState = (event) => {
  const rawTotal = event?.totalSlots ?? event?.total_slots ?? event?.availableSlots ?? event?.available_slots;
  const rawAvailable = event?.availableSlots ?? event?.available_slots;
  // Listings without slot data (legacy rows) are treated as open, never Full.
  if (rawTotal === undefined && rawAvailable === undefined) {
    return { total: 0, available: 1, isFull: false };
  }
  const total = Number(rawTotal ?? rawAvailable ?? 0);
  const available = Number(rawAvailable ?? total ?? 0);
  const safeTotal = Number.isFinite(total) ? Math.max(0, total) : 0;
  const safeAvailable = Number.isFinite(available) ? Math.max(0, available) : 0;
  return {
    total: safeTotal,
    available: safeAvailable,
    isFull: safeTotal > 0 ? safeAvailable <= 0 : false
  };
};

const readEventSlots = async (table, id) => {
  const client = requireSupabase();
  // Read full row to support tables missing slot columns.
  const { data, error } = await client
    .from(table)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
};

/**
 * Application statuses that occupy one of a listing's slots.
 * `ONGOING`/`COMPLETED` are included so a placement keeps its slot for its
 * whole life, not just at the moment of approval.
 */
export const SLOT_HOLDING_APP_STATUSES = ['APPROVED', 'ACCEPTED', 'ONGOING', 'COMPLETED'];

/** Statuses that free a slot that was previously held. */
export const SLOT_RELEASING_APP_STATUSES = [
  'REJECTED',
  'DECLINED',
  'DENIED',
  'WITHDRAWN',
  'CANCELLED',
  'VOID'
];

export const applicationHoldsSlot = (status) =>
  SLOT_HOLDING_APP_STATUSES.includes(normalizeStatus(status));

export const applicationReleasesSlot = (status) =>
  SLOT_RELEASING_APP_STATUSES.includes(normalizeStatus(status));

/**
 * Moves a listing's available-slot count by `delta` (-1 when an application is
 * approved, +1 when an approval is reversed).
 *
 * Slots are consumed on approval rather than on submission, so the number
 * reflects how many youth are actually placed.  The result is clamped to
 * [0, total] so it can never drift outside its bounds.
 *
 * Returns the updated row, or null when the table carries no slot columns.
 */
export const adjustEventSlots = async (table, id, delta) => {
  const client = requireSupabase();
  if (!Object.values(LISTING_TABLE_BY_KIND).includes(table)) throw new Error('Unknown event table.');
  if (!delta) return null;

  let current = null;
  try {
    current = await readEventSlots(table, id);
  } catch (readError) {
    if (isMissingColumnError(readError)) return null;
    throw readError;
  }

  const rawAvailable = current?.available_slots ?? current?.availableSlots;
  const rawTotal = current?.total_slots ?? current?.totalSlots;
  // A listing with no slot columns has no capacity to track.
  if (rawAvailable === undefined && rawTotal === undefined) return null;

  const total = Number(rawTotal ?? rawAvailable ?? 0);
  const available = Number(rawAvailable ?? rawTotal ?? 0);
  const safeTotal = Number.isFinite(total) ? Math.max(0, total) : 0;
  let next = (Number.isFinite(available) ? available : 0) + delta;
  if (next < 0) next = 0;
  if (safeTotal > 0 && next > safeTotal) next = safeTotal;

  const { data, error } = await client
    .from(table)
    .update({ available_slots: next, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) {
    if (isMissingColumnError(error)) return null;
    throw error;
  }
  return data ? toCamelCase(data) : null;
};

/**
 * Reads a listing's slot state.  Exported so approval screens can check
 * remaining capacity before accepting.
 */
export const getEventSlotStateById = async (table, id) => {
  try {
    const row = await readEventSlots(table, id);
    return getEventSlotState(row || {});
  } catch (error) {
    if (isMissingColumnError(error)) return { total: 0, available: 1, isFull: false };
    throw error;
  }
};

/**
 * The `applications` row an application to `eventId` of `kind` should create.
 *
 * `applications.check_application_target` requires EXACTLY ONE of program_id /
 * opportunity_id / event_id to be set, so every branch nulls the other two.
 */
const buildProgramApplicationPayload = (userId, eventId, kind) => {
  if (kind === 'event') {
    return { userId, programId: null, opportunityId: null, eventId, type: 'event', status: 'Applied' };
  }
  return kind === 'program'
    ? { userId, programId: eventId, opportunityId: null, eventId: null, type: 'program', status: 'Applied' }
    : { userId, programId: null, opportunityId: eventId, eventId: null, type: 'opportunity', status: 'Applied' };
};

/**
 * Guard #3 - the EVENT rules.
 *
 * A youth may hold at most MAX_ACTIVE_EVENT_APPLICATIONS live event
 * applications, and none of them may collide in time with the event being
 * applied for.  Released (rejected/withdrawn/cancelled) applications free both
 * the count and the window, which is what lets a student apply again once one
 * of their applications ends.
 *
 * `targetRow` is the event being applied for - the caller has already read it,
 * so this never issues a second query for it.
 */
const assertEventApplicationAllowed = async (client, userId, eventId, targetRow) => {
  const { data: activeRows, error: activeError } = await client
    .from('applications')
    .select('id, status, event_id')
    .eq('user_id', userId)
    .not('event_id', 'is', null);
  if (activeError && activeError.code !== 'PGRST116') throw activeError;

  const held = (activeRows || []).filter((row) => !applicationReleasesSlot(row.status));
  if (held.length >= MAX_ACTIVE_EVENT_APPLICATIONS) {
    throw new Error(
      `You can apply to at most ${MAX_ACTIVE_EVENT_APPLICATIONS} events at a time. `
      + 'Finish or withdraw one before applying to another.'
    );
  }

  const heldIds = held.map((row) => row.event_id).filter(Boolean);
  if (!heldIds.length) return;

  const { data: heldEvents, error: heldError } = await client
    .from('events')
    .select('id, title, starts_at, ends_at')
    .in('id', heldIds);
  if (heldError && heldError.code !== 'PGRST116') throw heldError;

  const clash = (heldEvents || []).find((row) => eventWindowsOverlap(targetRow, row));
  if (clash) {
    throw new Error(
      `This event overlaps "${clash.title || 'another event'}" that you have already applied to.`
    );
  }
};

export const applyToEvent = async (kind, eventId, userId) => {
  const client = requireSupabase();
  if (!userId) throw new Error('You must be signed in to apply.');
  if (!eventId) throw new Error('Missing listing reference.');
  const table = LISTING_TABLE_BY_KIND[kind] || LISTING_TABLE_BY_KIND.opportunity;
  const idColumn = LISTING_ID_COLUMN_BY_KIND[kind] || LISTING_ID_COLUMN_BY_KIND.opportunity;

  const { data: existing, error: existingError } = await client
    .from('applications')
    .select('id')
    .eq('user_id', userId)
    .eq(idColumn, eventId)
    .limit(1)
    .maybeSingle();
  if (existingError && existingError.code !== 'PGRST116') throw existingError;
  if (existing) throw new Error('You have already applied to this listing.');

  // An OJT/Intern may hold only ONE OJT posting application at a time - they
  // cannot be placed at two companies at once.  Rejected or withdrawn
  // applications release the hold so the intern can apply again.
  if (kind === 'opportunity') {
    const { data: activeRows, error: activeError } = await client
      .from('applications')
      .select('id, status')
      .eq('user_id', userId)
      .not('opportunity_id', 'is', null);
    if (activeError && activeError.code !== 'PGRST116') throw activeError;
    const blocking = (activeRows || []).filter((row) => !applicationReleasesSlot(row.status));
    if (blocking.length > 0) {
      throw new Error(
        'You already have an OJT application. Only one OJT posting application is allowed per intern.'
      );
    }
  }

  // A Trainee may hold only ONE training programme at a time - the mirror of
  // the OJT rule below.  Rejected or withdrawn applications release the hold so
  // the trainee can apply again.  Only `program_id` rows count, so an OJT
  // posting or an event never blocks a programme application.
  if (kind === 'program') {
    const { data: activeRows, error: activeError } = await client
      .from('applications')
      .select('id, status')
      .eq('user_id', userId)
      .not('program_id', 'is', null);
    if (activeError && activeError.code !== 'PGRST116') throw activeError;
    const blocking = (activeRows || []).filter((row) => !applicationReleasesSlot(row.status));
    if (blocking.length > 0) {
      throw new Error(
        'You already have a program application. Only one training program application is allowed per trainee.'
      );
    }
  }

  const slotRow = await readEventSlots(table, eventId);
  const slotState = getEventSlotState(slotRow || {});
  // Only enforce Full when the listing carries explicit slot data.
  const hasSlotData = slotRow != null && (
    slotRow.available_slots !== undefined || slotRow.availableSlots !== undefined ||
    slotRow.total_slots !== undefined || slotRow.totalSlots !== undefined
  );
  if (hasSlotData && slotState.isFull) {
    throw new Error('This listing is full. No slots available.');
  }

  // Guard #3 - the event count and overlap rules.  `slotRow` is the event being
  // applied for, already read above, so its window costs no extra query.
  if (kind === 'event') {
    await assertEventApplicationAllowed(client, userId, eventId, slotRow || {});
  }

  const payload = toSnakeCase(buildProgramApplicationPayload(userId, eventId, kind));
  // Keep only columns present in every generation of the applications table.
  delete payload.id;
  let created = null;
  let createError = null;
  const attemptInsert = async (statusValue) => client
    .from('applications')
    .insert([{ ...payload, status: statusValue }])
    .select('*')
    .single();
  // Title-case first (legacy CHECK), then UPPER (new CHECK).
  let insertResult = await attemptInsert(payload.status || 'Applied');
  if (insertResult.error && insertResult.error.code === '23514') {
    insertResult = await attemptInsert('APPLIED');
  }
  if (insertResult.error && insertResult.error.code === '23514') {
    insertResult = await attemptInsert('Pending');
  }
  if (insertResult.error && insertResult.error.code === '23514') {
    insertResult = await attemptInsert('PENDING_APPROVAL');
  }
  created = insertResult.data;
  createError = insertResult.error;
  if (createError) throw createError;

  // Slots are consumed when an admin APPROVES the application (see
  // setApplicationStatus), not on submission.  Applying only checks that
  // capacity still remains, so a listing can collect more applicants than it
  // has slots and the admin decides who fills them.
  return toCamelCase(created);
};

export const applyToProgram = (programId, userId) => applyToEvent('program', programId, userId);
export const applyToOpportunity = (opportunityId, userId) => applyToEvent('opportunity', opportunityId, userId);
/** Apply to an EVENT listing (the `events` table), not to be confused with the
 *  generic `applyToEvent` above. */
export const applyToEventPosting = (eventId, userId) => applyToEvent('event', eventId, userId);

/**
 * Admin review action: move an application to a new status while keeping the
 * listing's available-slot count in step.
 *
 * Approving consumes a slot; rejecting or withdrawing returns one.  The slot
 * only moves when the "holds a slot" state actually flips, so re-saving the
 * same status is a no-op and can never double-count.
 *
 * `statuses` is an ordered list of candidates because different generations of
 * the schema spell the same state differently ('Approved' vs 'APPROVED' vs
 * 'ACCEPTED').  The first value the CHECK constraint accepts wins.
 */
export const setApplicationStatus = async (applicationId, statuses) => {
  const client = requireSupabase();
  if (!applicationId) throw new Error('Missing application reference.');
  const candidates = (Array.isArray(statuses) ? statuses : [statuses]).filter(Boolean);
  if (candidates.length === 0) throw new Error('Missing target status.');

  const { data: application, error: readError } = await client
    .from('applications')
    .select('*')
    .eq('id', applicationId)
    .maybeSingle();
  if (readError) throw readError;
  if (!application) throw new Error('Application not found.');

  // The listing this application points at - exactly one of the three keys is
  // set (check_application_target), so the first non-null wins.
  const table = application.program_id ? 'programs'
    : application.event_id ? 'events'
      : 'opportunities';
  const eventId = application.program_id || application.event_id || application.opportunity_id;
  const wasHolding = applicationHoldsSlot(application.status);

  // Accepting must never oversubscribe the listing.
  const willHold = candidates.some((status) => applicationHoldsSlot(status));
  if (!wasHolding && willHold && eventId) {
    const slotState = await getEventSlotStateById(table, eventId);
    if (slotState.total > 0 && slotState.available <= 0) {
      throw new Error('All slots for this listing are already filled.');
    }
  }

  let updated = null;
  let lastError = null;
  for (const status of candidates) {
    const { data, error } = await client
      .from('applications')
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq('id', applicationId)
      .select('*')
      .maybeSingle();
    if (!error) {
      updated = data;
      lastError = null;
      break;
    }
    lastError = error;
    if (error.code !== '23514') throw error;
  }
  if (lastError) throw lastError;

  const nowHolding = applicationHoldsSlot(updated?.status ?? candidates[0]);
  if (eventId && wasHolding !== nowHolding) {
    await adjustEventSlots(table, eventId, nowHolding ? -1 : 1);
  }

  return toCamelCase(updated || { id: applicationId });
};

/** Pending account sign-ups are stored as user profiles in this deployment. */
export const getPendingUserApplications = async (role = null) => {
  const client = requireSupabase();
  let query = client
    .from('users')
    .select('*')
    .order('created_at', { ascending: true });

  const { data, error } = await query;
  if (error) throw error;
  return mapRows(data).filter((user) => {
    if (!isTraineeRole(user.role ?? user.accountType ?? user.account_type)) return false;
    if (!isPendingAccountStatus(user.applicationStatus ?? user.application_status)) return false;
    if (!role) return true;
    const normalized = normalizeRole(user.role ?? user.accountType ?? user.account_type);
    return role === 'ojt' ? normalized === 'OJT/INTERN' : ['TRAINEE', 'STUDENT'].includes(normalized);
  });
};

export const getUserApplicationsByStatus = async (status = 'PENDING_APPROVAL', role = null) => {
  const client = requireSupabase();
  const normalized = normalizeStatus(status);
  if (['PENDING', 'PENDING_APPROVAL', 'PENDING_APPLICATION'].includes(normalized)) {
    return getPendingUserApplications(role);
  }

  const { data, error } = await client.from('users').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return mapRows(data).filter((user) => {
    if (!isTraineeRole(user.role ?? user.accountType ?? user.account_type)) return false;
    const userStatus = normalizeStatus(user.applicationStatus ?? user.application_status);
    if (normalized === 'APPROVED') return isApprovedAccountStatus(userStatus);
    if (['REJECTED', 'DECLINED'].includes(normalized)) return ['REJECTED', 'DECLINED', 'DENIED'].includes(userStatus);
    return true;
  }).filter((user) => {
    if (!role) return true;
    const r = normalizeRole(user.role ?? user.accountType ?? user.account_type);
    return role === 'ojt' ? r === 'OJT/INTERN' : ['TRAINEE', 'STUDENT'].includes(r);
  });
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
    .order('created_at', { ascending: false });
  if (error) throw error;
  return mapRows(data);
};

export const getCertificatesByEmail = async (email) => {
  const client = requireSupabase();
  const normalized = String(email || '').trim();
  if (!normalized) return [];
  const attempt = await client.from('certificates').select('*').ilike('recipient_email', normalized);
  if (!attempt.error) return mapRows(attempt.data);
  const fallback = await client.from('certificates').select('*');
  if (fallback.error) return [];
  const lower = normalized.toLowerCase();
  return mapRows(fallback.data).filter((row) =>
    String(row.recipientEmail || row.recipient_email || row.email || '').trim().toLowerCase() === lower
  );
};

export const issueCertificateRecord = async (payload) => {
  const client = requireSupabase();
  const base = {
    student_id: payload.studentId || null,
    type: payload.certificateType,
    title: payload.title,
    description: payload.description || null,
    certificate_number: payload.certificateNumber,
    issue_date: payload.issueDate || new Date().toISOString().slice(0, 10),
    template_used: payload.certificateType,
    status: 'Issued',
    issued_by: payload.issuedBy || null
  };
  // Extended columns are optional and only present after the migration.
  const extended = {
    recipient_name: payload.studentName || null,
    recipient_email: payload.recipientEmail || null,
    certificate_type: payload.certificateType || null,
    hours_completed: payload.hoursCompleted ?? null,
    signatory_one_name: payload.signatoryOneName || 'Mrs. Hydee Tabao',
    signatory_one_title: payload.signatoryOneTitle || 'Founder & CEO',
    signatory_two_name: payload.signatoryTwoName || null,
    signatory_two_title: payload.signatoryTwoTitle || null
  };
  let insertPayload = { ...base, ...extended };
  let result = await client.from('certificates').insert([insertPayload]).select().single();
  if (result.error && isMissingColumnError(result.error)) {
    result = await client.from('certificates').insert([base]).select().single();
  }
  if (result.error) throw result.error;
  return toCamelCase(result.data);
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

/**
 * Publish an announcement.
 *
 * The admin Announcements screen used to dispatch straight into React state, so
 * a "published" notice existed only in the tab that created it and vanished on
 * the next reload.  This is the real write; the events screen reuses it so
 * posting an event also raises a notice.
 */
export const createAnnouncement = async (payload = {}) => {
  const client = requireSupabase();
  const row = {
    title: String(payload.title || '').trim(),
    content: String(payload.content || '').trim(),
    category: payload.category || 'General',
    priority: payload.priority || 'Medium',
    status: payload.status || 'Published',
    published_at: payload.publishedAt || new Date().toISOString(),
    created_by: payload.createdBy || null
  };
  if (!row.title || !row.content) {
    throw new Error('An announcement needs both a title and some content.');
  }

  let result = await client.from('announcements').insert([row]).select().single();
  // 23503 = foreign-key violation.  `created_by` points at public.users, and a
  // profile that was never rebuilt would otherwise take the whole notice down
  // with it; the announcement itself is still worth publishing.
  if (result.error && result.error.code === '23503') {
    result = await client.from('announcements').insert([{ ...row, created_by: null }]).select().single();
  }
  if (result.error) throw result.error;
  return toCamelCase(result.data);
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
// ATTENDANCE_LOGS - dual approval state machine
// ==========================================================================

const attendanceUserSelect = `
  id, user_id, date, time_in, time_out, status, rendered_hours, duration_seconds,
  pending_end_time, location_name, admin_note, approved_by, approved_at, created_at,
  user:users(id, full_name, email, school, role, required_hours, rendered_hours)
`;

const ATTENDANCE_USER_ID_KEYS = ['userId', 'user_id'];

/** Read the owning user id off a row regardless of its casing. */
const rowUserId = (row) => {
  if (!row) return null;
  for (const key of ATTENDANCE_USER_ID_KEYS) {
    const value = row[key];
    if (value) return value;
  }
  return null;
};

/**
 * Re-attach the `user` profile to rows that arrived without one.
 * Used by the attendance queue AND the daily-report feed - anywhere a row
 * carries an owner id but the joined profile may be absent.
 *
 * The embedded `user:users(...)` relation in `attendanceUserSelect` is the fast
 * path, but it is not guaranteed: on a deployment whose
 * `attendance_logs.user_id → users.id` foreign key is absent - or whose
 * PostgREST schema cache has not picked the relation up - the relation select
 * fails and every caller below falls back to `select('*')`.  That fallback
 * returns rows with **no `user` key at all**, so `log.user?.fullName` evaluated
 * to undefined and the admin attendance queue, the dashboard feed and the
 * approval dialog all rendered the approver as "Unknown".
 *
 * Profile lookup failures are swallowed deliberately: a missing profile must
 * never take down the attendance list.
 */
const attachUserProfiles = async (rows, client = requireSupabase()) => {
  const list = Array.isArray(rows) ? rows : [];
  const needing = list.filter((row) => !row?.user && rowUserId(row));
  if (needing.length === 0) return list;

  const ids = [...new Set(needing.map(rowUserId))];
  let profiles = [];

  try {
    const { data, error } = await client
      .from('users')
      .select('id, full_name, first_name, last_name, email, school, role, required_hours, rendered_hours')
      .in('id', ids);
    if (error) throw error;
    profiles = mapRows(data);
  } catch (error) {
    try {
      const { data } = await client.from('users').select('*').in('id', ids);
      profiles = mapRows(data);
    } catch (fallbackError) {
      return list;
    }
  }

  const byId = new Map(profiles.filter(Boolean).map((profile) => [profile.id, profile]));
  return list.map((row) => {
    if (row?.user) return row;
    const profile = byId.get(rowUserId(row));
    return profile ? { ...row, user: profile } : row;
  });
};

/**
 * Single source of truth for "who is this?" on every attendance surface.
 *
 * Only returns a placeholder once every identifying field is genuinely absent - * a full name, a composed first/last name, an e-mail or a truncated id all
 * resolve first, so "Unknown" can no longer appear for a real person.
 */
export const resolveUserName = (user, fallbackRow = null) => {
  const source = user || fallbackRow || {};

  const fullName = source.fullName || source.full_name;
  if (fullName && String(fullName).trim()) return String(fullName).trim();

  const composed = [source.firstName || source.first_name, source.lastName || source.last_name]
    .filter((part) => part && String(part).trim())
    .join(' ')
    .trim();
  if (composed) return composed;

  const email = source.email;
  if (email && String(email).trim()) return String(email).trim().split('@')[0];

  // Prefer the OWNER id.  When the fallback argument is an attendance row its
  // `id` is the log's id, so reading `id` first would label the person after
  // their own attendance record ("User log-1").  `user_id`/`userId` is the
  // person; a bare `id` is only used when the source really is a user record.
  const ownerId = rowUserId(source);
  if (ownerId) return `User ${String(ownerId).slice(0, 8)}`;

  const id = source.id;
  if (id) return `User ${String(id).slice(0, 8)}`;

  return 'Unknown user';
};

/** Convenience wrapper for the common `log.user` case. */
export const resolveAttendanceUserName = (log) => resolveUserName(log?.user, log);

const getAttendanceLogById = async (attendanceId, client = requireSupabase()) => {
  let result = await client
    .from('attendance_logs')
    .select(attendanceUserSelect)
    .eq('id', attendanceId)
    .maybeSingle();

  // Some old deployments do not have all columns used in the relation select.
  if (result.error) {
    result = await client.from('attendance_logs').select('*').eq('id', attendanceId).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return null;
    const [row] = await attachUserProfiles([toCamelCase(result.data)], client);
    return row || null;
  }
  // A successful relation select can still come back without the joined `user`
  // (PostgREST could not resolve the FK, or RLS hides the joined row), which is
  // exactly the case that surfaced as "Unknown" in the admin reviewer list.
  // attachUserProfiles() is a no-op when the user is already present.
  if (!result.data) return null;
  const [row] = await attachUserProfiles([toCamelCase(result.data)], client);
  return row || null;
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
    const rows = mapRows(result.data);
    const scoped = userId ? rows.filter((row) => rowUserId(row) === userId) : rows;
    return attachUserProfiles(scoped, client);
  }
  return attachUserProfiles(mapRows(result.data), client);
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
 * RPC-ONLY: attendance_logs carries no INSERT/UPDATE grant for `authenticated`
 * (see OJT_TRACKING_PRODUCTION_MIGRATION.sql), so the only legal way to open a
 * request is the SECURITY DEFINER function request_clock_in.  A direct client
 * write fails with exactly "permission denied for table attendance_logs".
 *
 * The geofence decision is made inside that function, driven by
 * settings.geofence_enforcement_enabled - so the testing bypass no longer needs
 * (and must not use) a client-side write path.
 */
export const clockIn = async (userId, latitude, longitude) => {
  const client = requireSupabase();
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error('A valid location is required before submitting a clock-in request.');
  }

  // Client-side Haversine is a fast pre-check for a friendlier message without
  // a round trip.  It is NOT authoritative - request_clock_in re-validates.
  //
  // The office list and the distance function come from utils/geofence, which
  // is the only place they are written down.  This used to be a second, private
  // copy of the coordinates, and it had drifted 5.9 km from the first one.
  const distances = OFFICE_LOCATIONS.map((office) => ({
    ...office,
    distance: haversineDistanceMeters(lat, lon, office.latitude, office.longitude)
  }));
  const nearest = distances.sort((a, b) => a.distance - b.distance)[0];
  // Skipped while the testing bypass is on; the server applies the same rule
  // whenever settings.geofence_enforcement_enabled is true.  The radius comes
  // from the shared constant so this check cannot drift away from the one the
  // Attendance page shows the student.
  if (GEOFENCE_ENFORCEMENT_ENABLED && (!nearest || nearest.distance > GEOFENCE_RADIUS_METERS)) {
    throw new Error(
      nearest
        ? `You are currently ${Math.round(nearest.distance)} meters away from the nearest approved office. You must be within ${GEOFENCE_RADIUS_METERS} meters to clock in.`
        : `You must be within ${GEOFENCE_RADIUS_METERS} meters of an approved HYT location to clock in.`
    );
  }

  const params = {
    p_user_id: userId,
    p_latitude: lat,
    p_longitude: lon
  };

  const { data, error } = await client.rpc('request_clock_in', params);
  if (!error) {
    if (!data?.success) throw new Error(data?.message || data?.error || 'Clock-in request failed');
    const fallback = { status: data.status || 'PENDING_CLOCK_IN', locationName: data.location || data.location_name || null };
    const record = await readAttendanceLogOrFallback(data.attendance_id, client, fallback);
    return { ...record, ...fallback };
  }

  // The raw RPC failure is the only clue when PostgREST returns an opaque body.
  console.warn('[clockIn] request_clock_in failed', error);
  if (!isMissingFunctionError(error, 'request_clock_in')) throw error;
  if (process.env.NODE_ENV === 'production') throw attendanceMigrationRequired();

  // Development compatibility fallback for a database that has not installed
  // request_clock_in. Production writes are intentionally RPC-only.
  return writePendingClockInDirect(client, userId, lat, lon);
};

/**
 * LAST-RESORT compatibility writer, used only when request_clock_in is missing
 * from the database.  Attendance is RPC-only in production, so this path
 * normally cannot succeed - a hardened database has no INSERT grant on
 * attendance_logs for `authenticated`, and the write comes back as 42501.
 */
const writePendingClockInDirect = async (client, userId, lat, lon) => {
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
    latitude: Number(lat),
    longitude: Number(lon),
    location_name: 'Testing bypass - geofence disabled',
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
  if (result.error) {
    // 42501 = insufficient_privilege.  Means the RPC is missing AND the table
    // grants are hardened - surface the real remedy instead of a raw Postgres
    // string that looks like a browser location-permission problem.
    if (result.error.code === '42501') throw attendanceMigrationRequired();
    throw result.error;
  }
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
    const fallback = toCamelCase({
      ...existing,
      status: rpcData.status || 'PENDING_CLOCK_OUT',
      pending_end_time: rpcData.pending_end_time,
      duration_seconds: rpcData.duration_seconds,
      rendered_hours: rpcData.rendered_hours
    });
    const record = await readAttendanceLogOrFallback(rpcData.attendance_id, client, fallback);
    return record || fallback;
  }
  if (!isMissingFunctionError(rpcError, 'request_clock_out')) throw rpcError;
  if (process.env.NODE_ENV === 'production') throw attendanceMigrationRequired();

  if (!existing || !existing.time_in || status !== 'CLOCKED_IN') {
    if (isPendingClockInStatus(status)) {
      throw new Error('Clock-in is still awaiting admin approval.');
    }
    throw new Error('No active clock-in was found. Please wait for clock-in approval first.');
  }

  const now = new Date();
  const start = new Date(existing.time_in);
  const rawSeconds = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 1000));
  // Daily hard cap: active timer stops accumulating at exactly 08:00:00.
  const durationSeconds = Math.min(28800, rawSeconds);
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
    if (result.error) throw result.error;
    const rows = await attachUserProfiles(mapRows(result.data), client);
    return rows.filter((log) => isPendingAttendanceStatus(log.status));
  }
  if (result.error) throw result.error;
  const rows = await attachUserProfiles(mapRows(result.data), client);
  return rows.filter((log) => isPendingAttendanceStatus(log.status));
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
 * A committed mutation must never be reported as a failure because the
 * follow-up read failed.  Fall back to the row the caller already knows about.
 */
const readAttendanceLogOrFallback = async (attendanceId, client, fallback) => {
  try {
    return (await getAttendanceLogById(attendanceId, client)) || fallback;
  } catch (error) {
    console.warn('Attendance was saved but could not be re-read.', error);
    return fallback;
  }
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
    // The approval timestamp is the exact start of the live timer.  A pending
    // clock-in must never carry a start time, otherwise the shift would be
    // credited retroactively.
    payload.time_in = now;
  } else {
    // The frozen timestamp is authoritative.  Never credit up to the approval
    // time, which would hand out hours the trainee never worked.
    const frozenAt = current.pendingEndTime || current.timeOut || null;
    if (!frozenAt) {
      throw new Error('This clock-out request has no frozen end time and cannot be approved. Please reject it and ask the trainee to clock out again.');
    }
    payload.time_out = frozenAt;
    if (!current.pendingEndTime) {
      const duration = Math.max(0, Math.floor((new Date(frozenAt).getTime() - new Date(current.timeIn).getTime()) / 1000));
      payload.pending_end_time = frozenAt;
      payload.duration_seconds = duration;
      payload.rendered_hours = Math.round((duration / 3600) * 10000) / 10000;
    }
  }

  const expected = isClockIn
    ? ['PENDING_CLOCK_IN', 'PENDING_CLOCK_IN_APPROVAL', 'PENDING_IN', 'PENDING_APPROVE', 'PENDING_APPROVAL', 'PENDING_REVIEW', 'PENDING', 'Pending']
    : ['PENDING_CLOCK_OUT', 'PENDING_OUT', 'PENDING_APPROVE', 'PENDING_APPROVAL', 'PENDING_REVIEW', 'PENDING', 'Pending'];

  // Use the atomic RPC when installed.  It prevents two admins from crediting
  // the same session twice and applies the approval trigger in one transaction.
  const rpcName = isClockIn ? 'approve_clock_in_request' : 'approve_attendance_request';
  const { error: rpcError } = await client.rpc(rpcName, {
    p_attendance_id: attendanceId,
    p_admin_id: args.adminUserId,
    p_admin_note: args.adminNote || null
  });
  if (!rpcError) {
    return readAttendanceLogOrFallback(attendanceId, client, { ...current, ...payload });
  }

  if (!isMissingFunctionError(rpcError, rpcName)) throw rpcError;
  if (process.env.NODE_ENV === 'production') throw attendanceMigrationRequired();
  const updated = await updateAttendanceStatusAtomically(attendanceId, expected, payload);
  return updated || { ...current, ...payload };
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
    ? ['PENDING_CLOCK_IN', 'PENDING_CLOCK_IN_APPROVAL', 'PENDING_IN', 'PENDING_APPROVE', 'PENDING_APPROVAL', 'PENDING_REVIEW', 'PENDING', 'Pending']
    : ['PENDING_CLOCK_OUT', 'PENDING_OUT', 'PENDING_APPROVE', 'PENDING_APPROVAL', 'PENDING_REVIEW', 'PENDING', 'Pending'];

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
  if (!rpcError) return readAttendanceLogOrFallback(attendanceId, client, { ...current, ...updates });
  if (!isMissingFunctionError(rpcError, 'reject_attendance_request')) throw rpcError;
  if (process.env.NODE_ENV === 'production') throw attendanceMigrationRequired();

  const updated = await updateAttendanceStatusAtomically(attendanceId, expected, updates);
  return updated || { ...current, ...updates };
};

// ==========================================================================
// OT REQUESTS
// ==========================================================================

export const getOtRequests = async (userId = null) => {
  const client = requireSupabase();
  let query = client.from('ot_requests').select('*').order('created_at', { ascending: false });
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
// ABSENCE REQUESTS
//
// A trainee/OJT tells the administrator in advance that they cannot attend,
// and why.  This is deliberately NOT an approval workflow: the administrator
// only *acknowledges* it with "Noted", so the request has exactly two states - // Submitted (waiting to be seen) and Noted (seen).  Nothing here credits or
// removes hours.
//
// Requires the absence_requests table - see ABSENCE_REQUESTS_MIGRATION.sql.
// Every reader degrades to an empty list when the table has not been created
// yet, so the attendance page still loads on an older database.
// ==========================================================================

export const ABSENCE_STATUS_SUBMITTED = 'Submitted';
export const ABSENCE_STATUS_NOTED = 'Noted';
export const ABSENCE_ACKNOWLEDGEMENT = 'Noted';

/** 42P01 = undefined_table; PGRST205 = table not found in the schema cache. */
export const isMissingTableError = (error) => {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  if (code === '42p01' || code === 'pgrst205') return true;
  return message.includes('could not find the table') ||
    (message.includes('relation') && message.includes('does not exist'));
};

export const isAbsenceNoted = (request) =>
  normalizeStatus(request?.status) === 'NOTED';

export const isAbsencePending = (request) =>
  !isAbsenceNoted(request);

const ABSENCE_SELECT = `
  id, user_id, absence_date, reason, status, admin_note, noted_by, noted_at, created_at, updated_at,
  user:users(id, full_name, first_name, last_name, email, school, role)
`;

/**
 * Absence requests, newest first.  `userId` scopes to one person; omit it for
 * the administrator view.
 */
export const getAbsenceRequests = async (userId = null) => {
  const client = requireSupabase();
  const run = async (selectClause) => {
    let query = client
      .from('absence_requests')
      .select(selectClause)
      .order('created_at', { ascending: false });
    if (userId) query = query.eq('user_id', userId);
    return query;
  };

  let result = await run(ABSENCE_SELECT);
  if (result.error && isMissingColumnError(result.error)) {
    result = await run('*');
  }
  if (result.error) {
    if (isMissingTableError(result.error)) return [];
    throw result.error;
  }

  const rows = mapRows(result.data);
  return userId ? rows.filter((row) => rowUserId(row) === userId || !rowUserId(row)) : rows;
};

/** The administrator queue: everything not yet acknowledged. */
export const getPendingAbsenceRequests = async () => {
  const rows = await getAbsenceRequests();
  return rows.filter(isAbsencePending);
};

export const createAbsenceRequest = async ({ userId, absenceDate, reason }) => {
  const client = requireSupabase();
  if (!userId) throw new Error('You must be signed in to file an absence request.');
  const trimmedReason = String(reason || '').trim();
  if (trimmedReason.length < 10) {
    throw new Error('Please describe the reason (at least 10 characters).');
  }

  const { data, error } = await client
    .from('absence_requests')
    .insert([toSnakeCase({
      userId,
      absenceDate: absenceDate || todayISODate(),
      reason: trimmedReason,
      status: ABSENCE_STATUS_SUBMITTED
    })])
    .select()
    .single();

  if (error) {
    if (isMissingTableError(error)) {
      throw new Error('Absence requests are not enabled on this database yet. Please ask an administrator to run ABSENCE_REQUESTS_MIGRATION.sql.');
    }
    throw error;
  }
  return toCamelCase(data);
};

/**
 * Acknowledge a request.  There is no approve/reject - the administrator simply
 * marks it as seen, optionally with a short note back to the trainee.
 */
export const acknowledgeAbsenceRequest = async (requestId, adminNote = '', adminUserId = null) => {
  const client = requireSupabase();
  if (!requestId) throw new Error('Missing absence request.');

  const { data, error } = await client
    .from('absence_requests')
    .update(toSnakeCase({
      status: ABSENCE_STATUS_NOTED,
      adminNote: String(adminNote || '').trim(),
      notedBy: adminUserId || (await getCurrentAuthUserId()),
      notedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }))
    .eq('id', requestId)
    .select()
    .single();

  if (error) throw error;
  return toCamelCase(data);
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
  // Read without server-side eq filters to avoid 400s when deployments use
  // user_id vs student_id. Filtering happens in JS.
  const result = await client.from('daily_reports').select('*').order('created_at', { ascending: false });
  let rows = [];
  if (result.error) {
    if (isMissingColumnError(result.error)) {
      const retry = await client.from('daily_reports').select('*');
      if (retry.error) throw retry.error;
      rows = (retry.data || []).map(normalizeReportRow);
    } else {
      throw result.error;
    }
  } else {
    rows = (result.data || []).map(normalizeReportRow);
  }
  // normalizeReportRow() always sets userId, so the same profile attach used by
  // the attendance queue works here - the admin feed showed "User <id>" because
  // the report rows arrived with no joined user.
  rows = await attachUserProfiles(rows, client);
  if (!userId) return rows;
  return rows.filter((report) => report.userId === userId || report.studentId === userId);
};

export const getPendingDailyReports = async () => {
  const reports = await getDailyReports();
  return reports.filter((report) => isPendingReportStatus(report.status));
};

/**
 * The columns that actually exist on `daily_reports` in this deployment.
 *
 * Verified against the live project: the table is
 *   id · user_id · report_date · accomplishments · slot_entries · status · created_at
 *
 * The legacy names the code used to fall back on - `student_id`, `ojt_id`,
 * `date`, `tasks_completed`, `notes`, `attachments` - do NOT exist there. Sending
 * them made PostgREST answer PGRST204 ("Could not find the 'student_id' column
 * ... in the schema cache") on the first attempt and the same for 'date' on the
 * fallback, so every filing failed with a 400 no matter which path ran.
 *
 * The fix is to project the payload onto this list before inserting, instead of
 * growing the fallback chain.
 */
const DAILY_REPORT_COLUMNS = [
  'user_id', 'report_date', 'accomplishments', 'slot_entries', 'status', 'created_at'
];

/** Keep only the columns the table really has, and drop undefined values. */
const projectDailyReport = (payload) =>
  DAILY_REPORT_COLUMNS.reduce((result, column) => {
    if (payload[column] !== undefined) result[column] = payload[column];
    return result;
  }, {});

export const createDailyReport = async (reportData) => {
  const client = requireSupabase();
  const payload = projectDailyReport({
    // `user_id` is the only owner column this deployment has. `reportDate` is the
    // storage name for the day; `date` was the legacy spelling.
    user_id: reportData.userId || reportData.studentId || reportData.user_id || null,
    report_date: reportData.reportDate || reportData.date || reportData.report_date || null,
    accomplishments: reportData.accomplishments || reportData.tasksCompleted || reportData.notes || '',
    slot_entries: reportData.slotEntries ?? reportData.slot_entries ?? null,
    status: 'PENDING',
    created_at: reportData.createdAt || new Date().toISOString()
  });

  const result = await client
    .from('daily_reports')
    .insert([payload])
    .select()
    .single();

  if (result.error) throw result.error;
  return normalizeReportRow(result.data);
};

/**
 * Is the `slot_entries` column present yet?
 *
 * A read-only capability probe.  The three-slot report needs one added column,
 * and the migration that adds it is run by hand in the SQL editor - so the page
 * has to be able to say "run the migration" instead of failing on submit with a
 * Postgres error code.  `select('slot_entries')` answers with 42703 when the
 * column is absent, which is exactly the question being asked.
 */
export const reportSlotsReady = async () => {
  try {
    const client = requireSupabase();
    const probe = await client.from('daily_reports').select('slot_entries').limit(1);
    if (!probe.error) return true;
    // Only a missing column means "not migrated".  A transient network or RLS
    // complaint must not block the form, or a blip would look like a schema
    // problem and the trainee would be told to run SQL they already ran.
    return !isMissingColumnError(probe.error);
  } catch (error) {
    return true;
  }
};

/**
 * File ONE slot of one day's report.
 *
 * A day is one row.  The three slots live together in `slot_entries` (jsonb),
 * so filing the 15:00 slot merges into the row the 11:00 filing created rather
 * than inserting a second report - which is what lets the administrator read
 * the whole day as a single consolidated report.
 *
 * `accomplishments` is kept in step with the latest filed slot.  Every older
 * reader still reads that column (the CSV export, the DTR merge, the legacy
 * admin screen), so leaving it behind would make a filed day look empty
 * everywhere except the new screen.
 *
 * Nothing here is sent anywhere.  The 17:00 filing is what makes the day
 * visible to the administrator, and that is a read-time rule, not a job.
 */
export const submitReportSlot = async ({ userId, studentId, reportDate, slot, entry }) => {
  const owner = userId || studentId;
  if (!owner) throw new Error('Missing user for the daily report.');
  if (!reportDate) throw new Error('Missing report date.');
  if (!slot) throw new Error('Missing report slot.');

  const client = requireSupabase();

  // Fail loudly and early rather than filing into a day that cannot hold its
  // slots - without this column the whole three-slot model has nowhere to write.
  const probe = await client.from('daily_reports').select('slot_entries').limit(1);
  if (probe.error && isMissingColumnError(probe.error)) {
    throw new Error(
      'The `slot_entries` column is missing from the database. Run ADD_REPORT_SLOTS.sql in the Supabase SQL Editor.'
    );
  }

  // Find the day's row through the same read path the page already uses, so
  // the lookup works whatever the service normalised the day into.
  const mine = await getDailyReports(owner);
  const existing = mine.find((report) => (report.reportDate || report.date) === reportDate) || null;

  const entries = mergeSlotEntry(readSlotEntries(existing || {}), slot, entry);
  const accomplishments = summariseForAccomplishments({ slotEntries: entries });

  if (!existing) {
    return createDailyReport({
      userId: owner,
      studentId: owner,
      reportDate,
      accomplishments,
      slotEntries: entries
    });
  }

  const { data, error } = await client
    .from('daily_reports')
    .update({ slot_entries: entries, accomplishments })
    .eq('id', existing.id)
    .select()
    .single();
  if (error) throw error;
  return normalizeReportRow(data);
};

export const updateDailyReport = async (reportId, updates) => {
  const client = requireSupabase();
  // Same projection as createDailyReport: `status` is the only review field this
  // deployment stores. The legacy fallback used to write `feedback` /
  // `reviewed_at`, neither of which exists here, so it turned one 400 into two.
  const payload = projectDailyReport({
    status: updates.status,
    accomplishments: updates.accomplishments,
    slot_entries: updates.slotEntries ?? updates.slot_entries
  });

  const result = await client
    .from('daily_reports')
    .update(payload)
    .eq('id', reportId)
    .select()
    .single();

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

const toCount = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.floor(number);
};

const mapRpcDashboardStats = (data) => {
  const source = Array.isArray(data) ? data[0] : data;
  if (!source || typeof source !== 'object') return null;
  const totalStudents = toCount(source.total_students ?? source.totalStudents);
  const totalApplications = toCount(source.total_applications ?? source.totalApplications);
  const acceptedApplications = toCount(source.accepted_applications ?? source.acceptedApplications);
  const completedOJT = toCount(source.completed_ojt ?? source.completedOJT);
  const activePrograms = toCount(source.active_programs ?? source.activePrograms);
  const activeOpportunities = toCount(source.active_opportunities ?? source.activeOpportunities);
  const pendingAttendance = toCount(source.pending_attendance ?? source.pendingAttendance);
  const pendingReports = toCount(source.pending_reports ?? source.pendingReports ?? source.pending_daily_reports);
  return {
    totalStudents,
    totalApplications,
    acceptedApplications,
    completedOJT,
    activePrograms,
    activeOpportunities,
    totalProgramsOpportunities: toCount(
      source.total_programs_opportunities ?? source.totalProgramsOpportunities ?? activePrograms + activeOpportunities
    ),
    pendingAttendance,
    pendingReports,
    pendingDailyReports: pendingReports
  };
};

/**
 * Fetch all dashboard counters from the database.  A server RPC is preferred;
 * the row-based fallback is kept for older Supabase projects and mirrors the
 * same cohorts:
 *
 * - totalStudents: every Trainee / OJT-Intern account, any approval state.
 * - totalApplications: trainee accounts still awaiting review.
 * - acceptedApplications: approved AND active trainee accounts.
 * - completedOJT: approved, active accounts at 100% of their required hours.
 *
 * Every query error is surfaced.  Supabase resolves with `{ error }` instead of
 * rejecting, so ignoring them would render convincing all-zero metrics after an
 * RLS, schema or network failure.
 */
export const getAdminDashboardStats = async () => {
  const client = requireSupabase();

  try {
    const { data, error } = await client.rpc('get_admin_dashboard_stats');
    if (!error) {
      const mapped = mapRpcDashboardStats(data);
      if (mapped) return mapped;
    }
    // RPC missing or broken: fall through to compatible queries silently
    // to avoid spamming the console on every poll.
  } catch (error) {
    // Ignore RPC errors; compatible queries below handle all schemas.
  }

  const results = await Promise.all([
    client.from('users').select('*'),
    client.from('programs').select('*'),
    client.from('opportunities').select('*'),
    client.from('attendance_logs').select('*'),
    client.from('daily_reports').select('*')
  ]);

  const [usersResult, programsResult, opportunitiesResult, attendanceResult, reportsResult] = results;

  const users = usersResult.error ? [] : (usersResult.data || []);
  const programs = programsResult.error ? [] : (programsResult.data || []);
  const opportunities = opportunitiesResult.error ? [] : (opportunitiesResult.data || []);
  const attendance = attendanceResult.error ? [] : (attendanceResult.data || []);
  const reports = reportsResult.error ? [] : (reportsResult.data || []);

  const roleOf = (user) => user.role ?? user.account_type ?? user.accountType;
  const statusOf = (user) => user.application_status ?? user.applicationStatus;
  const activeOf = (user) => user.is_active ?? user.isActive;

  const totalStudents = users.filter((user) => isTraineeRole(roleOf(user))).length;
  const totalApplications = users.filter((user) =>
    isTraineeRole(roleOf(user)) &&
    isPendingAccountStatus(statusOf(user))
  ).length;
  const acceptedApplications = users.filter((user) =>
    isTraineeRole(roleOf(user)) &&
    isApprovedAccountStatus(statusOf(user)) &&
    activeOf(user) === true
  ).length;
  const completedOJT = users.filter((user) => {
    if (!isTraineeRole(roleOf(user))) return false;
    if (!isApprovedAccountStatus(statusOf(user))) return false;
    if (activeOf(user) !== true) return false;
    const required = numericValue(user.required_hours ?? user.requiredHours);
    return required > 0 && numericValue(user.rendered_hours ?? user.renderedHours) >= required;
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
