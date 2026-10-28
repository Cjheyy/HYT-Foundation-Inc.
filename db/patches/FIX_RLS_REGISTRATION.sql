-- ============================================
-- FIX: Add INSERT policy for users table
-- ============================================
-- This allows authenticated users to create their own profile during registration
-- Security: Users can ONLY insert their own profile (auth.uid() = id)
-- This prevents users from creating profiles for other user IDs

CREATE POLICY "Users can insert own profile during registration" 
ON users 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- ============================================
-- VERIFICATION QUERIES (Run these after to confirm)
-- ============================================

-- 1. Check that RLS is enabled on users table
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'users';
-- Expected: rowsecurity = true

-- 2. List all policies on users table
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'users'
ORDER BY policyname;
-- Expected: Should show 5 policies including the new INSERT policy

-- 3. Test the policy (optional - only run if you want to test)
-- This should succeed (inserting own profile):
-- INSERT INTO users (id, email, password_hash, role, full_name, account_type)
-- VALUES (auth.uid(), 'test@example.com', '', 'STUDENT', 'Test User', 'Training');

-- This should fail (inserting different user ID):
-- INSERT INTO users (id, email, password_hash, role, full_name, account_type)
-- VALUES ('00000000-0000-0000-0000-000000000000', 'test2@example.com', '', 'STUDENT', 'Test User 2', 'Training');
