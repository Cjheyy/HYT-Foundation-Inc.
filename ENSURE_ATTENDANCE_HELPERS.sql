-- ============================================================================
-- HYT Foundation — ENSURE the helper functions request_clock_in depends on
-- ============================================================================
-- Run ONCE in the Supabase SQL Editor.  Idempotent — safe to re-run.
--
-- SAFETY
-- ----------------------------------------------------------------------------
-- The definitions below are copied VERBATIM from
-- OJT_TRACKING_PRODUCTION_MIGRATION.sql — they are your own functions, not new
-- ones.  Geofencing is NOT removed: hyt_location_is_valid still performs the
-- same 100 m Haversine test against the same two office coordinates.
--
-- The report at the end tells you exactly what happened per function:
--   "created (was missing)"     -> it really was absent; nothing was overwritten
--   "unchanged"                 -> it already existed and matched; no-op
--   "REPLACED (definition differed)" -> it existed but differed from the
--                                       migration's version.  If you see this
--                                       and you did not expect it, STOP and tell
--                                       me before relying on it.
--
-- WHY THIS IS NEEDED
-- ----------------------------------------------------------------------------
-- request_clock_in calls these helpers.  If one is missing, the RPC raises
-- `42883: function public.<helper>(...) does not exist`, and PostgREST reports
-- 42883 as HTTP 404 — indistinguishable from "the RPC isn't installed".  That
-- is what produced the misleading "Attendance workflow migration is required"
-- toast.  Creating the helpers removes that ambiguity.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Snapshot the CURRENT state, before touching anything
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS _hyt_helper_snapshot;
CREATE TEMP TABLE _hyt_helper_snapshot AS
SELECT *
FROM (VALUES
  ('hyt_location_is_valid',
   'public.hyt_location_is_valid(numeric, numeric, numeric, numeric, numeric)'),
  ('hyt_close_previous_attendance',
   'public.hyt_close_previous_attendance(uuid)'),
  ('is_hyt_admin',
   'public.is_hyt_admin()')
) AS v(function_name, signature)
CROSS JOIN LATERAL (
  SELECT
    to_regprocedure(v.signature) IS NOT NULL AS existed_before,
    (SELECT pg_get_functiondef(p.oid)
       FROM pg_proc p
      WHERE p.oid = to_regprocedure(v.signature)) AS defn_before
) AS snap;


-- ---------------------------------------------------------------------------
-- 2. Haversine distance test used by request_clock_in
--    (100 m radius, same two HYT office coordinates — unchanged)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hyt_location_is_valid(
  user_lat NUMERIC,
  user_lon NUMERIC,
  site_lat NUMERIC,
  site_lon NUMERIC,
  radius_meters NUMERIC DEFAULT 100
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  earth_radius NUMERIC := 6371000;
  dlat DOUBLE PRECISION;
  dlon DOUBLE PRECISION;
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
  distance DOUBLE PRECISION;
BEGIN
  IF user_lat IS NULL OR user_lon IS NULL THEN RETURN FALSE; END IF;
  dlat := RADIANS((site_lat - user_lat)::DOUBLE PRECISION);
  dlon := RADIANS((site_lon - user_lon)::DOUBLE PRECISION);
  a := POWER(SIN(dlat / 2.0), 2.0) +
       COS(RADIANS(user_lat::DOUBLE PRECISION)) *
       COS(RADIANS(site_lat::DOUBLE PRECISION)) *
       POWER(SIN(dlon / 2.0), 2.0);
  c := 2.0 * ASIN(LEAST(1.0, SQRT(GREATEST(0.0, a))));
  distance := earth_radius * c;
  RETURN distance <= radius_meters;
END;
$$;


-- ---------------------------------------------------------------------------
-- 3. Voids a shift left open on a previous day (called by request_clock_in)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hyt_close_previous_attendance(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today_value DATE := (NOW() AT TIME ZONE 'Asia/Manila')::date;
BEGIN
  UPDATE public.attendance_logs
  SET status = 'VOID',
      rendered_hours = 0,
      time_out = NULL,
      admin_note = COALESCE(NULLIF(TRIM(admin_note), ''), 'Automatically closed: the trainee did not clock out the previous day.'),
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND date < today_value
    AND UPPER(status) IN ('CLOCKED_IN', 'PENDING_CLOCK_IN', 'PENDING_CLOCK_OUT', 'PENDING_OUT', 'PENDING_APPROVAL', 'PENDING_REVIEW', 'PENDING');
END;
$$;

REVOKE ALL ON FUNCTION public.hyt_close_previous_attendance(UUID) FROM PUBLIC;


-- ---------------------------------------------------------------------------
-- 4. Admin check used by the approval RPCs and the RLS policies
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_hyt_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND UPPER(role) = 'ADMIN'
  );
$$;

REVOKE ALL ON FUNCTION public.is_hyt_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_hyt_admin() TO authenticated;


-- ---------------------------------------------------------------------------
-- 5. Report BOTH what changed and what exists now, in ONE result set.
--    (The SQL Editor only shows the last statement that returns rows, so
--    splitting these into two queries would hide the change report.)
-- ---------------------------------------------------------------------------
SELECT
  'WHAT CHANGED' AS section,
  s.function_name AS item,
  CASE
    WHEN NOT s.existed_before THEN 'created (was missing)'
    WHEN s.defn_before IS DISTINCT FROM (
      SELECT pg_get_functiondef(p.oid) FROM pg_proc p WHERE p.oid = to_regprocedure(s.signature)
    ) THEN 'REPLACED (definition differed)'
    ELSE 'unchanged (already present, identical)'
  END AS detail
FROM _hyt_helper_snapshot s

UNION ALL

SELECT
  'PRESENT NOW',
  p.proname,
  pg_get_function_identity_arguments(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'request_clock_in',
    'request_clock_out',
    'hyt_location_is_valid',
    'hyt_close_previous_attendance',
    'is_hyt_admin',
    'approve_clock_in_request',
    'approve_attendance_request',
    'reject_attendance_request'
  )

ORDER BY section, item;

-- Rebuild the PostgREST schema cache so the definitions are picked up.
NOTIFY pgrst, 'reload schema';
