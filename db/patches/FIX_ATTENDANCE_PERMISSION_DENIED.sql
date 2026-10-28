-- ============================================================================
-- HYT Foundation — FIX: "permission denied for table attendance_logs"
-- ============================================================================
-- Run ONCE in the Supabase SQL Editor.  Every statement is idempotent, so it is
-- safe to re-run.
--
-- WHY THE ERROR HAPPENS
-- ----------------------------------------------------------------------------
-- OJT_TRACKING_PRODUCTION_MIGRATION.sql hardened the attendance table to be
-- RPC-only:
--
--     REVOKE INSERT, UPDATE, DELETE ON public.attendance_logs FROM authenticated;
--     GRANT  SELECT                  ON public.attendance_logs TO authenticated;
--
-- That is the correct production design — a trainee must not be able to write
-- status / time_in / rendered_hours directly.
--
-- But the client's "testing bypass" (GEOFENCE_ENFORCEMENT_ENABLED = false in
-- src/utils/geofence.js) made clockIn() skip the request_clock_in RPC and
-- INSERT straight into the table.  The role no longer holds INSERT, so Postgres
-- rejects it with exactly:  permission denied for table attendance_logs
--
-- WHAT THIS SCRIPT DOES
-- ----------------------------------------------------------------------------
-- Keeps the RPC-only model and moves the geofence bypass to the SERVER, where
-- it belongs.  request_clock_in now reads a settings row to decide whether to
-- enforce the 100 m radius, so the client never needs table-level write access.
--
-- TO TURN STRICT GEOFENCING BACK ON BEFORE PRODUCTION:
--     UPDATE public.settings SET value = 'true'::jsonb
--     WHERE key = 'geofence_enforcement_enabled';
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Server-side geofence switch (currently OFF for testing / demo)
-- ---------------------------------------------------------------------------
INSERT INTO public.settings (key, value, category, description)
VALUES (
  'geofence_enforcement_enabled',
  'false'::jsonb,
  'attendance',
  'When false, request_clock_in accepts a clock-in from any location (testing/demo only). Set to true before production.'
)
ON CONFLICT (key) DO NOTHING;


-- ---------------------------------------------------------------------------
-- 2. Recreate request_clock_in with the geofence decision made server-side
-- ---------------------------------------------------------------------------
-- Safety net: if an older deployment left an extra overload of this function
-- behind, a 3-argument call becomes ambiguous and PostgREST answers with
-- "PGRST203: Could not choose the best candidate function" instead of running
-- anything.  Drop every signature except the canonical one.
--
-- NOTE: pg_get_function_identity_arguments() returns the argument list WITH
-- parameter names (e.g. "p_user_id uuid, p_latitude numeric, p_longitude
-- numeric"), not bare types.  Comparing against 'uuid, numeric, numeric' would
-- be true for the canonical function too and drop it — the canonical string
-- below must match the CREATE OR REPLACE signature exactly.
DO $$
DECLARE
  stray RECORD;
  canonical CONSTANT TEXT := 'p_user_id uuid, p_latitude numeric, p_longitude numeric';
BEGIN
  FOR stray IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'request_clock_in'
      AND pg_get_function_identity_arguments(p.oid) <> canonical
  LOOP
    EXECUTE format('DROP FUNCTION %s', stray.signature);
    RAISE NOTICE 'Dropped stray overload: %', stray.signature;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.request_clock_in(
  p_user_id UUID,
  p_latitude NUMERIC,
  p_longitude NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller UUID := auth.uid();
  today_value DATE := (NOW() AT TIME ZONE 'Asia/Manila')::date;
  record_id UUID;
  site_name TEXT;
  enforce_geofence BOOLEAN := TRUE;   -- fail closed
  setting_value JSONB;
BEGIN
  IF caller IS NULL OR (caller <> p_user_id AND NOT public.is_hyt_admin()) THEN
    RAISE EXCEPTION 'Unauthorized clock-in request';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = caller AND (
      UPPER(role) = 'ADMIN'
      OR (is_active = TRUE AND UPPER(COALESCE(application_status, '')) IN ('APPROVED', 'ACCEPTED', 'ACTIVE'))
    )
  ) THEN
    RAISE EXCEPTION 'Account is not approved';
  END IF;

  -- Server-authoritative geofence switch.  Anything other than an explicit
  -- false / 0 / off / no / disabled keeps the 100 m radius enforced, and a
  -- missing row also fails closed.
  SELECT value INTO setting_value
  FROM public.settings
  WHERE key = 'geofence_enforcement_enabled';

  IF setting_value IS NOT NULL THEN
    enforce_geofence := LOWER(TRIM(BOTH '"' FROM setting_value::text))
      NOT IN ('false', 'f', '0', 'off', 'no', 'disabled');
  END IF;

  IF NOT enforce_geofence THEN
    site_name := 'Testing bypass - geofence disabled';
  ELSIF public.hyt_location_is_valid(p_latitude, p_longitude, 14.6401, 121.0189)
     OR public.hyt_location_is_valid(p_latitude, p_longitude, 14.6435, 121.0175) THEN
    site_name := CASE
      WHEN public.hyt_location_is_valid(p_latitude, p_longitude, 14.6401, 121.0189) THEN 'HYT Building'
      ELSE 'Atlanta Office'
    END;
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'You must be at an approved HYT location to clock in.');
  END IF;

  -- Self-heal a shift left open on a previous day instead of silently allowing
  -- a second concurrent open row.
  PERFORM public.hyt_close_previous_attendance(caller);

  IF EXISTS (
    SELECT 1 FROM public.attendance_logs
    WHERE user_id = caller AND date = today_value
      AND UPPER(status) IN (
        'PENDING_CLOCK_IN', 'CLOCKED_IN', 'PENDING_CLOCK_OUT', 'PENDING_OUT',
        'APPROVED', 'REJECTED', 'VOID', 'PENDING_APPROVAL', 'PENDING_REVIEW'
      )
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Attendance for today is already in progress or completed.');
  END IF;

  INSERT INTO public.attendance_logs (
    user_id, date, time_in, latitude, longitude, location_name, status, requested_at
  ) VALUES (
    caller, today_value, NULL, p_latitude, p_longitude, site_name, 'PENDING_CLOCK_IN', NOW()
  ) RETURNING id INTO record_id;

  RETURN jsonb_build_object(
    'success', true,
    'attendance_id', record_id,
    'status', 'PENDING_CLOCK_IN',
    'location', site_name,
    'message', 'Clock-in request submitted. Waiting for administrator approval.'
  );
END;
$$;


-- ---------------------------------------------------------------------------
-- 3. Keep the RPC as the only write path for attendance
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.request_clock_in(UUID, NUMERIC, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_clock_in(UUID, NUMERIC, NUMERIC) TO authenticated;

-- The table stays read-only for clients.  This is intentional — do not grant
-- INSERT / UPDATE / DELETE back to `authenticated`.
REVOKE INSERT, UPDATE, DELETE ON public.attendance_logs FROM authenticated;
GRANT SELECT ON public.attendance_logs TO authenticated;


-- ---------------------------------------------------------------------------
-- 4. Verify
-- ---------------------------------------------------------------------------
SELECT key, value, category
FROM public.settings
WHERE key = 'geofence_enforcement_enabled';

SELECT p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('request_clock_in', 'request_clock_out', 'approve_clock_in_request')
ORDER BY p.proname;

-- Refresh the PostgREST schema cache so the new function body is picked up
-- immediately instead of after the next automatic reload.
NOTIFY pgrst, 'reload schema';
