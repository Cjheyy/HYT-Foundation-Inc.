-- ============================================
-- FIX: Allow user registration
-- Run this sa Supabase SQL Editor
-- ============================================

-- Drop old restrictive policy
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- Create new policies that allow registration
CREATE POLICY "Allow user registration" ON users
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can view own profile" ON users
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON users
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN')
);

CREATE POLICY "Admins can update all users" ON users
FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN')
);

-- ============================================
-- DONE! Now you can register new users!
-- ============================================
