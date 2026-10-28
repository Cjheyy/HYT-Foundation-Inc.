-- ============================================
-- HYT FOUNDATION DATABASE SCHEMA
-- Supabase PostgreSQL Database
-- Created: 2026-09-16
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- Stores both STUDENT and ADMIN accounts
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'OJT/Intern', 'Trainee')),
  
  -- Profile Information
  full_name VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  profile_picture TEXT,
  
  -- Student-specific fields
  student_id VARCHAR(50),
  account_type VARCHAR(20), -- Deprecated: use 'role' instead
  school VARCHAR(255),
  course VARCHAR(100),
  year_level VARCHAR(20),
  birthday DATE,
  age INTEGER,
  address TEXT,
  contact_number VARCHAR(20),
  required_hours INTEGER,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- Indexes for users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_student_id ON users(student_id);
CREATE INDEX idx_users_account_type ON users(account_type);

-- ============================================
-- PROGRAMS TABLE
-- Leadership programs, summits, etc.
-- ============================================
CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  objectives JSONB DEFAULT '[]',
  category VARCHAR(100),
  thrusts JSONB DEFAULT '[]',
  schedule VARCHAR(255),
  location VARCHAR(255),
  setup VARCHAR(50) CHECK (setup IN ('On-site', 'Remote', 'Hybrid')),
  requirements JSONB DEFAULT '[]',
  available_slots INTEGER,
  application_deadline DATE,
  status VARCHAR(50) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Published', 'Archived', 'Closed')),
  image TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for programs
CREATE INDEX idx_programs_status ON programs(status);
CREATE INDEX idx_programs_category ON programs(category);
CREATE INDEX idx_programs_deadline ON programs(application_deadline);

-- ============================================
-- OPPORTUNITIES TABLE
-- Internships, OJT, Training, Workshops, Youth Programs, Community Activities
-- ============================================
CREATE TABLE opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  organization VARCHAR(255),
  description TEXT,
  objectives JSONB DEFAULT '[]',
  category VARCHAR(100) NOT NULL CHECK (category IN ('Internship', 'OJT', 'Training', 'Workshop', 'Youth Program', 'Community Activity')),
  thrusts JSONB DEFAULT '[]',
  location VARCHAR(255),
  setup VARCHAR(50) CHECK (setup IN ('On-site', 'Remote', 'Hybrid')),
  schedule VARCHAR(255),
  duration VARCHAR(100),
  required_hours INTEGER,
  requirements JSONB DEFAULT '[]',
  available_slots INTEGER,
  application_deadline DATE,
  status VARCHAR(50) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Published', 'Archived', 'Closed')),
  restricted_to VARCHAR(50), -- 'OJT' for OJT-only trainings
  
  -- Workplace details (for OJT)
  workplace_name VARCHAR(255),
  workplace_address TEXT,
  workplace_latitude DECIMAL(10, 8),
  workplace_longitude DECIMAL(11, 8),
  workplace_radius INTEGER,
  
  -- Work schedule (for OJT)
  work_days JSONB DEFAULT '[]',
  time_in_start TIME,
  time_in_end TIME,
  time_out_start TIME,
  time_out_end TIME,
  expected_hours_per_day INTEGER,
  
  image TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for opportunities
CREATE INDEX idx_opportunities_status ON opportunities(status);
CREATE INDEX idx_opportunities_category ON opportunities(category);
CREATE INDEX idx_opportunities_deadline ON opportunities(application_deadline);
CREATE INDEX idx_opportunities_restricted_to ON opportunities(restricted_to);

-- ============================================
-- APPLICATIONS TABLE
-- Student applications to programs/opportunities
-- ============================================
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('program', 'opportunity')),
  status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Applied', 'Under Review', 'Interview', 'Approved', 'Rejected', 'Accepted', 'Declined')),
  
  -- Review details
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES users(id),
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure either program_id or opportunity_id is set, not both
  CONSTRAINT check_application_target CHECK (
    (program_id IS NOT NULL AND opportunity_id IS NULL) OR
    (program_id IS NULL AND opportunity_id IS NOT NULL)
  )
);

