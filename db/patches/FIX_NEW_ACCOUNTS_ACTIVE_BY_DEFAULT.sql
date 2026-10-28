-- ===========================================================================
-- New accounts are ACTIVE from the moment they exist.
--
-- Run this in the Supabase SQL Editor. It returns ONE result grid at the end.
--
-- ---------------------------------------------------------------------------
-- Why new accounts needed a manual activation
-- ---------------------------------------------------------------------------
-- Two things disagree about what `is_active = false` means.
--
--   src/services/authService.js treats it as "the administrator switched this
--   account off" - a deliberate deactivation, and the only thing that should
--   stop someone signing in.
--
--   OJT_TRACKING_PRODUCTION_MIGRATION.sql ran
--       ALTER TABLE public.users ALTER COLUMN is_active SET DEFAULT FALSE;
--   and public.handle_new_user() inserts a new row WITHOUT naming is_active.
--   So every brand-new account was born inactive - not because anyone decided
--   anything, but because nobody said otherwise.
--
-- The visible symptom is the one you hit: a fresh registration shows
-- "Deactivated" in Admin -> Students and sits there waiting to be activated.
-- Worse, approving the account makes it real: once application_status leaves
-- PENDING_*, isDeactivatedAccount() stops treating the row as an unreviewed
-- placeholder and starts treating it as a genuine deactivation - so the person
-- is locked out at exactly the moment they were approved.
--
-- The fix is the default. `handle_new_user()` is deliberately NOT rewritten:
-- it may have grown columns since the copy in this repo, and retyping it is how
-- a migration silently reverts a later change. It does not name is_active, so
-- the column default is what decides - set that to TRUE and new accounts are
-- active without touching the trigger.
--
-- What an administrator still controls: Deactivate / Activate in
-- Admin -> Students, which is now the ONLY thing that changes is_active.
-- ===========================================================================


-- ===========================================================================
-- PART 1 - the default that decides a new row
-- ===========================================================================
ALTER TABLE public.users ALTER COLUMN is_active SET DEFAULT TRUE;

-- New accounts are "not reviewed yet", which is a statement about their OJT
-- application, not about the account being switched off. Re-stated so the two
-- columns cannot be confused with each other.
ALTER TABLE public.users ALTER COLUMN application_status SET DEFAULT 'PENDING_APPROVAL';

-- Rows already in the table keep whatever they have; PART 3 handles those.


-- ===========================================================================
-- PART 2 - the legacy placeholder rows.
--
-- Every account created while the default was FALSE is inactive for no reason.
-- Only the ones still waiting for their first review are touched: if somebody
-- was approved or rejected and is switched off, that was a decision, and this
-- script must not undo it.
-- ===========================================================================
UPDATE public.users
SET is_active = TRUE
WHERE is_active IS FALSE
  AND UPPER(COALESCE(application_status, '')) IN (
    'PENDING', 'PENDING_APPROVAL', 'PENDING_APPLICATION', 'SUBMITTED', 'APPLIED'
  );


-- ===========================================================================
-- PART 3 - verification. ONE grid, because the SQL Editor only shows the last
--          result set.
-- ===========================================================================
WITH
col AS (
  SELECT
    MAX(column_default) FILTER (WHERE column_name = 'is_active')          AS active_default,
    MAX(column_default) FILTER (WHERE column_name = 'application_status') AS status_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'users'
),
trg AS (
  SELECT COUNT(*) AS names_is_active
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'handle_new_user'
    AND pg_get_functiondef(p.oid) ~* 'is_active'
),
counts AS (
  SELECT
    COUNT(*)                                                              AS total,
    COUNT(*) FILTER (WHERE is_active IS TRUE)                             AS active,
    COUNT(*) FILTER (WHERE is_active IS FALSE)                            AS inactive,
    COUNT(*) FILTER (WHERE is_active IS FALSE
                       AND UPPER(COALESCE(application_status, '')) IN (
                         'PENDING', 'PENDING_APPROVAL', 'PENDING_APPLICATION',
                         'SUBMITTED', 'APPLIED'))                         AS inactive_pending
  FROM public.users
)
SELECT '1 is_active default' AS item,
       CASE WHEN (SELECT active_default FROM col) ILIKE 'true'
            THEN 'PASS (TRUE)' ELSE 'FAIL -> ' || COALESCE((SELECT active_default FROM col), 'none') END AS value
UNION ALL
SELECT '2 application_status default',
       CASE WHEN (SELECT status_default FROM col) ILIKE '%PENDING_APPROVAL%'
            THEN 'PASS (PENDING_APPROVAL)' ELSE 'FAIL -> ' || COALESCE((SELECT status_default FROM col), 'none') END
UNION ALL
SELECT '3 trigger leaves is_active to the default',
       CASE WHEN (SELECT names_is_active FROM trg) = 0
            THEN 'PASS (omits it)' ELSE 'CHECK -> trigger names is_active' END
UNION ALL
SELECT '4 unreviewed accounts still inactive',
       CASE WHEN (SELECT inactive_pending FROM counts) = 0
            THEN 'PASS (0)' ELSE 'FAIL -> ' || (SELECT inactive_pending FROM counts) END
UNION ALL
SELECT '5 accounts an admin switched off',
       (SELECT inactive FROM counts) || ' of ' || (SELECT total FROM counts)
       || ' (these are real deactivations - Activate them by hand)'
UNION ALL
SELECT '6 active accounts',
       (SELECT active FROM counts) || ' of ' || (SELECT total FROM counts)
ORDER BY item;
