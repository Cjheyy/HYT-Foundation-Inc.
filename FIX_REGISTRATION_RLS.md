# 🔧 Fix Registration Error - RLS Policy Update

## Problem
Registration fails with: `new row violates row-level security policy for table "users"`

## Root Cause
The RLS policy for INSERT on `users` table is missing `TO authenticated` clause, so authenticated users can't insert their own profile after `supabase.auth.signUp()`.

## ✅ Solution

### Step 1: Update RLS Policies in Supabase

1. Go to Supabase SQL Editor:
   👉 https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/editor

2. Click **"New Query"**

3. Copy and paste this SQL:

```sql
-- Drop old policies
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile during registration" ON users;

-- Create new policies with TO authenticated
CREATE POLICY "Users can view own profile" ON users 
  FOR SELECT 
  TO authenticated 
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users 
  FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile during registration" ON users 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = id);
```

4. Click **"Run"** ▶️

5. ✅ Done! You should see "Success. No rows returned"

---

### Step 2: Test Registration

1. Go to your website registration page
2. Fill in the form with test data:
   - Email: `test@example.com`
   - Password: `test123456`
   - Full name: `Test User`
   - Account Type: `Training`
   - Fill other required fields
3. Click Register
4. ✅ Should see: "🎉 Registration successful! You can now login."
5. Try logging in with the new account

---

## What Changed?

### Before (Broken):
```sql
CREATE POLICY "Users can insert own profile during registration" ON users 
  FOR INSERT 
  WITH CHECK (auth.uid() = id);
```
❌ Missing `TO authenticated` - policy didn't apply to authenticated users

### After (Fixed):
```sql
CREATE POLICY "Users can insert own profile during registration" ON users 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = id);
```
✅ Explicitly allows authenticated users to insert their own profile

---

## How Registration Works Now:

1. User fills registration form
2. `supabase.auth.signUp()` creates Auth user → **user is now authenticated**
3. Code gets `authData.user.id` from Supabase Auth
4. Code inserts profile into `public.users` with `id: authData.user.id`
5. RLS checks: `auth.uid() = id` → ✅ Passes because authenticated user ID matches
6. Profile created successfully!
7. Toast notification: "🎉 Registration successful!"

---

## Security Notes:

✅ **Secure**: Users can only insert their own profile (WHERE auth.uid() = id)  
✅ **No bypass**: RLS stays enabled  
✅ **No public access**: Only authenticated users can insert  
✅ **UUID validation**: Uses Supabase Auth UUID, not user-provided ID

---

## Verification Checklist:

After running the SQL above:

- [ ] Registration page works
- [ ] New user is created in Auth Users
- [ ] New row is created in `users` table
- [ ] Login works with new account
- [ ] No "row-level security policy" error
- [ ] Existing users can still login
- [ ] Toast notifications appear correctly

---

## Troubleshooting:

**If registration still fails:**

1. Check Supabase logs:
   👉 https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/logs/postgres-logs

2. Verify policy exists:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'users';
   ```

3. Check if user was created in Auth:
   👉 https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/auth/users

4. If Auth user exists but no profile, manually delete and re-register

---

**Ready to run? Just copy the SQL above and run it in Supabase!** 🚀
