-- ============================================
-- HYT FOUNDATION SEED DATA
-- Initial data for testing and demo purposes
-- ============================================

-- Note: Passwords should be hashed using Supabase Auth
-- For demo purposes, we'll insert users with plaintext passwords
-- In production, use Supabase Auth signup

-- ============================================
-- DEMO USERS
-- ============================================

-- Demo Admin User
INSERT INTO users (id, email, password_hash, role, full_name, first_name, last_name, created_at)
VALUES 
('a0000000-0000-0000-0000-000000000001', 'admin@hyt-foundation.org', '$2a$10$placeholder', 'ADMIN', 'HYT Administrator', 'HYT', 'Administrator', NOW());

-- Demo Student 1 (Training/Trainee)
INSERT INTO users (
  id, email, password_hash, role, full_name, first_name, last_name,
  student_id, account_type, school, course, year_level, birthday, age,
  address, contact_number, profile_picture, created_at
)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'christian.jay@hyt-demo.com',
  '$2a$10$placeholder',
  'STUDENT',
  'Christian Jay Mabbayad',
  'Christian Jay',
  'Mabbayad',
  '2022-00123-QC-0',
  'Training',
  'Quezon City University',
  'BSIT',
  '4th Year',
  '2005-03-15',
  21,
  'Brgy. Commonwealth, Quezon City, Metro Manila',
  '+63 912 345 6789',
  NULL,
  '2024-01-15 08:00:00+00'
);

-- Demo Student 2 (OJT Student)
INSERT INTO users (
  id, email, password_hash, role, full_name, first_name, last_name,
  student_id, account_type, school, course, year_level, birthday, age,
  address, contact_number, required_hours, profile_picture, created_at
)
VALUES (
  'b0000000-0000-0000-0000-000000000002',
  'maria.santos@hyt-demo.com',
  '$2a$10$placeholder',
  'STUDENT',
  'Maria Clara Santos',
  'Maria Clara',
  'Santos',
  '21-2021-456',
  'OJT Student',
  'University of Santo Tomas',
  'BSCS',
  '3rd Year',
  '2006-07-22',
  20,
  'Brgy. Batasan Hills, Quezon City, Metro Manila',
  '+63 917 654 3210',
  486,
  NULL,
  '2024-02-10 09:00:00+00'
);

-- ============================================
-- DEMO ANNOUNCEMENTS
-- ============================================

INSERT INTO announcements (id, title, content, category, priority, status, published_at, created_by, created_at)
VALUES
('c0000000-0000-0000-0000-000000000001', 'Welcome to HYT Foundation Platform', 'We are excited to have you join the HYT Foundation community. Explore opportunities, apply to programs, and start your development journey today!', 'General', 'High', 'Published', NOW(), 'a0000000-0000-0000-0000-000000000001', NOW()),
('c0000000-0000-0000-0000-000000000002', 'New IT Internship Opportunities Available', 'We have new IT internship positions available with partner companies. Check the Opportunities page and apply now!', 'Opportunities', 'Medium', 'Published', NOW(), 'a0000000-0000-0000-0000-000000000001', NOW());

-- ============================================
-- SAMPLE PROGRAM
-- ============================================

INSERT INTO programs (
  id, title, description, objectives, category, thrusts,
  schedule, location, setup, requirements, available_slots,
  application_deadline, status, created_at
)
VALUES (
  'd0000000-0000-0000-0000-000000000001',
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
);

-- ============================================
-- NOTE: Opportunities data will be loaded from dummy data
-- The dummyOpportunities in opportunitiesData.js should be
-- converted to SQL INSERT statements. Here's the structure:
-- ============================================

