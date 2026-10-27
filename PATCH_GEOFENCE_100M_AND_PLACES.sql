-- ===========================================================================
-- Geofence: 100 m instead of 20 m, and exactly TWO place names.
--
-- Run this in the Supabase SQL Editor. It returns ONE result grid at the end.
--
-- ---------------------------------------------------------------------------
-- Why
-- ---------------------------------------------------------------------------
-- 1. 20 m does not survive contact with a real phone. Indoors - which is where
--    a trainee stands when clocking in - a handset reports 20-50 m of
--    uncertainty. The accuracy gate runs BEFORE the distance check, so a real
--    reading of 29 m was refused with "too rough to confirm you are on site"
--    while the person was inside the building.
--
--    100 m still refuses the clock-in this fence exists for: the one from MOA,
--    6.4 km away. The two offices are ~5.2 km apart, so the circles cannot
--    overlap and nobody can be "inside both".
--
-- 2. The place label was written down twice and disagreed. The client said
--    "HYT Foundation Building, Natividad, QC" / "Atlanta Centre, San Juan",
--    the server wrote "HYT Building" / "Atlanta Office". The same clock-in
--    therefore read as a different site depending on which screen rendered it.
--    Both sides now say exactly:
--
--       HYT Building
--       Atlanta San Juan Building
--
-- ---------------------------------------------------------------------------
-- What this file does
-- ---------------------------------------------------------------------------
--   PART 1  hyt_location_is_valid  - default radius 20 -> 100
--   PART 2  request_clock_in / request_clock_out - the fence literal 20 -> 100
--           and 'Atlanta Office' -> 'Atlanta San Juan Building', patched in the
--           LIVE function source rather than retyped (see the note there)
--   PART 3  existing attendance_logs.location_name rows, normalised to the two
--           names so old records stop showing a third place
--   PART 4  one verification grid
--
-- Idempotent: running it twice changes nothing the second time.
-- ===========================================================================


-- ===========================================================================
-- PART 1 - the default radius used by the 3-argument clock-in and by anything
--          else that calls this helper without an explicit radius.
-- ===========================================================================
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

COMMENT ON FUNCTION public.hyt_location_is_valid(NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC)
  IS 'Haversine fence, default 100 m. Keep in sync with GEOFENCE_RADIUS_METERS in src/utils/geofence.js.';


-- ===========================================================================
-- PART 2 - the two RPCs carry the radius as a local variable
--          (`fence_radius NUMERIC := 20;`), not as a parameter, so there is no
--          way to change it with a settings row.
--
--          WHY THIS PATCHES THE LIVE SOURCE INSTEAD OF RETYPING THE FUNCTION:
--          request_clock_in is ~150 lines of approval, cutoff and duplicate-row
--          logic. Copying that body into a migration is how a migration ends up
--          reverting a fix somebody shipped last week - the copy is correct the
--          day it is written and wrong the next time the function changes. So
--          the CURRENT definition is read from pg_proc, the one literal is
--          replaced, and the result is executed. Whatever else the body does
--          today, it keeps doing.
--
--          The replacement is anchored to `fence_radius NUMERIC := 20;`, which
--          exists exactly once per function. If a function has already been
--          moved to 100 it is left alone, so this is safe to re-run.
-- ===========================================================================
DO $$
DECLARE
  r        RECORD;
  v_def    TEXT;
  v_new    TEXT;
  v_count  INT := 0;
BEGIN
  FOR r IN
    SELECT p.oid,
           p.proname,
           pg_get_function_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('request_clock_in', 'request_clock_out')
  LOOP
    v_def := pg_get_functiondef(r.oid);

    -- 20 -> 100, case- and spacing-tolerant.
    v_new := regexp_replace(
      v_def,
      'fence_radius\s+numeric\s*:=\s*20\s*;',
      'fence_radius NUMERIC := 100;',
      'gi'
    );

    -- The server's place label must be one of the same two the client prints.
    v_new := replace(v_new, '''Atlanta Office''', '''Atlanta San Juan Building''');

    IF v_new <> v_def THEN
      EXECUTE v_new;
      v_count := v_count + 1;
      RAISE NOTICE 'patched %(%)', r.proname, r.args;
    END IF;
  END LOOP;

  RAISE NOTICE 'functions patched: %', v_count;
END $$;