-- Indexes for applications
CREATE INDEX idx_applications_user_id ON applications(user_id);
CREATE INDEX idx_applications_program_id ON applications(program_id);
CREATE INDEX idx_applications_opportunity_id ON applications(opportunity_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_type ON applications(type);

-- ============================================
-- OJT_RECORDS TABLE
-- Track OJT progress and details
-- ============================================
CREATE TABLE ojt_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Active', 'Completed', 'Cancelled')),
  
  start_date DATE,
  end_date DATE,
  required_hours INTEGER NOT NULL,
  completed_hours INTEGER DEFAULT 0,
  
  workplace VARCHAR(255),
  supervisor VARCHAR(255),
  supervisor_email VARCHAR(255),
  supervisor_phone VARCHAR(20),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for ojt_records
CREATE INDEX idx_ojt_records_student_id ON ojt_records(student_id);
CREATE INDEX idx_ojt_records_opportunity_id ON ojt_records(opportunity_id);
CREATE INDEX idx_ojt_records_status ON ojt_records(status);

-- ============================================
-- ATTENDANCE TABLE
-- Daily attendance/time logs for OJT students
-- ============================================
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ojt_id UUID NOT NULL REFERENCES ojt_records(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  time_in TIME,
  time_out TIME,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  
  status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Verified', 'Rejected')),
  hours_worked DECIMAL(5, 2) DEFAULT 0,
  notes TEXT,
  
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique date per student per OJT
  UNIQUE(student_id, ojt_id, date)
);

-- Indexes for attendance
CREATE INDEX idx_attendance_student_id ON attendance(student_id);
CREATE INDEX idx_attendance_ojt_id ON attendance(ojt_id);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_status ON attendance(status);

-- ============================================
-- DAILY_REPORTS TABLE
-- Daily work reports/accomplishments
-- ============================================
CREATE TABLE daily_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ojt_id UUID NOT NULL REFERENCES ojt_records(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  tasks_completed TEXT,
  skills_learned TEXT,
  challenges TEXT,
  notes TEXT,
  attachments JSONB DEFAULT '[]',
  
  status VARCHAR(50) DEFAULT 'Submitted' CHECK (status IN ('Draft', 'Submitted', 'Reviewed')),
  feedback TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique report per date
  UNIQUE(student_id, ojt_id, date)
);

-- Indexes for daily_reports
CREATE INDEX idx_daily_reports_student_id ON daily_reports(student_id);
CREATE INDEX idx_daily_reports_ojt_id ON daily_reports(ojt_id);
CREATE INDEX idx_daily_reports_date ON daily_reports(date);
CREATE INDEX idx_daily_reports_status ON daily_reports(status);

-- ============================================
-- REQUIREMENTS TABLE
-- Document submissions (MOA, endorsement letters, etc.)
-- ============================================
CREATE TABLE requirements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  ojt_id UUID REFERENCES ojt_records(id) ON DELETE CASCADE,
  
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_url TEXT,
  file_name VARCHAR(255),
  file_size INTEGER,
  file_type VARCHAR(100),
  
  status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Submitted', 'Approved', 'Rejected', 'Needs Revision')),
  notes TEXT,
  
  submitted_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for requirements
CREATE INDEX idx_requirements_student_id ON requirements(student_id);
CREATE INDEX idx_requirements_application_id ON requirements(application_id);
CREATE INDEX idx_requirements_ojt_id ON requirements(ojt_id);
CREATE INDEX idx_requirements_status ON requirements(status);
CREATE INDEX idx_requirements_type ON requirements(type);

-- ============================================
-- CERTIFICATES TABLE
-- Generated certificates for completions
-- ============================================
CREATE TABLE certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  ojt_id UUID REFERENCES ojt_records(id) ON DELETE SET NULL,
  
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  certificate_number VARCHAR(100) UNIQUE,
  issue_date DATE NOT NULL,
  
  file_url TEXT,
  template_used VARCHAR(100),
  
  status VARCHAR(50) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Issued', 'Revoked')),
  issued_by UUID REFERENCES users(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for certificates
CREATE INDEX idx_certificates_student_id ON certificates(student_id);
CREATE INDEX idx_certificates_certificate_number ON certificates(certificate_number);
CREATE INDEX idx_certificates_status ON certificates(status);
CREATE INDEX idx_certificates_issue_date ON certificates(issue_date);

-- ============================================
-- ANNOUNCEMENTS TABLE
-- System-wide announcements and news
-- ============================================
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(100) DEFAULT 'General',
  priority VARCHAR(20) DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
  status VARCHAR(50) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Published', 'Archived')),
  
  published_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for announcements
CREATE INDEX idx_announcements_status ON announcements(status);
CREATE INDEX idx_announcements_category ON announcements(category);
CREATE INDEX idx_announcements_priority ON announcements(priority);
CREATE INDEX idx_announcements_published_at ON announcements(published_at);

-- ============================================
-- NOTIFICATIONS TABLE
-- User-specific notifications
-- ============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(100) DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error', 'announcement')),
  
  related_entity_type VARCHAR(100), -- 'application', 'attendance', 'report', etc.
  related_entity_id UUID,
  
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- ============================================
-- SETTINGS TABLE
-- Application settings and configurations
-- ============================================
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(255) UNIQUE NOT NULL,
  value JSONB,
  category VARCHAR(100),
  description TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_programs_updated_at BEFORE UPDATE ON programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ojt_records_updated_at BEFORE UPDATE ON ojt_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_reports_updated_at BEFORE UPDATE ON daily_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_requirements_updated_at BEFORE UPDATE ON requirements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_certificates_updated_at BEFORE UPDATE ON certificates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-update OJT completed hours
CREATE OR REPLACE FUNCTION update_ojt_completed_hours()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'Verified' AND (TG_OP = 'INSERT' OR OLD.status != 'Verified') THEN
    UPDATE ojt_records 
    SET completed_hours = (
      SELECT COALESCE(SUM(hours_worked), 0)
      FROM attendance
      WHERE ojt_id = NEW.ojt_id AND status = 'Verified'
    )
    WHERE id = NEW.ojt_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ojt_hours_on_attendance AFTER INSERT OR UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION update_ojt_completed_hours();

-- ============================================
-- TRIGGER: Auto-create public.users profile
-- ============================================
-- This trigger automatically creates a public.users profile
-- when a new auth.users record is created during registration.
-- This bypasses RLS issues during signup.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into public.users with info from auth.users metadata
  INSERT INTO public.users (
    id,
    email,
    password_hash,
    role,
    full_name,
    first_name,
    last_name,
    account_type,
    student_id,
    school,
    course,
    year_level,
    birthday,
    age,
    address,
    contact_number,
    required_hours
  )
  VALUES (
    NEW.id,
    NEW.email,
    '', -- Empty - Supabase Auth handles passwords
    'STUDENT', -- Default role
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'account_type', 'Training'),
    COALESCE(NEW.raw_user_meta_data->>'student_id', ''),
    COALESCE(NEW.raw_user_meta_data->>'school', ''),
    COALESCE(NEW.raw_user_meta_data->>'course', ''),
    COALESCE((NEW.raw_user_meta_data->>'year_level')::INTEGER, 1),
    COALESCE((NEW.raw_user_meta_data->>'birthday')::DATE, NULL),
    COALESCE((NEW.raw_user_meta_data->>'age')::INTEGER, NULL),
    COALESCE(NEW.raw_user_meta_data->>'address', ''),
    COALESCE(NEW.raw_user_meta_data->>'contact_number', ''),
    COALESCE((NEW.raw_user_meta_data->>'required_hours')::INTEGER, 0)
  )
  ON CONFLICT (id) DO NOTHING; -- Prevent duplicates

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users INSERT
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ojt_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile" ON users FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Allow profile creation during registration" ON users FOR INSERT WITH CHECK (
  -- Allow if authenticated user matches
  auth.uid() = id 
  OR
  -- Allow if called from trigger (bypass RLS for system operations)
  current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
);
CREATE POLICY "Admins can view all users" ON users FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "Admins can update all users" ON users FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN')
);

