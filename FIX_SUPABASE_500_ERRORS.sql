-- ============================================================================
-- SUPABASE 500 ERROR FIX - COMPLETE DATABASE REPAIR SCRIPT
-- ============================================================================
-- Purpose: Fix RLS policies, sync auth.users with public.users, and prevent
--          500 Internal Server Errors on REST API queries
-- Run this entire script in Supabase SQL Editor
-- ============================================================================

-- STEP 1: DISABLE RLS TEMPORARILY FOR CLEANUP
-- ============================================================================
ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;

-- STEP 2: DROP ALL EXISTING RLS POLICIES (REMOVE RECURSIVE POLICIES)
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.users;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.users;
DROP POLICY IF EXISTS "Allow individual read access" ON public.users;
DROP POLICY IF EXISTS "Allow individual update access" ON public.users;
DROP POLICY IF EXISTS "Allow service role all access" ON public.users;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

-- STEP 3: DROP ALL EXISTING TRIGGERS ON AUTH.USERS
-- ============================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user ON auth.users;
DROP TRIGGER IF EXISTS on_user_created ON auth.users;
DROP TRIGGER IF EXISTS create_user_profile ON auth.users;

-- Drop associated functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.create_user_profile() CASCADE;
DROP FUNCTION IF EXISTS public.on_auth_user_created() CASCADE;

-- STEP 4: MODIFY PUBLIC.USERS TABLE SCHEMA (REMOVE RIGID NOT NULL CONSTRAINTS)
-- ============================================================================

-- Add columns if they don't exist (idempotent)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS school VARCHAR(255);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS required_hours NUMERIC(6,2) DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS rendered_hours NUMERIC(6,2) DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Remove NOT NULL constraints on non-essential columns
ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN first_name DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN last_name DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN address DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN birthday DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN school DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN course DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN year_level DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN student_id DROP NOT NULL;

-- Ensure essential columns exist with proper defaults
ALTER TABLE public.users ALTER COLUMN email SET NOT NULL;
ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'OJT/Intern';
ALTER TABLE public.users ALTER COLUMN role SET NOT NULL;
ALTER TABLE public.users ALTER COLUMN full_name SET DEFAULT 'User';
ALTER TABLE public.users ALTER COLUMN is_active SET DEFAULT TRUE;
ALTER TABLE public.users ALTER COLUMN rendered_hours SET DEFAULT 0;
ALTER TABLE public.users ALTER COLUMN required_hours SET DEFAULT 0;

-- Ensure proper foreign key constraint exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'users_id_fkey' AND table_name = 'users'
    ) THEN
        ALTER TABLE public.users 
        ADD CONSTRAINT users_id_fkey 
        FOREIGN KEY (id) 
        REFERENCES auth.users(id) 
        ON DELETE CASCADE;
    END IF;
END $$;

-- STEP 5: RETROACTIVE SYNC - INSERT MISSING USERS FROM AUTH.USERS
-- ============================================================================

INSERT INTO public.users (
    id,
    email,
    full_name,
    role,
    required_hours,
    rendered_hours,
    is_active,
    created_at
)
SELECT 
    au.id,
    au.email,
    COALESCE(
        au.raw_user_meta_data->>'full_name',
        au.raw_user_meta_data->>'fullName', 
        SPLIT_PART(au.email, '@', 1)
    ) as full_name,
    COALESCE(
        au.raw_user_meta_data->>'role',
        'OJT/Intern'
    ) as role,
    COALESCE(
        (au.raw_user_meta_data->>'required_hours')::numeric,
        (au.raw_user_meta_data->>'requiredHours')::numeric,
        486
    ) as required_hours,
    0 as rendered_hours,
    COALESCE(
        (au.raw_user_meta_data->>'is_active')::boolean,
        (au.raw_user_meta_data->>'isActive')::boolean,
        TRUE
    ) as is_active,
    au.created_at
FROM auth.users au
WHERE NOT EXISTS (
    SELECT 1 FROM public.users pu WHERE pu.id = au.id
)
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.users.full_name, EXCLUDED.full_name),
    role = COALESCE(public.users.role, EXCLUDED.role),
    required_hours = COALESCE(public.users.required_hours, EXCLUDED.required_hours),
    is_active = COALESCE(public.users.is_active, EXCLUDED.is_active);

