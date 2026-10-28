-- ===========================================================================
-- Guarantee: a brand-new account is ACTIVE, whatever the sign-up trigger says.
--
-- Run this in the Supabase SQL Editor. It returns ONE result grid at the end.
--
-- ---------------------------------------------------------------------------
-- Why this exists on top of FIX_NEW_ACCOUNTS_ACTIVE_BY_DEFAULT.sql
-- ---------------------------------------------------------------------------
-- That script fixed the column default (`is_active DEFAULT TRUE`), which is
-- enough only if handle_new_user() does NOT name is_active. On the live
-- database it does - check 3 of the verification grid came back as "CHECK"
-- rather than "PASS" - so the default never gets a say, and the trigger's own
-- value wins.
--
-- The copy of handle_new_user() in this repo does not name is_active at all,
-- which means the live version has been edited since. Rather than rewrite a
-- function whose current body I cannot see, this adds a BEFORE INSERT guard:
-- the row is corrected on the way in, no matter what produced it.
--
-- A brand-new row is never a deactivation. Deactivating is something an
-- administrator does to an account that already exists, and that is an UPDATE -
-- which this trigger does not touch. So Activate/Deactivate in
-- Admin -> Students keeps working exactly as before.
-- ===========================================================================


-- ===========================================================================
-- PART 1 - the guard
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.hyt_force_new_user_active()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Deliberately unconditional. "Inactive" describes an administrator's
  -- decision about an existing account; it cannot be true of one that is being
  -- created, and every path that used to write it here was a placeholder.
  NEW.is_active := TRUE;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hyt_force_new_user_active ON public.users;

CREATE TRIGGER hyt_force_new_user_active
  BEFORE INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.hyt_force_new_user_active();

-- The column default stays TRUE as well, so a row inserted by something that
-- bypasses triggers (a data import, a manual INSERT) still lands active.
ALTER TABLE public.users ALTER COLUMN is_active SET DEFAULT TRUE;


-- ===========================================================================
-- PART 2 - verification. ONE grid.
-- ===========================================================================
WITH
col AS (
  SELECT MAX(column_default) AS active_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_active'
),
guard AS (
  SELECT COUNT(*) AS installed
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'users'
    AND t.tgname = 'hyt_force_new_user_active'
    AND NOT t.tgisinternal
),
fn AS (
  SELECT pg_get_functiondef(p.oid) AS body
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'handle_new_user'
  LIMIT 1
),
fn_insert AS (
  -- The INSERT the trigger actually runs, whitespace collapsed onto one line.
  -- Showing the whole function would bury the answer; showing only the lines
  -- that mention is_active hides the VALUE, which is the part that matters.
  SELECT regexp_replace(
           substring(COALESCE((SELECT body FROM fn), '') FROM '(?is)INSERT\s+INTO[^;]*;'),
           '\s+', ' ', 'g'
         ) AS stmt
),
counts AS (
  SELECT
    COUNT(*)                                                   AS total,
    COUNT(*) FILTER (WHERE is_active IS TRUE)                  AS active,
    COUNT(*) FILTER (WHERE is_active IS FALSE)                 AS inactive
  FROM public.users
)
SELECT '1 is_active default' AS item,
       CASE WHEN (SELECT active_default FROM col) ILIKE 'true'
            THEN 'PASS (TRUE)' ELSE 'FAIL -> ' || COALESCE((SELECT active_default FROM col), 'none') END AS value
UNION ALL
SELECT '2 guard trigger installed',
       CASE WHEN (SELECT installed FROM guard) = 1 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT '3 the INSERT handle_new_user runs',
       COALESCE(NULLIF((SELECT stmt FROM fn_insert), ''), 'no INSERT found - check by hand') AS value
UNION ALL
SELECT '4 accounts',
       (SELECT active FROM counts) || ' active of ' || (SELECT total FROM counts) || ' total'
       || ' (' || (SELECT inactive FROM counts) || ' deactivated)'
ORDER BY item;
