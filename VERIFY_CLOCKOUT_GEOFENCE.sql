-- ===========================================================================
-- VERIFY: did PATCH_CLOCKOUT_GEOFENCE.sql land?
--
-- Run this AFTER the patch, in the same SQL editor. Read-only - every
-- statement here is a SELECT, so nothing can be rolled back by a mistake in
-- this file. That separation is the point: the first version had these checks
-- at the bottom of the migration, and a wrong column name in a SELECT rolled
-- back the entire batch.
--
-- Expected results are written above each query. If one does not match, the
-- patch did not apply - re-run it, then run this again.
-- ===========================================================================

-- 1. Exactly TWO functions, five arguments each. Expect 2 rows:
--      request_clock_in  | p_user_id uuid, p_latitude numeric, p_longitude numeric, p_accuracy numeric DEFAULT NULL::numeric, p_source text DEFAULT NULL::text
--      request_clock_out | p_user_id uuid DEFAULT NULL::uuid, p_latitude numeric DEFAULT NULL::numeric, ...
--    If you see four rows, an old overload survived and is still reachable.
SELECT p.proname, pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('request_clock_in', 'request_clock_out')
ORDER BY p.proname;

-- 2. The seven new columns. Expect 7 rows.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'attendance_logs'
  AND column_name IN (
    'accuracy_meters', 'location_source', 'clock_out_latitude',
    'clock_out_longitude', 'clock_out_accuracy_meters',
    'clock_out_location_source', 'clock_out_location_name'
  )
ORDER BY column_name;

-- 3. The enforcement switch. Expect ONE row, and `value` should be false /
--    "false" / 0 while you are still testing. The column is `value` -
--    `setting_value` is only a variable name inside the RPCs.
SELECT key, value
FROM public.settings
WHERE key = 'geofence_enforcement_enabled';

-- 4. The distance helper. Expect at_pin = 0 and thirty_metres_north ~ 30.
SELECT
  ROUND(public.hyt_location_distance_meters(
    14.642625282062204, 121.02453106633574,
    14.642625282062204, 121.02453106633574)) AS at_pin,
  ROUND(public.hyt_location_distance_meters(
    14.642895, 121.02453106633574,
    14.642625282062204, 121.02453106633574)) AS thirty_metres_north;

-- 5. Grants: `authenticated` may EXECUTE both RPCs and must NOT be able to
--    write attendance_logs directly. Expect the two functions with
--    grantee = authenticated, and NO insert/update/delete rows for that table.
SELECT routine_name, privilege_type, grantee
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN ('request_clock_in', 'request_clock_out')
ORDER BY routine_name, grantee;

-- Expect SELECT only for authenticated. Anything else here is a write path
-- that bypasses the RPC - TRUNCATE especially, because RLS does not filter it
-- and one statement empties the table.
SELECT grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'attendance_logs'
  AND grantee IN ('authenticated', 'anon')
ORDER BY grantee, privilege_type;

-- 6. RLS must be ON. Expect rowsecurity = true.
SELECT relname, relrowsecurity
FROM pg_class
WHERE oid = 'public.attendance_logs'::regclass;
