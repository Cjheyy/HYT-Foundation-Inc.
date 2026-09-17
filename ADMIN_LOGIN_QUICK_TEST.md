# 🚀 Quick Test Guide - Admin Login

## ⚡ What Changed?

**ADMIN users can now login WITHOUT selecting any account type card!**

---

## 🧪 Quick Test (2 minutes)

### Setup: Create Test Admin User

**Option 1: Via Supabase Dashboard**
1. Go to: `Authentication → Users → Add User`
2. Create user:
   - Email: `admin@test.com`
   - Password: `Admin123!`
   - Auto Confirm: ✅ YES
3. Copy the User ID
4. Go to: `Table Editor → users → Insert`
5. Add row:
   ```
   id: [paste User ID]
   email: admin@test.com
   password_hash: hashed
   role: ADMIN
   full_name: Test Admin
   first_name: Test
   last_name: Admin
   ```

**Option 2: Run SQL**
```sql
-- In Supabase SQL Editor
-- First create auth user via dashboard, then run:
INSERT INTO users (id, email, password_hash, role, full_name, first_name, last_name)
VALUES (
  '[AUTH_USER_ID]',  -- Replace with auth user ID
  'admin@test.com',
  'hashed',
  'ADMIN',
  'Test Admin',
  'Test',
  'Admin'
);
```

---

## ✅ Test 1: Admin Login (No Card)

1. Go to: `http://localhost:3000/login`
2. **DON'T SELECT ANY CARD**
3. Enter:
   - Email: `admin@test.com`
   - Password: `Admin123!`
4. Click "Login"

**Expected:**
- ✅ Toast: "Login successful! Welcome Admin Test Admin"
- ✅ Redirect to `/admin/dashboard`
- ✅ No error about account type

---

## ✅ Test 2: Admin Login (Card Selected - Should Still Work)

1. Go to: `http://localhost:3000/login`
2. **SELECT "TRAINEE" CARD** (or OJT Student)
3. Enter:
   - Email: `admin@test.com`
   - Password: `Admin123!`
4. Click "Login"

**Expected:**
- ✅ Toast: "Login successful! Welcome Admin Test Admin"
- ✅ Redirect to `/admin/dashboard`
- ✅ Card selection is IGNORED for admins

---

## ✅ Test 3: OJT User Must Select Card

1. Create OJT user with `role: 'OJT/Intern'`
2. Go to login page
3. **DON'T SELECT ANY CARD**
4. Enter OJT credentials
5. Click "Login"

**Expected:**
- ❌ Toast: "Access Denied! Please select the OJT Student account type to log in."
- ❌ Session signed out
- ❌ Stays on login page

---

## ✅ Test 4: Trainee User Must Select Card

1. Create Trainee user with `role: 'Trainee'`
2. Go to login page
3. **DON'T SELECT ANY CARD**
4. Enter Trainee credentials
5. Click "Login"

**Expected:**
- ❌ Toast: "Access Denied! Please select the Trainee account type to log in."
- ❌ Session signed out
- ❌ Stays on login page

---

## ✅ Test 5: Wrong Card Selected

1. Use OJT user credentials
2. **SELECT "TRAINEE" CARD** (wrong!)
3. Enter credentials
4. Click "Login"

**Expected:**
- ❌ Toast: "Access Denied! Please select the OJT Student account type to log in."
- ❌ Session signed out
- ❌ Stays on login page

---

## 🎯 Visual Checklist

On the login page, you should see:

```
┌─────────────────────────────────────┐
│   Login as (Optional for Admin)     │
│                                     │
│  [🎓 Trainee]  [💼 OJT Student]    │
│                                     │
│  Admin users can login without      │
│  selecting an account type          │
└─────────────────────────────────────┘
```

---

## 🔍 What to Look For

### ✅ ADMIN
- Can login with or without card selection
- Always redirects to `/admin/dashboard`
- Toast says "Welcome Admin [Name]"

### ✅ OJT/Intern
- MUST select "OJT Student" card
- Gets error if no card or wrong card
- Redirects to `/student/dashboard` if correct

### ✅ Trainee
- MUST select "Trainee" card
- Gets error if no card or wrong card
- Redirects to `/trainee/dashboard` if correct

---

## 🛠️ Troubleshooting

### Admin still can't login?
1. Check `users` table: `role` column = `'ADMIN'` (exact case)
2. Check auth user exists in Supabase Authentication
3. Check IDs match between `auth.users` and `public.users`

### Getting "Invalid credentials"?
- Password might be wrong
- Email might be wrong
- Auth user doesn't exist in Supabase Authentication

### Getting "Profile incomplete"?
- User exists in `auth.users` but NOT in `public.users`
- Need to insert row in `public.users` table with same ID

---

## 📊 Quick Debug SQL

```sql
-- Check user role
SELECT id, email, role FROM users WHERE email = 'admin@test.com';

-- Should return: role = 'ADMIN'

-- Check all roles in system
SELECT role, COUNT(*) FROM users GROUP BY role;

-- Should show: ADMIN, OJT/Intern, Trainee
```

---

## 🎉 Success!

If all tests pass:
- ✅ Admin bypass working
- ✅ Role verification working
- ✅ Error messages clear
- ✅ Redirects correct

**System is ready for production!** 🚀
