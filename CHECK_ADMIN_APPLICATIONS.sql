-- ============================================================================
--  CHECK ADMIN APPLICATIONS  (read-only)
--
--  Run this after BLOCK_ADMIN_APPLICATIONS.sql if check 5 was not 0. It lists
--  the application rows that belong to an admin account, so you can decide
--  whether to leave them alone or remove them.
--
--  Nothing here writes anything. The DELETE is at the bottom, commented out.
--
--  WHY IT MATTERS: these rows were created before the guard existed. They are
--  harmless to the guard (it only fires on INSERT), but an admin who still has
--  a live application will see it on their own dashboard, and it can sit in a
--  reviewer's queue as if an admin had applied to their own posting.
--
--  Supabase -> SQL Editor -> paste -> Run. One result set.
-- ============================================================================

SELECT
  a.id                    AS application_id,
  u.email                 AS applicant_email,
  u.role                  AS applicant_role,
  a.status                AS status,
  a.applied_at            AS applied_at,
  CASE
    WHEN (to_jsonb(a) ->> 'program_id')     IS NOT NULL THEN 'program'
    WHEN (to_jsonb(a) ->> 'opportunity_id') IS NOT NULL THEN 'opportunity'
    WHEN (to_jsonb(a) ->> 'event_id')       IS NOT NULL THEN 'event'
    ELSE 'unknown'
  END                     AS kind,
  -- to_jsonb() instead of a direct column reference: `event_id` was added to
  -- this table later than the other two, and a hard reference would make the
  -- whole query fail on a database that predates it.
  COALESCE(p.title, o.title, e.title) AS listing_title
FROM public.applications a
JOIN public.users u
  ON u.id = a.user_id
LEFT JOIN public.programs p
  ON p.id = (to_jsonb(a) ->> 'program_id')::uuid
LEFT JOIN public.opportunities o
  ON o.id = (to_jsonb(a) ->> 'opportunity_id')::uuid
LEFT JOIN public.events e
  ON e.id = (to_jsonb(a) ->> 'event_id')::uuid
WHERE upper(btrim(coalesce(u.role, ''))) = 'ADMIN'
ORDER BY a.applied_at;


-- ---------------------------------------------------------------------------
-- OPTIONAL - only if you want those rows gone. Read it first: it deletes.
-- Same filter as the query above.
-- ---------------------------------------------------------------------------
-- DELETE FROM public.applications a
-- USING public.users u
-- WHERE u.id = a.user_id
--   AND upper(btrim(coalesce(u.role, ''))) = 'ADMIN';