-- Example Opportunity (you'll need to add all 24 from your dummyOpportunities)
INSERT INTO opportunities (
  id, title, organization, description, objectives, category, thrusts,
  location, setup, schedule, duration, required_hours, requirements,
  available_slots, application_deadline, status, created_at
)
VALUES (
  'e0000000-0000-0000-0000-000000000001',
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
  '2026-10-30',
  'Published',
  NOW()
);

-- Add more opportunities here (copy from your dummyOpportunities array)
-- For brevity, I'm not adding all 24, but you should convert them all

-- ============================================
-- DEMO APPLICATIONS
-- ============================================

INSERT INTO applications (
  id, user_id, opportunity_id, type, status,
  applied_at, reviewed_at, reviewed_by, notes
)
VALUES
('f0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'opportunity', 'Approved', '2026-08-15 09:00:00+00', '2026-08-18 11:00:00+00', 'a0000000-0000-0000-0000-000000000001', 'Strong technical background. Approved for internship.');

-- ============================================
-- DEMO OJT RECORD
-- ============================================

INSERT INTO ojt_records (
  id, student_id, opportunity_id, status,
  start_date, end_date, required_hours, completed_hours,
  workplace, supervisor, supervisor_email, supervisor_phone,
  created_at
)
VALUES (
  'g0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000001',
  'Active',
  '2026-09-01',
  '2027-01-15',
  486,
  120,
  'HYT Foundation Office - Technology Unit',
  'Engr. Maria Santos',
  'maria.santos@hyt-foundation.org',
  '+63 917 123 4567',
  NOW()
);

-- ============================================
-- DEMO ATTENDANCE (Last 5 days)
-- ============================================

INSERT INTO attendance (
  id, student_id, ojt_id, date, time_in, time_out,
  location_lat, location_lng, status, hours_worked, notes,
  verified_by, verified_at
)
VALUES
('h0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'g0000000-0000-0000-0000-000000000001', '2026-09-10', '08:15:00', '17:10:00', 14.6760, 121.0437, 'Verified', 8, 'Completed React component training', 'a0000000-0000-0000-0000-000000000001', NOW()),
('h0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'g0000000-0000-0000-0000-000000000001', '2026-09-11', '08:05:00', '17:15:00', 14.6760, 121.0437, 'Verified', 8, 'Worked on database schema design', 'a0000000-0000-0000-0000-000000000001', NOW()),
('h0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'g0000000-0000-0000-0000-000000000001', '2026-09-12', '08:20:00', '17:05:00', 14.6760, 121.0437, 'Verified', 8, 'API development and testing', 'a0000000-0000-0000-0000-000000000001', NOW()),
('h0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'g0000000-0000-0000-0000-000000000001', '2026-09-13', '08:10:00', '17:20:00', 14.6760, 121.0437, 'Verified', 8, 'Code review and documentation', 'a0000000-0000-0000-0000-000000000001', NOW()),
('h0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'g0000000-0000-0000-0000-000000000001', '2026-09-16', '08:00:00', NULL, 14.6760, 121.0437, 'Pending', 0, NULL, NULL, NULL);

-- ============================================
-- DEMO DAILY REPORTS
-- ============================================

INSERT INTO daily_reports (
  id, student_id, ojt_id, date,
  tasks_completed, skills_learned, challenges, notes,
  status, created_at
)
VALUES
('i0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'g0000000-0000-0000-0000-000000000001', '2026-09-10', 'Completed user authentication module setup. Implemented login and registration forms.', 'React Hooks (useState, useEffect), Form validation, API integration', 'Had issues with CORS configuration, resolved with supervisor help.', 'Productive day, learned a lot about React best practices.', 'Submitted', NOW()),
('i0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'g0000000-0000-0000-0000-000000000001', '2026-09-11', 'Designed database schema for user management system. Created ERD diagram.', 'Database normalization, PostgreSQL, Entity relationships', 'Complex relationships between tables required multiple revisions.', 'Gained confidence in database design.', 'Reviewed', NOW());

-- ============================================
-- DEMO SETTINGS
-- ============================================

INSERT INTO settings (key, value, category, description)
VALUES
('system_name', '"HYT Foundation Platform"'::jsonb, 'general', 'Application name'),
('default_required_hours', '486'::jsonb, 'ojt', 'Default OJT required hours'),
('attendance_geofence_radius', '100'::jsonb, 'attendance', 'Geofence radius in meters for attendance'),
('max_file_upload_size', '5242880'::jsonb, 'files', 'Maximum file upload size in bytes (5MB)');

-- ============================================
-- END OF SEED DATA
-- ============================================

-- Note: Remember to:
-- 1. Hash passwords properly using Supabase Auth
-- 2. Convert all 24 opportunities from dummyOpportunities to INSERT statements
-- 3. Update UUIDs as needed
-- 4. Test all foreign key relationships
