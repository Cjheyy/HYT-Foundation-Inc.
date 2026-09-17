# ⚡ QUICK SETUP - 3 Minutes to Working System!

Boss, supabase connection WORKING na! Just 3 quick steps:

---

## ✅ Step 1: Load Seed Data (1 min)

1. Go to: https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/editor

2. Click **"New Query"**

3. Copy ALL contents of `COMPLETE_SEED_DATA.sql`

4. Paste and click **RUN**

5. ✅ Should see: "Success" message

---

## ✅ Step 2: Create Auth Users (2 min)

Since Supabase uses separate Auth system, create users manually:

### Go to: https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/auth/users

### Click "Add user" and create 3 accounts:

**User 1 - Admin:**
- Email: `admin@hyt-foundation.org`
- Password: `admin123`
- User ID: `00000000-0000-0000-0000-000000000001`
- Click "Create user"

**User 2 - Student (Training):**
- Email: `christian.jay@hyt-demo.com`  
- Password: `demo123`
- User ID: `00000000-0000-0000-0000-000000000002`
- Click "Create user"

**User 3 - Student (OJT):**
- Email: `maria.santos@hyt-demo.com`
- Password: `demo123`
- User ID: `00000000-0000-0000-0000-000000000003`
- Click "Create user"

**IMPORTANT:** Use the EXACT User IDs above para mag-match sa database!

---

## ✅ Step 3: Disable Email Verification (30 sec)

Para di na kailangan mag-verify ng email:

1. Go to: https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/auth/settings

2. Find "Email Auth" section

3. Toggle **OFF** the "Confirm email" option

4. Click **Save**

---

## 🎯 TEST NOW!

1. Go to: http://localhost:3000

2. Click **"Login as Student (Demo)"**

3. Should successfully login! ✅

4. Should see dashboard with data! 🎉

---

## 🔄 Alternative: Just Register

If ayaw mo mag-manual create:

1. Go to Register page
2. Fill form and create account
3. Login with that account
4. Done!

---

## ✅ What's in Seed Data:

- 3 demo users (admin, 2 students)
- 2 announcements
- 1 program
- 3 opportunities (Internship, OJT, Training)
- App settings

---

**After Step 2, login should work! Database connection is GOOD! 🚀**

Yung error "Invalid credentials" means API is working - just need users!
