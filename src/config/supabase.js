import { createClient } from '@supabase/supabase-js';

// Get from .env file - CORRECT variable names
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
// Supabase now exposes both the legacy anon key and the newer publishable key.
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY ||
  process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY || '';

// Validate
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ MISSING SUPABASE CREDENTIALS!');
  console.error('Add to .env file:');
  console.error('REACT_APP_SUPABASE_URL=https://qlulnldctvcjlzflpupe.supabase.co');
  console.error('REACT_APP_SUPABASE_ANON_KEY=eyJ... (your anon key)');
  console.error('Get key: https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/settings/api');
}

// Create Supabase client
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    })
  : null;

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
