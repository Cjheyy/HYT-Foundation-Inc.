-- ============================================
-- HYT FOUNDATION - COMPLETE SEED DATA
-- Copy-paste this ENTIRE file to Supabase SQL Editor
-- ============================================

-- ============================================
-- DEMO USERS (with Supabase Auth)
-- ============================================

-- Note: For Supabase Auth users, you need to create them via the dashboard or API
-- But we'll insert the database records assuming auth users exist

-- Insert Demo Users into users table
INSERT INTO users (
  id, email, password_hash, role, full_name, first_name, last_name,
  student_id, account_type, school, course, year_level, birthday, age,
  address, contact_number, created_at
) VALUES
-- Admin User
('00000000-0000-0000-0000-000000000001', 'admin@hyt-foundation.org', 'hashed_password', 'ADMIN', 'HYT Administrator', 'HYT', 'Administrator', NULL, 'Admin', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW()),

-- Student 1 (Training)
('00000000-0000-0000-0000-000000000002', 'christian.jay@hyt-demo.com', 'hashed_password', 'STUDENT', 'Christian Jay Mabbayad', 'Christian Jay', 'Mabbayad', '2022-00123-QC-0', 'Training', 'Quezon City University', 'BSIT', '4th Year', '2005-03-15', 21, 'Brgy. Commonwealth, Quezon City, Metro Manila', '+63 912 345 6789', '2024-01-15 08:00:00+00'),

-- Student 2 (OJT Student)
('00000000-0000-0000-0000-000000000003', 'maria.santos@hyt-demo.com', 'hashed_password', 'STUDENT', 'Maria Clara Santos', 'Maria Clara', 'Santos', '21-2021-456', 'OJT Student', 'University of Santo Tomas', 'BSCS', '3rd Year', '2006-07-22', 20, 'Brgy. Batasan Hills, Quezon City, Metro Manila', '+63 917 654 3210', '2024-02-10 09:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- ANNOUNCEMENTS
-- ============================================
INSERT INTO announcements (id, title, content, category, priority, status, published_at, created_by, created_at) VALUES
('a0000000-0000-0000-0000-000000000001', 'Welcome to HYT Foundation Platform', 'We are excited to have you join the HYT Foundation community. Explore opportunities, apply to programs, and start your development journey today!', 'General', 'High', 'Published', NOW(), '00000000-0000-0000-0000-000000000001', NOW()),
('a0000000-0000-0000-0000-000000000002', 'New IT Internship Opportunities Available', 'We have new IT internship positions available with partner companies. Check the Opportunities page and apply now!', 'Opportunities', 'Medium', 'Published', NOW(), '00000000-0000-0000-0000-000000000001', NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- PROGRAMS
-- ============================================
INSERT INTO programs (
  id, title, description, objectives, category, thrusts,
  schedule, location, setup, requirements, available_slots,
  application_deadline, status, created_at
) VALUES (
  'p0000000-0000-0000-0000-000000000001',
  'Youth Leadership Summit 2026',
  'A comprehensive leadership development program for young aspiring leaders.',
  '["Develop leadership competencies", "Build networks with fellow youth leaders", "Create actionable community projects"]'::jsonb,
  'Leadership',
  '["Empowerment", "Enlightenment"]'::jsonb,
  'November 15-17, 2026',
  'HYT Foundation Center',
  'On-site',
  '["Valid ID", "Registration Form"]'::jsonb,
  50,
  '2026-11-01',
  'Published',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- OPPORTUNITIES
-- ============================================
INSERT INTO opportunities (
  id, title, organization, description, objectives, category, thrusts,
  location, setup, schedule, duration, required_hours, requirements,
  available_slots, application_deadline, status, created_at
) VALUES 
(
  'o0000000-0000-0000-0000-000000000001',
  'Software Development Internship',
  'Tech Solutions Inc.',
  'Gain hands-on experience in web and mobile development. Work with modern technologies and experienced mentors.',
  '["Develop web applications using React and Node.js", "Learn agile development methodologies", "Participate in code reviews and testing", "Build a portfolio project"]'::jsonb,
  'Internship',
  '["Experience", "Enhancement", "Entrepreneurship"]'::jsonb,
  'Makati City, Metro Manila',
  'Hybrid',
  'Monday to Friday, 9:00 AM - 5:00 PM',
  '3 months',
  480,
  '["Currently enrolled in IT/CS program", "Basic knowledge of programming", "Resume and cover letter", "School endorsement"]'::jsonb,
  5,
  '2026-12-31',
  'Published',
  NOW()
),
(
  'o0000000-0000-0000-0000-000000000002',
  'Creative Unit - Design & Multimedia',
  'HYT Foundation',
  'Join our Creative Unit and work on visual design, branding, animation, and multimedia projects.',
  '["Logo design and brand identity", "Animation and motion graphics", "Social media content", "Video editing"]'::jsonb,
  'OJT',
  '["Experience", "Enhancement", "Entrepreneurship"]'::jsonb,
  'Quezon City, Metro Manila',
  'Hybrid',
  'Flexible (20-40 hours/week)',
  '4-5 months',
  486,
  '["Valid School ID", "School Endorsement Letter", "Portfolio (if available)"]'::jsonb,
  5,
  '2026-12-31',
  'Published',
  NOW()
),
(
  'o0000000-0000-0000-0000-000000000003',
  'Web Development Bootcamp',
  'HYT Foundation',
  'Comprehensive training program covering HTML, CSS, JavaScript, and modern web frameworks.',
  '["Learn front-end development fundamentals", "Build responsive websites", "Introduction to React.js", "Project-based learning"]'::jsonb,
  'Training',
  '["Education", "Enhancement", "Empowerment"]'::jsonb,
  'HYT Foundation Training Center',
  'On-site',
  'Monday to Friday, 1:00 PM - 5:00 PM',
  '8 weeks',
  120,
  '["Basic computer literacy", "Own laptop", "Commitment to attend all sessions"]'::jsonb,
  25,
  '2026-12-31',
  'Published',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SETTINGS
-- ============================================
INSERT INTO settings (key, value, category, description) VALUES
('system_name', '"HYT Foundation Platform"'::jsonb, 'general', 'Application name'),
('default_required_hours', '486'::jsonb, 'ojt', 'Default OJT required hours'),
('attendance_geofence_radius', '100'::jsonb, 'attendance', 'Geofence radius in meters'),
('max_file_upload_size', '5242880'::jsonb, 'files', 'Max file upload size (5MB)')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ SEED DATA LOADED SUCCESSFULLY!';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE 'Demo Accounts Created:';
  RAISE NOTICE '1. Admin: admin@hyt-foundation.org / admin123';
  RAISE NOTICE '2. Student (Training): christian.jay@hyt-demo.com / demo123';
  RAISE NOTICE '3. Student (OJT): maria.santos@hyt-demo.com / demo123';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE 'NOTE: You need to create auth users separately in Supabase Auth';
  RAISE NOTICE 'or use the Register page to create accounts.';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;
