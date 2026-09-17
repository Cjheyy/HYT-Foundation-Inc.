-- ============================================
-- SIMPLE USER CREATION FOR HYT FOUNDATION
-- Copy this entire file and run in Supabase SQL Editor
-- ============================================

-- Create Demo Admin
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'admin@hyt-foundation.org',
  crypt('admin123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"HYT Administrator"}',
  false,
  'authenticated'
) ON CONFLICT (email) DO NOTHING
RETURNING id;

-- Create Demo Student 1 (Training)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'christian.jay@hyt-demo.com',
  crypt('demo123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Christian Jay Mabbayad"}',
  false,
  'authenticated'
) ON CONFLICT (email) DO NOTHING
RETURNING id;

-- Create Demo Student 2 (OJT)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'maria.santos@hyt-demo.com',
  crypt('demo123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Maria Clara Santos"}',
  false,
  'authenticated'
) ON CONFLICT (email) DO NOTHING
RETURNING id;

-- Now create entries in users table
-- First, let's get the IDs we just created
DO $$
DECLARE
  admin_id uuid;
  student1_id uuid;
  student2_id uuid;
BEGIN
  -- Get admin ID
  SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@hyt-foundation.org';
  
  -- Get student IDs
  SELECT id INTO student1_id FROM auth.users WHERE email = 'christian.jay@hyt-demo.com';
  SELECT id INTO student2_id FROM auth.users WHERE email = 'maria.santos@hyt-demo.com';
  
  -- Insert admin into users table
  INSERT INTO users (
    id, email, password_hash, role, full_name, 
    first_name, last_name, created_at
  ) VALUES (
    admin_id,
    'admin@hyt-foundation.org',
    'hashed',
    'ADMIN',
    'HYT Administrator',
    'HYT',
    'Administrator',
    now()
  ) ON CONFLICT (id) DO NOTHING;
  
  -- Insert student 1 into users table
  INSERT INTO users (
    id, email, password_hash, role, full_name, 
    first_name, last_name, student_id, account_type,
    school, course, year_level, birthday, age,
    address, contact_number, created_at
  ) VALUES (
    student1_id,
    'christian.jay@hyt-demo.com',
    'hashed',
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
    now()
  ) ON CONFLICT (id) DO NOTHING;
  
  -- Insert student 2 into users table
  INSERT INTO users (
    id, email, password_hash, role, full_name,
    first_name, last_name, student_id, account_type,
    school, course, year_level, birthday, age,
    address, contact_number, required_hours, created_at
  ) VALUES (
    student2_id,
    'maria.santos@hyt-demo.com',
    'hashed',
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
    now()
  ) ON CONFLICT (id) DO NOTHING;
  
END $$;

-- Create sample announcements
INSERT INTO announcements (title, content, category, priority, status, published_at, created_by, created_at)
SELECT 
  'Welcome to HYT Foundation Platform',
  'We are excited to have you join the HYT Foundation community. Explore opportunities, apply to programs, and start your development journey today!',
  'General',
  'High',
  'Published',
  now(),
  id,
  now()
FROM users WHERE email = 'admin@hyt-foundation.org'
ON CONFLICT DO NOTHING;

INSERT INTO announcements (title, content, category, priority, status, published_at, created_by, created_at)
SELECT 
  'New IT Internship Opportunities Available',
  'We have new IT internship positions available with partner companies. Check the Opportunities page and apply now!',
  'Opportunities',
  'Medium',
  'Published',
  now(),
  id,
  now()
FROM users WHERE email = 'admin@hyt-foundation.org'
ON CONFLICT DO NOTHING;

-- Done!
SELECT 'SUCCESS! Demo users created. You can now login with:' as message
UNION ALL
SELECT '1. admin@hyt-foundation.org / admin123 (Admin)'
UNION ALL
SELECT '2. christian.jay@hyt-demo.com / demo123 (Student - Training)'
UNION ALL
SELECT '3. maria.santos@hyt-demo.com / demo123 (Student - OJT)';
