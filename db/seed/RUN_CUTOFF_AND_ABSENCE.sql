-- ==========================================================================
-- RUN THIS ONE FILE  ·  clock-out cutoff + absence review
--
-- This is PATCH_CLOCKOUT_CUTOFF.sql followed by PATCH_ABSENCE_REVIEW.sql,
-- unchanged, in one paste.  Nothing else is needed - the two verify scripts are
-- separate on purpose (see the note at the bottom of each patch).
--
-- Run it once in the Supabase SQL Editor, then run:
--     VERIFY_CLOCKOUT_CUTOFF.sql
--     VERIFY_ABSENCE_REVIEW.sql
--
-- Both halves are idempotent, so running this file twice is harmless.  The
-- editor executes the whole batch as ONE transaction: if any statement fails,
-- nothing is applied and nothing is left half-done.
-- ==========================================================================

-- ##########################################################################
-- PART 1 of 2  ·  HARD CLOCK-OUT CUTOFF (6:30 PM, enforced by the database)
-- ##########################################################################

-- ==========================================================================
-- HARD CLOCK-OUT CUTOFF  ·  6:30 PM Asia/Manila, enforced by the database
--
-- WHY THIS FILE EXISTS
--
-- The clock-out deadline used to live only in the browser
-- (`CLOCK_OUT_CLOSES_MINUTES` in src/pages/student/Attendance.jsx).  That made
-- it a suggestion, not a rule: anyone could open the console and call
--
--     await supabase.rpc('request_clock_out', { p_user_id: '<their id>' })
--
-- or simply move the operating-system clock past 6:30 PM, and the request went
-- through.  The page would then be out of step with a row the database had
-- already accepted.
--
-- A deadline that only one of the two sides believes in is not a deadline.
-- So the same rule now lives in `request_clock_out`, and the browser copy is
-- kept only to tell the trainee *before* they tap the button.
--
-- THE RULE
--
--   Clock-out is allowed at any hour of the working day, but never after the
--   cutoff.  The cutoff is 18:30 by default and can be changed by an
--   administrator with a single settings row - no redeploy:
--
--       UPDATE public.settings
--          SET value = to_jsonb('17:00'::text)
--        WHERE key = 'clock_out_cutoff';
--
--   A missing, malformed or unreadable setting falls back to 18:30.  It never
--   fails open.
--
-- ORDER OF CHECKS (cheapest and most honest first)
--
--   1. authentication / ownership
--   2. the cutoff          <- new
--   3. the geofence
--   4. the CLOCKED_IN row
--
--   The cutoff is checked before the fence so a trainee standing outside the
--   office at 7 PM is told "too late", which is the true reason, instead of
--   "you are 3 km away", which is true but beside the point.
--
-- This file is idempotent.  Run it after PATCH_CLOCKOUT_GEOFENCE.sql.
-- Verification lives in VERIFY_CLOCKOUT_CUTOFF.sql, deliberately NOT here: the
-- SQL editor runs a batch as one transaction, so a typo in a SELECT at the
-- bottom would roll back the CREATE FUNCTION above it.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. Seed the setting (optional - the function defaults to 18:30 without it)
-- --------------------------------------------------------------------------
-- Wrapped in its own block with an exception handler: an unexpected NOT NULL
-- column on `settings` must not take the function replacement down with it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.settings WHERE key = 'clock_out_cutoff') THEN
    INSERT INTO public.settings (key, value)
    VALUES ('clock_out_cutoff', to_jsonb('18:30'::text));
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not seed clock_out_cutoff (%); the function still defaults to 18:30.', SQLERRM;
END $$;

