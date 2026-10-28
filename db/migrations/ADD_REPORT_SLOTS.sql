-- ==========================================================================
-- ADD_REPORT_SLOTS.sql
--
-- Makes the three-slot daily report work on this deployment.
--
-- Run this once in the Supabase SQL Editor. It is idempotent — running it a
-- second time changes nothing and is safe.
--
-- WHY THIS IS NEEDED
--   The trainee files three updates a day (11:00 / 15:00 / 17:00), and the day
--   is stored as ONE row whose slots live in the `slot_entries` jsonb column.
--   Filing the 15:00 slot merges into the row the 11:00 filing created, which
--   is what lets the administrator read a whole day as one consolidated report.
--
--   Two things have to be true for that to work:
--
--     1. The `slot_entries` column must exist.
--     2. The signed-in trainee must be allowed to UPDATE it. The production
--        migration narrows report updates down to `accomplishments` alone
--        (`GRANT UPDATE (accomplishments) ...`), so a slot filing would be
--        rejected with a permission error even though the column is present.
--
--   This script restores both without widening anything else: reports stay
--   owner-scoped, and the admin-only paths stay admin-only.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. The column the three slots are stored in.
-- --------------------------------------------------------------------------
ALTER TABLE public.daily_reports
  ADD COLUMN IF NOT EXISTS slot_entries JSONB DEFAULT '{}'::jsonb;

-- Normalise any row that predates the column so readers never see NULL.
UPDATE public.daily_reports
   SET slot_entries = '{}'::jsonb
 WHERE slot_entries IS NULL;

COMMENT ON COLUMN public.daily_reports.slot_entries IS
  'The day''s three slot filings, keyed by "11:00" / "15:00" / "17:00". '
  'Each value is { accomplished, inProgress, pending, submittedAt }. '
  'The 17:00 entry is what releases the whole day to the administrator.';

-- --------------------------------------------------------------------------
-- 2. Let the trainee write that column on their own row.
--
--    Only the two columns a filing touches are granted. `status` stays out of
--    reach of the client so a trainee cannot approve their own report, and the
--    row-level policies below still restrict every write to user_id = auth.uid().
-- --------------------------------------------------------------------------
GRANT UPDATE (slot_entries, accomplishments) ON public.daily_reports TO authenticated;

-- --------------------------------------------------------------------------
-- 3. Row-level security, restated so it matches the live table.
--
--    The table's owner column on this deployment is `user_id` (there is no
--    `student_id`). These policies are the same shape the production migration
--    installs; they are repeated here so this script is self-contained.
-- --------------------------------------------------------------------------
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hyt_reports_select_own_or_admin" ON public.daily_reports;
DROP POLICY IF EXISTS "hyt_reports_insert_own" ON public.daily_reports;
DROP POLICY IF EXISTS "hyt_reports_update_own_pending" ON public.daily_reports;
DROP POLICY IF EXISTS "hyt_reports_admin_manage" ON public.daily_reports;

CREATE POLICY "hyt_reports_select_own_or_admin" ON public.daily_reports
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_hyt_admin());

CREATE POLICY "hyt_reports_insert_own" ON public.daily_reports
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "hyt_reports_update_own_pending" ON public.daily_reports
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "hyt_reports_admin_manage" ON public.daily_reports
  FOR ALL TO authenticated
  USING (public.is_hyt_admin())
  WITH CHECK (public.is_hyt_admin());

-- --------------------------------------------------------------------------
-- 4. Verify. Expect: slot_entries = jsonb, and a grant on slot_entries.
-- --------------------------------------------------------------------------
SELECT column_name, data_type, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'daily_reports'
   AND column_name IN ('slot_entries', 'accomplishments', 'user_id', 'report_date')
 ORDER BY column_name;

SELECT grantee, privilege_type, column_name
  FROM information_schema.column_privileges
 WHERE table_schema = 'public'
   AND table_name = 'daily_reports'
   AND grantee = 'authenticated'
   AND privilege_type = 'UPDATE'
 ORDER BY column_name;
