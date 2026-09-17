# 🚨 URGENT FIX - 500 Error Solution

Boss, yung error na "500 Internal Server Error" is from database RLS policies blocking everything!

---

## ✅ STEP 1: Fix Database (1 minute)

### Go to Supabase SQL Editor:
https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/sql/new

### Copy and paste `FIX_DATABASE_ERROR.sql`:

```sql
-- Disable RLS temporarily
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Drop old policies
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
```

### Click "RUN" button sa SQL Editor

---

## ✅ STEP 2: Add Correct Anon Key sa `.env`

### Go to:
https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/settings/api

### Find "anon public" key (starts with eyJ...)

### Update `.env`:
```env
REACT_APP_SUPABASE_URL=https://qlulnldctvcjlzflpupe.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGci...  # PASTE HERE
```

**NOT** the `sb_publishable_...` key!

---

## ✅ STEP 3: Restart Server

```bash
# Stop (Ctrl+C)
npm start
```

---

## What I Fixed:

1. ✅ Removed demo account buttons from Login
2. ✅ Fixed login to use async Supabase auth
3. ✅ Created SQL fix for RLS policies
4. ✅ Better error messages

---

## After fixing both:

1. Try to **Register** a new account
2. Or login with existing account
3. Should work na!

The 500 error is from RLS blocking INSERT/SELECT operations. Once you run the SQL fix, tapos na yan!
