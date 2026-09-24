-- ============================================================================
-- HYT OJT Tracking - production state-machine migration
--
-- Run this file once in the Supabase SQL Editor after backing up the project.
-- It is intentionally idempotent and keeps the status values used by the
-- React services canonical:
--   account:       PENDING_APPROVAL | APPROVED | REJECTED
--   attendance:    PENDING_CLOCK_IN | CLOCKED_IN | PENDING_CLOCK_OUT |
--                  APPROVED | REJECTED | VOID
--   daily report:  PENDING | APPROVED | REJECTED
--   overtime:      PENDING | APPROVED | REJECTED
--
-- The functions use auth.uid() for authorization.  The p_admin_id arguments
-- remain only for backwards-compatible RPC signatures and are never trusted.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Ensure the current tables/columns exist
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time_in TIMESTAMPTZ,
  time_out TIMESTAMPTZ,
  rendered_hours NUMERIC(8, 4) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'PENDING_CLOCK_IN',
  admin_note TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  location_name VARCHAR(120),
  pending_end_time TIMESTAMPTZ,
  duration_seconds INTEGER,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.users(id),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS rendered_hours NUMERIC(8, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS application_status VARCHAR(30) DEFAULT 'PENDING_APPROVAL',
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.users ALTER COLUMN is_active SET DEFAULT FALSE;
ALTER TABLE public.users ALTER COLUMN application_status SET DEFAULT 'PENDING_APPROVAL';

ALTER TABLE public.attendance_logs
  ADD COLUMN IF NOT EXISTS rendered_hours NUMERIC(8, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_end_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS admin_note TEXT,
  ADD COLUMN IF NOT EXISTS location_name VARCHAR(120);
ALTER TABLE public.attendance_logs
  ALTER COLUMN rendered_hours TYPE NUMERIC(8, 4) USING rendered_hours::NUMERIC;
ALTER TABLE public.attendance_logs
  ALTER COLUMN time_in TYPE TIMESTAMPTZ USING time_in::TIMESTAMPTZ;
ALTER TABLE public.attendance_logs
  ALTER COLUMN time_out TYPE TIMESTAMPTZ USING time_out::TIMESTAMPTZ;
ALTER TABLE public.attendance_logs
  ALTER COLUMN status SET DEFAULT 'PENDING_CLOCK_IN';
ALTER TABLE public.attendance_logs
  ALTER COLUMN requested_at SET DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.ot_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  attendance_id UUID REFERENCES public.attendance_logs(id) ON DELETE SET NULL,
  requested_hours NUMERIC(5, 1) NOT NULL CHECK (requested_hours > 0),
  reason TEXT NOT NULL,
  status VARCHAR(30) DEFAULT 'PENDING',
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- New daily-report columns are additive so an old daily_reports table can be
-- backfilled instead of being silently left incompatible.
CREATE TABLE IF NOT EXISTS public.daily_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  accomplishments TEXT,
  status VARCHAR(30) DEFAULT 'PENDING',
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.daily_reports
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS report_date DATE,
  ADD COLUMN IF NOT EXISTS accomplishments TEXT,
  ADD COLUMN IF NOT EXISTS admin_note TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE public.daily_reports
  ALTER COLUMN status SET DEFAULT 'PENDING';
ALTER TABLE public.ot_requests
  ALTER COLUMN status SET DEFAULT 'PENDING';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'daily_reports' AND column_name = 'student_id'
  ) THEN
    EXECUTE 'UPDATE public.daily_reports SET user_id = student_id WHERE user_id IS NULL AND student_id IS NOT NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'daily_reports' AND column_name = 'date'
  ) THEN
    EXECUTE 'UPDATE public.daily_reports SET report_date = date WHERE report_date IS NULL AND date IS NOT NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'daily_reports' AND column_name = 'tasks_completed'
  ) THEN
    EXECUTE $sql$UPDATE public.daily_reports SET accomplishments = COALESCE(accomplishments, tasks_completed, notes, '') WHERE accomplishments IS NULL$sql$;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'daily_reports' AND column_name = 'student_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.daily_reports ALTER COLUMN student_id DROP NOT NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'daily_reports' AND column_name = 'ojt_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.daily_reports ALTER COLUMN ojt_id DROP NOT NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'daily_reports' AND column_name = 'date'
  ) THEN
    EXECUTE 'ALTER TABLE public.daily_reports ALTER COLUMN date DROP NOT NULL';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Remove old status checks before rewriting legacy values.  Older scripts
-- constrained attendance_logs.status to title-case values (or to the
-- intermediate CLOCKED_IN/PENDING_APPROVAL set), so normalizing first would
-- abort the migration with a check-constraint violation.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.attendance_logs'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.attendance_logs DROP CONSTRAINT %I', constraint_name);
  END LOOP;
  FOR constraint_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%application_status%'
  LOOP
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I', constraint_name);
  END LOOP;
  FOR constraint_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.daily_reports'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.daily_reports DROP CONSTRAINT %I', constraint_name);
  END LOOP;
  FOR constraint_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.ot_requests'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.ot_requests DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END;
$$;

