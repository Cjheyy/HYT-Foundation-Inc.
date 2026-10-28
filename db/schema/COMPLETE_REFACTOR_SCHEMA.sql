-- ============================================
-- COMPLETE PLATFORM REFACTOR - DATABASE SCHEMA
-- HYT Foundation - OJT & Trainee Management System
-- Created: 2026-09-17
-- ============================================

-- ============================================
-- 1. UPDATE USERS TABLE
-- ============================================

-- Add new columns to existing users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS school VARCHAR(255),
ADD COLUMN IF NOT EXISTS required_hours NUMERIC(6,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS rendered_hours NUMERIC(6,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Update address and birthday if they don't exist
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS birthday DATE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_school ON public.users(school);

-- ============================================
-- 2. CREATE ATTENDANCE_LOGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  time_in TIMESTAMP WITH TIME ZONE,
  time_out TIMESTAMP WITH TIME ZONE,
  rendered_hours NUMERIC(4,2) DEFAULT 0,
  status VARCHAR(20) CHECK (status IN ('Pending', 'Approved', 'Rejected')) DEFAULT 'Pending',
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_user_date_attendance UNIQUE (user_id, date)
);

-- Indexes for attendance_logs
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON public.attendance_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance_logs(date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON public.attendance_logs(status);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON public.attendance_logs(user_id, date);

-- Trigger to update rendered_hours automatically
CREATE OR REPLACE FUNCTION calculate_attendance_hours()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.time_in IS NOT NULL AND NEW.time_out IS NOT NULL THEN
    NEW.rendered_hours := EXTRACT(EPOCH FROM (NEW.time_out - NEW.time_in)) / 3600;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_attendance_hours
  BEFORE INSERT OR UPDATE ON public.attendance_logs
  FOR EACH ROW
  EXECUTE FUNCTION calculate_attendance_hours();

-- ============================================
-- 3. CREATE OT_REQUESTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.ot_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  attendance_id UUID REFERENCES public.attendance_logs(id) ON DELETE SET NULL,
  requested_hours NUMERIC(3,1) NOT NULL CHECK (requested_hours > 0 AND requested_hours <= 8),
  reason TEXT NOT NULL,
  status VARCHAR(20) CHECK (status IN ('Pending', 'Approved', 'Rejected')) DEFAULT 'Pending',
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for ot_requests
CREATE INDEX IF NOT EXISTS idx_ot_requests_user_id ON public.ot_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_ot_requests_status ON public.ot_requests(status);
CREATE INDEX IF NOT EXISTS idx_ot_requests_attendance_id ON public.ot_requests(attendance_id);
CREATE INDEX IF NOT EXISTS idx_ot_requests_created_at ON public.ot_requests(created_at DESC);

-- Trigger to update timestamp
CREATE OR REPLACE FUNCTION update_ot_request_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ot_request_timestamp
  BEFORE UPDATE ON public.ot_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_ot_request_timestamp();

-- ============================================
-- 4. CREATE DAILY_REPORTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  accomplishments TEXT NOT NULL,
  status VARCHAR(20) CHECK (status IN ('Pending', 'Approved', 'Rejected')) DEFAULT 'Pending',
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_user_date_report UNIQUE (user_id, report_date)
);

-- Indexes for daily_reports
CREATE INDEX IF NOT EXISTS idx_daily_reports_user_id ON public.daily_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON public.daily_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_daily_reports_status ON public.daily_reports(status);
CREATE INDEX IF NOT EXISTS idx_daily_reports_user_date ON public.daily_reports(user_id, report_date DESC);

-- Trigger to update timestamp
CREATE OR REPLACE FUNCTION update_daily_report_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_daily_report_timestamp
  BEFORE UPDATE ON public.daily_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_report_timestamp();

-- ============================================
-- 5. UPDATE USERS RENDERED HOURS TRIGGER
-- ============================================

-- Function to update user's total rendered hours when attendance is approved
CREATE OR REPLACE FUNCTION update_user_rendered_hours()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if attendance was approved
  IF NEW.status = 'Approved' AND (OLD.status IS NULL OR OLD.status != 'Approved') THEN
    UPDATE public.users
    SET rendered_hours = COALESCE(rendered_hours, 0) + NEW.rendered_hours
    WHERE id = NEW.user_id;
  END IF;
  
  -- Subtract hours if attendance was previously approved but now rejected/pending
  IF OLD.status = 'Approved' AND NEW.status != 'Approved' THEN
    UPDATE public.users
    SET rendered_hours = GREATEST(0, COALESCE(rendered_hours, 0) - OLD.rendered_hours)
    WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_rendered_hours
  AFTER UPDATE ON public.attendance_logs
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_user_rendered_hours();

-- ============================================
-- 6. ADD OT HOURS TO ATTENDANCE WHEN APPROVED
-- ============================================

CREATE OR REPLACE FUNCTION add_ot_hours_to_attendance()
RETURNS TRIGGER AS $$
BEGIN
  -- When OT request is approved, add hours to associated attendance log
  IF NEW.status = 'Approved' AND (OLD.status IS NULL OR OLD.status != 'Approved') AND NEW.attendance_id IS NOT NULL THEN
    UPDATE public.attendance_logs
    SET rendered_hours = rendered_hours + NEW.requested_hours
    WHERE id = NEW.attendance_id;
  END IF;
  
  -- If OT was approved but now rejected, subtract the hours
  IF OLD.status = 'Approved' AND NEW.status != 'Approved' AND NEW.attendance_id IS NOT NULL THEN
    UPDATE public.attendance_logs
    SET rendered_hours = GREATEST(0, rendered_hours - NEW.requested_hours)
    WHERE id = NEW.attendance_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_add_ot_hours_to_attendance
  AFTER UPDATE ON public.ot_requests
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION add_ot_hours_to_attendance();

-- ============================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on new tables
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ot_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

-- Attendance Logs Policies
CREATE POLICY "Users can view own attendance logs"
  ON public.attendance_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own attendance logs"
  ON public.attendance_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending attendance logs"
  ON public.attendance_logs FOR UPDATE
  USING (auth.uid() = user_id AND status = 'Pending');

CREATE POLICY "Admins can view all attendance logs"
  ON public.attendance_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can update all attendance logs"
  ON public.attendance_logs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- OT Requests Policies
CREATE POLICY "Users can view own OT requests"
  ON public.ot_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own OT requests"
  ON public.ot_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all OT requests"
  ON public.ot_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can update all OT requests"
  ON public.ot_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Daily Reports Policies
CREATE POLICY "Users can view own daily reports"
  ON public.daily_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily reports"
  ON public.daily_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending daily reports"
  ON public.daily_reports FOR UPDATE
  USING (auth.uid() = user_id AND status = 'Pending');

CREATE POLICY "Admins can view all daily reports"
  ON public.daily_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can update all daily reports"
  ON public.daily_reports FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- ============================================
-- 8. HELPER VIEWS FOR ADMIN DASHBOARD
-- ============================================

-- View for OJT progress tracking
CREATE OR REPLACE VIEW public.ojt_progress_view AS
SELECT 
  u.id,
  u.full_name,
  u.email,
  u.school,
  u.role,
  u.required_hours,
  u.rendered_hours,
  (u.required_hours - u.rendered_hours) AS remaining_hours,
  CASE 
    WHEN u.required_hours > 0 THEN ROUND((u.rendered_hours / u.required_hours * 100)::numeric, 2)
    ELSE 0
  END AS progress_percentage,
  u.is_active,
  u.created_at
FROM public.users u
WHERE u.role IN ('OJT/Intern', 'Trainee')
ORDER BY u.created_at DESC;

-- View for pending approvals summary
CREATE OR REPLACE VIEW public.pending_approvals_summary AS
SELECT 
  u.id AS user_id,
  u.full_name,
  COUNT(DISTINCT al.id) AS pending_attendance,
  COUNT(DISTINCT ot.id) AS pending_ot_requests,
  COUNT(DISTINCT dr.id) AS pending_daily_reports
FROM public.users u
LEFT JOIN public.attendance_logs al ON al.user_id = u.id AND al.status = 'Pending'
LEFT JOIN public.ot_requests ot ON ot.user_id = u.id AND ot.status = 'Pending'
LEFT JOIN public.daily_reports dr ON dr.user_id = u.id AND dr.status = 'Pending'
WHERE u.role IN ('OJT/Intern', 'Trainee')
GROUP BY u.id, u.full_name;

-- ============================================
-- SCHEMA UPDATE COMPLETE
-- ============================================

-- Verify tables
SELECT 
  'attendance_logs' AS table_name, 
  COUNT(*) AS row_count 
FROM public.attendance_logs
UNION ALL
SELECT 
  'ot_requests' AS table_name, 
  COUNT(*) AS row_count 
FROM public.ot_requests
UNION ALL
SELECT 
  'daily_reports' AS table_name, 
  COUNT(*) AS row_count 
FROM public.daily_reports;
