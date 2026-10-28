-- ===========================================================================
-- PATCH: fence the clock-OUT, and let the server judge fix quality
--
-- Run this in the Supabase SQL editor. It is idempotent - safe to run twice.
--
-- What it fixes
-- ---------------------------------------------------------------------------
-- 1. Clock-out had no fence at all. request_clock_out(p_user_id) took no
--    coordinates and checked nothing, so a trainee could clock in at the office
--    and clock out from home. The client checked, but the client is not the
--    authority - a direct RPC call skipped it entirely.
--
-- 2. The server could not see how good a fix was. request_clock_in took only
--    lat/lon, and attendance_logs had no column for accuracy or source, so a
--    3 m GPS fix and a 5 km IP guess were indistinguishable in the audit trail.
--
-- 3. The accuracy ceiling was 30 m against a 20 m fence. A fix good to +/-30 m
--    cannot place anyone inside a 20 m circle. The ceiling is now the radius.
--
-- Deploy order
-- ---------------------------------------------------------------------------
--   Client first, then this file, then flip the enforcement switch:
--     1. Deploy the app (it sends accuracy/source and clock-out coordinates,
--        and falls back gracefully if this file has not run yet).
--     2. Run this file. Verify with the queries at the bottom.
--     3. Only then: settings.geofence_enforcement_enabled = 'true' and
--        GEOFENCE_ENFORCEMENT_ENABLED = true in src/utils/geofence.js.
--
-- Until step 3 the fence is open and nothing is rejected - this patch changes
-- what is RECORDED and what WOULD be checked, not what is enforced.
-- ===========================================================================

-- 1. Columns ------------------------------------------------------------------
-- Clock-in position is already on the row. Clock-out gets its own, because the
-- two are different places and only one pair was being kept.
ALTER TABLE public.attendance_logs
  ADD COLUMN IF NOT EXISTS accuracy_meters NUMERIC,
  ADD COLUMN IF NOT EXISTS location_source TEXT,
  ADD COLUMN IF NOT EXISTS clock_out_latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS clock_out_longitude NUMERIC,
  ADD COLUMN IF NOT EXISTS clock_out_accuracy_meters NUMERIC,
  ADD COLUMN IF NOT EXISTS clock_out_location_source TEXT,
  ADD COLUMN IF NOT EXISTS clock_out_location_name TEXT;

COMMENT ON COLUMN public.attendance_logs.accuracy_meters
  IS 'Reported GPS accuracy at clock-in, in metres. NULL = unknown (old client).';
COMMENT ON COLUMN public.attendance_logs.location_source
  IS 'gps | coarse | ip | fallback - where the clock-in fix came from.';