-- Remove legacy state-change triggers before rewriting any status values.
-- Otherwise an old title-case hour-credit trigger can subtract or add hours
-- while this migration is only normalizing a row.
DROP TRIGGER IF EXISTS trigger_void_yesterday_logs ON public.attendance_logs;
DROP TRIGGER IF EXISTS trigger_calculate_attendance_hours ON public.attendance_logs;
DROP TRIGGER IF EXISTS trigger_freeze_timer_on_pending ON public.attendance_logs;
DROP TRIGGER IF EXISTS trigger_update_user_hours_on_approval ON public.attendance_logs;
DROP TRIGGER IF EXISTS trigger_update_user_rendered_hours ON public.attendance_logs;
DROP TRIGGER IF EXISTS attendance_approval_update_hours ON public.attendance_logs;
DROP TRIGGER IF EXISTS trigger_hyt_freeze_attendance_timer ON public.attendance_logs;
DROP TRIGGER IF EXISTS trigger_hyt_credit_attendance_hours ON public.attendance_logs;
DROP TRIGGER IF EXISTS ot_approval_update_hours ON public.ot_requests;
DROP TRIGGER IF EXISTS trigger_add_ot_hours_to_attendance ON public.ot_requests;
DROP TRIGGER IF EXISTS trigger_hyt_credit_ot_hours ON public.ot_requests;

-- Existing active accounts predate the approval queue and must remain usable;
-- new registrations are explicitly created with is_active = false below.
UPDATE public.users
SET role = CASE
  WHEN LOWER(role) = 'admin' THEN 'ADMIN'
  WHEN LOWER(role) IN ('trainee', 'training') THEN 'Trainee'
  WHEN LOWER(role) IN ('ojt/intern', 'ojt_intern', 'ojt') THEN 'OJT/Intern'
  ELSE role
END
WHERE LOWER(role) IN ('admin', 'trainee', 'training', 'ojt/intern', 'ojt_intern', 'ojt');

UPDATE public.users
SET role = CASE
  WHEN LOWER(COALESCE(account_type, '')) LIKE '%ojt%' THEN 'OJT/Intern'
  ELSE 'Trainee'
END
WHERE UPPER(role) = 'STUDENT';

UPDATE public.users
SET application_status = 'APPROVED', is_active = TRUE
WHERE UPPER(role) = 'ADMIN'
   OR (is_active = TRUE AND UPPER(COALESCE(application_status, 'PENDING_APPROVAL')) IN ('PENDING', 'PENDING_APPROVAL'));

-- ---------------------------------------------------------------------------
-- Normalize legacy rows before enforcing the new state values
-- ---------------------------------------------------------------------------
UPDATE public.attendance_logs
SET status = CASE
  WHEN time_in IS NULL AND UPPER(status) IN ('PENDING', 'PENDING_CLOCK_IN', 'PENDING_CLOCK_OUT', 'PENDING_OUT', 'PENDING_APPROVAL', 'PENDING_REVIEW', 'CLOCKED_IN') THEN 'PENDING_CLOCK_IN'
  WHEN time_in IS NOT NULL AND time_out IS NULL AND UPPER(status) IN ('PENDING', 'PENDING_APPROVAL', 'PENDING_CLOCK_OUT', 'PENDING_OUT', 'PENDING_REVIEW') THEN 'PENDING_CLOCK_OUT'
  WHEN UPPER(status) = 'APPROVED' THEN 'APPROVED'
  WHEN UPPER(status) = 'REJECTED' THEN 'REJECTED'
  WHEN UPPER(status) = 'VOID' THEN 'VOID'
  WHEN UPPER(status) = 'CLOCKED_IN' THEN 'CLOCKED_IN'
  ELSE status
END
WHERE status IS NOT NULL;

UPDATE public.users
SET application_status = CASE
  WHEN UPPER(application_status) IN ('PENDING', 'PENDING_APPLICATION', 'SUBMITTED') THEN 'PENDING_APPROVAL'
  WHEN UPPER(application_status) IN ('APPROVED', 'ACCEPTED', 'ACTIVE') THEN 'APPROVED'
  WHEN UPPER(application_status) IN ('REJECTED', 'DECLINED') THEN 'REJECTED'
  ELSE application_status
END
WHERE application_status IS NOT NULL;

UPDATE public.daily_reports
SET status = CASE
  WHEN UPPER(status) IN ('SUBMITTED', 'UNDER_REVIEW', 'PENDING') THEN 'PENDING'
  WHEN UPPER(status) IN ('APPROVED', 'REVIEWED') THEN 'APPROVED'
  WHEN UPPER(status) IN ('REJECTED', 'RETURNED') THEN 'REJECTED'
  ELSE status
END
WHERE status IS NOT NULL;

UPDATE public.ot_requests
SET status = CASE
  WHEN UPPER(status) IN ('PENDING', 'SUBMITTED', 'UNDER_REVIEW') THEN 'PENDING'
  WHEN UPPER(status) IN ('APPROVED', 'ACCEPTED') THEN 'APPROVED'
  WHEN UPPER(status) IN ('REJECTED', 'DECLINED') THEN 'REJECTED'
  ELSE status
END
WHERE status IS NOT NULL;

ALTER TABLE public.attendance_logs
  DROP CONSTRAINT IF EXISTS attendance_logs_status_check;
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_application_status_check;
ALTER TABLE public.daily_reports
  DROP CONSTRAINT IF EXISTS daily_reports_status_check;
