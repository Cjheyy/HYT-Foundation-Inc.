-- ============================================================================
-- DIAGNOSE_GEOFENCE.sql  --  READ ONLY. Nothing here writes, drops or changes.
--
-- ONE query, ONE grid. The Supabase SQL Editor only displays the LAST result
-- set of a multi-statement script, which is why the previous version appeared
-- to return nothing but section 5.
--
-- Every answer comes back as a (section, item, value) row, so nothing can be
-- hidden behind a tab you did not click.
--
-- Why: a clock-in from MOA (~10.9 km from the nearest office) was accepted and
-- reached the admin queue, although both installed versions of
-- request_clock_in are written fail-closed. So the fence logic is not the bug.
-- It is one of:
--
--   A. settings.geofence_enforcement_enabled is OFF  -> the RPC bypasses
--   B. an old UNFENCED overload is still installed   -> PostgREST calls it
--   C. hyt_location_is_valid uses the wrong radius, or returns NULL/TRUE
--
-- Read the grid top to bottom: sections 1, 2, 3 then 5.
-- ============================================================================

WITH cfg AS (
  SELECT
    (SELECT s.value::text
       FROM public.settings s
      WHERE s.key = 'geofence_enforcement_enabled')                     AS switch_value,
    (SELECT COUNT(*)
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'request_clock_in')                             AS overload_count
),
recent AS (
  SELECT al.*
  FROM public.attendance_logs al
  WHERE al.latitude IS NOT NULL
  ORDER BY al.date DESC, al.created_at DESC
  LIMIT 1
)
SELECT section, item, value
FROM (

  -- ---------------------------------------------------------------- 1
  SELECT '1 OVERLOAD' AS section,
         'request_clock_in count' AS item,
         cfg.overload_count::text ||
           CASE WHEN cfg.overload_count > 1 THEN '  <-- two shapes installed' ELSE '' END AS value
  FROM cfg

  UNION ALL
  SELECT '1 OVERLOAD',
         'shape ' || p.pronargs || ' args',
         p.oid::regprocedure::text
           || ' | fence=' ||
           CASE
             WHEN p.prosrc LIKE '%nearest_distance%' OR p.prosrc LIKE '%fence_radius%'
               THEN 'yes, 20 m'
             WHEN p.prosrc LIKE '%hyt_location_is_valid%'
               THEN 'via hyt_location_is_valid'
             ELSE 'NO FENCE  <-- unfenced'
           END
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'request_clock_in'

  -- ---------------------------------------------------------------- 2
  UNION ALL
  SELECT '2 SWITCH',
         'geofence_enforcement_enabled',
         COALESCE(cfg.switch_value, '(row missing -> fail closed, i.e. ON)')
           || CASE
                WHEN cfg.switch_value IS NULL THEN ''
                WHEN LOWER(TRIM(BOTH '"' FROM cfg.switch_value)) IN ('false','f','0','off','no','disabled')
                  THEN '   <-- GEOFENCE IS OFF. THIS IS THE BUG.'
                ELSE '   (on)'
              END
  FROM cfg

  -- ---------------------------------------------------------------- 2b
  UNION ALL
  SELECT '2b SETTINGS', s.key, s.value::text
  FROM public.settings s

  -- ---------------------------------------------------------------- 3
  UNION ALL
  SELECT '3 LAST ROW', 'date',            COALESCE(r.date::text, '(no row has a latitude)')
  FROM cfg LEFT JOIN recent r ON TRUE

  UNION ALL
  SELECT '3 LAST ROW', 'status',          COALESCE(r.status, '(none)')
  FROM cfg LEFT JOIN recent r ON TRUE

  UNION ALL
  SELECT '3 LAST ROW', 'location_name',   COALESCE(r.location_name, '(null)')
  FROM cfg LEFT JOIN recent r ON TRUE

  UNION ALL
  SELECT '3 LAST ROW', 'location_source', COALESCE(r.location_source, '(null - old 3-arg function ran)')
  FROM cfg LEFT JOIN recent r ON TRUE

  UNION ALL
  SELECT '3 LAST ROW', 'accuracy_meters', COALESCE(r.accuracy_meters::text, '(null - slips past the imprecise gate)')
  FROM cfg LEFT JOIN recent r ON TRUE

  UNION ALL
  SELECT '3 LAST ROW', 'lat, lon',
         COALESCE(r.latitude::text, '?') || ', ' || COALESCE(r.longitude::text, '?')
  FROM cfg LEFT JOIN recent r ON TRUE

  UNION ALL
  SELECT '3 LAST ROW', 'meters from HYT (14.642625, 121.024531)',
         COALESCE(ROUND(6371000 * 2 * ASIN(SQRT(
             POWER(SIN(RADIANS((14.642625282062204 - r.latitude) / 2)), 2) +
             COS(RADIANS(r.latitude)) * COS(RADIANS(14.642625282062204)) *
             POWER(SIN(RADIANS((121.02453106633574 - r.longitude) / 2)), 2)
         )))::text, '(n/a)')
  FROM cfg LEFT JOIN recent r ON TRUE

  UNION ALL
  SELECT '3 LAST ROW', 'meters from ATLANTA (14.604736, 121.053147)',
         COALESCE(ROUND(6371000 * 2 * ASIN(SQRT(
             POWER(SIN(RADIANS((14.604736146553744 - r.latitude) / 2)), 2) +
             COS(RADIANS(r.latitude)) * COS(RADIANS(14.604736146553744)) *
             POWER(SIN(RADIANS((121.05314663304407 - r.longitude) / 2)), 2)
         )))::text, '(n/a)')
  FROM cfg LEFT JOIN recent r ON TRUE

  -- ---------------------------------------------------------------- 5
  UNION ALL
  SELECT '5 IS_VALID',
         'arguments (default radius lives here)',
         COALESCE(pg_get_function_arguments(p.oid), '(none)')
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'hyt_location_is_valid'

  UNION ALL
  SELECT '5 IS_VALID',
         'full body (' || length(p.prosrc) || ' chars)',
         p.prosrc
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'hyt_location_is_valid'

) AS report
ORDER BY section, item;
