-- HYT Foundation: fix 400s for programs / opportunities / daily_reports / dashboard
-- Run this ONCE in Supabase SQL Editor. All statements are idempotent.

-- 1. Slot columns (old schema has only available_slots)
ALTER TABLE programs ADD COLUMN IF NOT EXISTS total_slots INTEGER;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS total_slots INTEGER;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='programs' AND column_name='available_slots') THEN
    UPDATE programs SET total_slots = available_slots WHERE total_slots IS NULL AND available_slots IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='opportunities' AND column_name='available_slots') THEN
    UPDATE opportunities SET total_slots = available_slots WHERE total_slots IS NULL AND available_slots IS NOT NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. Relax opportunities category CHECK to allow new generic categories
-- Old: ('Internship','OJT','Training','Workshop','Youth Program','Community Activity')
-- New spec: ('Technical Training','Community Outreach','Skill Building','General') + legacy
DO $$
BEGIN
  ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_category_check;
  ALTER TABLE opportunities ADD CONSTRAINT opportunities_category_check
    CHECK (category IS NULL OR category IN (
      'Internship','OJT','Training','Workshop','Youth Program','Community Activity',
      'Technical Training','Community Outreach','Skill Building','General'
    ));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 3. Users: columns used by dashboard + auth (safe to add if missing)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS application_status VARCHAR(50) DEFAULT 'APPROVED';
ALTER TABLE users ADD COLUMN IF NOT EXISTS required_hours INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rendered_hours DOUBLE PRECISION DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reviewed_by UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 4. Daily reports: new columns alongside legacy student_id/date/tasks_completed
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS report_date DATE;
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS accomplishments TEXT;
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS admin_note TEXT;
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
-- Backfill only when both source and target columns exist (prod uses user_id, old dev uses student_id)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_reports' AND column_name='student_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_reports' AND column_name='user_id') THEN
    UPDATE daily_reports SET user_id = student_id WHERE user_id IS NULL AND student_id IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_reports' AND column_name='date')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_reports' AND column_name='report_date') THEN
    UPDATE daily_reports SET report_date = date WHERE report_date IS NULL AND date IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_reports' AND column_name='tasks_completed')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_reports' AND column_name='accomplishments') THEN
    UPDATE daily_reports SET accomplishments = tasks_completed WHERE (accomplishments IS NULL OR accomplishments = '') AND tasks_completed IS NOT NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 5. Dashboard stats RPC (replaces broken get_admin_dashboard_stats with role-safe version)
DROP FUNCTION IF EXISTS get_admin_dashboard_stats();
CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS JSON AS $$
DECLARE
  v_users_exist BOOLEAN;
  v_has_role BOOLEAN;
  v_has_app_status BOOLEAN;
  v_result JSON;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='users') INTO v_users_exist;
  IF NOT v_users_exist THEN
    RETURN json_build_object('total_students',0,'total_applications',0,'accepted_applications',0,'completed_ojt',0,'active_programs',0,'active_opportunities',0,'pending_attendance',0,'pending_reports',0);
  END IF;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='role') INTO v_has_role;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='application_status') INTO v_has_app_status;

  IF v_has_role AND v_has_app_status THEN
    SELECT json_build_object(
      'total_students', (SELECT COUNT(*) FROM users WHERE role IN ('Trainee','OJT/Intern','STUDENT')),
      'total_applications', (SELECT COUNT(*) FROM users WHERE role IN ('Trainee','OJT/Intern','STUDENT') AND application_status IN ('PENDING_APPROVAL','PENDING','PENDING_APPLICATION')),
      'accepted_applications', (SELECT COUNT(*) FROM users WHERE role IN ('Trainee','OJT/Intern','STUDENT') AND application_status IN ('APPROVED','ACCEPTED','ACTIVE') AND COALESCE(is_active, TRUE) = TRUE),
      'completed_ojt', 0,
      'active_programs', (SELECT COUNT(*) FROM programs WHERE status='Published'),
      'active_opportunities', (SELECT COUNT(*) FROM opportunities WHERE status='Published'),
      'pending_attendance', (SELECT COUNT(*) FROM attendance_logs WHERE status LIKE 'PENDING%'),
      'pending_reports', (SELECT COUNT(*) FROM daily_reports WHERE status IN ('PENDING','PENDING_APPROVAL','SUBMITTED'))
    ) INTO v_result;
  ELSE
    SELECT json_build_object(
      'total_students', (SELECT COUNT(*) FROM users),
      'total_applications', 0,
      'accepted_applications', 0,
      'completed_ojt', 0,
      'active_programs', (SELECT COUNT(*) FROM programs WHERE status='Published'),
      'active_opportunities', (SELECT COUNT(*) FROM opportunities WHERE status='Published'),
      'pending_attendance', 0,
      'pending_reports', 0
    ) INTO v_result;
  END IF;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Relax applications status CHECK to accept both title-case and UPPER values
DO $$
BEGIN
  ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check;
  ALTER TABLE applications ADD CONSTRAINT applications_status_check
    CHECK (status IS NULL OR status IN (
      'Pending','Applied','Under Review','Interview','Approved','Rejected','Accepted','Declined',
      'PENDING','PENDING_APPROVAL','PENDING_APPLICATION','APPLIED','SUBMITTED','UNDER_REVIEW','INTERVIEW',
      'APPROVED','REJECTED','ACCEPTED','DECLINED','ACTIVE','VERIFIED'
    ));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 7. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