ALTER TABLE public.ot_requests
  DROP CONSTRAINT IF EXISTS ot_requests_status_check;

ALTER TABLE public.attendance_logs
  ADD CONSTRAINT attendance_logs_status_check CHECK (
    status IN ('PENDING_CLOCK_IN', 'CLOCKED_IN', 'PENDING_CLOCK_OUT',
               'PENDING_APPROVAL', 'PENDING_REVIEW', 'PENDING_OUT',
               'APPROVED', 'REJECTED', 'VOID', 'PENDING')
  );

ALTER TABLE public.users
  ADD CONSTRAINT users_application_status_check CHECK (
    application_status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PENDING')
  );

ALTER TABLE public.daily_reports
  ADD CONSTRAINT daily_reports_status_check CHECK (
    status IN ('PENDING', 'APPROVED', 'REJECTED', 'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REVIEWED')
  );

ALTER TABLE public.ot_requests
  ADD CONSTRAINT ot_requests_status_check CHECK (
    status IN ('PENDING', 'APPROVED', 'REJECTED')
  );

CREATE INDEX IF NOT EXISTS idx_attendance_logs_user_date ON public.attendance_logs(user_id, date DESC);
-- A calendar day may have only one attendance state for a trainee.
DELETE FROM public.attendance_logs older
USING public.attendance_logs newer
WHERE older.user_id = newer.user_id
  AND older.date = newer.date
  AND (older.created_at IS NULL OR newer.created_at IS NULL
       OR older.created_at < newer.created_at
       OR (older.created_at = newer.created_at AND older.id < newer.id));
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_logs_user_date_unique
  ON public.attendance_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_pending ON public.attendance_logs(status) WHERE status IN ('PENDING_CLOCK_IN', 'PENDING_CLOCK_OUT', 'PENDING_OUT', 'PENDING_APPROVAL', 'PENDING_REVIEW', 'PENDING');
CREATE INDEX IF NOT EXISTS idx_users_application_status ON public.users(application_status);
CREATE INDEX IF NOT EXISTS idx_daily_reports_pending ON public.daily_reports(status) WHERE status = 'PENDING';
-- Keep the newest row when a legacy deployment has duplicate report dates.
DELETE FROM public.daily_reports older
USING public.daily_reports newer
WHERE older.user_id IS NOT NULL
  AND older.report_date IS NOT NULL
  AND older.user_id = newer.user_id
  AND older.report_date = newer.report_date
  AND (older.created_at IS NULL OR newer.created_at IS NULL
       OR older.created_at < newer.created_at
       OR (older.created_at = newer.created_at AND older.id < newer.id));
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_reports_user_date
  ON public.daily_reports(user_id, report_date)
  WHERE user_id IS NOT NULL AND report_date IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Auth profile trigger: new signups are always pending and inactive
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role TEXT;
  safe_year_level INTEGER;
BEGIN
  requested_role := CASE
    WHEN NEW.raw_user_meta_data->>'requested_role' IN ('OJT/Intern', 'OJT_INTERN', 'ojt-student')
      THEN 'OJT/Intern'
    ELSE 'Trainee'
  END;

  IF NEW.raw_user_meta_data->>'year_level' ~ '^[0-9]+$' THEN
    safe_year_level := (NEW.raw_user_meta_data->>'year_level')::INTEGER;
  END IF;

  INSERT INTO public.users (
    id, email, password_hash, role, full_name, first_name, last_name,
    account_type, student_id, school, course, year_level, birthday, age,
    address, contact_number, required_hours, rendered_hours, is_active,
    application_status
  )
  VALUES (
    NEW.id,
    NEW.email,
    '',
    requested_role,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'first_name', ''), split_part(NEW.email, '@', 1)),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'last_name', ''), ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'account_type', ''), requested_role),
    COALESCE(NEW.raw_user_meta_data->>'student_id', ''),
    COALESCE(NEW.raw_user_meta_data->>'school', ''),
    COALESCE(NEW.raw_user_meta_data->>'course', ''),
    safe_year_level,
    NULLIF(NEW.raw_user_meta_data->>'birthday', '')::DATE,
    NULLIF(NEW.raw_user_meta_data->>'age', '')::INTEGER,
    COALESCE(NEW.raw_user_meta_data->>'address', ''),
    COALESCE(NEW.raw_user_meta_data->>'contact_number', ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'required_hours', '')::NUMERIC, 0),
    0,
    FALSE,
    'PENDING_APPROVAL'
  )
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    application_status = 'PENDING_APPROVAL',
    is_active = FALSE,
    rendered_hours = 0,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Small authorization helper.  SECURITY DEFINER avoids recursive users RLS.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_hyt_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND UPPER(role) = 'ADMIN'
  );
$$;

