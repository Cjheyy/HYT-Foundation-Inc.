-- ============================================================
-- CHECK CONTENT  (READ-ONLY — changes nothing)
-- ============================================================
-- Run in the Supabase SQL Editor for project qlulnldctvcjlzflpupe.
--
-- WHY THIS IS NEEDED
-- A request made with the public anon key is filtered by RLS.
-- "0 rows" through the API therefore proves nothing on its own:
-- the table may be genuinely empty, OR full of rows the visitor
-- is not allowed to see.
--
-- The SQL Editor runs as the service role, so COUNT(*) here is the
-- real total. Compare the two columns below:
--   total_rows  = what actually exists
--   anon_visible = what the public website can show
-- ============================================================


-- ------------------------------------------------------------
-- 1. REAL ROW COUNTS PER TABLE
-- ------------------------------------------------------------
SELECT 'programs'        AS table_name, COUNT(*) AS total_rows FROM public.programs
UNION ALL SELECT 'events',          COUNT(*) FROM public.events
UNION ALL SELECT 'opportunities',   COUNT(*) FROM public.opportunities
UNION ALL SELECT 'applications',    COUNT(*) FROM public.applications
UNION ALL SELECT 'daily_reports',   COUNT(*) FROM public.daily_reports
UNION ALL SELECT 'attendance_logs', COUNT(*) FROM public.attendance_logs
UNION ALL SELECT 'ojt_records',     COUNT(*) FROM public.ojt_records
UNION ALL SELECT 'requirements',    COUNT(*) FROM public.requirements
UNION ALL SELECT 'certificates',    COUNT(*) FROM public.certificates
UNION ALL SELECT 'announcements',   COUNT(*) FROM public.announcements
UNION ALL SELECT 'users',           COUNT(*) FROM public.users
ORDER BY table_name;


-- ------------------------------------------------------------
-- 2. ARE THE PUBLIC LISTINGS PUBLISHED?
-- ------------------------------------------------------------
-- If rows exist but status is Draft/Pending, the public page stays
-- empty even though the data is there. This is the most common
-- reason a listing looks blank.
SELECT 'programs' AS source, status, COUNT(*) AS rows
FROM public.programs GROUP BY status
UNION ALL
SELECT 'events', status, COUNT(*) FROM public.events GROUP BY status
UNION ALL
SELECT 'opportunities', status, COUNT(*) FROM public.opportunities GROUP BY status
ORDER BY source, status;


-- ------------------------------------------------------------
-- 3. SAMPLE OF WHAT A VISITOR WOULD SEE
-- ------------------------------------------------------------
SELECT id, title, status, created_at
FROM public.programs
ORDER BY created_at DESC
LIMIT 10;

SELECT id, title, status, created_at
FROM public.events
ORDER BY created_at DESC
LIMIT 10;

SELECT id, title, status, created_at
FROM public.opportunities
ORDER BY created_at DESC
LIMIT 10;


-- ------------------------------------------------------------
-- 4. WHICH RLS POLICIES GOVERN THE PUBLIC LISTINGS
-- ------------------------------------------------------------
-- Tells you whether "0 rows on the website" is a data problem or
-- a policy problem.
SELECT tablename, policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('programs', 'events', 'opportunities')
ORDER BY tablename, cmd, policyname;


-- ------------------------------------------------------------
-- 5. ANNOUNCEMENTS THAT POINT AT NOTHING
-- ------------------------------------------------------------
-- Catches leftovers like "New event: Pitas Calamansi" after the
-- event itself was deleted.
SELECT id, title, status, created_at
FROM public.announcements
ORDER BY created_at DESC;
