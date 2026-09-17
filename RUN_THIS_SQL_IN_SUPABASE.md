# 🚨 CRITICAL: Run This SQL in Supabase

## Step 1: Open Supabase SQL Editor

👉 Go to: https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/sql/new

## Step 2: Copy and Paste This SQL

```sql
-- Add INSERT policy for users table to allow self-registration
CREATE POLICY "Users can insert own profile during registration" 
ON users 
FOR INSERT 
WITH CHECK (auth.uid() = id);
```

## Step 3: Click "Run" Button

## Step 4: Verify the Fix

Run this query to see all policies on users table:

```sql
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual, 
  with_check
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;
```

You should see:
- ✅ Users can view own profile (SELECT)
- ✅ Users can update own profile (UPDATE)
- ✅ **Users can insert own profile during registration (INSERT)** ← NEW!
- ✅ Admins can view all users (SELECT)
- ✅ Admins can update all users (UPDATE)

---

## What This Fixes

**Before**: Registration created Auth user but couldn't create profile → 401 Unauthorized

**After**: Registration creates both Auth user AND profile → Success! 🎉

---

## Test After Running SQL

1. Go to Register page
2. Fill in form
3. Click Register
4. ✅ Should show: "🎉 Registration successful! You can now login."
5. Check Supabase:
   - Authentication → Users (Auth user exists)
   - Table Editor → users (Profile exists with same ID)
6. Login with new account
7. ✅ Should redirect to dashboard with data!

---

**BOSS: Run this SQL now then test registration!** 🚀
