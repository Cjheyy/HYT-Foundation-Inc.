-- ============================================================================
-- FIX_GEOFENCE_ENFORCEMENT.sql
--
-- Turns the geofence back on. This is the fix for the off-site clock-in that
-- reached the admin queue from ~6.4 km away.
--
-- ---------------------------------------------------------------------------
-- WHAT THE DIAGNOSTIC PROVED
-- ---------------------------------------------------------------------------
--   1 OVERLOAD  request_clock_in count   = 1
--   1 OVERLOAD  shape 5 args             = fence=yes, 20 m      <- fence code is fine
--   2 SWITCH    geofence_enforcement_... = false                <- THIS was the bug
--   3 LAST ROW  location_name            = "Testing bypass - geofence disabled"
--   3 LAST ROW  location_source          = ip
--   3 LAST ROW  accuracy_meters          = 5000
--   3 LAST ROW  meters from ATLANTA      = 6444
--   5 IS_VALID  radius_meters            = numeric DEFAULT 100  <- second bug
--
-- So the function was never broken and there was no stale overload. One row in
-- `settings` was telling it to stand down, and it stamped every accepted row
-- with "Testing bypass - geofence disabled" while doing it.
--
-- ---------------------------------------------------------------------------
-- ORDER OF OPERATIONS - do not skip this
-- ---------------------------------------------------------------------------
-- Flip the CLIENT flag FIRST (src/utils/geofence.js,
-- GEOFENCE_ENFORCEMENT_ENABLED = true), then run this file.
--
-- Why: while the client flag is false the browser sends a coarse or IP fix with
-- accuracy 5000. The server's accuracy gate is `p_accuracy > 20` -> 'imprecise'.
-- Turn the server on first and every legitimate clock-in AT THE OFFICE is
-- rejected, because a 5000 m fix cannot prove you are inside a 20 m circle.
-- With the client flag on, the page asks for a high-accuracy GPS fix (3-10 m)
-- and the gate passes.
--
-- ---------------------------------------------------------------------------
-- WHAT TO EXPECT WHEN TESTING OFF-SITE AFTER THIS
-- ---------------------------------------------------------------------------
-- You will get "Your location is only accurate to about 5000 meters..." rather
-- than "You are 6444 meters away". That is the fence FIRING, not failing: the
-- accuracy check runs before the distance check. Section 3 below shows the
-- order. If you want the friendlier "you are X metres away" message off-site,
-- run the optional PART 3 - it reorders the two checks without loosening them.
--
-- Read only the last SELECT: it prints a single PASS/FAIL grid.
-- ============================================================================


-- ===========================================================================
-- PART 1 - the actual fix. One row, idempotent, no unique constraint needed.
-- ===========================================================================
UPDATE public.settings
SET value = 'true'::jsonb
WHERE key = 'geofence_enforcement_enabled';

INSERT INTO public.settings (key, value)
SELECT 'geofence_enforcement_enabled', 'true'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.settings WHERE key = 'geofence_enforcement_enabled'
);


-- ===========================================================================
-- PART 2 - the second bug: the helper's default radius is 100, not 20.
--
-- No live RPC calls this helper right now (the 5-arg request_clock_in does its
-- own maths with fence_radius := 20), so this is a latent trap rather than the
-- cause. It matters because ENSURE_ATTENDANCE_HELPERS.sql re-creates the helper
-- and would restore a 100 m default, and because anything that later calls it
-- with four arguments would silently get a fence five times too wide.
--
-- Same body as installed; only DEFAULT 100 -> DEFAULT 20 changes. Defaults are
-- not part of the signature, so this replaces in place without an overload.
-- ===========================================================================
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
  IS 'True when the fix is within radius_meters of the site. Default 20 m, matching GEOFENCE_RADIUS_METERS.';


-- ===========================================================================
-- PART 3 - OPTIONAL. Reorder the accuracy and distance checks in
-- request_clock_in so an off-site trainee is told the real reason.
--
-- Not applied by this file. Run it separately if you want it. It does NOT
-- loosen anything: a far-away fix is still refused, and a vague fix is still
-- refused. It only changes WHICH sentence you get, and only when the fix is
-- both far away and vague.
--
-- The change is:
--     now   : accuracy > 20           -> 'imprecise'   (even if 6 km away)
--             distance > 20           -> 'outside'
--     after : distance > 20           -> 'outside'     (the honest reason)
--             accuracy > 20 (close in) -> 'imprecise'
-- ===========================================================================
-- SELECT 'PART 3 is commented out - run it on purpose.' AS note;


-- ===========================================================================
-- VERIFY - one grid, one result set (the SQL Editor shows only the last one).
-- Every row must say PASS.
-- ===========================================================================
WITH cfg AS (
  SELECT
    (SELECT s.value::text FROM public.settings s
      WHERE s.key = 'geofence_enforcement_enabled')                  AS switch_value,
    (SELECT COUNT(*) FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'request_clock_in') AS overload_count,
    (SELECT pg_get_function_arguments(p.oid) FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'hyt_location_is_valid'
      LIMIT 1)                                                       AS is_valid_args
)
SELECT check_name, result, CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS verdict
FROM (
  SELECT 1 AS ord,
         'switch is ON' AS check_name,
         COALESCE(cfg.switch_value, '(missing - fail closed)') AS result,
         (cfg.switch_value IS NOT NULL
          AND LOWER(TRIM(BOTH '"' FROM cfg.switch_value))
              NOT IN ('false','f','0','off','no','disabled'))      AS ok
  FROM cfg

  UNION ALL
  SELECT 2, 'exactly one request_clock_in', cfg.overload_count::text,
         cfg.overload_count = 1
  FROM cfg

  UNION ALL
  SELECT 3, 'hyt_location_is_valid default is 20',
         COALESCE(cfg.is_valid_args, '(missing)'),
         COALESCE(cfg.is_valid_args, '') LIKE '%DEFAULT 20%'
  FROM cfg

  UNION ALL
  SELECT 4, 'MOA is rejected by the helper (must be false)',
         public.hyt_location_is_valid(14.5352, 120.9822, 14.642625282062204, 121.02453106633574)::text,
         public.hyt_location_is_valid(14.5352, 120.9822, 14.642625282062204, 121.02453106633574) = FALSE

  UNION ALL
  SELECT 5, 'a point 5 m from HYT is accepted (must be true)',
         public.hyt_location_is_valid(14.642670, 121.024531, 14.642625282062204, 121.02453106633574)::text,
         public.hyt_location_is_valid(14.642670, 121.024531, 14.642625282062204, 121.02453106633574) = TRUE
) AS checks
ORDER BY ord;
