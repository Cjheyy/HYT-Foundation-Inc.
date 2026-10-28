-- ============================================================================
--  DELETE ONE ADMIN TEST APPLICATION
--
--  Removes the application that the admin account made while testing:
--
--    application_id : b8d706d4-bf1b-4172-8e41-82d4748102f6
--    applicant      : admin.test@hyt-demo.com   (role ADMIN)
--    listing        : "Try Nga Muna"            (opportunity)
--    status         : Applied
--    applied_at     : 2026-10-27 08:33:42 UTC
--
--  Targeted by id, NOT by "every application owned by an admin". If you ever
--  need the wider sweep it is at the bottom of CHECK_ADMIN_APPLICATIONS.sql -
--  but this file touches exactly one row.
--
--  NO SLOT ADJUSTMENT IS NEEDED, and that is deliberate:
--  supabaseService.applyToEvent() consumes a slot when an admin APPROVES the
--  application, not when it is submitted (see the comment above its return).
--  So an `Applied` row has never held a slot, and deleting it cannot leave the
--  listing one short. The number on screen is corrected on the next refresh
--  either way.
--
--  Safe to re-run: a second run deletes 0 rows and the grid reports the same.
--
--  Supabase -> SQL Editor -> paste -> Run. One result set.
-- ============================================================================

DELETE FROM public.applications
WHERE id = 'b8d706d4-bf1b-4172-8e41-82d4748102f6';


-- ---------------------------------------------------------------------------
-- Verification (ONE result set: item | value)
-- ---------------------------------------------------------------------------
SELECT item, value
FROM (
  SELECT
    '1 that application still exists' AS item,
    CASE WHEN EXISTS (
      SELECT 1 FROM public.applications
       WHERE id = 'b8d706d4-bf1b-4172-8e41-82d4748102f6'
    ) THEN 'FAIL - still there' ELSE 'PASS - gone' END AS value

  UNION ALL
  SELECT
    '2 applications still owned by an admin',
    (SELECT count(*)::text
       FROM public.applications a
       JOIN public.users u ON u.id = a.user_id
      WHERE upper(btrim(coalesce(u.role, ''))) = 'ADMIN')

  UNION ALL
  SELECT
    '3 total applications',
    (SELECT count(*)::text FROM public.applications)
) AS report
ORDER BY item;
