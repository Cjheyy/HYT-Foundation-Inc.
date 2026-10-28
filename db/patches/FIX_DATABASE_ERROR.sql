-- ============================================
-- FIX for 500 Error: Disable RLS temporarily
-- Run this sa Supabase SQL Editor
-- ============================================

-- Disable RLS on users table temporarily para mag-work registration
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Drop existing policies if meron
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;
DROP POLICY IF EXISTS "Enable insert for registration" ON users;

-- Enable RLS ulit
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create SIMPLE policies
CREATE POLICY "Allow public registration"
  ON users FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Users can view own data"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- ============================================
-- After running this, try register again!
-- ============================================
