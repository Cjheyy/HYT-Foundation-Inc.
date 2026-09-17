# 🧪 Test Guide: Admin User (admin.test@hyt-demo.com)

## ⚡ Quick Test - 5 Minutes

Your admin user `admin.test@hyt-demo.com` is configured in Supabase. Let's verify everything works!

---

## ✅ Test 1: Admin Login (30 seconds)

### Steps:
1. Start the dev server:
   ```bash
   cd hyt-foundation
   npm start
   ```

2. Go to: `http://localhost:3000/login`

3. **DON'T SELECT ANY CARD** ⬅️ Important!

4. Enter credentials:
   ```
   Email: admin.test@hyt-demo.com
   Password: [your password]
   ```

5. Click **"Login"**

### Expected Result:
```
✅ Toast message: "Login successful! Welcome Admin [Name]"
✅ Automatic redirect to: http://localhost:3000/admin/dashboard
✅ See AdminLayout with admin navigation sidebar
✅ See "Admin Portal" in header
✅ See dashboard content with admin stats
```

### ❌ If This Fails:
```sql
-- Check in Supabase SQL Editor:
SELECT id, email, role FROM users WHERE email = 'admin.test@hyt-demo.com';

-- Should return:
-- role = 'ADMIN' (exact case)

-- If role is wrong, fix it:
UPDATE users SET role = 'ADMIN' WHERE email = 'admin.test@hyt-demo.com';
```

---

## ✅ Test 2: Session Persistence (15 seconds)

### Steps:
1. After logging in to `/admin/dashboard`
2. Press **F5** (refresh browser)
3. Wait for page to reload

### Expected Result:
```
✅ Stay on: http://localhost:3000/admin/dashboard
✅ No redirect to login page
✅ No card selection errors
✅ Dashboard loads with all content
✅ User still logged in
```

### ❌ If This Fails:
- Check browser console for errors
- Verify Supabase URL and ANON_KEY in `.env`
- Check `auth.users` table has the user

---

## ✅ Test 3: Direct URL Access (15 seconds)

### Steps:
1. While logged in as admin
2. Click address bar
3. Type: `http://localhost:3000/admin/students`
4. Press Enter

### Expected Result:
```
✅ Navigate to /admin/students page
✅ See AdminLayout
✅ See students management page
✅ No errors or redirects
```

### Repeat for other admin routes:
- `/admin/programs`
- `/admin/opportunities`
- `/admin/applications`
- `/admin/announcements`

All should work! ✅

---

## ✅ Test 4: Admin Bypass (30 seconds)

### Steps:
1. Logout (if logged in)
2. Go to login page
3. **SELECT "TRAINEE" CARD** ⬅️ Wrong card on purpose!
4. Enter admin credentials
5. Click "Login"

### Expected Result:
```
✅ Card selection IGNORED for admin
✅ Toast: "Login successful! Welcome Admin [Name]"
✅ Redirect to /admin/dashboard
✅ No error about wrong account type
```

This proves admin bypass works! 🎉

---

## ✅ Test 5: Route Protection (1 minute)

### Setup:
Create a test OJT user or use existing one

### Steps:
1. **Logout admin** (click Logout in sidebar)
2. **Login as OJT/Intern user:**
   - Select "OJT Student" card
   - Enter OJT user credentials
3. Should redirect to `/student/dashboard`
4. In address bar, **manually type:**
   ```
   http://localhost:3000/admin/dashboard
   ```
5. Press Enter

### Expected Result:
```
❌ Cannot access /admin/dashboard
✅ Automatic redirect to /student/dashboard
✅ No error message (silent redirect)
✅ OJT user stays in student portal
```

### Repeat for Trainee User:
1. Login as Trainee
2. Try accessing `/admin/dashboard`
3. Should redirect to `/trainee/dashboard`

---

## ✅ Test 6: Navigation Header Button (15 seconds)

### Steps:
1. Login as admin
2. Go to home page: `http://localhost:3000`
3. Click **"Dashboard"** button in top-right header

### Expected Result:
```
✅ Navigate to /admin/dashboard
✅ Not to /student/dashboard or /trainee/dashboard
✅ Header button knows user is admin
```

---

