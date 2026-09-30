import { clearPersistedSession, supabase, toCamelCase, toSnakeCase } from '../config/supabase';
import { toast } from 'react-toastify';
import { isApprovedAccountStatus, normalizeRole, normalizeStatus, SAFE_USER_COLUMNS } from './supabaseService';

const AUTH_MARKER_KEY = 'hyt.auth.last-user-id';

const requireSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase is not configured. Check your environment variables.');
  }
  return supabase;
};

const rememberUser = (userId) => {
  try {
    if (userId) localStorage.setItem(AUTH_MARKER_KEY, userId);
    else localStorage.removeItem(AUTH_MARKER_KEY);
  } catch (error) {
    // Storage can be disabled in private browsing; Supabase's own storage
    // remains the source of truth in that case.
    console.warn('Unable to synchronize auth marker.', error);
  }
};

export const isAdminAccount = (user) => normalizeRole(user?.role) === 'ADMIN';

export const isPendingAccount = (user) => {
  if (!user || isAdminAccount(user)) return false;
  const status = normalizeStatus(user.applicationStatus ?? user.application_status);
  return ['PENDING', 'PENDING_APPROVAL', 'PENDING_APPLICATION', 'SUBMITTED', 'APPLIED']
    .includes(status) || (
      user.isActive === false &&
      !isApprovedAccountStatus(status) &&
      !['REJECTED', 'DECLINED', 'DENIED'].includes(status)
    );
};

export const isRejectedAccount = (user) => {
  const status = normalizeStatus(user?.applicationStatus ?? user?.application_status);
  return ['REJECTED', 'DECLINED', 'DENIED'].includes(status);
};

export const isAccountApproved = (user) => {
  if (!user) return false;
  if (isAdminAccount(user)) return true;
  if (isRejectedAccount(user)) return false;

  // Direct login flow: newly registered Trainees and OJT applicants may sign
  // in immediately. Admin approval is enforced when applying for an OJT
  // Posting or Program, and when clocking in — not at login.
  const status = normalizeStatus(user.applicationStatus ?? user.application_status);
  if (['PENDING', 'PENDING_APPROVAL', 'PENDING_APPLICATION', 'SUBMITTED', 'APPLIED'].includes(status)) {
    return true;
  }

  // Admin-deactivated accounts remain blocked.
  if (user.isActive === false) return false;

  // Fail closed for unknown states without an approved status.
  if (!status) return Boolean(user.isActive !== false);
  return isApprovedAccountStatus(status);
};

const roleForAccountType = (accountType) => {
  if (accountType === 'ojt-student' || accountType === 'ojt_student' || accountType === 'OJT/Intern') {
    return 'OJT/Intern';
  }
  return 'Trainee';
};

const makeAuthError = (message, code) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const isMissingProfileError = (error) => {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === 'PGRST116' || code === '404' || message.includes('no rows') || message.includes('not found');
};

/**
 * End the Supabase session and confirm it is really gone.  `signOut()` resolves
 * with `{ error }` and the SDK can keep the stored session when the read fails,
 * so a best-effort call is not enough for a logout the UI reports as success.
 */
const endSession = async (client) => {
  let failure = null;
  try {
    const { error } = await client.auth.signOut();
    if (error) failure = error;
  } catch (error) {
    failure = error;
  }

  const readSession = async () => {
    try {
      const { data } = await client.auth.getSession();
      return data?.session || null;
    } catch (error) {
      return null;
    }
  };

  let remaining = await readSession();
  if (remaining) {
    // Offline or transient failure: drop the local token so a reload cannot
    // restore the session, then verify again.
    clearPersistedSession();
    remaining = await readSession();
  }

  return { failure, remaining };
};

// ==========================================================================
// Registration
// ==========================================================================

/**
 * Register a trainee.  New accounts can log in directly; admin approval is
 * enforced when the user applies for an OJT Posting or Program.
 */
