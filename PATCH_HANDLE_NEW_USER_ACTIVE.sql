-- ===========================================================================
-- handle_new_user() writes is_active = FALSE. Stop it.
--
-- Run this in the Supabase SQL Editor. It returns ONE result grid at the end.
--
-- ---------------------------------------------------------------------------
-- What check 3 showed
-- ---------------------------------------------------------------------------
--   INSERT INTO public.users ( ..., is_active, application_status )
--   VALUES ( ..., 0, FALSE, 'PENDING_APPROVAL' )
--   ON CONFLICT (id) DO UPDATE SET
--     ..., is_active = FALSE, ...
--
-- So the live trigger sets is_active to FALSE in two places, and the column
-- default never gets a say. That is the whole reason every new account arrived
-- deactivated.
--
-- GUARANTEE_NEW_ACCOUNTS_ACTIVE.sql already installed a BEFORE INSERT guard, so
-- the first FALSE is now corrected on the way in. The second one is NOT covered
-- by that guard: `ON CONFLICT ... DO UPDATE` runs as an UPDATE, and an INSERT
-- trigger cannot see it. It only fires when a row with the same id already
-- exists, which is rare - but when it does, it silently deactivates a live
-- account.
--
-- ---------------------------------------------------------------------------
-- What this does
-- ---------------------------------------------------------------------------
-- Patches the LIVE function source, rather than retyping it. The body has
-- DECLARE variables (requested_role, safe_year_level) and 20 columns that are
-- not visible in the extraction above, so a hand-written copy would be a guess.
-- Two targeted replacements instead:
--
--   FALSE, 'PENDING_APPROVAL'   ->  TRUE, 'PENDING_APPROVAL'   (the VALUES row)
--   is_active = FALSE           ->  is_active = TRUE           (the DO UPDATE)
--
-- Idempotent: once the text is gone there is nothing left to replace.
-- ===========================================================================


-- ===========================================================================
-- PART 1 - patch the live function
-- ===========================================================================
DO $$
DECLARE
  v_oid   OID;
  v_def   TEXT;
  v_new   TEXT;
BEGIN
  SELECT p.oid INTO v_oid
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'handle_new_user'
  LIMIT 1;

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'public.handle_new_user() not found - run the registration fix first.';
  END IF;

  v_def := pg_get_functiondef(v_oid);

  -- The VALUES row. Anchored on the pair so it cannot touch anything else.
  v_new := regexp_replace(
    v_def,
    'FALSE,(\s*)''PENDING_APPROVAL''',
    'TRUE,\1''PENDING_APPROVAL''',
    'g'
  );

  -- The ON CONFLICT branch, which no INSERT trigger can reach.
  v_new := regexp_replace(v_new, 'is_active(\s*)=(\s*)FALSE', 'is_active\1=\2TRUE', 'gi');

  IF v_new <> v_def THEN
    EXECUTE v_new;
    RAISE NOTICE 'handle_new_user patched';
  ELSE
    RAISE NOTICE 'handle_new_user already clean - nothing to patch';
  END IF;
END $$;


-- ===========================================================================
-- PART 2 - verification. ONE grid.
-- ===========================================================================
WITH
fn AS (
  SELECT pg_get_functiondef(p.oid) AS body
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'handle_new_user'
  LIMIT 1
),
guard AS (
  SELECT COUNT(*) AS installed
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'users'
    AND t.tgname = 'hyt_force_new_user_active' AND NOT t.tgisinternal
),
counts AS (
  SELECT COUNT(*) AS total,
         COUNT(*) FILTER (WHERE is_active IS TRUE) AS active,
         COUNT(*) FILTER (WHERE is_active IS FALSE) AS inactive
  FROM public.users
)
SELECT '1 trigger still writes is_active = FALSE' AS item,
       CASE WHEN (SELECT body FROM fn) ~* 'is_active\s*=\s*FALSE'
            THEN 'FAIL - still there' ELSE 'PASS (gone)' END AS value
UNION ALL
SELECT '2 trigger still writes FALSE, ''PENDING_APPROVAL''',
       CASE WHEN (SELECT body FROM fn) ~ 'FALSE,\s*''PENDING_APPROVAL'''
            THEN 'FAIL - still there' ELSE 'PASS (gone)' END
UNION ALL
SELECT '3 trigger now writes TRUE',
       -- `\y` is Postgres's word boundary; `\b` means BACKSPACE in ARE and
       -- silently matches nothing.
       CASE WHEN (SELECT body FROM fn) ~ '\yTRUE\y' THEN 'PASS (TRUE present)' ELSE 'FAIL' END
UNION ALL
SELECT '4 insert guard still installed',
       CASE WHEN (SELECT installed FROM guard) = 1 THEN 'PASS' ELSE 'FAIL - rerun GUARANTEE_NEW_ACCOUNTS_ACTIVE.sql' END
UNION ALL
SELECT '5 accounts',
       (SELECT active FROM counts) || ' active of ' || (SELECT total FROM counts) || ' total ('
       || (SELECT inactive FROM counts) || ' deactivated)'
ORDER BY item;
