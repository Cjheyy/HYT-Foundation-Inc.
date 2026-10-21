-- ==========================================================================
-- VERIFY · clock-out cutoff
--
-- READ ONLY.  Nothing here writes, so a mistake in this file can never roll
-- back the migration it is checking.
-- ==========================================================================

-- 1. The function exists with the expected signature.
SELECT p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'request_clock_out';

-- 2. The cutoff is really inside the function body.  Expect 1.
SELECT COUNT(*) AS mentions_cutoff
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'request_clock_out'
  AND p.prosrc ILIKE '%clock_out_cutoff%';

-- 3. Expect 1 for the too_late branch as well.
SELECT COUNT(*) AS has_too_late_branch
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'request_clock_out'
  AND p.prosrc ILIKE '%too_late%';

-- 4. The effective cutoff.  `null` here means the setting is absent and the
--    function is using its built-in 18:30 default - which is fine, not a fault.
SELECT key, value
FROM public.settings
WHERE key = 'clock_out_cutoff';

-- 5. The server's own idea of the time, so the deadline can be compared
--    against something trustworthy instead of the laptop clock.
SELECT (NOW() AT TIME ZONE 'Asia/Manila') AS manila_now,
       to_char((NOW() AT TIME ZONE 'Asia/Manila'), 'HH24:MI') AS manila_hhmm,
       TIME '18:30' AS default_cutoff,
       ((NOW() AT TIME ZONE 'Asia/Manila')::time > TIME '18:30') AS past_default_cutoff;

-- 6. Only `authenticated` may execute it, and only through the RPC.
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public' AND routine_name = 'request_clock_out'
ORDER BY grantee, privilege_type;
