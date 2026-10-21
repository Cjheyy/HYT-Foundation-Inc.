-- ==========================================================================
-- ABSENCE REVIEW  ·  accept / reject, with a mandatory reason
--
-- WHAT CHANGES
--
-- ABSENCE_REQUESTS_MIGRATION.sql gave absence requests exactly two states:
--
--     Submitted   filed, waiting to be seen
--     Noted       the administrator has seen it
--
-- "Noted" cannot say *no*.  An administrator reading "I was in hospital" and an
-- administrator reading "I felt like staying home" had the same button, and the
-- trainee could not tell which answer they had been given.  Worse, nothing in
-- the system could act on the difference - so a refused absence still silently
-- counted as a working day and quietly pushed the OJT end date out.
--
-- Three decisions replace two acknowledgements:
--
--     Submitted   waiting for the administrator
--     Accepted    the absence stands; the projected end date moves out by one
--                 working day for each accepted day
--     Rejected    the absence does not stand; the day is expected as normal
--
-- LEGACY DATA
--
--   'Noted' rows are migrated to 'Accepted', because "Noted" was the only
--   positive acknowledgement the old flow had and the trainee was never told
--   otherwise.  The value stays in the CHECK list so an un-migrated row can
--   still be read instead of breaking the table.
--
-- WHO MAY WRITE
--
--   RLS already restricts UPDATE to an administrator
--   (`absence_requests_update_admin`) and to the owner *while the request is
--   still Submitted* (`absence_requests_update_own_pending`, whose WITH CHECK
--   pins `status = 'Submitted'`).  The trigger below repeats that rule at the
--   row level: defence in depth, and it produces a readable error instead of a
--   silent no-op when a policy is later loosened by accident.
--
-- Idempotent.  Verification lives in VERIFY_ABSENCE_REVIEW.sql.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. Replace the two-value CHECK with the four-value one
-- --------------------------------------------------------------------------
-- The original constraint was created inline, so Postgres named it
-- `absence_requests_status_check`.  Rather than assume that name, every CHECK
-- on this table that mentions `status` is dropped - there is only one, and
-- looking it up makes the script survive a differently-named constraint.
DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'absence_requests'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.absence_requests DROP CONSTRAINT %I', con.conname);
    RAISE NOTICE 'Dropped old status constraint: %', con.conname;
  END LOOP;
END $$;

ALTER TABLE public.absence_requests
  ADD CONSTRAINT absence_requests_status_check
  CHECK (status IN ('Submitted', 'SUBMITTED', 'Accepted', 'ACCEPTED', 'Rejected', 'REJECTED', 'Noted', 'NOTED'));

-- --------------------------------------------------------------------------
-- 2. Migrate the old acknowledgement to the new one
-- --------------------------------------------------------------------------
UPDATE public.absence_requests
SET status = 'Accepted',
    updated_at = NOW()
WHERE UPPER(status) = 'NOTED';

UPDATE public.absence_requests
SET status = 'Submitted',
    updated_at = NOW()
WHERE UPPER(status) = 'SUBMITTED';

-- --------------------------------------------------------------------------
-- 3. A readable rejection reason is part of the answer
-- --------------------------------------------------------------------------
-- An accept may be silent ("fine"), a reject may not: the trainee has to know
-- what to do differently.  Enforced here as well as in the page, because the
-- page is not the only thing that can write to this table.
ALTER TABLE public.absence_requests
  DROP CONSTRAINT IF EXISTS absence_requests_reject_needs_note;

ALTER TABLE public.absence_requests
  ADD CONSTRAINT absence_requests_reject_needs_note
  CHECK (
    UPPER(status) <> 'REJECTED'
    OR (admin_note IS NOT NULL AND LENGTH(TRIM(admin_note)) >= 10)
  );

-- --------------------------------------------------------------------------
-- 4. Only an administrator may decide
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hyt_guard_absence_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- The owner may edit the reason while it is pending; that path never changes
  -- the status, so there is nothing to guard.
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF public.is_hyt_admin() THEN
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.user_id THEN
    RAISE EXCEPTION 'Only an administrator can accept or reject an absence request.';
  END IF;

  RAISE EXCEPTION 'Only an administrator can change the status of an absence request.';
END;
$$;

DROP TRIGGER IF EXISTS hyt_guard_absence_status_trg ON public.absence_requests;
CREATE TRIGGER hyt_guard_absence_status_trg
  BEFORE UPDATE ON public.absence_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.hyt_guard_absence_status();

-- --------------------------------------------------------------------------
-- 5. The administrator queue is "everything still Submitted"
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_absence_requests_pending
  ON public.absence_requests(status, absence_date DESC)
  WHERE UPPER(status) = 'SUBMITTED';

NOTIFY pgrst, 'reload schema';
