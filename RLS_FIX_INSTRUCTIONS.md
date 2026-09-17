# 🔧 RLS REGISTRATION FIX - INSTRUCTIONS

## ❌ PROBLEM IDENTIFIED

**Root Cause**: The `users` table has NO INSERT policy for authenticated users.

Current policies on `users` table:
- ✅ SELECT policy (users can view own profile)
- ✅ UPDATE policy (users can update own profile)
- ❌ **MISSING INSERT policy** ← This is the issue!
- ✅ Admin SELECT policy
- ✅ Admin UPDATE policy

**Why registration failed**:
1. User submits registration form
2. Supabase Auth creates authentication account ✅
3. `authService.js` tries to INSERT profile into `users` table ❌
4. RLS blocks the INSERT because no policy allows it
5. Error: "new row violates row-level security policy for table 'users'"

---

## ✅ SOLUTION

Add an INSERT policy that allows authenticated users to create ONLY their own profile.

**Policy Logic**:
```sql
auth.uid() = id
```

This means:
- ✅ User can INSERT a row where `users.id` equals their authenticated `auth.uid()`
- ❌ User CANNOT INSERT a row for a different user ID
- ❌ Unauthenticated users CANNOT INSERT at all

**Security**: This policy maintains security while allowing registration.

---

## 🚀 HOW TO APPLY THE FIX

### Step 1: Go to Supabase SQL Editor
👉 https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/editor

### Step 2: Create New Query
Click **"+ New query"** button

### Step 3: Copy and Paste This SQL
```sql
CREATE POLICY "Users can insert own profile during registration" 
ON users 
FOR INSERT 
WITH CHECK (auth.uid() = id);
```

### Step 4: Run the Query
Click **"Run"** or press `Ctrl+Enter`

### Step 5: Verify Success
You should see: ✅ Success. No rows returned

---

## ✅ VERIFICATION (Optional)

Run this to confirm the policy was created:

```sql
SELECT policyname, cmd, with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
  AND cmd = 'INSERT';
```

Expected result:
```
policyname: "Users can insert own profile during registration"
cmd: INSERT
with_check: (auth.uid() = id)
```

---

## 🧪 TEST REGISTRATION AFTER FIX

1. Go to your website's Register page
2. Fill in registration form:
   - Email: `test@example.com`
   - Password: `Test123!`
   - Full Name: `Test User`
   - Student ID: `2024-001`
   - Account Type: `Training`
   - School: `Test School`
   - (fill other required fields)
3. Click **"Register"**
4. Expected: ✅ "Registration successful! You can now login."
5. Go to Login page
6. Login with `test@example.com` / `Test123!`
7. Expected: ✅ Redirect to Student Dashboard

---

## 📋 WHAT WAS CHANGED

### Files Modified:
1. ✅ `supabase-schema.sql` - Added INSERT policy (for future reference)
2. ✅ `FIX_RLS_REGISTRATION.sql` - Standalone fix SQL (ready to run)
3. ❌ `authService.js` - NO CHANGES NEEDED (already correct!)

### Database Changes:
- Added 1 new RLS policy on `users` table
- Policy name: "Users can insert own profile during registration"
- Policy type: INSERT
- Policy check: `auth.uid() = id`

---

## 🔍 HOW THE REGISTRATION FLOW WORKS NOW

### Before Fix (FAILED):
```
User submits form
  ↓
supabase.auth.signUp() ✅ (creates auth user)
  ↓
authData.user.id obtained ✅
  ↓
INSERT into users table ❌ (blocked by RLS - no INSERT policy)
  ↓
ERROR: "new row violates row-level security policy"
```

### After Fix (SUCCESS):
```
User submits form
  ↓
supabase.auth.signUp() ✅ (creates auth user)
  ↓
authData.user.id obtained ✅
  ↓
INSERT into users table ✅ (allowed by new INSERT policy)
  ↓
Profile created with users.id = auth.uid() ✅
  ↓
SUCCESS: "Registration successful!"
```

---

## 🔐 SECURITY MAINTAINED

The fix is secure because:

1. ✅ **Only authenticated users can INSERT** (must have valid auth session)
2. ✅ **Users can only INSERT their own profile** (`auth.uid() = id`)
3. ✅ **Cannot create profiles for other users** (different ID blocked)
4. ✅ **RLS still enabled** (not disabled globally)
5. ✅ **No service role key in frontend** (still using anon key)
6. ✅ **Existing login/SELECT/UPDATE policies unchanged**

---

## 📞 TROUBLESHOOTING

### If registration still fails after applying fix:

1. **Confirm policy was created**:
   ```sql
   SELECT * FROM pg_policies 
   WHERE tablename = 'users' AND cmd = 'INSERT';
   ```

2. **Confirm RLS is enabled**:
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE tablename = 'users';
   ```
   Expected: `rowsecurity = true`

3. **Check browser console** for detailed error

4. **Verify .env file** has correct Supabase URL and anon key

5. **Clear browser cache** and retry

---

## ✅ DONE!

After running the SQL, registration should work immediately. No restart required!

🎉 Users can now register successfully! 🎉
