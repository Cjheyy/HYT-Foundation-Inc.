-- ============================================
-- CREATE SUPABASE AUTH USER + DATABASE USER
-- Run this in Supabase SQL Editor
-- ============================================

-- This will create a user in BOTH auth.users AND public.users tables

-- Step 1: Insert into auth.users (Supabase Authentication)
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
  role,
  aud
)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'demo@hyt.com',
  crypt('demo123', gen_salt('bf')), -- Password: demo123
  NOW(),
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Demo Student"}',
  false,
  'authenticated',
  'authenticated'
)
RETURNING id;

-- Step 2: Get the ID and insert into public.users
-- (Replace 'USER_ID_FROM_ABOVE' with the actual UUID returned)

-- For now, use a simple INSERT that will work:
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
  contact_number
)
SELECT 
  id,
  'demo@hyt.com',
  'hashed',
  'STUDENT',
  'Demo Student',
  'Demo',
  'Student',
  'Training',
  '2024-001',
  'Test University',
  'Computer Science',
  '4th Year',
  '2000-01-01',
  24,
  'Metro Manila',
  '+63 912 345 6789'
FROM auth.users 
WHERE email = 'demo@hyt.com'
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- DONE! 
-- Login with: demo@hyt.com / demo123
-- ============================================
