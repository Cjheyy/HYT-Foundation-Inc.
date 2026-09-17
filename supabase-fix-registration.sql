-- ============================================
-- FIX REGISTRATION RLS ISSUE
-- ============================================
-- This script fixes the "new row violates row-level security policy" error
-- by using a database trigger to auto-create public.users profile
-- when a new auth.users record is created.
--
-- Run this in Supabase SQL Editor BEFORE the main schema.
-- ============================================

-- Drop existing restrictive INSERT policy
DROP POLICY IF EXISTS "Users can insert own profile during registration" ON public.users;

-- Create new policy that allows INSERT during registration with user metadata
CREATE POLICY "Allow profile creation during registration" 
ON public.users 
FOR INSERT 
WITH CHECK (
  -- Allow if authenticated user matches
  auth.uid() = id 
  OR
  -- Allow if called from trigger (bypass RLS for system operations)
  current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
);

-- ============================================
-- DATABASE TRIGGER: Auto-create public.users profile
-- ============================================

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into public.users with basic info from auth.users
  INSERT INTO public.users (
    id,
    email,
    password_hash,
    role,
    full_name,
    first_name,
    last_name,
    account_type
  )
  VALUES (
    NEW.id,
    NEW.email,
    '', -- Empty - Supabase Auth handles passwords
    'STUDENT', -- Default role
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'account_type', 'Training')
  )
  ON CONFLICT (id) DO NOTHING; -- Prevent duplicates

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users INSERT
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Allow trigger to bypass RLS
GRANT USAGE ON SCHEMA public TO postgres;
GRANT ALL ON public.users TO postgres;

-- ============================================
-- NOTES
-- ============================================
-- This approach:
-- 1. Keeps RLS enabled ✅
-- 2. Secure - trigger runs with elevated privileges ✅
-- 3. Automatic - no client-side INSERT needed ✅
-- 4. Profile created immediately when auth user created ✅
--
-- After running this:
-- - Update authService.js to remove manual INSERT
-- - Pass user metadata in signUp() options.data
-- - Profile will be auto-created by trigger