-- --------------------------------------------------------------------------
-- 2. request_clock_out, rebuilt with the cutoff
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_clock_out(
  p_user_id UUID DEFAULT NULL,
  p_latitude NUMERIC DEFAULT NULL,
  p_longitude NUMERIC DEFAULT NULL,
  p_accuracy NUMERIC DEFAULT NULL,
  p_source TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller UUID := auth.uid();
  record_row public.attendance_logs%ROWTYPE;
  frozen_at TIMESTAMPTZ := NOW();
  seconds INTEGER;
  hours NUMERIC(8, 4);

  enforce_geofence BOOLEAN := TRUE;
  setting_value JSONB;
  fence_radius NUMERIC := 20;
  hyt_lat NUMERIC := 14.642625282062204;
  hyt_lon NUMERIC := 121.02453106633574;
  atl_lat NUMERIC := 14.604736146553744;
  atl_lon NUMERIC := 121.05314663304407;
  hyt_distance NUMERIC;
  atl_distance NUMERIC;
  nearest_distance NUMERIC;
  site_name TEXT;

  -- Cutoff state.  `cutoff_time` is the fallback and the answer whenever the
  -- settings row is absent or unparseable.
  cutoff_setting JSONB;
  cutoff_time TIME := TIME '18:30';
  manila_now TIMESTAMP := (NOW() AT TIME ZONE 'Asia/Manila');
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_user_id IS NOT NULL AND caller <> p_user_id AND NOT public.is_hyt_admin() THEN
    RAISE EXCEPTION 'Unauthorized clock-out request';
  END IF;

  -- ------------------------------------------------------------------------
  -- 2a. The hard cutoff.  Fail closed: any problem reading the setting leaves
  --     `cutoff_time` at 18:30, so the worst case is the documented deadline.
  -- ------------------------------------------------------------------------
  SELECT value INTO cutoff_setting
  FROM public.settings
  WHERE key = 'clock_out_cutoff';

  IF cutoff_setting IS NOT NULL THEN
    BEGIN
      cutoff_time := (TRIM(BOTH '"' FROM cutoff_setting::text))::time;
    EXCEPTION WHEN OTHERS THEN
      cutoff_time := TIME '18:30';
    END;
  END IF;

  IF manila_now::time > cutoff_time THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'too_late',
      'cutoff', to_char(cutoff_time, 'HH24:MI'),
      'server_time', to_char(manila_now, 'HH24:MI'),
      'message', format(
        'Clock-out closed at %s. This shift can no longer be closed from the portal - ask an administrator to record it for you.',
        to_char(cutoff_time, 'FMHH12:MI AM')
      )
    );
  END IF;

  -- ------------------------------------------------------------------------
  -- 2b. The geofence.  Runs BEFORE the row is touched, so a rejected
  --     clock-out leaves the shift open and the trainee can retry.
  -- ------------------------------------------------------------------------
  SELECT value INTO setting_value
  FROM public.settings
  WHERE key = 'geofence_enforcement_enabled';

  IF setting_value IS NOT NULL THEN
    enforce_geofence := LOWER(TRIM(BOTH '"' FROM setting_value::text))
      NOT IN ('false', 'f', '0', 'off', 'no', 'disabled');
  END IF;

  IF enforce_geofence THEN
    IF p_latitude IS NULL OR p_longitude IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'reason', 'invalid',
        'message', 'A valid location is required to clock out. Turn on location services and try again.'
      );
    END IF;

    IF p_accuracy IS NOT NULL AND p_accuracy > fence_radius THEN
      RETURN jsonb_build_object(
        'success', false,
        'reason', 'imprecise',
        'message', format('Your location is only accurate to about %s meters, which is too rough to confirm you are on site. Move somewhere with a clearer view of the sky and try again.', ROUND(p_accuracy))
      );
    END IF;

    hyt_distance := public.hyt_location_distance_meters(p_latitude, p_longitude, hyt_lat, hyt_lon);
    atl_distance := public.hyt_location_distance_meters(p_latitude, p_longitude, atl_lat, atl_lon);
    nearest_distance := LEAST(hyt_distance, atl_distance);

    IF nearest_distance > fence_radius THEN
      RETURN jsonb_build_object(
        'success', false,
        'reason', 'outside',
        'distance_meters', ROUND(nearest_distance),
        'message', format('You are currently %s meters away from the nearest approved office. You must be within %s meters to clock out.', ROUND(nearest_distance), fence_radius)
      );
    END IF;

    site_name := CASE WHEN hyt_distance <= atl_distance THEN 'HYT Building' ELSE 'Atlanta Office' END;
  ELSE
    site_name := 'Testing bypass - geofence disabled';
  END IF;

  -- ------------------------------------------------------------------------
  -- 2c. The open shift
  -- ------------------------------------------------------------------------
  SELECT * INTO record_row
  FROM public.attendance_logs
  WHERE user_id = caller AND date = manila_now::date
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;

  IF NOT FOUND OR UPPER(record_row.status) <> 'CLOCKED_IN' OR record_row.time_in IS NULL THEN
    RAISE EXCEPTION 'No active clock-in is available';
  END IF;

  seconds := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (frozen_at - record_row.time_in)))::INTEGER);
  hours := ROUND((seconds::NUMERIC / 3600), 4);

  UPDATE public.attendance_logs
  SET status = 'PENDING_CLOCK_OUT',
      pending_end_time = frozen_at,
      duration_seconds = seconds,
      rendered_hours = hours,
      clock_out_latitude = p_latitude,
      clock_out_longitude = p_longitude,
      clock_out_accuracy_meters = p_accuracy,
      clock_out_location_source = NULLIF(p_source, ''),
      clock_out_location_name = site_name,
      updated_at = NOW()
  WHERE id = record_row.id;

  RETURN jsonb_build_object(
    'success', true,
    'attendance_id', record_row.id,
    'status', 'PENDING_CLOCK_OUT',
    'pending_end_time', frozen_at,
    'duration_seconds', seconds,
    'rendered_hours', hours,
    'location', site_name,
    'message', 'Clock-out request submitted. Waiting for administrator approval.'
  );
END;
$$;

-- --------------------------------------------------------------------------
-- 3. Keep the RPC as the only write path
-- --------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.request_clock_out(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_clock_out(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT) TO authenticated;

-- PostgREST caches function signatures; without this the rebuilt body is not
-- picked up until the next schema reload.
NOTIFY pgrst, 'reload schema';


-- ##########################################################################
-- PART 2 of 2  ·  ABSENCE REVIEW (accept / reject, with a mandatory reason)
-- ##########################################################################

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


-- ==========================================================================
-- Done.  Next: VERIFY_CLOCKOUT_CUTOFF.sql, then VERIFY_ABSENCE_REVIEW.sql.
-- ==========================================================================