REVOKE ALL ON FUNCTION public.is_hyt_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_hyt_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- Account approval RPCs.  p_admin_id is retained for old clients but the
-- authenticated caller is always the reviewer.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_user_application(
  target_user_id UUID,
  admin_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reviewer UUID := auth.uid();
  target public.users%ROWTYPE;
BEGIN
  IF NOT public.is_hyt_admin() THEN
    RAISE EXCEPTION 'Only administrators may approve applications';
  END IF;

  SELECT * INTO target FROM public.users WHERE id = target_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;
  IF UPPER(COALESCE(target.application_status, '')) NOT IN ('PENDING_APPROVAL', 'PENDING', 'PENDING_APPLICATION') THEN
    RAISE EXCEPTION 'Application is no longer pending';
  END IF;

  UPDATE public.users
  SET application_status = 'APPROVED',
      is_active = TRUE,
      reviewed_by = reviewer,
      reviewed_at = NOW(),
      rejection_reason = NULL,
      updated_at = NOW()
  WHERE id = target_user_id;

  RETURN json_build_object('success', true, 'user_id', target_user_id, 'status', 'APPROVED');
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_user_application(
  target_user_id UUID,
  admin_id UUID DEFAULT NULL,
  reason TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reviewer UUID := auth.uid();
BEGIN
  IF NOT public.is_hyt_admin() THEN
    RAISE EXCEPTION 'Only administrators may reject applications';
  END IF;
  IF reason IS NULL OR LENGTH(TRIM(reason)) < 10 THEN
    RAISE EXCEPTION 'Rejection reason must be at least 10 characters';
  END IF;

  UPDATE public.users
  SET application_status = 'REJECTED',
      is_active = FALSE,
      reviewed_by = reviewer,
      reviewed_at = NOW(),
      rejection_reason = TRIM(reason),
      updated_at = NOW()
  WHERE id = target_user_id
    AND UPPER(COALESCE(application_status, '')) IN ('PENDING_APPROVAL', 'PENDING', 'PENDING_APPLICATION');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application is no longer pending';
  END IF;

  RETURN json_build_object('success', true, 'user_id', target_user_id, 'status', 'REJECTED');
END;
$$;

REVOKE ALL ON FUNCTION public.approve_user_application(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_user_application(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_user_application(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_user_application(UUID, UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Attendance lifecycle RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hyt_location_is_valid(
  user_lat NUMERIC,
  user_lon NUMERIC,
  site_lat NUMERIC,
  site_lon NUMERIC,
  radius_meters NUMERIC DEFAULT 100
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  earth_radius NUMERIC := 6371000;
  dlat DOUBLE PRECISION;
  dlon DOUBLE PRECISION;
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
  distance DOUBLE PRECISION;
BEGIN
  IF user_lat IS NULL OR user_lon IS NULL THEN RETURN FALSE; END IF;
  dlat := RADIANS((site_lat - user_lat)::DOUBLE PRECISION);
  dlon := RADIANS((site_lon - user_lon)::DOUBLE PRECISION);
  a := POWER(SIN(dlat / 2.0), 2.0) +
       COS(RADIANS(user_lat::DOUBLE PRECISION)) *
       COS(RADIANS(site_lat::DOUBLE PRECISION)) *
       POWER(SIN(dlon / 2.0), 2.0);
  c := 2.0 * ASIN(LEAST(1.0, SQRT(GREATEST(0.0, a))));
  distance := earth_radius * c;
  RETURN distance <= radius_meters;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_clock_in(
  p_user_id UUID,
  p_latitude NUMERIC,
  p_longitude NUMERIC
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
BEGIN
  IF caller IS NULL OR (caller <> p_user_id AND NOT public.is_hyt_admin()) THEN
    RAISE EXCEPTION 'Unauthorized clock-in request';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = caller AND (
      UPPER(role) = 'ADMIN'
      OR (is_active = TRUE AND UPPER(COALESCE(application_status, '')) IN ('APPROVED', 'ACCEPTED', 'ACTIVE'))
    )
  ) THEN
    RAISE EXCEPTION 'Account is not approved';
  END IF;

  IF public.hyt_location_is_valid(p_latitude, p_longitude, 14.6401, 121.0189)
     OR public.hyt_location_is_valid(p_latitude, p_longitude, 14.6435, 121.0175) THEN
    site_name := CASE
      WHEN public.hyt_location_is_valid(p_latitude, p_longitude, 14.6401, 121.0189) THEN 'HYT Building'
      ELSE 'Atlanta Office'
    END;
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'You must be at an approved HYT location to clock in.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.attendance_logs
    WHERE user_id = caller AND date = today_value
      AND UPPER(status) IN ('PENDING_CLOCK_IN', 'CLOCKED_IN', 'PENDING_CLOCK_OUT', 'PENDING_OUT', 'APPROVED', 'REJECTED', 'VOID', 'PENDING_APPROVAL', 'PENDING_REVIEW')
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Attendance for today is already in progress or completed.');
  END IF;

  INSERT INTO public.attendance_logs (
    user_id, date, time_in, latitude, longitude, location_name, status, requested_at
  ) VALUES (
    caller, today_value, NULL, p_latitude, p_longitude, site_name, 'PENDING_CLOCK_IN', NOW()
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

CREATE OR REPLACE FUNCTION public.request_clock_out(p_user_id UUID DEFAULT NULL)
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
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO record_row
  FROM public.attendance_logs
  WHERE user_id = caller AND date = (NOW() AT TIME ZONE 'Asia/Manila')::date
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
      updated_at = NOW()
  WHERE id = record_row.id;

  RETURN jsonb_build_object(
    'success', true,
    'attendance_id', record_row.id,
    'status', 'PENDING_CLOCK_OUT',
    'pending_end_time', frozen_at,
    'duration_seconds', seconds,
    'rendered_hours', hours,
    'message', 'Clock-out request submitted. Waiting for administrator approval.'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_clock_in_request(
  p_attendance_id UUID,
  p_admin_id UUID DEFAULT NULL,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reviewer UUID := auth.uid();
  record_row public.attendance_logs%ROWTYPE;
BEGIN
  IF NOT public.is_hyt_admin() THEN RAISE EXCEPTION 'Administrator approval required'; END IF;
  SELECT * INTO record_row FROM public.attendance_logs WHERE id = p_attendance_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Attendance request not found'; END IF;
  IF UPPER(record_row.status) NOT IN ('PENDING_CLOCK_IN', 'PENDING', 'PENDING_APPROVAL', 'PENDING_REVIEW') THEN
    RAISE EXCEPTION 'Attendance request is not awaiting clock-in approval';
  END IF;

  UPDATE public.attendance_logs
  SET status = 'CLOCKED_IN',
      time_in = COALESCE(time_in, NOW()),
      approved_by = reviewer,
      approved_at = NOW(),
      admin_note = NULLIF(TRIM(COALESCE(p_admin_note, '')), ''),
      updated_at = NOW()
  WHERE id = p_attendance_id;

  RETURN jsonb_build_object('success', true, 'attendance_id', p_attendance_id, 'status', 'CLOCKED_IN');
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_attendance_request(
  p_attendance_id UUID,
  p_admin_id UUID DEFAULT NULL,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reviewer UUID := auth.uid();
  record_row public.attendance_logs%ROWTYPE;
  frozen_at TIMESTAMPTZ;
  seconds INTEGER;
  hours NUMERIC(8, 4);
BEGIN
  IF NOT public.is_hyt_admin() THEN RAISE EXCEPTION 'Administrator approval required'; END IF;
  SELECT * INTO record_row FROM public.attendance_logs WHERE id = p_attendance_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Attendance request not found'; END IF;
  IF UPPER(record_row.status) NOT IN ('PENDING_CLOCK_OUT', 'PENDING_APPROVAL', 'PENDING', 'PENDING_REVIEW') THEN
    RAISE EXCEPTION 'Attendance request is not awaiting clock-out approval';
  END IF;
  IF record_row.time_in IS NULL THEN
    RAISE EXCEPTION 'Clock-out request has no approved clock-in timestamp';
  END IF;

  frozen_at := COALESCE(record_row.pending_end_time, NOW());
  seconds := COALESCE(record_row.duration_seconds,
    GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (frozen_at - record_row.time_in)))::INTEGER));
  hours := ROUND(COALESCE(record_row.rendered_hours, seconds::NUMERIC / 3600), 4);

  UPDATE public.attendance_logs
  SET status = 'APPROVED',
      time_out = frozen_at,
      duration_seconds = seconds,
      rendered_hours = hours,
      approved_by = reviewer,
      approved_at = NOW(),
      admin_note = NULLIF(TRIM(COALESCE(p_admin_note, '')), ''),
      updated_at = NOW()
  WHERE id = p_attendance_id;

  RETURN jsonb_build_object('success', true, 'attendance_id', p_attendance_id, 'status', 'APPROVED', 'rendered_hours', hours);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_attendance_request(
  p_attendance_id UUID,
  p_admin_id UUID DEFAULT NULL,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reviewer UUID := auth.uid();
BEGIN
  IF NOT public.is_hyt_admin() THEN RAISE EXCEPTION 'Administrator approval required'; END IF;
  IF p_admin_note IS NULL OR LENGTH(TRIM(p_admin_note)) < 10 THEN
    RAISE EXCEPTION 'Rejection reason must be at least 10 characters';
  END IF;

  UPDATE public.attendance_logs
  SET status = 'REJECTED',
      rendered_hours = 0,
      time_out = NULL,
      approved_by = reviewer,
      approved_at = NOW(),
      admin_note = TRIM(p_admin_note),
      updated_at = NOW()
  WHERE id = p_attendance_id
    AND UPPER(status) IN ('PENDING_CLOCK_IN', 'PENDING_CLOCK_OUT', 'PENDING_APPROVAL', 'PENDING_REVIEW', 'PENDING');

  IF NOT FOUND THEN RAISE EXCEPTION 'Attendance request is no longer pending'; END IF;
  RETURN jsonb_build_object('success', true, 'attendance_id', p_attendance_id, 'status', 'REJECTED');
END;
$$;

REVOKE ALL ON FUNCTION public.request_clock_in(UUID, NUMERIC, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_clock_out(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_clock_in_request(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_attendance_request(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_attendance_request(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_clock_in(UUID, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_clock_out(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_clock_in_request(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_attendance_request(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_attendance_request(UUID, UUID, TEXT) TO authenticated;

-- The legacy RPC started the timer immediately.  Remove that alternate
-- write path so production clients cannot bypass PENDING_CLOCK_IN approval.
DROP FUNCTION IF EXISTS public.geofenced_clock_in(UUID, NUMERIC, NUMERIC);

-- One and only one attendance timer/credit implementation.
CREATE OR REPLACE FUNCTION public.hyt_freeze_attendance_timer()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF UPPER(NEW.status) = 'PENDING_CLOCK_OUT' AND UPPER(OLD.status) = 'CLOCKED_IN' THEN
    NEW.pending_end_time := COALESCE(NEW.pending_end_time, NOW());
    IF NEW.time_in IS NOT NULL THEN
      NEW.duration_seconds := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NEW.pending_end_time - NEW.time_in)))::INTEGER);
      NEW.rendered_hours := ROUND(NEW.duration_seconds::NUMERIC / 3600, 4);
    END IF;
  ELSIF UPPER(NEW.status) = 'APPROVED' AND UPPER(OLD.status) IN ('PENDING_CLOCK_OUT', 'PENDING_APPROVAL', 'PENDING', 'PENDING_OUT', 'PENDING_REVIEW') THEN
    NEW.time_out := COALESCE(NEW.pending_end_time, NEW.time_out, NOW());
    IF NEW.duration_seconds IS NOT NULL THEN
      NEW.rendered_hours := ROUND(NEW.duration_seconds::NUMERIC / 3600, 4);
    END IF;
  ELSIF UPPER(NEW.status) = 'REJECTED' THEN
    NEW.time_out := NULL;
    NEW.rendered_hours := 0;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.hyt_credit_attendance_hours()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF UPPER(NEW.status) = 'APPROVED' AND UPPER(OLD.status) IN ('PENDING_CLOCK_OUT', 'PENDING_APPROVAL', 'PENDING', 'PENDING_OUT', 'PENDING_REVIEW') THEN
    UPDATE public.users
    SET rendered_hours = COALESCE(rendered_hours, 0) + COALESCE(NEW.rendered_hours, 0),
        updated_at = NOW()
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_void_yesterday_logs ON public.attendance_logs;
DROP TRIGGER IF EXISTS trigger_calculate_attendance_hours ON public.attendance_logs;
DROP TRIGGER IF EXISTS trigger_freeze_timer_on_pending ON public.attendance_logs;
DROP TRIGGER IF EXISTS trigger_update_user_hours_on_approval ON public.attendance_logs;
DROP TRIGGER IF EXISTS trigger_update_user_rendered_hours ON public.attendance_logs;
DROP TRIGGER IF EXISTS attendance_approval_update_hours ON public.attendance_logs;
DROP TRIGGER IF EXISTS trigger_hyt_freeze_attendance_timer ON public.attendance_logs;
DROP TRIGGER IF EXISTS trigger_hyt_credit_attendance_hours ON public.attendance_logs;
CREATE TRIGGER trigger_hyt_freeze_attendance_timer
BEFORE UPDATE ON public.attendance_logs
FOR EACH ROW EXECUTE FUNCTION public.hyt_freeze_attendance_timer();
CREATE TRIGGER trigger_hyt_credit_attendance_hours
AFTER UPDATE OF status ON public.attendance_logs
FOR EACH ROW EXECUTE FUNCTION public.hyt_credit_attendance_hours();

-- OT approval uses one separate credit path.  It does not add the OT hours to
-- attendance_logs, otherwise approving that attendance later would count the
-- same hours twice.
CREATE OR REPLACE FUNCTION public.hyt_credit_ot_hours()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF UPPER(NEW.status) = 'APPROVED' AND UPPER(OLD.status) <> 'APPROVED' THEN
    UPDATE public.users
    SET rendered_hours = COALESCE(rendered_hours, 0) + COALESCE(NEW.requested_hours, 0),
        updated_at = NOW()
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ot_approval_update_hours ON public.ot_requests;
DROP TRIGGER IF EXISTS trigger_add_ot_hours_to_attendance ON public.ot_requests;
DROP TRIGGER IF EXISTS trigger_hyt_credit_ot_hours ON public.ot_requests;
CREATE TRIGGER trigger_hyt_credit_ot_hours
AFTER UPDATE OF status ON public.ot_requests
FOR EACH ROW EXECUTE FUNCTION public.hyt_credit_ot_hours();

-- ---------------------------------------------------------------------------
-- Dashboard and event cleanup RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.is_hyt_admin() THEN RAISE EXCEPTION 'Administrator access required'; END IF;

  SELECT jsonb_build_object(
    'total_students', COUNT(*) FILTER (WHERE LOWER(role) IN ('trainee', 'ojt/intern', 'student')),
    'total_applications', COUNT(*) FILTER (WHERE LOWER(role) IN ('trainee', 'ojt/intern', 'student') AND UPPER(COALESCE(application_status, '')) IN ('PENDING_APPROVAL', 'PENDING', 'PENDING_APPLICATION')),
    'accepted_applications', COUNT(*) FILTER (WHERE LOWER(role) IN ('trainee', 'ojt/intern', 'student') AND UPPER(COALESCE(application_status, '')) IN ('APPROVED', 'ACCEPTED', 'ACTIVE') AND is_active = TRUE),
    'completed_ojt', COUNT(*) FILTER (WHERE LOWER(role) IN ('trainee', 'ojt/intern', 'student') AND COALESCE(required_hours, 0) > 0 AND COALESCE(rendered_hours, 0) >= required_hours),
    'active_programs', (SELECT COUNT(*) FROM public.programs WHERE UPPER(status) IN ('PUBLISHED', 'ACTIVE', 'OPEN') AND (application_deadline IS NULL OR application_deadline >= (NOW() AT TIME ZONE 'Asia/Manila')::date)),
    'active_opportunities', (SELECT COUNT(*) FROM public.opportunities WHERE UPPER(status) IN ('PUBLISHED', 'ACTIVE', 'OPEN') AND (application_deadline IS NULL OR application_deadline >= (NOW() AT TIME ZONE 'Asia/Manila')::date)),
    'pending_attendance', (SELECT COUNT(*) FROM public.attendance_logs WHERE UPPER(status) IN ('PENDING_CLOCK_IN', 'PENDING_CLOCK_OUT', 'PENDING_APPROVAL', 'PENDING_REVIEW', 'PENDING')),
    'pending_reports', (SELECT COUNT(*) FROM public.daily_reports WHERE UPPER(status) IN ('PENDING', 'PENDING_APPROVAL', 'SUBMITTED', 'UNDER_REVIEW'))
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_hyt_events()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  program_count INTEGER;
  opportunity_count INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_hyt_admin() THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;
  UPDATE public.programs SET status = 'Closed', updated_at = NOW()
    WHERE UPPER(status) = 'PUBLISHED'
      AND application_deadline < (NOW() AT TIME ZONE 'Asia/Manila')::date;
  GET DIAGNOSTICS program_count = ROW_COUNT;
  UPDATE public.opportunities SET status = 'Closed', updated_at = NOW()
    WHERE UPPER(status) = 'PUBLISHED'
      AND application_deadline < (NOW() AT TIME ZONE 'Asia/Manila')::date;
  GET DIAGNOSTICS opportunity_count = ROW_COUNT;
  RETURN jsonb_build_object('programs', program_count, 'opportunities', opportunity_count);
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_dashboard_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_hyt_events() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_hyt_events() TO authenticated;

-- If the Supabase project has pg_cron enabled, run cleanup hourly even when
-- no admin dashboard is open.  The frontend still filters expired rows while
-- the scheduler is unavailable.
DO $$
DECLARE
  has_job BOOLEAN;
BEGIN
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
      EXECUTE 'SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = ''hyt-expire-events'')' INTO has_job;
      IF NOT COALESCE(has_job, FALSE) THEN
        EXECUTE 'SELECT cron.schedule(''hyt-expire-events'', ''15 * * * *'', ''SELECT public.expire_hyt_events()'')';
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Scheduling is optional.  A restricted pg_cron installation must not
    -- prevent the schema/RPC migration from completing.
    RAISE NOTICE 'HYT event cleanup scheduler was not installed: %', SQLERRM;
  END;
END;
$$;

-- ---------------------------------------------------------------------------
-- Daily report review RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_daily_report(
  p_report_id UUID,
  p_status TEXT,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_status TEXT := UPPER(TRIM(COALESCE(p_status, '')));
BEGIN
  IF NOT public.is_hyt_admin() THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  IF normalized_status NOT IN ('APPROVED', 'REJECTED') THEN
    RAISE EXCEPTION 'Report decision must be APPROVED or REJECTED';
  END IF;
  IF normalized_status = 'REJECTED' AND (p_admin_note IS NULL OR LENGTH(TRIM(p_admin_note)) < 10) THEN
    RAISE EXCEPTION 'Rejection reason must be at least 10 characters';
  END IF;

  UPDATE public.daily_reports
  SET status = normalized_status,
      admin_note = NULLIF(TRIM(COALESCE(p_admin_note, '')), ''),
      reviewed_by = auth.uid(),
      reviewed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_report_id
    AND UPPER(status) IN ('PENDING', 'PENDING_APPROVAL', 'SUBMITTED', 'UNDER_REVIEW');

  IF NOT FOUND THEN RAISE EXCEPTION 'Daily report is no longer pending'; END IF;
  RETURN jsonb_build_object('success', true, 'report_id', p_report_id, 'status', normalized_status);
END;
$$;

REVOKE ALL ON FUNCTION public.review_daily_report(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_daily_report(UUID, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS hardening for the tables touched by this workflow
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view published programs" ON public.programs;
DROP POLICY IF EXISTS "hyt_public_read_programs" ON public.programs;
CREATE POLICY "hyt_public_read_programs" ON public.programs FOR SELECT TO anon, authenticated
  USING (
    UPPER(status) = 'PUBLISHED'
    AND (application_deadline IS NULL OR application_deadline >= (NOW() AT TIME ZONE 'Asia/Manila')::date)
  );
DROP POLICY IF EXISTS "Admins can manage programs" ON public.programs;
DROP POLICY IF EXISTS "hyt_admins_manage_programs" ON public.programs;
CREATE POLICY "hyt_admins_manage_programs" ON public.programs FOR ALL TO authenticated
USING (public.is_hyt_admin()) WITH CHECK (public.is_hyt_admin());
DROP POLICY IF EXISTS "Anyone can view published opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "hyt_public_read_opportunities" ON public.opportunities;
CREATE POLICY "hyt_public_read_opportunities" ON public.opportunities FOR SELECT TO anon, authenticated
  USING (
    UPPER(status) = 'PUBLISHED'
    AND (application_deadline IS NULL OR application_deadline >= (NOW() AT TIME ZONE 'Asia/Manila')::date)
  );
DROP POLICY IF EXISTS "Admins can manage opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "hyt_admins_manage_opportunities" ON public.opportunities;
CREATE POLICY "hyt_admins_manage_opportunities" ON public.opportunities FOR ALL TO authenticated
USING (public.is_hyt_admin()) WITH CHECK (public.is_hyt_admin());
GRANT SELECT ON public.programs, public.opportunities TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.programs, public.opportunities TO authenticated;

DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Allow profile creation during registration" ON public.users;
DROP POLICY IF EXISTS "Allow public registration" ON public.users;
DROP POLICY IF EXISTS "Allow user registration" ON public.users;
DROP POLICY IF EXISTS "anon_insert_on_signup" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
DROP POLICY IF EXISTS "hyt_users_select_own_or_admin" ON public.users;
DROP POLICY IF EXISTS "hyt_users_update_own_profile" ON public.users;
CREATE POLICY "hyt_users_select_own_or_admin" ON public.users FOR SELECT TO authenticated
USING (auth.uid() = id OR public.is_hyt_admin());
CREATE POLICY "hyt_users_update_own_profile" ON public.users FOR UPDATE TO authenticated
USING (auth.uid() = id OR public.is_hyt_admin())
WITH CHECK (auth.uid() = id OR public.is_hyt_admin());

DROP POLICY IF EXISTS "Users can view own attendance logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "Users can create own attendance logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "Users can update own attendance logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "Users can update own pending attendance logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "Users can update own attendance logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "Admins can manage all attendance logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "Admins can view all attendance" ON public.attendance_logs;
DROP POLICY IF EXISTS "hyt_attendance_select_own_or_admin" ON public.attendance_logs;
DROP POLICY IF EXISTS "hyt_attendance_admin_manage" ON public.attendance_logs;
CREATE POLICY "hyt_attendance_select_own_or_admin" ON public.attendance_logs FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_hyt_admin());
CREATE POLICY "hyt_attendance_admin_manage" ON public.attendance_logs FOR ALL TO authenticated
USING (public.is_hyt_admin()) WITH CHECK (public.is_hyt_admin());

DROP POLICY IF EXISTS "Users can view own reports" ON public.daily_reports;
DROP POLICY IF EXISTS "Users can create own reports" ON public.daily_reports;
DROP POLICY IF EXISTS "Users can update own reports" ON public.daily_reports;
DROP POLICY IF EXISTS "Admins can manage all reports" ON public.daily_reports;
DROP POLICY IF EXISTS "hyt_reports_select_own_or_admin" ON public.daily_reports;
DROP POLICY IF EXISTS "hyt_reports_insert_own" ON public.daily_reports;
DROP POLICY IF EXISTS "hyt_reports_update_own_pending" ON public.daily_reports;
DROP POLICY IF EXISTS "hyt_reports_admin_manage" ON public.daily_reports;
CREATE POLICY "hyt_reports_select_own_or_admin" ON public.daily_reports FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_hyt_admin());
CREATE POLICY "hyt_reports_insert_own" ON public.daily_reports FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND UPPER(status) IN ('PENDING', 'SUBMITTED', 'DRAFT'));
CREATE POLICY "hyt_reports_update_own_pending" ON public.daily_reports FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND UPPER(status) IN ('PENDING', 'SUBMITTED', 'DRAFT'))
WITH CHECK (user_id = auth.uid());
CREATE POLICY "hyt_reports_admin_manage" ON public.daily_reports FOR ALL TO authenticated
USING (public.is_hyt_admin()) WITH CHECK (public.is_hyt_admin());

-- Direct attendance state changes are not client-writable; use the RPCs above.
REVOKE INSERT, UPDATE, DELETE ON public.attendance_logs FROM authenticated;
GRANT SELECT ON public.attendance_logs TO authenticated;
GRANT SELECT ON public.users, public.daily_reports TO authenticated;

-- Profile clients may edit presentation fields only.  Approval, role and hour
-- totals are changed exclusively by trusted triggers/RPCs.
REVOKE INSERT, DELETE ON public.users FROM anon, authenticated;
REVOKE UPDATE ON public.users FROM authenticated;
GRANT UPDATE (
  full_name, first_name, last_name, profile_picture, school, course,
  year_level, birthday, age, address, contact_number, last_login
) ON public.users TO authenticated;

-- ---------------------------------------------------------------------------
-- Realtime publication (safe to run more than once)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'users') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.users';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'attendance_logs') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_logs';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'daily_reports') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_reports';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'programs') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.programs';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'opportunities') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.opportunities';
  END IF;
END;
$$;

COMMENT ON TABLE public.attendance_logs IS 'Two-stage attendance: PENDING_CLOCK_IN -> CLOCKED_IN -> PENDING_CLOCK_OUT -> APPROVED/REJECTED';
COMMENT ON FUNCTION public.request_clock_in(UUID, NUMERIC, NUMERIC) IS 'Creates a pending clock-in request; does not start the timer';
COMMENT ON FUNCTION public.request_clock_out(UUID) IS 'Freezes the live timer and creates a pending clock-out request';
COMMENT ON FUNCTION public.approve_attendance_request(UUID, UUID, TEXT) IS 'Atomically approves a frozen clock-out and credits hours';