export async function register(userData) {
  try {
    const client = requireSupabase();
    const email = String(userData.email || '').trim().toLowerCase();
    if (!email) throw new Error('Email is required.');

    // This is only a UX optimization.  Supabase Auth remains authoritative
    // and prevents duplicate accounts even when the public profile is hidden
    // by RLS.
    try {
      const { data: existingUser } = await client
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      if (existingUser) throw makeAuthError('Email already registered.', 'EMAIL_EXISTS');
    } catch (error) {
      if (error.code === 'EMAIL_EXISTS') throw error;
      // An anon request may not be allowed to read public.users.  Continue to
      // signUp and surface the authoritative Auth error if it is a duplicate.
    }

    const role = roleForAccountType(userData.accountType);
    const metadata = {
      full_name: userData.fullName,
      first_name: userData.firstName,
      last_name: userData.lastName,
      student_id: userData.studentId || null,
      requested_role: role,
      // Kept for compatibility with the existing profile trigger.  The SQL
      // trigger only permits Trainee/OJT-Intern; ADMIN is never accepted from
      // user metadata.
      role,
      account_type: userData.accountType,
      school: userData.school || null,
      course: userData.course || null,
      year_level: userData.yearLevel || null,
      birthday: userData.birthday || null,
      age: userData.age ? Number(userData.age) : null,
      address: userData.address || null,
      contact_number: userData.contactNumber || null,
      required_hours: Number(userData.requiredHours) || 0,
      rendered_hours: 0,
      application_status: 'PENDING_APPROVAL',
      is_active: false
    };

    // The confirmation link must land on /login: a confirmed account is still
    // pending approval and ProtectedRoute refuses portal access.
    const siteUrl = (process.env.REACT_APP_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
    const redirectTo = siteUrl ? `${siteUrl}/login` : undefined;
    const { data: authData, error: authError } = await client.auth.signUp({
      email,
      password: userData.password,
      options: {
        data: metadata,
        ...(redirectTo ? { emailRedirectTo: redirectTo } : {})
      }
    });

    if (authError) throw authError;

    // When email confirmation is disabled Supabase returns a session.  The
    // SECURITY DEFINER auth trigger has already created the profile.
    // Destroy the temporary session so the signup form can redirect to login
    // where the user signs in directly into their dashboard.
    if (authData.session) {
      const { error: signOutError } = await client.auth.signOut();
      if (signOutError) throw makeAuthError('Registration completed, but the temporary session could not be closed. Please contact support.', 'REGISTRATION_SESSION_CLEANUP_FAILED');
    }

    rememberUser(null);
    return {
      user: authData.user,
      needsEmailConfirmation: !authData.session,
      pendingApproval: true
    };
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === 'EMAIL_EXISTS') toast.error('Email already registered.');
    throw error;
  }
}

// ==========================================================================
// Login and account approval gate
// ==========================================================================

