-- ===========================================================================
-- Geofence: measured centres + 20 m radius, client and server together.
--
-- Run this AFTER the client change (src/utils/geofence.js) is deployed. The
-- radius and the two centres are written down in two places by necessity - the
-- React app and Postgres - and this file is the half that Postgres owns. If the
-- two halves disagree, the client and the RPC judge the same student
-- differently and nobody can tell which one said no.
--
-- ---------------------------------------------------------------------------
-- What changed and why
-- ---------------------------------------------------------------------------
-- Centres are now the pins measured at each entrance:
--
--   HYT Building    14.642625282062204, 121.02453106633574
--   Atlanta Centre  14.604736146553744, 121.05314663304407
--
-- The previous values were not close. Measured against the streets the offices
-- actually sit on:
--
--   client HYT 14.6433,121.0125  -> 1,194 m off Natividad St     (wrong)
--   server HYT 14.6401,121.0189  ->   556 m off Natividad St     (wrong)
--   client ATL 14.6041,121.0538  ->    89 m off Annapolis St     (roughly right)
--   server ATL 14.6435,121.0175  -> 5,818 m off Annapolis St    (wrong - in QC)
--
-- At a 100 m radius those errors were survivable, which is why nobody noticed.
-- At 20 m they are the whole game: a student standing at the Atlanta door was
-- 5.8 km outside the server's idea of where that door is.
--
-- ---------------------------------------------------------------------------
-- Order of operations
-- ---------------------------------------------------------------------------
--   1. Run this file.
--   2. Confirm the verification queries at the bottom return what they say.
--   3. Only then set settings.geofence_enforcement_enabled = 'true'
--      and GEOFENCE_ENFORCEMENT_ENABLED = true in src/utils/geofence.js.
--
-- Running it in the other order rejects every clock-in at both offices.
-- ===========================================================================

-- 1. The radius the RPC actually uses ----------------------------------------
-- request_clock_in calls hyt_location_is_valid() without a radius, so it takes
-- this DEFAULT. Changing the default is enough; the RPC body needs no edit for
-- the radius.
CREATE OR REPLACE FUNCTION public.hyt_location_is_valid(
  user_lat NUMERIC,
  user_lon NUMERIC,
  site_lat NUMERIC,
  site_lon NUMERIC,
  radius_meters NUMERIC DEFAULT 20
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

COMMENT ON FUNCTION public.hyt_location_is_valid(NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC)
  IS 'Haversine fence, default 20 m. Keep in sync with GEOFENCE_RADIUS_METERS in src/utils/geofence.js.';

-- 2. The centres the RPC checks against --------------------------------------
-- Same body as before; only the four coordinate literals changed.
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
  -- false / 0 / off / no / disabled keeps the geofence enforced at the default radius, and a
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
  ELSIF public.hyt_location_is_valid(p_latitude, p_longitude, 14.642625282062204, 121.02453106633574)
     OR public.hyt_location_is_valid(p_latitude, p_longitude, 14.604736146553744, 121.05314663304407) THEN
    site_name := CASE
      WHEN public.hyt_location_is_valid(p_latitude, p_longitude, 14.642625282062204, 121.02453106633574) THEN 'HYT Building'
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
-- 3. Keep the RPC as the only write path for attendance ----------------------
REVOKE ALL ON FUNCTION public.request_clock_in(UUID, NUMERIC, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_clock_in(UUID, NUMERIC, NUMERIC) TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.attendance_logs FROM authenticated;

-- 4. The older fence path, which still hardcodes 5 m and the old centres -----
-- The app calls request_clock_in, never geofenced_clock_in, so these are dead
-- weight. A 5 m fence with wrong coordinates lying around is exactly what
-- someone finds later and switches on by mistake.
-- DROP FUNCTION IF EXISTS public.geofenced_clock_in(NUMERIC, NUMERIC, NUMERIC, NUMERIC);
-- DROP FUNCTION IF EXISTS public.validate_geofence(NUMERIC, NUMERIC);

-- 5. Verify ------------------------------------------------------------------
-- 5a. Radius in effect (expect radius_meters NUMERIC DEFAULT 20)
SELECT p.proname, pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'hyt_location_is_valid';

-- 5b. Enforcement switch (must still be false until you have run 5c)
SELECT key, setting_value
FROM public.settings
WHERE key = 'geofence_enforcement_enabled';

-- 5c. Standing on each entrance must pass; 30 m away must fail.
SELECT
  public.hyt_location_is_valid(14.642625282062204, 121.02453106633574, 14.642625282062204, 121.02453106633574) AS hyt_centre_true,
  public.hyt_location_is_valid(14.604736146553744, 121.05314663304407, 14.604736146553744, 121.05314663304407) AS atlanta_centre_true,
  public.hyt_location_is_valid(14.642895, 121.02453106633574, 14.642625282062204, 121.02453106633574) AS hyt_30m_false;

-- 5d. The old server centre must now FAIL for the real HYT entrance.
--     If this returns true, you are still on the old coordinates.
SELECT public.hyt_location_is_valid(14.642625282062204, 121.02453106633574, 14.6401, 121.0189) AS old_centre_should_be_false;
