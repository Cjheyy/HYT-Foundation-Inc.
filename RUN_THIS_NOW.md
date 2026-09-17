# ✅ SCHEMA ALREADY EXISTS! Now Add Users

Boss, yung error "users already exists" is GOOD NEWS! Meaning na-create na yung tables! 🎉

---

## 🎯 NEXT STEP: Run Seed Data (Create Demo Users)

### **Go to Supabase SQL Editor:**
👉 https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/editor

### **Copy THIS SQL instead:**

```sql
-- Create demo users directly in auth.users first
-- This will trigger our function to create profiles automatically

-- Demo Admin
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'admin@hyt-foundation.org',
  crypt('admin123', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"HYT Administrator","role":"ADMIN"}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
);

-- Demo Student 1 (Training)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'b0000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'christian.jay@hyt-demo.com',
  crypt('demo123', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Christian Jay Mabbayad","account_type":"Training","student_id":"2022-00123-QC-0","school":"Quezon City University","course":"BSIT","year_level":"4","age":21}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
);

-- Now insert into public.users (bypassing RLS with admin user)
INSERT INTO public.users (
  id, email, password_hash, role, full_name, first_name, last_name,
  account_type, student_id, school, course, year_level, age,
  created_at, updated_at
) VALUES
  (
    'a0000000-0000-0000-0000-000000000001',
    'admin@hyt-foundation.org',
    '',
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
    NOW(),
    NOW()
  ),
  (
    'b0000000-0000-0000-0000-000000000001',
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
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- Add sample announcements
INSERT INTO announcements (title, content, category, priority, status, published_at, created_at)
VALUES
  ('Welcome to HYT Foundation!', 'We are excited to have you join our community!', 'General', 'High', 'Published', NOW(), NOW()),
  ('New Opportunities Available', 'Check out our latest internship and OJT opportunities!', 'Opportunities', 'Medium', 'Published', NOW(), NOW())
ON CONFLICT DO NOTHING;
```

### **Click "Run"**

---

## ✅ After Running:

You'll have 2 demo accounts:

**Admin:**
- Email: `admin@hyt-foundation.org`
- Password: `admin123`

**Student (Training):**
- Email: `christian.jay@hyt-demo.com`
- Password: `demo123`

---

## 🎯 Test Login:

1. Go back to your website: http://localhost:3000
2. Click "Login as Student (Demo)"
3. Should successfully login! ✅
4. Should redirect to student dashboard! 🎉

---

## ⚠️ If You Get Errors:

**Error about auth.users:**
Just run the public.users INSERT part only (the second half after "-- Now insert into public.users")

**Error about unique constraint:**
Users already exist! Just try logging in with the credentials above.

---

**Run that SQL and you're DONE!** 🚀
