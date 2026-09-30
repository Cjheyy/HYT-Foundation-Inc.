import { createClient } from '@supabase/supabase-js';

// Get from .env file - CORRECT variable names
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
// Supabase now exposes both the legacy anon key and the newer publishable key.
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY ||
  process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY || '';

// Pin the session storage key so sign-out, cross-tab fallbacks and support
// tooling all target exactly the same entry instead of guessing by substring.
const projectRef = (() => {
  try {
    return supabaseUrl ? new URL(supabaseUrl).hostname.split('.')[0] : '';
  } catch (error) {
    return '';
  }
})();

export const SUPABASE_STORAGE_KEY = process.env.REACT_APP_SUPABASE_STORAGE_KEY ||
  (projectRef ? `sb-${projectRef}-auth-token` : 'hyt-supabase-auth-token');

export const SUPABASE_CONFIG_ERROR = supabaseUrl && supabaseAnonKey
  ? null
  : 'Supabase is not configured. Add REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY (or REACT_APP_SUPABASE_PUBLISHABLE_KEY) to your environment.';

let client = null;

if (SUPABASE_CONFIG_ERROR) {
  console.error(` ${SUPABASE_CONFIG_ERROR}`);
} else {
  try {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        // Implicit (fragment) recovery links are handled by the client itself.
        // Supabase's {{ .TokenHash }} template is handled by the /auth/confirm
        // route via verifyOtp, so both email templates work with this setting.
        flowType: 'implicit',
        storageKey: SUPABASE_STORAGE_KEY
      }
    });
  } catch (error) {
    console.error(' Failed to create the Supabase client.', error);
  }
}

export const supabase = client;

/**
 * Remove the persisted session entry.  The auth client keeps the session in an
 * in-memory cache as well, so callers must re-read with `getSession()` after
 * using this helper.
 */
export const clearPersistedSession = () => {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(SUPABASE_STORAGE_KEY);
    }
  } catch (error) {
    console.warn('Unable to clear the persisted Supabase session.', error);
  }
};

// Helper: Convert snake_case to camelCase
export const toCamelCase = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(item => toCamelCase(item));
  }

  // `null` and primitive values (including undefined) must be returned as-is.
  // The previous implementation dereferenced obj.constructor for undefined.
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  return Object.keys(obj).reduce((result, key) => {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = toCamelCase(obj[key]);
    return result;
  }, {});
};

// Helper: Convert camelCase to snake_case
export const toSnakeCase = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(item => toSnakeCase(item));
  }

  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  return Object.keys(obj).reduce((result, key) => {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    result[snakeKey] = toSnakeCase(obj[key]);
    return result;
  }, {});
};

export default supabase;