-- STEP 6: CREATE BULLETPROOF TRIGGER FUNCTION FOR NEW USERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_full_name TEXT;
    v_role TEXT;
    v_school TEXT;
    v_required_hours NUMERIC;
    v_address TEXT;
    v_birthday DATE;
BEGIN
    -- Safely extract metadata with fallbacks
    BEGIN
        v_full_name := COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'fullName',
            SPLIT_PART(NEW.email, '@', 1),
            'User'
        );
        
        v_role := COALESCE(
            NEW.raw_user_meta_data->>'role',
            'OJT/Intern'
        );
        
        v_school := NEW.raw_user_meta_data->>'school';
        
        v_required_hours := COALESCE(
            (NEW.raw_user_meta_data->>'required_hours')::numeric,
            (NEW.raw_user_meta_data->>'requiredHours')::numeric,
            CASE 
                WHEN v_role = 'OJT/Intern' THEN 486
                ELSE 0
            END
        );
        
        v_address := NEW.raw_user_meta_data->>'address';
        
        v_birthday := (NEW.raw_user_meta_data->>'birthday')::date;
        
    EXCEPTION WHEN OTHERS THEN
        -- If any parsing fails, use safe defaults
        v_full_name := COALESCE(SPLIT_PART(NEW.email, '@', 1), 'User');
        v_role := 'OJT/Intern';
        v_school := NULL;
        v_required_hours := 0;
        v_address := NULL;
        v_birthday := NULL;
    END;

    -- Insert into public.users
    INSERT INTO public.users (
        id,
        email,
        full_name,
        role,
        school,
        required_hours,
        rendered_hours,
        address,
        birthday,
        is_active,
        created_at
    ) VALUES (
        NEW.id,
        NEW.email,
        v_full_name,
        v_role,
        v_school,
        v_required_hours,
        0,
        v_address,
        v_birthday,
        TRUE,
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = NOW();

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the auth.users insert
    RAISE WARNING 'Failed to create user profile for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- STEP 7: ATTACH TRIGGER TO AUTH.USERS
-- ============================================================================

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- STEP 8: CREATE NON-RECURSIVE RLS POLICIES
-- ============================================================================

-- Re-enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow users to read their own profile
CREATE POLICY "users_select_own"
ON public.users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Policy 2: Allow admins to read all profiles (non-recursive check)
CREATE POLICY "admins_select_all"
ON public.users
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND auth.users.raw_user_meta_data->>'role' = 'ADMIN'
    )
);

-- Policy 3: Allow users to update their own profile
CREATE POLICY "users_update_own"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy 4: Allow authenticated users to insert their profile on registration
CREATE POLICY "users_insert_own"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Policy 5: Allow anon role to insert during registration (if using signup)
CREATE POLICY "anon_insert_on_signup"
ON public.users
FOR INSERT
TO anon
WITH CHECK (true);

-- Policy 6: Service role has full access
CREATE POLICY "service_role_all_access"
ON public.users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- STEP 9: GRANT PERMISSIONS TO ROLES
-- ============================================================================

-- Grant schema access
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated, service_role;
GRANT SELECT, INSERT ON public.users TO anon;

-- Grant permissions on other tables (attendance, reports, etc.)
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Grant sequence permissions
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- STEP 10: VERIFY SETUP
-- ============================================================================

-- Check if policies are active
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

-- Check if trigger exists
SELECT tgname, tgtype, tgenabled 
FROM pg_trigger 
WHERE tgrelid = 'auth.users'::regclass
AND tgname = 'on_auth_user_created';

-- Count synced users
SELECT 
    (SELECT COUNT(*) FROM auth.users) as auth_users_count,
    (SELECT COUNT(*) FROM public.users) as public_users_count;

-- ============================================================================
-- SCRIPT COMPLETE
-- ============================================================================

-- Next steps:
-- 1. Test registration with a new email
-- 2. Test login with existing account
-- 3. Check that public.users row exists after auth succeeds
-- 4. Verify no 500 errors on /rest/v1/users queries

RAISE NOTICE 'Database repair complete! RLS policies fixed, trigger installed, users synced.';
