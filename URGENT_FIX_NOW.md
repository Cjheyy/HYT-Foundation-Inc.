# 🚨 URGENT FIX - RLS Policy Blocking Registration

## ❌ Problem:
"new row violates row-level security policy for table users"

**Meaning**: Supabase RLS is blocking registration kasi walang permission to INSERT new users.

---

## ✅ SOLUTION (1 minute):

### Step 1: Go to Supabase SQL Editor
👉 https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/editor

### Step 2: Copy-Paste this SQL

```sql
-- Allow user registration
DROP POLICY IF EXISTS "Allow user registration" ON users;

CREATE POLICY "Allow user registration" ON users
FOR INSERT
WITH CHECK (true);
```

### Step 3: Click "Run"

### Step 4: Try Register Again

Should work na! ✅

---

## 🎯 What This Does:

- Allows ANYONE to insert (register) into users table
- Still protects viewing/updating with existing RLS
- Only affects INSERT operation

---

## 📝 Alternative: Disable RLS (Not recommended pero mabilis)

If ayaw pa rin:

```sql
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
```

**WARNING**: This removes all protection! Use only for testing!

---

## ✅ After Fix:

1. Register new account
2. Should successfully create user
3. Should redirect to dashboard
4. Should see data from Supabase

---

**RUN THE SQL NOW!** 🔥
