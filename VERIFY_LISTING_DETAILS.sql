-- ===========================================================================
-- VERIFY: the listing-detail columns exist
--
-- Read-only. Every statement is a SELECT, so nothing here can roll anything
-- back. Run it after PATCH_LISTING_DETAILS.sql.
-- ===========================================================================

-- 1. Expect 6 rows: position / schedule_start / schedule_end on both tables.
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('opportunities', 'programs')
  AND column_name IN ('position', 'schedule_start', 'schedule_end')
ORDER BY table_name, column_name;

-- 2. Which postings still have no dates (these will only finish on hours).
--    Expect the rows created before the patch, and nothing newer.
SELECT title, schedule, schedule_start, schedule_end
FROM public.opportunities
WHERE schedule_start IS NULL OR schedule_end IS NULL
ORDER BY created_at DESC;

-- 3. Which programmes still have no dates. Same reading.
SELECT title, schedule, schedule_start, schedule_end
FROM public.programs
WHERE schedule_start IS NULL OR schedule_end IS NULL
ORDER BY created_at DESC;

-- 4. The three listing kinds side by side, so the difference is visible:
--    an event already had real timestamps, the other two now have real dates.
SELECT 'event' AS kind, title, starts_at::text AS start_on, ends_at::text AS end_on
FROM public.events
UNION ALL
SELECT 'program', title, schedule_start::text, schedule_end::text FROM public.programs
UNION ALL
SELECT 'posting', title, schedule_start::text, schedule_end::text FROM public.opportunities
ORDER BY kind, start_on DESC NULLS LAST;
