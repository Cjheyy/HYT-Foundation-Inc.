-- ============================================
-- SIMPLE SEED DATA - Just Insert Users
-- Run this if schema already exists
-- ============================================

-- Insert demo users directly into public.users
-- Note: Password authentication is handled by Supabase Auth
-- These are just for database records

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
  age,
  address,
  contact_number,
  created_at, 
  updated_at
) VALUES
  -- Admin User
  (
    gen_random_uuid(),
    'admin@hyt-foundation.org',
    '',  -- Empty - Supabase Auth handles passwords
    'ADMIN',
    'HYT Administrator',
    'HYT',
    'Administrator',
    'Admin',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NOW(),
    NOW()
  ),
  -- Student User (Training)
  (
    gen_random_uuid(),
    'christian.jay@hyt-demo.com',
    '',
    'STUDENT',
    'Christian Jay Mabbayad',
    'Christian Jay',
    'Mabbayad',
    'Training',
    '2022-00123-QC-0',
    'Quezon City University',
    'BSIT',
    '4th Year',
    21,
    'Brgy. Commonwealth, Quezon City',
    '+63 912 345 6789',
    NOW(),
    NOW()
  ),
  -- Student User (OJT)
  (
    gen_random_uuid(),
    'maria.santos@hyt-demo.com',
    '',
    'STUDENT',
    'Maria Clara Santos',
    'Maria Clara',
    'Santos',
    'OJT Student',
    '21-2021-456',
    'University of Santo Tomas',
    'BSCS',
    '3rd Year',
    20,
    'Brgy. Batasan Hills, Quezon City',
    '+63 917 654 3210',
    NOW(),
    NOW()
  )
ON CONFLICT (email) DO NOTHING;

-- Add sample announcements
INSERT INTO announcements (
  title, 
  content, 
  category, 
  priority, 
  status, 
  published_at, 
  created_at
)
VALUES
  (
    'Welcome to HYT Foundation Platform',
    'We are excited to have you join the HYT Foundation community. Explore opportunities, apply to programs, and start your development journey today!',
    'General',
    'High',
    'Published',
    NOW(),
    NOW()
  ),
  (
    'New IT Internship Opportunities Available',
    'We have new IT internship positions available with partner companies. Check the Opportunities page and apply now!',
    'Opportunities',
    'Medium',
    'Published',
    NOW(),
    NOW()
  );

-- ============================================
-- IMPORTANT: After running this SQL
-- ============================================
-- You need to MANUALLY create these users in Supabase Auth:
-- 
-- 1. Go to: Authentication → Users
-- 2. Click "Add user"
-- 3. Add each user:
--    - admin@hyt-foundation.org / admin123
--    - christian.jay@hyt-demo.com / demo123
--    - maria.santos@hyt-demo.com / demo123
--
-- OR just use the Register page on your website!
-- ============================================