-- 2. Distance helper ----------------------------------------------------------
-- Same Haversine as hyt_location_is_valid, but returns the number so the RPCs
-- can report HOW far away someone was instead of just "no".
CREATE OR REPLACE FUNCTION public.hyt_location_distance_meters(
  user_lat NUMERIC,
  user_lon NUMERIC,
  site_lat NUMERIC,
  site_lon NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  earth_radius NUMERIC := 6371000;
  dlat DOUBLE PRECISION;
  dlon DOUBLE PRECISION;
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
BEGIN
  IF user_lat IS NULL OR user_lon IS NULL OR site_lat IS NULL OR site_lon IS NULL THEN
    RETURN NULL;
  END IF;
  dlat := RADIANS((site_lat - user_lat)::DOUBLE PRECISION);
  dlon := RADIANS((site_lon - user_lon)::DOUBLE PRECISION);
  a := POWER(SIN(dlat / 2.0), 2.0) +
       COS(RADIANS(user_lat::DOUBLE PRECISION)) *
       COS(RADIANS(site_lat::DOUBLE PRECISION)) *
       POWER(SIN(dlon / 2.0), 2.0);
  c := 2.0 * ASIN(LEAST(1.0, SQRT(GREATEST(0.0, a))));
  RETURN (earth_radius * c)::NUMERIC;
END;
$$;

COMMENT ON FUNCTION public.hyt_location_distance_meters(NUMERIC, NUMERIC, NUMERIC, NUMERIC)
  IS 'Metres between two points. Keep the earth radius in step with hyt_location_is_valid.';

-- 3. Drop the old overloads ---------------------------------------------------
-- Leaving the three-argument request_clock_in or the one-argument
-- request_clock_out in place would give PostgREST two candidates and, worse,
-- leave an unfenced clock-out reachable by calling the old signature.
DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('request_clock_in', 'request_clock_out')
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s', fn.signature);
  END LOOP;
END;
$$;

-- 4. request_clock_in ---------------------------------------------------------
-- Same contract as before, plus:
--   * p_accuracy - rejected when worse than the radius (a fix cannot prove you
--     are inside a fence smaller than its own uncertainty)
--   * p_source   - recorded so an IP guess is visible later
--   * the rejection message carries the real distance
CREATE OR REPLACE FUNCTION public.request_clock_in(
  p_user_id UUID,
  p_latitude NUMERIC,
  p_longitude NUMERIC,
  p_accuracy NUMERIC DEFAULT NULL,
  p_source TEXT DEFAULT NULL
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
  fence_radius NUMERIC := 20;         -- keep in step with GEOFENCE_RADIUS_METERS
  hyt_lat NUMERIC := 14.642625282062204;
  hyt_lon NUMERIC := 121.02453106633574;
  atl_lat NUMERIC := 14.604736146553744;
  atl_lon NUMERIC := 121.05314663304407;
  hyt_distance NUMERIC;
  atl_distance NUMERIC;
  nearest_distance NUMERIC;
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

  SELECT value INTO setting_value
  FROM public.settings
  WHERE key = 'geofence_enforcement_enabled';

  IF setting_value IS NOT NULL THEN
    enforce_geofence := LOWER(TRIM(BOTH '"' FROM setting_value::text))
      NOT IN ('false', 'f', '0', 'off', 'no', 'disabled');
  END IF;

  IF NOT enforce_geofence THEN
    site_name := 'Testing bypass - geofence disabled';
  ELSE
    IF p_latitude IS NULL OR p_longitude IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'A valid location is required to clock in.');
    END IF;

    -- A fix whose own uncertainty is wider than the fence cannot answer the
    -- question, so it is refused instead of being run through the distance
    -- check and passing by luck.
    IF p_accuracy IS NOT NULL AND p_accuracy > fence_radius THEN
      RETURN jsonb_build_object(
        'success', false,
        'reason', 'imprecise',
        'message', format('Your location is only accurate to about %s meters, which is too rough to confirm you are on site. Move somewhere with a clearer view of the sky and try again.', ROUND(p_accuracy))
      );
    END IF;

    hyt_distance := public.hyt_location_distance_meters(p_latitude, p_longitude, hyt_lat, hyt_lon);
    atl_distance := public.hyt_location_distance_meters(p_latitude, p_longitude, atl_lat, atl_lon);
    nearest_distance := LEAST(hyt_distance, atl_distance);

    IF nearest_distance > fence_radius THEN
      RETURN jsonb_build_object(
        'success', false,
        'reason', 'outside',
        'distance_meters', ROUND(nearest_distance),
        'message', format('You are currently %s meters away from the nearest approved office. You must be within %s meters to clock in.', ROUND(nearest_distance), fence_radius)
      );
    END IF;

    site_name := CASE WHEN hyt_distance <= atl_distance THEN 'HYT Building' ELSE 'Atlanta Office' END;
  END IF;

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
    user_id, date, time_in, latitude, longitude, accuracy_meters, location_source,
    location_name, status, requested_at
  ) VALUES (
    caller, today_value, NULL, p_latitude, p_longitude, p_accuracy, NULLIF(p_source, ''),
    site_name, 'PENDING_CLOCK_IN', NOW()
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

-- 5. request_clock_out --------------------------------------------------------
-- Now takes the same fix the clock-in takes, and applies the same fence.
-- Extra parameters are DEFAULT NULL so an un-updated client still resolves to
-- this one function; it is refused only when enforcement is ON and it sent no
-- coordinates, which is the honest answer.
CREATE OR REPLACE FUNCTION public.request_clock_out(
  p_user_id UUID DEFAULT NULL,
  p_latitude NUMERIC DEFAULT NULL,
  p_longitude NUMERIC DEFAULT NULL,
  p_accuracy NUMERIC DEFAULT NULL,
  p_source TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller UUID := auth.uid();
  record_row public.attendance_logs%ROWTYPE;
  frozen_at TIMESTAMPTZ := NOW();
  seconds INTEGER;
  hours NUMERIC(8, 4);
  enforce_geofence BOOLEAN := TRUE;
  setting_value JSONB;
  fence_radius NUMERIC := 20;
  hyt_lat NUMERIC := 14.642625282062204;
  hyt_lon NUMERIC := 121.02453106633574;
  atl_lat NUMERIC := 14.604736146553744;
  atl_lon NUMERIC := 121.05314663304407;
  hyt_distance NUMERIC;
  atl_distance NUMERIC;
  nearest_distance NUMERIC;
  site_name TEXT;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_user_id IS NOT NULL AND caller <> p_user_id AND NOT public.is_hyt_admin() THEN
    RAISE EXCEPTION 'Unauthorized clock-out request';
  END IF;

  -- The fence runs BEFORE the row is touched, so a rejected clock-out leaves
  -- the shift open and the trainee can retry from the right place.
  SELECT value INTO setting_value
  FROM public.settings
  WHERE key = 'geofence_enforcement_enabled';

  IF setting_value IS NOT NULL THEN
    enforce_geofence := LOWER(TRIM(BOTH '"' FROM setting_value::text))
      NOT IN ('false', 'f', '0', 'off', 'no', 'disabled');
  END IF;

  IF enforce_geofence THEN
    IF p_latitude IS NULL OR p_longitude IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'reason', 'invalid',
        'message', 'A valid location is required to clock out. Turn on location services and try again.'
      );
    END IF;

    IF p_accuracy IS NOT NULL AND p_accuracy > fence_radius THEN
      RETURN jsonb_build_object(
        'success', false,
        'reason', 'imprecise',
        'message', format('Your location is only accurate to about %s meters, which is too rough to confirm you are on site. Move somewhere with a clearer view of the sky and try again.', ROUND(p_accuracy))
      );
    END IF;

    hyt_distance := public.hyt_location_distance_meters(p_latitude, p_longitude, hyt_lat, hyt_lon);
    atl_distance := public.hyt_location_distance_meters(p_latitude, p_longitude, atl_lat, atl_lon);
    nearest_distance := LEAST(hyt_distance, atl_distance);

    IF nearest_distance > fence_radius THEN
      RETURN jsonb_build_object(
        'success', false,
        'reason', 'outside',
        'distance_meters', ROUND(nearest_distance),
        'message', format('You are currently %s meters away from the nearest approved office. You must be within %s meters to clock out.', ROUND(nearest_distance), fence_radius)
      );
    END IF;

    site_name := CASE WHEN hyt_distance <= atl_distance THEN 'HYT Building' ELSE 'Atlanta Office' END;
  ELSE
    site_name := 'Testing bypass - geofence disabled';
  END IF;

  SELECT * INTO record_row
  FROM public.attendance_logs
  WHERE user_id = caller AND date = (NOW() AT TIME ZONE 'Asia/Manila')::date
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;

  IF NOT FOUND OR UPPER(record_row.status) <> 'CLOCKED_IN' OR record_row.time_in IS NULL THEN
    RAISE EXCEPTION 'No active clock-in is available';
  END IF;

  seconds := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (frozen_at - record_row.time_in)))::INTEGER);
  hours := ROUND((seconds::NUMERIC / 3600), 4);

  UPDATE public.attendance_logs
  SET status = 'PENDING_CLOCK_OUT',
      pending_end_time = frozen_at,
      duration_seconds = seconds,
      rendered_hours = hours,
      clock_out_latitude = p_latitude,
      clock_out_longitude = p_longitude,
      clock_out_accuracy_meters = p_accuracy,
      clock_out_location_source = NULLIF(p_source, ''),
      clock_out_location_name = site_name,
      updated_at = NOW()
  WHERE id = record_row.id;

  RETURN jsonb_build_object(
    'success', true,
    'attendance_id', record_row.id,
    'status', 'PENDING_CLOCK_OUT',
    'pending_end_time', frozen_at,
    'duration_seconds', seconds,
    'rendered_hours', hours,
    'location', site_name,
    'message', 'Clock-out request submitted. Waiting for administrator approval.'
  );
END;
$$;

-- 6. Keep the RPCs as the only write path -------------------------------------
REVOKE ALL ON FUNCTION public.request_clock_in(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_clock_in(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.request_clock_out(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_clock_out(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.hyt_location_distance_meters(NUMERIC, NUMERIC, NUMERIC, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hyt_location_distance_meters(NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.attendance_logs FROM authenticated;

-- Supabase grants ALL to `authenticated` by default, so the row above left
-- TRUNCATE, REFERENCES and TRIGGER behind. TRUNCATE is not filtered by RLS and
-- empties the table in one statement - it is a bigger hole than DELETE, which
-- is why it is revoked explicitly rather than assumed gone.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.attendance_logs FROM authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.attendance_logs FROM anon;

-- PostgREST caches function signatures; without this the new parameters are
-- invisible until the next schema reload.
NOTIFY pgrst, 'reload schema';

-- Verification lives in VERIFY_CLOCKOUT_GEOFENCE.sql, deliberately NOT here.
-- The SQL editor runs a batch as one transaction, so a typo in a SELECT at the
-- bottom rolled back every ALTER and CREATE above it. Checks get their own
-- file so a mistake in a check can never undo a migration.