-- Programs policies
CREATE POLICY "Anyone can view published programs" ON programs FOR SELECT USING (status = 'Published');
CREATE POLICY "Admins can manage programs" ON programs FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN')
);

-- Opportunities policies
CREATE POLICY "Anyone can view published opportunities" ON opportunities FOR SELECT USING (status = 'Published');
CREATE POLICY "Admins can manage opportunities" ON opportunities FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN')
);

-- Applications policies
CREATE POLICY "Users can view own applications" ON applications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create applications" ON applications FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own applications" ON applications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admins can view all applications" ON applications FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "Admins can update all applications" ON applications FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN')
);

-- OJT Records policies
CREATE POLICY "Users can view own OJT records" ON ojt_records FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Admins can manage OJT records" ON ojt_records FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN')
);

-- Attendance policies
CREATE POLICY "Users can view own attendance" ON attendance FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Users can create own attendance" ON attendance FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "Users can update own attendance" ON attendance FOR UPDATE USING (student_id = auth.uid());
CREATE POLICY "Admins can manage all attendance" ON attendance FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN')
);

-- Daily Reports policies
CREATE POLICY "Users can view own reports" ON daily_reports FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Users can create own reports" ON daily_reports FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "Users can update own reports" ON daily_reports FOR UPDATE USING (student_id = auth.uid());
CREATE POLICY "Admins can manage all reports" ON daily_reports FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN')
);

