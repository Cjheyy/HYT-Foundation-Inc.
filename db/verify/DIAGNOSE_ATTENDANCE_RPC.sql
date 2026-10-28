-- ============================================================================
-- HYT Foundation — DIAGNOSE: RPC returns 404 for role `authenticated`
-- ============================================================================
-- Run in the Supabase SQL Editor and send me the result table.
--
-- Symptom: POST /rest/v1/rpc/request_clock_in returns 404 from the browser, but
-- the same call with the anon key reaches the function and returns its own
-- "Unauthorized clock-in request" error.  PostgREST hides an RPC from a role
-- that lacks EXECUTE, and reports that as 404 (PGRST202) — so the difference
-- between anon working and authenticated 404-ing points at the function ACL.
--
-- This script records the CURRENT state first, then defensively re-grants
-- EXECUTE, then shows before/after side by side.  The re-grant is harmless:
-- these functions all check auth.uid() internally.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Snapshot the current state (before any change)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS _hyt_diag;
CREATE TEMP TABLE _hyt_diag AS
SELECT
  has_function_privilege('anon',
    'public.request_clock_in(uuid, numeric, numeric)', 'EXECUTE') AS anon_before,
  has_function_privilege('authenticated',
    'public.request_clock_in(uuid, numeric, numeric)', 'EXECUTE') AS auth_before,
  has_schema_privilege('anon', 'public', 'USAGE')            AS anon_schema_usage,
  has_schema_privilege('authenticated', 'public', 'USAGE')   AS auth_schema_usage,
  (SELECT p.proacl::text
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'request_clock_in'
    LIMIT 1)                                                 AS acl_before,
  (SELECT pg_get_userbyid(p.proowner)
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'request_clock_in'
    LIMIT 1)                                                 AS owner_name;


-- ---------------------------------------------------------------------------
-- 2. Defensive re-grant (no-op if the ACL was already correct)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  sig TEXT;
  targets TEXT[] := ARRAY[
    'public.request_clock_in(uuid, numeric, numeric)',
    'public.request_clock_out(uuid)',
    'public.approve_clock_in_request(uuid, uuid, text)',
    'public.approve_attendance_request(uuid, uuid, text)',
    'public.reject_attendance_request(uuid, uuid, text)',
    'public.is_hyt_admin()'
  ];
BEGIN
  FOREACH sig IN ARRAY targets LOOP
    IF to_regprocedure(sig) IS NOT NULL THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated, service_role', sig);
    END IF;
  END LOOP;
END $$;


-- ---------------------------------------------------------------------------
-- 3. Before / after comparison
-- ---------------------------------------------------------------------------
SELECT
  d.anon_before,
  d.auth_before,
  d.auth_schema_usage,
  d.owner_name,
  has_function_privilege('authenticated',
    'public.request_clock_in(uuid, numeric, numeric)', 'EXECUTE') AS auth_after,
  d.acl_before,
  (SELECT p.proacl::text
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'request_clock_in'
    LIMIT 1)                                                      AS acl_after
FROM _hyt_diag d;


-- ---------------------------------------------------------------------------
-- 4. Force PostgREST to rebuild its schema cache
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
