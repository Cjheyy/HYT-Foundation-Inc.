-- ===========================================================================
-- PATCH: the clock-in gate was checking the wrong approval
--
-- Run in the Supabase SQL editor. Idempotent.
--
-- The bug
-- ---------------------------------------------------------------------------
-- request_clock_in refused anyone whose `users.application_status` was not
-- APPROVED/ACCEPTED/ACTIVE:
--
--     OR (is_active = TRUE AND UPPER(application_status) IN ('APPROVED', ...))
--
-- That is the ACCOUNT approval, not the POSTING approval. The product rule is
-- the other way round:
--
--   * an account is not approved to exist - it exists the moment it registers
--   * what gets approved is the OJT Posting / Trainee Program application
--   * the ATTENDANCE REQUEST is then approved separately, after clocking in
--
-- So a trainee with an approved OJT Posting but `application_status =
-- 'PENDING_APPROVAL'` was refused with "Account is not approved", which is both
-- wrong and unreadable. This patch makes the gate ask the right question.
--
-- The trap this patch also closes
-- ---------------------------------------------------------------------------
-- Gating on `applications.status` is only safe if users cannot write it
-- themselves. They could: the policy was
--
--     CREATE POLICY "users_update_own_applications" ... USING (auth.uid() = user_id)
--
-- with no restriction on which columns change, so any trainee could PATCH their
-- own application to status = 'Approved' and walk through the new gate. The
-- trigger and the tightened INSERT policy below make the new gate trustworthy
-- before it is switched on.
-- ===========================================================================

-- 1. Users may not approve themselves ----------------------------------------
-- A user may still withdraw or cancel their own application (any non-approved
-- status), so nothing in the existing UI breaks.
CREATE OR REPLACE FUNCTION public.hyt_guard_application_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_hyt_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF UPPER(COALESCE(NEW.status, '')) IN ('APPROVED', 'ACCEPTED', 'ACTIVE') THEN
      RAISE EXCEPTION 'Application status can only be set by an administrator';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hyt_guard_application_status ON public.applications;
CREATE TRIGGER hyt_guard_application_status
BEFORE INSERT OR UPDATE ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.hyt_guard_application_status();

-- Belt and braces on the INSERT policy: a brand-new application may not be born
-- already approved.
DROP POLICY IF EXISTS "users_insert_own_applications" ON public.applications;
CREATE POLICY "users_insert_own_applications"
ON public.applications FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND UPPER(COALESCE(status, 'PENDING')) NOT IN ('APPROVED', 'ACCEPTED', 'ACTIVE')
);

