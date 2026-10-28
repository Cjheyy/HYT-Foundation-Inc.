-- ===========================================================================
-- PATCH: the two columns "My Applications" needs to finish a card by itself
--
-- Run in the Supabase SQL editor. Idempotent - safe to run twice.
--
-- Why
-- ---------------------------------------------------------------------------
-- 1. `position`
--    The application card has to say WHAT the applicant signed up for
--    ("Software Engineer", "Barista"), and that text comes from the admin's own
--    posting. There was no column to put it in, so the card could only repeat
--    the listing title.
--
-- 2. `schedule_start` / `schedule_end`
--    A posting and a programme only stored a human-readable `schedule` string
--    ("Oct 1, 2026 - Dec 1, 2026"). A string cannot be compared against
--    `new Date()`, so an application on a finished programme or placement had
--    no way to know it was over and sat in Ongoing forever. Events were fine
--    because they already carry `starts_at` / `ends_at`.
--
--    With these two DATE columns the app derives the Done state itself:
--    the card moves to Done on its own once `schedule_end` has passed.
--
-- What this does NOT do
-- ---------------------------------------------------------------------------
-- It does not guess dates for rows that already exist. Their `schedule` string
-- is free text and parsing it would invent facts; those rows keep working as
-- they do today (an OJT posting still finishes on its hours). Every posting or
-- programme created AFTER this patch gets real dates, because the admin forms
-- now write them.
-- ===========================================================================

-- 1. OJT postings -------------------------------------------------------------
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS position TEXT;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS schedule_start DATE;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS schedule_end DATE;

COMMENT ON COLUMN public.opportunities.position IS
  'Role the applicant applies for, e.g. Software Engineer. Typed by the admin on the posting and shown on the application card.';
COMMENT ON COLUMN public.opportunities.schedule_start IS
  'First day of the placement. Used with schedule_end to close the application automatically.';
COMMENT ON COLUMN public.opportunities.schedule_end IS
  'Last day of the placement. Once this date has passed, an approved application is Done.';

-- 2. Programmes ---------------------------------------------------------------
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS position TEXT;
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS schedule_start DATE;
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS schedule_end DATE;

COMMENT ON COLUMN public.programs.position IS
  'Role the trainee takes on, e.g. Barista. Typed by the admin on the programme and shown on the application card.';
COMMENT ON COLUMN public.programs.schedule_start IS
  'First day of the programme.';
COMMENT ON COLUMN public.programs.schedule_end IS
  'Last day of the programme. Once this date has passed, an approved application is Done.';

-- 3. Make sure the API sees them ---------------------------------------------
-- PostgREST caches the table shape; without this the new columns stay invisible
-- until the next schema reload and every insert naming them fails.
NOTIFY pgrst, 'reload schema';

-- Checks live in VERIFY_LISTING_DETAILS.sql - they are kept out of this file on
-- purpose: a typo in a check would roll back the whole migration.
