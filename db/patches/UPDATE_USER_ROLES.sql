-- ============================================
-- UPDATE USER ROLES TO NEW SYSTEM
-- Run this AFTER updating schema
-- ============================================

-- This SQL script migrates existing users to the new 3-role system:
-- ADMIN, OJT/Intern, Trainee

-- Step 1: Add new role column temporarily if migrating
-- (Skip if running fresh schema)
-- ALTER TABLE users ADD COLUMN new_role VARCHAR(20);

-- Step 2: Map old roles to new roles
UPDATE users 
SET role = CASE 
  WHEN role = 'ADMIN' THEN 'ADMIN'
  WHEN role = 'STUDENT' AND account_type = 'Training' THEN 'Trainee'
  WHEN role = 'STUDENT' AND account_type = 'OJT Student' THEN 'OJT/Intern'
  WHEN role = 'STUDENT' THEN 'Trainee' -- Default students to Trainee
  ELSE role
END;

-- Step 3: Verify the migration
SELECT role, COUNT(*) as count 
FROM users 
GROUP BY role;

-- Expected output:
-- ADMIN | (count)
-- OJT/Intern | (count)
-- Trainee | (count)

-- Step 4: Update the CHECK constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('ADMIN', 'OJT/Intern', 'Trainee'));

-- Step 5: Remove old account_type constraint (keep column for backward compatibility)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_account_type_check;

-- ============================================
-- IMPORTANT: Run this in Supabase SQL Editor
-- ============================================
