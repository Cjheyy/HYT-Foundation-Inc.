# 🎯 EASIEST WAY: Create User via Supabase Dashboard

Boss, instead of SQL, gamitin yung Supabase UI - mas madali!

---

## ✅ Method 1: Use Supabase Dashboard (EASIEST - 1 minute)

### Step 1: Create Auth User
1. Go to: https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/auth/users

2. Click **"Invite"** or **"Add user"** button

3. Select **"Create new user"**

4. Fill in:
   ```
   Email: demo@hyt.com
   Password: demo123
   Auto Confirm User: ✅ YES (check this!)
   ```

5. Click **"Create user"**

6. **COPY THE USER ID** (looks like: `a1b2c3d4-1234-...`)

### Step 2: Add to users Table
1. Go to: https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/editor

2. Click on **"users"** table

3. Click **"Insert row"** button

4. Fill in (copy-paste mo lang):
   ```
   id: PASTE_THE_USER_ID_FROM_STEP_1
   email: demo@hyt.com
   password_hash: hashed
   role: STUDENT
   full_name: Demo Student
   first_name: Demo
   last_name: Student
   account_type: Training
   student_id: 2024-001
   school: Test University
   course: Computer Science
   year_level: 4th Year
   birthday: 2000-01-01
   age: 24
   address: Metro Manila
   contact_number: +63 912 345 6789
   ```

5. Click **"Save"**

### Step 3: Login!
1. Go to your website
2. Login with:
   - Email: `demo@hyt.com`
   - Password: `demo123`
   - Account Type: Training
3. ✅ SUCCESS!

---

## ✅ Method 2: Run SQL (if Method 1 doesn't work)

1. Go to SQL Editor: https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/editor

2. Copy the contents of `CREATE_AUTH_USER.sql`

3. Paste and **Run**

4. Login with `demo@hyt.com` / `demo123`

---

## ⚠️ Important Notes:

**Why "Invalid login credentials"?**
- Seed data creates entries in `users` table only
- But Supabase Auth needs user in `auth.users` table too
- Both tables must have the same user!

**The Fix:**
- Create user sa Authentication UI (auth.users)
- Then add same user sa users table (public.users)
- Both IDs must match!

---

## 🎯 Quick Check:

After creating user, verify:

1. **Authentication**: https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/auth/users
   - Should see `demo@hyt.com` with green "Confirmed" badge

2. **users Table**: https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/editor
   - Should see row with same email

3. **Test Login**: Website → demo@hyt.com / demo123 → ✅

---

**Pinaka-easy: Method 1 via Dashboard UI!** 👆
