import { supabase, toCamelCase } from '../config/supabase';
import { toast } from 'react-toastify';

// ============================================
// REGISTER - Sign up new user
// ============================================
export async function register(userData) {
  try {
    if (!supabase) {
      throw new Error('Supabase not configured. Check .env file.');
    }

    // Check if email exists in public.users
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', userData.email)
      .maybeSingle();

    if (existingUser) {
      toast.error('Email already registered!');
      throw new Error('Email already registered');
    }

    // Map frontend account type to database role
    // Frontend: 'trainee' → Database: 'Trainee'
    // Frontend: 'ojt-student' → Database: 'OJT/Intern'
    const roleMap = {
      'trainee': 'Trainee',
      'ojt-student': 'OJT/Intern'
    };

    const userRole = roleMap[userData.accountType] || 'Trainee';

    // Create auth user with metadata
    // Database trigger will auto-create public.users profile
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          full_name: userData.fullName,
          first_name: userData.firstName,
          last_name: userData.lastName,
          student_id: userData.studentId,
          role: userRole, // Use mapped role
          account_type: userData.accountType, // Keep for backward compatibility
          school: userData.school,
          course: userData.course,
          year_level: userData.yearLevel,
          birthday: userData.birthday,
          age: userData.age,
          address: userData.address,
          contact_number: userData.contactNumber,
          required_hours: userData.requiredHours,
          rendered_hours: 0
        },
        emailRedirectTo: window.location.origin
      }
    });

    if (authError) throw authError;

    // Handle email confirmation case
    if (!authData.session) {
      toast.info('📧 Please check your email to confirm your account before logging in.');
      return { user: authData.user, needsEmailConfirmation: true };
    }

    // If session exists, update profile with additional fields
    // (Database trigger creates basic profile, now we add extra fields)
    if (authData.session) {
      const { error: updateError } = await supabase
        .from('users')
        .update({
          role: userRole, // Set correct role
          student_id: userData.studentId,
          school: userData.school || null,
          course: userData.course,
          year_level: userData.yearLevel,
          birthday: userData.birthday,
          age: userData.age,
          address: userData.address,
          contact_number: userData.contactNumber,
          required_hours: userData.requiredHours || 0,
          rendered_hours: 0,
          is_active: true
        })
        .eq('id', authData.user.id);

      if (updateError) {
        console.warn('Profile update warning:', updateError);
        // Don't throw - basic profile was created by trigger
      }
    }

    toast.success('🎉 Registration successful! You can now login.');
    return { user: authData.user, needsEmailConfirmation: false };
  } catch (error) {
    console.error('Registration error:', error);
    toast.error(error.message || 'Registration failed');
    throw error;
  }
}

// ============================================
// LOGIN - Sign in with email/password
// Architecture: Authenticate first, then verify role
// ============================================
export async function login(email, password, selectedAccountType) {
  try {
    if (!supabase) {
      throw new Error('Supabase not configured. Check .env file.');
    }

    // STEP 1: Authenticate with Supabase Auth (credentials validation)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      // Authentication failed - wrong email/password
      toast.error('❌ Invalid email or password');
      throw authError;
    }

    // STEP 2: Fetch user profile from database to get role
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (userError || !user) {
      // Auth succeeded but profile is missing - database/registration issue
      await supabase.auth.signOut(); // Sign out since profile is missing
      toast.error('❌ Account found but profile is incomplete. Please contact support.');
      throw new Error('User profile not found in database. Auth succeeded but profile missing.');
    }

    // STEP 3: Role-based verification and redirection logic

    // CASE 1: ADMIN BYPASS - Admins don't need account type selection
    if (user.role === 'ADMIN') {
      // Update last login
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);

      toast.success(`✅ Login successful! Welcome Admin ${user.full_name}`);
      return toCamelCase(user);
    }

    // CASE 2 & 3: Non-admin users MUST select correct account type
    
    // Check if account type was selected
    if (!selectedAccountType) {
      await supabase.auth.signOut();
      
      // Provide helpful error based on user's actual role
      if (user.role === 'Trainee') {
        toast.error('❌ Access Denied! Please select the Trainee account type to log in.');
      } else if (user.role === 'OJT/Intern') {
        toast.error('❌ Access Denied! Please select the OJT Student account type to log in.');
      } else {
        toast.error('❌ Access Denied! Please select an account type to log in.');
      }
      throw new Error('Account type selection required for non-admin users');
    }

    // Map frontend account type selection to database role
    // Frontend: 'trainee' → Database: 'Trainee'
    // Frontend: 'ojt-student' → Database: 'OJT/Intern'
    const accountTypeMap = {
      'trainee': 'Trainee',
      'ojt-student': 'OJT/Intern'
    };

    const expectedRole = accountTypeMap[selectedAccountType];

    // Verify the user's role matches their selection
    if (user.role !== expectedRole) {
      await supabase.auth.signOut();
      
      // Provide helpful error message
      const userRoleFriendly = user.role === 'Trainee' ? 'Trainee' : 'OJT Student';
      toast.error(`❌ Access Denied! Please select the ${userRoleFriendly} account type to log in.`);
      throw new Error('Incorrect account type selected');
    }

    // Update last login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    toast.success(`✅ Login successful! Welcome ${user.full_name}`);
    return toCamelCase(user);
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

// ============================================
// LOGOUT
// ============================================
export async function logout() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    toast.info('👋 Logged out successfully');
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    toast.error('Logout failed');
    return { success: false };
  }
}

// ============================================
// GET CURRENT USER
// ============================================
export async function getCurrentUser() {
  try {
    if (!supabase) {
      console.error('Supabase client not initialized');
      return null;
    }
    
    const { data: { user: authUser }, error } = await supabase.auth.getUser();
    
    if (error || !authUser) return null;

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    return user ? toCamelCase(user) : null;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}

// ============================================
// UPDATE PROFILE
// ============================================
export async function updateProfile(userId, updates) {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({
        full_name: updates.fullName,
        first_name: updates.firstName,
        last_name: updates.lastName,
        birthday: updates.birthday,
        age: updates.age,
        address: updates.address,
        contact_number: updates.contactNumber,
        profile_picture: updates.profilePicture,
        school: updates.school,
        course: updates.course,
        year_level: updates.yearLevel
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    toast.success('✅ Profile updated successfully!');
    return toCamelCase(data);
  } catch (error) {
    console.error('Update profile error:', error);
    toast.error('Failed to update profile');
    throw error;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================
export function hasRole(currentUser, role) {
  return currentUser?.role === role;
}

export function isAdmin(currentUser) {
  return currentUser?.role === 'ADMIN';
}

export function isStudent(currentUser) {
  return currentUser?.role === 'STUDENT';
}

export function isAuthenticated(currentUser) {
  return currentUser !== null;
}
