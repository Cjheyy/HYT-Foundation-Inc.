-- ============================================================
-- CHECK ADMIN ACCOUNTS  (READ-ONLY — changes nothing)
-- ============================================================
-- Run this in the Supabase SQL Editor for project
--   qlulnldctvcjlzflpupe   (the one the live site uses)
--
-- The SQL Editor runs with the service role, so it bypasses RLS.
-- The public website can only see what RLS exposes, which is why
-- an outside check can disagree with what you see in the dashboard.
--
-- Answer the question: "is there really an admin account?"
-- ============================================================


-- ------------------------------------------------------------
-- 1. EVERY PROFILE ROW — who the app considers a user
-- ------------------------------------------------------------
-- `role` here is what the app reads. The app treats an account as
-- admin only when UPPER(role) = 'ADMIN' exactly. 'Administrator',
-- 'Admin', or 'OJT/Intern' are NOT admin.
SELECT
  id,
  email,
  role,
  account_type,
  is_active,
  application_status,
  created_at
FROM public.users
ORDER BY created_at;


-- ------------------------------------------------------------
-- 2. EVERY AUTH USER — including ones with no profile row
-- ------------------------------------------------------------
-- If a user appears here but NOT in query 1, they can sign in
-- but the app cannot load their profile — that is a different bug
-- (usually a missing or failed handle_new_user trigger).
SELECT
  au.id,
  au.email,
  au.email_confirmed_at IS NOT NULL AS email_confirmed,
  au.raw_user_meta_data ->> 'role' AS role_in_metadata,
  (SELECT pu.role FROM public.users pu WHERE pu.id = au.id) AS role_in_public_users,
  au.created_at
FROM auth.users au
ORDER BY au.created_at;


-- ------------------------------------------------------------
-- 3. THE VERDICT — how many admins exist?
-- ------------------------------------------------------------
SELECT
  COUNT(*) FILTER (WHERE UPPER(TRIM(role)) = 'ADMIN')      AS real_admins,
  COUNT(*) FILTER (WHERE UPPER(TRIM(role)) <> 'ADMIN')     AS non_admins,
  COUNT(*)                                                  AS total_profiles
FROM public.users;


-- ------------------------------------------------------------
-- 4. IS RLS ACTUALLY ON? — explains the public exposure
-- ------------------------------------------------------------
SELECT
  relname        AS table_name,
  relrowsecurity AS rls_enabled
FROM pg_class
WHERE relname = 'users'
  AND relnamespace = 'public'::regnamespace;


-- ------------------------------------------------------------
-- 5. EVERY POLICY CURRENTLY ON public.users
-- ------------------------------------------------------------
-- If this list is empty while RLS is enabled, nobody can read
-- the table through the API. If RLS is disabled, the anon key
-- can read every row — which is the exposure in the audit.
SELECT
  policyname,
  cmd        AS applies_to,
  roles,
  qual       AS using_expression,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'users'
ORDER BY cmd, policyname;


-- ------------------------------------------------------------
-- 6. EVERY PROFILE ROW AGAIN, WITH ITS ROLE — for a quick headcount
-- ------------------------------------------------------------
-- NOTE: this does NOT reproduce what a logged-out visitor sees.
-- The SQL Editor runs as the service role, so RLS is bypassed here
-- and you always get the full table. To test the public exposure
-- you must call the REST endpoint with the anon key, e.g.
--   curl "https://qlulnldctvcjlzflpupe.supabase.co/rest/v1/users?select=*" \
--        -H "apikey: <ANON_KEY>"
-- Comparing that row count against this one is the real RLS test.
SELECT id, email, full_name, role
FROM public.users
ORDER BY role, email;
