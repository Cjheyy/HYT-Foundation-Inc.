# 🚀 Quick Start Guide - 3-Role Authentication System

## ⚡ TL;DR

Your authentication system now supports **3 roles**:
1. **ADMIN** - Full access, no card selection needed
2. **OJT/Intern** - Select "OJT Student" card at login
3. **Trainee** - Select "Trainee" card at login

---

## 🔧 Setup (One-Time)

### Step 1: Update Database Roles

Run this in **Supabase SQL Editor**:

```sql
-- Update existing users to new role system
UPDATE users 
SET role = CASE 
  WHEN role = 'ADMIN' THEN 'ADMIN'
  WHEN role = 'STUDENT' AND account_type = 'Training' THEN 'Trainee'
  WHEN role = 'STUDENT' AND account_type = 'OJT Student' THEN 'OJT/Intern'
  WHEN role = 'STUDENT' THEN 'Trainee'
  ELSE role
END;

-- Update constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('ADMIN', 'OJT/Intern', 'Trainee'));

-- Verify
SELECT role, COUNT(*) FROM users GROUP BY role;
```

---

## 👤 Creating Users

### Option 1: Via Supabase Dashboard (Easiest)

**Step 1:** Create Auth User
1. Go to: Authentication → Users → Add User
2. Fill in:
   - Email: `user@gmail.com`
   - Password: `password123`
   - Auto Confirm User: ✅ YES
3. Copy the User ID

**Step 2:** Add to users Table
1. Go to: Table Editor → users → Insert Row
2. Fill in:
   - `id`: [Paste User ID from Step 1]
   - `email`: `user@gmail.com`
   - `password_hash`: `hashed`
   - `role`: Choose one: `ADMIN`, `OJT/Intern`, or `Trainee`
   - `full_name`: `Test User`
   - `first_name`: `Test`
   - `last_name`: `User`

**Step 3:** Test Login
- ADMIN: Login directly (no card selection)
- OJT/Intern: Select "OJT Student" card
- Trainee: Select "Trainee" card

### Option 2: Via Registration Page
1. Go to `/register`
2. Select account type (Trainee or OJT Student)
3. Fill in form
4. Submit - user created automatically with correct role!

---

## 🧪 Testing

### Test Admin Login
```
Email: admin@gmail.com
Password: [your password]
Account Type: [don't select anything]
Expected: Redirect to /admin/dashboard
```

### Test OJT/Intern Login
```
Email: ojt@gmail.com
Password: [your password]
Account Type: Select "OJT Student" card
Expected: Redirect to /student/dashboard
```

### Test Trainee Login
```
Email: trainee@gmail.com
Password: [your password]
Account Type: Select "Trainee" card
Expected: Redirect to /trainee/dashboard
```

### Test Wrong Card Selection
```
User: trainee@gmail.com (role: Trainee)
Select: "OJT Student" card (wrong!)
Expected: Toast error "Access Denied! Please login as Trainee"
```

---

## 📍 Dashboard URLs

| Role | URL | Features |
|------|-----|----------|
| ADMIN | `/admin/dashboard` | Full system management |
| OJT/Intern | `/student/dashboard` | OJT tracking, daily reports, attendance |
| Trainee | `/trainee/dashboard` | Training programs, workshops |

---

## 🎯 User Flows

### ADMIN
```
Login → [No card selection] → /admin/dashboard
```

### OJT/Intern
```
Login → Select "OJT Student" → /student/dashboard
Can access: Programs, OJT, Daily Reports, Attendance, Requirements
```

### Trainee
```
Login → Select "Trainee" → /trainee/dashboard
Can access: Programs, Opportunities, Requirements, Certificates
Cannot access: OJT features, Daily Reports
```

---

## ❌ Troubleshooting

### "Invalid login credentials"
- ✅ User exists in `auth.users`?
- ✅ User exists in `public.users` with same ID?
- ✅ Password correct?

### "Access Denied! Please login as [role]"
- ✅ Selected correct card? (OJT Student vs Trainee)
- ✅ Database role matches selection?

### Can't access dashboard
- ✅ Role set correctly in database?
- ✅ Using correct URL for your role?

### Migration didn't work
```sql
-- Check current roles
SELECT id, email, role FROM users;

-- Manually fix a user
UPDATE users SET role = 'Trainee' WHERE email = 'user@gmail.com';
```

---

## 📋 Role Comparison

| Feature | ADMIN | OJT/Intern | Trainee |
|---------|-------|------------|---------|
| Dashboard | ✅ Custom | ✅ Custom | ✅ Custom |
| View Programs | ✅ Manage | ✅ Browse | ✅ Browse |
| Apply to Opportunities | ❌ | ✅ | ✅ |
| OJT Tracking | ✅ View All | ✅ Own | ❌ |
| Daily Reports | ✅ View All | ✅ Submit | ❌ |
| Attendance | ✅ Manage | ✅ Own | ✅ Own |
| Requirements | ✅ Manage | ✅ Own | ✅ Own |
| Certificates | ✅ Issue | ✅ Own | ✅ Own |
| User Management | ✅ | ❌ | ❌ |

---

## 🎉 Quick Test Script

```bash
# 1. Start development server
cd hyt-foundation
npm start

# 2. Open browser to http://localhost:3000

# 3. Test each role:
# - Register new trainee account
# - Register new OJT student account
# - Login with each account
# - Verify dashboard redirection
# - Try accessing other role's routes (should redirect)

# 4. Build for production
npm run build
# ✅ Should compile with no errors!
```

---

## 📞 Need Help?

Check these files:
- `AUTHENTICATION_REFACTOR_COMPLETE.md` - Full technical documentation
- `UPDATE_USER_ROLES.sql` - Database migration script
- `FINAL_SETUP.md` - Original setup guide

**Everything is working! Just run the migration and test! 🚀**
