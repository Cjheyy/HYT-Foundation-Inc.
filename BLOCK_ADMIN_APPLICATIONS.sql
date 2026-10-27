-- ============================================================================
--  BLOCK ADMIN APPLICATIONS
--
--  An admin account runs the programme; it does not take part in it. The UI
--  already refuses (every apply surface checks isAdminRole()), but the UI is
--  not the database: `applications` accepts any `user_id` that exists, so a
--  stale tab, an old bundle, or any future call site could still write an
--  application row for an admin.
--
--  This puts the rule where it cannot be skipped - a BEFORE INSERT trigger on
--  `applications` that rejects the row when the applicant's role is ADMIN.
--  It covers all three listing kinds (program / opportunity / event) at once,
--  because they all land in this one table.
--
--  Existing rows are NOT touched. If an admin already has applications, check
--  4 below reports the count and the commented cleanup at the bottom removes
--  them - run that only if you actually want them gone.
--
--  HOW TO RUN
--    Supabase -> SQL Editor -> New query -> paste this whole file -> Run.
--    The editor only shows the LAST result set, so this file ends in one grid.
--  Safe to re-run: CREATE OR REPLACE + DROP TRIGGER IF EXISTS.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PART 1 - the guard function
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so the role lookup still works when the caller is an
-- ordinary authenticated user: `users` is protected by RLS, and without this
-- the SELECT could return no row and the check would silently pass.
-- `SET search_path` is mandatory on a definer function - without it a caller
-- could shadow `users` with their own object and defeat the lookup.
CREATE OR REPLACE FUNCTION public.hyt_block_admin_applications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  applicant_role TEXT;
BEGIN
  SELECT upper(btrim(coalesce(u.role, '')))
    INTO applicant_role
    FROM public.users u
   WHERE u.id = NEW.user_id;

  IF applicant_role = 'ADMIN' THEN
    RAISE EXCEPTION
      'Admin accounts cannot apply to programs, OJT postings or events.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- PART 2 - attach it (BEFORE INSERT only; UPDATEs are left alone so the
-- existing admin-review flow cannot trip over it)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_hyt_block_admin_applications ON public.applications;

CREATE TRIGGER trg_hyt_block_admin_applications
BEFORE INSERT ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.hyt_block_admin_applications();

-- ---------------------------------------------------------------------------
-- PART 3 - verification (ONE result set: item | value)
-- ---------------------------------------------------------------------------
SELECT item, value
FROM (
  SELECT
    '1 guard function exists' AS item,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'hyt_block_admin_applications'
    ) THEN 'PASS' ELSE 'FAIL' END AS value

  UNION ALL
  SELECT
    '2 trigger attached and enabled',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'applications'
        AND t.tgname = 'trg_hyt_block_admin_applications'
        AND t.tgenabled <> 'D'
    ) THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  SELECT
    '3 trigger fires BEFORE INSERT',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relname = 'applications'
        AND t.tgname = 'trg_hyt_block_admin_applications'
        AND (t.tgtype & 2) = 2          -- 2 = BEFORE
        AND (t.tgtype & 4) = 4          -- 4 = INSERT
    ) THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  SELECT
    '4 admin accounts in users',
    (SELECT count(*)::text FROM public.users WHERE upper(btrim(coalesce(role, ''))) = 'ADMIN')

  UNION ALL
  SELECT
    '5 applications already owned by an admin',
    (SELECT count(*)::text
       FROM public.applications a
       JOIN public.users u ON u.id = a.user_id
      WHERE upper(btrim(coalesce(u.role, ''))) = 'ADMIN')

  UNION ALL
  SELECT
    '6 total applications',
    (SELECT count(*)::text FROM public.applications)
) AS report
ORDER BY item;


-- ---------------------------------------------------------------------------
-- OPTIONAL - only if check 5 is not 0 and you want the old rows gone.
-- Read it before running it: it deletes rows, and it is NOT part of the fix.
-- ---------------------------------------------------------------------------
-- DELETE FROM public.applications a
-- USING public.users u
-- WHERE u.id = a.user_id
--   AND upper(btrim(coalesce(u.role, ''))) = 'ADMIN';
