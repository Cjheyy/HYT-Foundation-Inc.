# 🎯 FINAL SETUP - Create Your First User

Boss, the connection is **WORKING PERFECTLY!** ✅

The error "Invalid login credentials" just means walang pa user sa database. Follow this:

---

## 🚀 EASIEST METHOD: Create User via Supabase Dashboard (1 minute)

### Step 1: Create Auth User (in Supabase Authentication)

1. Open this link:
   👉 **https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/auth/users**

2. Click the **"Add user"** button (or "Invite" button)

3. Select **"Create new user"**

4. Fill in these details:
   ```
   Email: demo@hyt.com
   Password: demo123
   Auto Confirm User: ✅ YES (IMPORTANT: Check this box!)
   ```

5. Click **"Create user"**

6. **⚠️ IMPORTANT: Copy the User ID!**
   - After creating, you'll see a user with UUID like: `a1b2c3d4-5678-90ab-cdef-1234567890ab`
   - COPY this ID! (Click to copy)

### Step 2: Add to users Table (in Database Editor)

1. Open this link:
   👉 **https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/editor/17579**

2. Click on **"users"** table (left sidebar)

3. Click **"Insert"** button → **"Insert row"**

4. Fill in these fields (EXACT VALUES):
   ```
   id: [PASTE THE USER ID FROM STEP 1]
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

### Step 3: Test Login! 🎉

1. Go to your website: **http://localhost:3002**

2. Click **"Login"**

3. Fill in:
   ```
   Account Type: Select "Trainee" (Training)
   Email: demo@hyt.com
   Password: demo123
   ```

4. Click **"Login"**

5. ✅ **SUCCESS!** Should redirect to Student Dashboard!

---

## 📋 Quick Verification Checklist

Before login, verify these:

### ✅ Check Authentication (auth.users)
1. Go to: https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/auth/users
2. Should see: `demo@hyt.com` with green "Confirmed" badge
3. Note the User ID

### ✅ Check Database (public.users)
1. Go to: https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/editor/17579
2. Click "users" table
3. Should see row with:
   - Same email: `demo@hyt.com`
   - Same ID as auth user
   - account_type: `Training`

### ✅ Both IDs Must Match!
- Auth user ID = Database user ID
- If different, delete and recreate

---

## 🎯 What Each Part Does:

### auth.users (Supabase Authentication)
- Handles login/logout
- Manages passwords
- Creates sessions
- Email verification

### public.users (Your Database)
- Stores profile info
- Student details
- Role & permissions
- Account type

**BOTH MUST EXIST with same ID for login to work!**

---

## ⚠️ Troubleshooting

### "Invalid login credentials"
- ✅ User exists in auth.users? Check Authentication page
- ✅ Password correct? Try reset or create new user
- ✅ Email confirmed? Check "Auto Confirm" was checked

### "Access Denied! Please login as Training"
- ✅ Account type in database matches login selection?
- ✅ If logging as Trainee, database should have `account_type: Training`

### "User profile not found"
- ✅ User exists in public.users table?
- ✅ ID matches auth user?
- ✅ Re-insert row with correct ID

---

## 🎉 After Successful Login:

You should see:
1. ✅ Green toast: "Login successful! Welcome Demo Student"
2. ✅ Redirect to Student Dashboard
3. ✅ See your profile in top right
4. ✅ All features working with Supabase data!

---

## 🚀 Next Steps:

1. **Test Registration**: Try creating new account via Register page
2. **Add More Users**: Create admin account, more students
3. **Test Features**: Browse programs, apply to opportunities
4. **Verify Data**: Check if data saving to Supabase

---

**Summary: Create user in TWO places (auth.users + public.users) with SAME ID!** 🔑