-- 2. request_clock_in: ask about the posting, not the account -----------------
-- Same signature and same geofence behaviour as PATCH_CLOCKOUT_GEOFENCE.sql.
-- Only the approval gate changed, plus it no longer blocks on a NULL is_active.
CREATE OR REPLACE FUNCTION public.request_clock_in(
  p_user_id UUID,
  p_latitude NUMERIC,
  p_longitude NUMERIC,
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
  today_value DATE := (NOW() AT TIME ZONE 'Asia/Manila')::date;
  record_id UUID;
  site_name TEXT;
  enforce_geofence BOOLEAN := TRUE;   -- fail closed
  setting_value JSONB;
  fence_radius NUMERIC := 20;
  hyt_lat NUMERIC := 14.642625282062204;
  hyt_lon NUMERIC := 121.02453106633574;
  atl_lat NUMERIC := 14.604736146553744;
  atl_lon NUMERIC := 121.05314663304407;
  hyt_distance NUMERIC;
  atl_distance NUMERIC;
  nearest_distance NUMERIC;
  v_is_active BOOLEAN;
  v_app_status TEXT;
BEGIN
  IF caller IS NULL OR (caller <> p_user_id AND NOT public.is_hyt_admin()) THEN
    RAISE EXCEPTION 'Unauthorized clock-in request';
  END IF;

  -- Admin: no approval question to ask.
  -- Everyone else: the account only has to be alive, and the OJT/Trainee
  -- Program application has to be approved. The account's own application_status
  -- is not the gate - it is the registration state.
  IF NOT public.is_hyt_admin() THEN
    SELECT COALESCE(u.is_active, TRUE), UPPER(COALESCE(u.application_status, ''))
    INTO v_is_active, v_app_status
    FROM public.users u
    WHERE u.id = caller;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Account not found';
    END IF;

    IF v_is_active = FALSE THEN
      RAISE EXCEPTION 'This account is deactivated. Contact an administrator.';
    END IF;

    IF v_app_status IN ('REJECTED', 'DECLINED', 'SUSPENDED', 'DEACTIVATED') THEN
      RAISE EXCEPTION 'This account was rejected. Contact an administrator.';
    END IF;

    IF v_app_status NOT IN ('APPROVED', 'ACCEPTED', 'ACTIVE')
       AND NOT EXISTS (
         SELECT 1
         FROM public.applications a
         WHERE a.user_id = caller
           -- An approved PLACEMENT: an OJT posting or a Trainee programme.
           -- Written as "one of these two keys is set" rather than
           -- `event_id IS NULL`, because an event application has neither key
           -- and this form works even on a deployment whose `applications`
           -- table predates the `event_id` column.
           AND (a.program_id IS NOT NULL OR a.opportunity_id IS NOT NULL)
           AND UPPER(COALESCE(a.status, '')) IN ('APPROVED', 'ACCEPTED', 'ACTIVE')
       )
    THEN
      RAISE EXCEPTION 'No approved OJT Posting or Trainee Program yet. Apply first, then wait for admin approval.';
    END IF;
  END IF;

  SELECT value INTO setting_value
  FROM public.settings
  WHERE key = 'geofence_enforcement_enabled';

  IF setting_value IS NOT NULL THEN
    enforce_geofence := LOWER(TRIM(BOTH '"' FROM setting_value::text))
      NOT IN ('false', 'f', '0', 'off', 'no', 'disabled');
  END IF;

  IF NOT enforce_geofence THEN
    site_name := 'Testing bypass - geofence disabled';
  ELSE
    IF p_latitude IS NULL OR p_longitude IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'A valid location is required to clock in.');
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
        'message', format('You are currently %s meters away from the nearest approved office. You must be within %s meters to clock in.', ROUND(nearest_distance), fence_radius)
      );
    END IF;

    site_name := CASE WHEN hyt_distance <= atl_distance THEN 'HYT Building' ELSE 'Atlanta Office' END;
  END IF;

  PERFORM public.hyt_close_previous_attendance(caller);

  IF EXISTS (
    SELECT 1 FROM public.attendance_logs
    WHERE user_id = caller AND date = today_value
      AND UPPER(status) IN (
        'PENDING_CLOCK_IN', 'CLOCKED_IN', 'PENDING_CLOCK_OUT', 'PENDING_OUT',
        'APPROVED', 'REJECTED', 'VOID', 'PENDING_APPROVAL', 'PENDING_REVIEW'
      )
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Attendance for today is already in progress or completed.');
  END IF;

  INSERT INTO public.attendance_logs (
    user_id, date, time_in, latitude, longitude, accuracy_meters, location_source,
    location_name, status, requested_at
  ) VALUES (
    caller, today_value, NULL, p_latitude, p_longitude, p_accuracy, NULLIF(p_source, ''),
    site_name, 'PENDING_CLOCK_IN', NOW()
  ) RETURNING id INTO record_id;

  RETURN jsonb_build_object(
    'success', true,
    'attendance_id', record_id,
    'status', 'PENDING_CLOCK_IN',
    'location', site_name,
    'message', 'Clock-in request submitted. Waiting for administrator approval.'
  );
END;
$$;

-- 3. Grants -------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.request_clock_in(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_clock_in(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.hyt_guard_application_status() FROM PUBLIC;

NOTIFY pgrst, 'reload schema';

-- Checks live in VERIFY_CLOCK_IN_GATE.sql.