export async function login(email, password, selectedAccountType = null) {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: String(email || '').trim().toLowerCase(),
    password
  });

  if (authError) {
    toast.error('Invalid email or password');
    throw authError;
  }

  try {
    let profileResult = await client
      .from('users')
      .select(SAFE_USER_COLUMNS)
      .eq('id', authData.user.id)
      .maybeSingle();
    if (profileResult.error) {
      profileResult = await client.from('users').select('*').eq('id', authData.user.id).maybeSingle();
    }
    const profile = profileResult.data;
    const profileError = profileResult.error;

    if (profileError && !isMissingProfileError(profileError)) {
      // An explicit credential attempt must never leave a half-validated
      // session behind.  Token refresh is handled separately by the provider.
      await endSession(client);
      rememberUser(null);
      const error = makeAuthError('We could not verify your account right now. Please try again.', 'PROFILE_READ_ERROR');
      toast.error(error.message);
      throw error;
    }
    if (!profile) {
      await endSession(client);
      rememberUser(null);
      const error = makeAuthError('Your account profile is incomplete. Please contact HYT support.', 'PROFILE_MISSING');
      toast.error(error.message);
      throw error;
    }

    const user = toCamelCase(profile);
    // Direct login: pending accounts are allowed. Only rejected or
    // admin-deactivated accounts are blocked here.
    if (isRejectedAccount(user)) {
      await endSession(client);
      rememberUser(null);
      const error = makeAuthError(
        'Your application was not approved. Please contact HYT support for more information.',
        'APPLICATION_REJECTED'
      );
      toast.error(error.message);
      throw error;
    }
    if (!isAccountApproved(user)) {
      await endSession(client);
      rememberUser(null);
      const error = makeAuthError('Your account is not active yet. Please contact HYT support.', 'ACCOUNT_INACTIVE');
      toast.error(error.message);
      throw error;
    }

    if (isAdminAccount(user)) {
      await client
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);
      rememberUser(user.id);
      return user;
    }

    // The account type is required for everyone except admins (handled above).
    // It is the student's declaration of which portal they belong to, and it
    // must match the role stored on their profile — otherwise a Trainee could
    // sign into the OJT portal, or vice versa.
    if (!selectedAccountType) {
      await endSession(client);
      rememberUser(null);
      const error = makeAuthError(
        'Please choose whether you are signing in as an OJT Student or a Trainee.',
        'ACCOUNT_TYPE_REQUIRED'
      );
      toast.error(error.message);
      throw error;
    }

    const expectedRole = roleForAccountType(selectedAccountType);
    if (normalizeRole(user.role) !== normalizeRole(expectedRole)) {
      await endSession(client);
      rememberUser(null);
      const roleLabel = normalizeRole(user.role) === 'OJT/INTERN' ? 'OJT Student' : 'Trainee';
      const error = makeAuthError(`Please select the ${roleLabel} account type to log in.`, 'ROLE_MISMATCH');
      toast.error(`Access Denied! ${error.message}`);
      throw error;
    }

    await client
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);
    rememberUser(user.id);
    return user;
  } catch (error) {
    if (!['PENDING_APPROVAL', 'APPLICATION_REJECTED', 'ACCOUNT_INACTIVE', 'ROLE_MISMATCH', 'ACCOUNT_TYPE_REQUIRED', 'PROFILE_READ_ERROR'].includes(error.code)) {
      // Do not turn a network/profile read failure into a false successful
      // login.  Supabase has already invalidated the local session where
      // appropriate; the caller will show the useful error.
      console.error('Login profile validation error:', error);
    }
    throw error;
  }
}

// ==========================================================================
// Session/logout/profile helpers
// ==========================================================================

export async function logout() {
  const client = supabase;
  let failure = null;
  let forced = false;

  if (client) {
    const result = await endSession(client);
    failure = result.failure;
    forced = Boolean(failure);
    if (result.remaining) {
      failure = makeAuthError(
        'We could not end your session. Please clear your browser data and try again.',
        'LOGOUT_FAILED'
      );
    }
  } else {
    clearPersistedSession();
  }

  rememberUser(null);

  if (failure) throw failure;
  toast.info('Logged out successfully');
  return { success: true, forced };
}

export async function getCurrentUser() {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) return null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    let profileResult = await client
      .from('users')
      .select(SAFE_USER_COLUMNS)
      .eq('id', data.user.id)
      .maybeSingle();
    if (profileResult.error) {
      profileResult = await client.from('users').select('*').eq('id', data.user.id).maybeSingle();
    }
    if (!profileResult.error && profileResult.data) return toCamelCase(profileResult.data);
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return null;
}

export async function updateProfile(userId, updates) {
  const client = requireSupabase();
  const allowed = {
    fullName: updates.fullName,
    firstName: updates.firstName,
    lastName: updates.lastName,
    birthday: updates.birthday,
    age: updates.age,
    address: updates.address,
    contactNumber: updates.contactNumber,
    profilePicture: updates.profilePicture,
    school: updates.school,
    course: updates.course,
    yearLevel: updates.yearLevel
  };
  Object.keys(allowed).forEach((key) => {
    if (allowed[key] === undefined) delete allowed[key];
  });

  const { data, error } = await client
    .from('users')
    .update(toSnakeCase(allowed))
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  toast.success('Profile updated successfully.');
  return toCamelCase(data);
}

export function hasRole(currentUser, role) {
  return normalizeRole(currentUser?.role) === normalizeRole(role);
}

export function isAdmin(currentUser) {
  return isAdminAccount(currentUser);
}

export function isStudent(currentUser) {
  return ['OJT/INTERN', 'STUDENT', 'TRAINEE'].includes(normalizeRole(currentUser?.role));
}

export function isAuthenticated(currentUser) {
  return Boolean(currentUser);
}

export { rememberUser as syncAuthMarker };