-- Requirements policies
CREATE POLICY "Users can view own requirements" ON requirements FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Users can create own requirements" ON requirements FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "Users can update own requirements" ON requirements FOR UPDATE USING (student_id = auth.uid());
CREATE POLICY "Admins can manage all requirements" ON requirements FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN')
);

-- Certificates policies
CREATE POLICY "Users can view own certificates" ON certificates FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Admins can manage certificates" ON certificates FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN')
);

-- Announcements policies
CREATE POLICY "Anyone can view published announcements" ON announcements FOR SELECT USING (status = 'Published');
CREATE POLICY "Admins can manage announcements" ON announcements FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN')
);

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admins can create notifications" ON notifications FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN')
);

-- Settings policies
CREATE POLICY "Anyone can view settings" ON settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage settings" ON settings FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN')
);

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- View: Student Dashboard Summary
CREATE OR REPLACE VIEW student_dashboard_summary AS
SELECT 
  u.id as student_id,
  u.full_name,
  COUNT(DISTINCT a.id) as total_applications,
  COUNT(DISTINCT CASE WHEN a.status = 'Approved' THEN a.id END) as approved_applications,
  COUNT(DISTINCT ojt.id) as active_ojt,
  COALESCE(SUM(ojt.completed_hours), 0) as total_hours_completed,
  COALESCE(SUM(ojt.required_hours), 0) as total_hours_required
FROM users u
LEFT JOIN applications a ON u.id = a.user_id
LEFT JOIN ojt_records ojt ON u.id = ojt.student_id AND ojt.status = 'Active'
WHERE u.role = 'STUDENT'
GROUP BY u.id, u.full_name;

-- View: Admin Dashboard Stats
CREATE OR REPLACE VIEW admin_dashboard_stats AS
SELECT
  (SELECT COUNT(*) FROM users WHERE role = 'STUDENT') as total_students,
  (SELECT COUNT(*) FROM applications WHERE status IN ('Applied', 'Under Review', 'Interview')) as pending_applications,
  (SELECT COUNT(*) FROM ojt_records WHERE status = 'Active') as active_ojt_students,
  (SELECT COUNT(*) FROM opportunities WHERE status = 'Published') as published_opportunities,
  (SELECT COUNT(*) FROM programs WHERE status = 'Published') as published_programs,
  (SELECT COUNT(*) FROM attendance WHERE status = 'Pending') as pending_attendance,
  (SELECT COUNT(*) FROM daily_reports WHERE status = 'Submitted') as pending_reports;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE users IS 'User accounts - both students and administrators';
COMMENT ON TABLE programs IS 'Leadership programs, summits, and training programs';
COMMENT ON TABLE opportunities IS 'Internships, OJT positions, workshops, youth programs, and community activities';
COMMENT ON TABLE applications IS 'Student applications to programs and opportunities';
COMMENT ON TABLE ojt_records IS 'OJT progress tracking and details';
COMMENT ON TABLE attendance IS 'Daily attendance records for OJT students';
COMMENT ON TABLE daily_reports IS 'Daily work reports and accomplishments';
COMMENT ON TABLE requirements IS 'Document submissions and requirements';
COMMENT ON TABLE certificates IS 'Generated certificates for program/OJT completion';
COMMENT ON TABLE announcements IS 'System-wide announcements and news';
COMMENT ON TABLE notifications IS 'User-specific notifications';
COMMENT ON TABLE settings IS 'Application settings and configurations';

-- ============================================
-- END OF SCHEMA
-- ============================================