## 🔍 Visual Checklist

When logged in as admin, you should see:

### Header:
```
┌────────────────────────────────────────┐
│ [HYT Logo]    Admin Portal  [Username] │
└────────────────────────────────────────┘
```

### Sidebar:
```
┌──────────────────────┐
│  [Admin Avatar]      │
│  Admin Name          │
│  Role: Admin         │
├──────────────────────┤
│  📊 Dashboard        │
│  👥 Students         │
│  📚 Programs         │
│  🎯 Opportunities    │
│  📝 Applications     │
│  ✓ Attendance        │
│  💼 OJT Records      │
│  📋 Daily Reports    │
│  📄 Requirements     │
│  🏆 Certificates     │
│  📢 Announcements    │
│  📊 Reports          │
├──────────────────────┤
│  🚪 Logout           │
└──────────────────────┘
```

### Dashboard Content:
```
┌──────────────────────────────────────┐
│  Welcome back, Admin!                │
│  System overview and statistics      │
├──────────────────────────────────────┤
│  [Stats Cards]                       │
│  - Total Students                    │
│  - Active Programs                   │
│  - Pending Applications              │
│  - etc.                              │
└──────────────────────────────────────┘
```

---

## 🐛 Troubleshooting

### Issue: "Invalid login credentials"
**Solution:**
1. Check email spelling: `admin.test@hyt-demo.com`
2. Verify password is correct
3. Check user exists in both:
   - `auth.users` (Supabase Authentication)
   - `public.users` (Database table)
4. IDs must match between both tables

### Issue: Redirects to /login after login
**Solution:**
1. Check `.env` file has correct Supabase URL and ANON_KEY
2. Restart dev server after `.env` changes
3. Clear browser cache and cookies
4. Check browser console for errors

### Issue: Redirects to /student instead of /admin
**Solution:**
```sql
-- Fix role in database:
UPDATE users 
SET role = 'ADMIN' 
WHERE email = 'admin.test@hyt-demo.com';

-- Verify:
SELECT email, role FROM users WHERE email = 'admin.test@hyt-demo.com';
```

### Issue: "Account found but profile is incomplete"
**Solution:**
1. User exists in `auth.users` but NOT in `public.users`
2. Need to insert row in `public.users`:
```sql
INSERT INTO users (id, email, password_hash, role, full_name, first_name, last_name)
VALUES (
  '[AUTH_USER_ID]',
  'admin.test@hyt-demo.com',
  'hashed',
  'ADMIN',
  'Admin User',
  'Admin',
  'User'
);
```

### Issue: Page refreshes and logs out
**Solution:**
1. Supabase session expired
2. Check Supabase project is active
3. Verify ANON_KEY is correct in `.env`
4. Check browser console for auth errors

---

## 📊 Success Criteria

All tests pass if:

- ✅ Admin can login without card selection
- ✅ Redirects to `/admin/dashboard` after login
- ✅ Session persists on browser refresh
- ✅ Can access all `/admin/*` routes
- ✅ OJT/Trainee users blocked from admin routes
- ✅ Header Dashboard button routes to admin dashboard
- ✅ No errors in browser console
- ✅ Toast notifications work correctly

---

## 🎉 Expected Output: ALL TESTS PASS ✅

If all 6 tests pass, your admin system is:
- ✅ Fully functional
- ✅ Properly secured  
- ✅ Session persistent
- ✅ Production ready

**Ready to deploy!** 🚀

---

## 📝 Quick Reference

### Admin Credentials:
```
Email: admin.test@hyt-demo.com
Password: [your password]
Card Selection: NONE (optional)
Expected Dashboard: /admin/dashboard
```

### Test URLs:
```
Login: http://localhost:3000/login
Admin Dashboard: http://localhost:3000/admin/dashboard
Admin Students: http://localhost:3000/admin/students
Admin Programs: http://localhost:3000/admin/programs
```

### Verification SQL:
```sql
-- Check admin user:
SELECT id, email, role FROM users 
WHERE email = 'admin.test@hyt-demo.com';

-- Check all roles:
SELECT role, COUNT(*) FROM users GROUP BY role;
```

---

**Run these tests now and verify everything works!** ✅