-- The rebuilt bodies must still be callable by signed-in users.
REVOKE ALL ON FUNCTION public.request_clock_in(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_clock_in(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.request_clock_out(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_clock_out(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT) TO authenticated;

-- attendance_logs stays read-only for clients; the RPCs are the only write path.
REVOKE INSERT, UPDATE, DELETE ON public.attendance_logs FROM authenticated;


-- ===========================================================================
-- PART 3 - old rows, normalised to the two names.
--
--          Without this, every clock-in recorded before today keeps whatever
--          label was current then, and the admin queue shows a third and fourth
--          place that no longer exists. 'Testing bypass - geofence disabled' is
--          deliberately left alone: it is a true record of a period when the
--          fence was off, and rewriting it would hide that.
-- ===========================================================================
UPDATE public.attendance_logs
SET location_name = 'HYT Building'
WHERE location_name LIKE 'HYT Foundation Building%'
   OR location_name LIKE 'HYT Foundation Inc%';

UPDATE public.attendance_logs
SET location_name = 'Atlanta San Juan Building'
WHERE location_name LIKE 'Atlanta Centre%'
   OR location_name = 'Atlanta Office';

-- The clock-out half of the row, when that column exists on this deployment.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'attendance_logs'
      AND column_name = 'clock_out_location_name'
  ) THEN
    UPDATE public.attendance_logs
    SET clock_out_location_name = 'HYT Building'
    WHERE clock_out_location_name LIKE 'HYT Foundation Building%'
       OR clock_out_location_name LIKE 'HYT Foundation Inc%';

    UPDATE public.attendance_logs
    SET clock_out_location_name = 'Atlanta San Juan Building'
    WHERE clock_out_location_name LIKE 'Atlanta Centre%'
       OR clock_out_location_name = 'Atlanta Office';
  END IF;
END $$;


-- ===========================================================================
-- PART 4 - verification. ONE grid, because the SQL Editor only shows the last
--          result set - the earlier scripts in this repo learned that the hard
--          way. Every row must say PASS / the expected value.
-- ===========================================================================
WITH
rpc AS (
  SELECT
    COUNT(*) FILTER (WHERE pg_get_functiondef(p.oid) ~* 'fence_radius\s+numeric\s*:=\s*20\s*;') AS still_20,
    COUNT(*) FILTER (WHERE pg_get_functiondef(p.oid) ~* 'fence_radius\s+numeric\s*:=\s*100\s*;') AS at_100,
    COUNT(*) FILTER (WHERE pg_get_functiondef(p.oid) LIKE '%''Atlanta Office''%') AS old_name
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('request_clock_in', 'request_clock_out')
),
helper AS (
  SELECT pg_get_function_arguments(p.oid) AS args
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'hyt_location_is_valid'
  LIMIT 1
),
places AS (
  SELECT COALESCE(location_name, '(null)') AS name, COUNT(*) AS rows
  FROM public.attendance_logs
  GROUP BY 1
),
stray AS (
  SELECT COUNT(*) AS n,
         COALESCE(STRING_AGG(DISTINCT location_name, ', '), '') AS names
  FROM public.attendance_logs
  WHERE location_name IS NOT NULL
    AND location_name NOT IN (
      'HYT Building',
      'Atlanta San Juan Building',
      'Testing bypass - geofence disabled'
    )
)
SELECT '1 helper default radius' AS item,
       CASE WHEN (SELECT args FROM helper) LIKE '%DEFAULT 100%' THEN 'PASS (100)' ELSE 'FAIL -> ' || COALESCE((SELECT args FROM helper), 'missing') END AS value
UNION ALL
SELECT '2 RPCs still holding 20 m',
       CASE WHEN (SELECT still_20 FROM rpc) = 0 THEN 'PASS (0)' ELSE 'FAIL -> ' || (SELECT still_20 FROM rpc) END
UNION ALL
SELECT '3 RPCs moved to 100 m',
       CASE WHEN (SELECT at_100 FROM rpc) >= 1 THEN 'PASS (' || (SELECT at_100 FROM rpc) || ')' ELSE 'FAIL -> 0' END
UNION ALL
SELECT '4 old ''Atlanta Office'' literal',
       CASE WHEN (SELECT old_name FROM rpc) = 0 THEN 'PASS (0)' ELSE 'FAIL -> ' || (SELECT old_name FROM rpc) END
UNION ALL
SELECT '5 fence ON (server switch)',
       CASE WHEN LOWER(TRIM(BOTH '"' FROM value::text)) NOT IN ('false','f','0','off','no','disabled')
            THEN 'PASS (enforced)' ELSE 'FAIL (disabled)' END
FROM public.settings WHERE key = 'geofence_enforcement_enabled'
UNION ALL
SELECT '6 standing on HYT pin passes',
       CASE WHEN public.hyt_location_is_valid(14.642625282062204, 121.02453106633574,
                                              14.642625282062204, 121.02453106633574)
            THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT '7 90 m away still passes (was refused at 20 m)',
       CASE WHEN public.hyt_location_is_valid(14.6434333, 121.02453106633574,
                                              14.642625282062204, 121.02453106633574)
            THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT '8 400 m away is refused',
       CASE WHEN NOT public.hyt_location_is_valid(14.6462185, 121.02453106633574,
                                                  14.642625282062204, 121.02453106633574)
            THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT '9 Atlanta pin passes against Atlanta',
       CASE WHEN public.hyt_location_is_valid(14.604736146553744, 121.05314663304407,
                                              14.604736146553744, 121.05314663304407)
            THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT '11 labels outside the two allowed',
       CASE WHEN (SELECT n FROM stray) = 0
            THEN 'PASS (none)'
            ELSE 'FAIL -> ' || (SELECT names FROM stray) END
UNION ALL
SELECT '10 place label: ' || name, rows || ' row(s)' FROM places
ORDER BY item;
