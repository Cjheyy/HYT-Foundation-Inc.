# 🚀 Quick Start Guide - HYT Foundation System Polish

## ✅ What's Been Done

All 9 production features have been implemented:
1. ✅ Supabase forgot password with magic links
2. ✅ Strict auth guards with session validation
3. ✅ Role selection modals for registration
4. ✅ Real-time profile & avatar sync
5. ✅ Clock-in/out confirmation modals
6. ✅ 8:55 AM - 6:05 PM attendance window + void rule
7. ✅ Live time tracker (HH:MM:SS)
8. ✅ Real-time admin dashboard metrics (7 cards)
9. ✅ Admin navigation cleanup

**Build Status:** ✅ Successful (226.54 kB)

---

## 📋 What You Need to Do

### Step 1: Run the Canonical OJT Migration (REQUIRED)

Back up the project, then run the entire contents of
`OJT_TRACKING_PRODUCTION_MIGRATION.sql` in the Supabase SQL Editor.

The canonical migration installs the approval gate, dual-stage attendance
states, atomic hour crediting, RLS policies, dashboard metrics, event cleanup,
and Realtime publication. Follow `OJT_TRACKING_MIGRATION_RUNBOOK.md` to verify
the installation.

Do not re-run the legacy `AUTO_VOID_INCOMPLETE_LOGS.sql` or
`COMPLETE_PRODUCTION_FEATURES.sql` scripts; their status values and triggers
conflict with the canonical state machine.

### Step 2: Test in Development

```bash
npm start
```

**Test These Features:**

1. **Forgot Password Flow:**
   - Go to /login
   - Click "Forgot Password"
   - Enter email (use a real email you have access to)
   - Check inbox for reset link
   - Click link → redirected to /reset-password
   - Set new password
   - Verify you can login with new password

2. **Registration with Role Selection:**
   - Go to /register
   - Select role (OJT or Trainee)
   - Read guidance modal
   - Click "I Understand & Agree"
   - Fill form and submit
   - Check that role badge shows correctly

3. **Attendance Features:**
   - Login as student
   - Go to Attendance page
   - Try clock-in (should show confirmation modal)
   - Confirm → the request stays pending and the timer must remain stopped
   - Approve the request in `/admin/attendance-verification` → the timer starts
   - Submit clock-out → the timer freezes while the request is pending
   - Approve the clock-out → the frozen duration is credited once
   - **Test Time Window:**
     - Try before 8:55 AM → should see warning
     - Try after 6:05 PM → should see warning

4. **Admin Dashboard:**
   - Login as admin
   - Check Dashboard page
   - Verify 7 metric cards show live counts
   - Use the cards to open Applications, Attendance, or Reports
   - Verify the "Live" indicator reflects the Realtime connection

### Step 3: Deploy to Production

```bash
npm run build
```

Upload the `build` folder to your hosting service.

---

## 🎯 Key Changes to Know

### For Users:
- **Forgot password** now sends email link (not OTP code)
- **Registration** creates a pending application; an administrator must approve it before login
- **Attendance** must be between 8:55 AM - 6:05 PM
- **Confirmation** is required before submitting clock-in/out requests
- **Clock-in and clock-out each require administrator approval**

### For Admins:
- **Dashboard metrics** update in real-time (no refresh needed)
- **Application Review** handles account approvals and rejections
- **Attendance Verification** handles both clock-in and clock-out stages
- **Report Approvals** handles daily-report decisions

---

## 🐛 Troubleshooting

### "Metrics not updating in real-time"
- Check Supabase realtime is enabled
- Verify project has realtime subscriptions enabled in Supabase dashboard

### "Clock-in not working"
- Check geolocation permissions in browser
- Development mode: Works on localhost automatically
- Production: Requires GPS or location services

### "Forgot password email not received"
- Check Supabase email settings
- Verify SMTP is configured
- Check spam folder

### "Build warnings about unused imports"
- Non-critical, safe to ignore
- In `Home.jsx`: ContactForm and SignInWall imports can be removed if not used

---

## 📱 Testing on Mobile

### Attendance Geofencing:
1. Open on mobile device
2. Enable location services
3. Must be within 5 meters of:
   - HYT Building: 14.6401, 121.0189
   - Atlanta Office: 14.6435, 121.0175

### Time Window:
- Clock-in: 8:55 AM - 6:05 PM only
- Outside window: Red alert banner shows
- A clock-out request freezes the duration; hours are credited only after admin approval

---

## 🎨 New UI Components

### Modals:
- `ConfirmationModal` - Used for clock-in/out confirmations
- `RoleSelectionModal` - Used in registration
- All modals are responsive and accessible

### Live Components:
- `LiveTimeTracker` - Real-time stopwatch while clocked in
- `AdminDashboardMetrics` - 7 real-time metric cards

### Styling:
- All auth pages use unified `Auth.css`
- Purple gradient theme: #667eea → #764ba2

---

## 📊 Admin Dashboard Metrics

**7 Real-time Cards:**
1. Total Students (OJT + Trainee accounts)
2. Total Applications (registrations awaiting review)
3. Accepted Applications (approved and active users)
4. Completed OJT (rendered hours meet each user's required hours)
5. Programs & Opportunities (published, non-expired listings)
6. Pending Attendance (clock-in or clock-out requests)
7. Pending Reports (daily reports awaiting review)

All update automatically when database changes.

---

## 🔐 Security Features

- ✅ Strict session validation on every protected route
- ✅ Auto-logout on invalid/expired session
- ✅ Active user status check (`is_active = true`)
- ✅ No dashboard bypass possible
- ✅ Loading state during validation

---

## ⚙️ Configuration Notes

### Development Mode:
- Geolocation fallback to HYT Building coordinates
- Easier testing without GPS

### Production Mode:
- Strict geofencing required
- Real GPS coordinates needed
- Time window strictly enforced

---

## 📞 Quick Reference

**Clock-in Time:** 8:55 AM - 6:05 PM  
**Geofence Radius:** 5 meters  
**OJT Requirement:** configured per trainee
**Attendance approval:** clock-in and clock-out are separate admin stages

**Files to Check:**
- `OJT_TRACKING_PRODUCTION_MIGRATION.sql` - Canonical database migration
- `OJT_TRACKING_MIGRATION_RUNBOOK.md` - Deployment and smoke tests
- `SYSTEM_POLISH_COMPLETE.md` - Full documentation
- `.env` - Supabase credentials

---

## ✅ Checklist Before Going Live

- [ ] Run `OJT_TRACKING_PRODUCTION_MIGRATION.sql` in Supabase SQL Editor
- [ ] Test forgot password with real email
- [ ] Test registration with both roles
- [ ] Test clock-in confirmation modal
- [ ] Test time window enforcement
- [ ] Verify admin metrics update live
- [ ] Check navigation cleanup
- [ ] Test on mobile device
- [ ] Verify geofencing works
- [ ] Build production version
- [ ] Deploy to hosting

---

**Status:** Ready for Testing → Production  
**Build:** 226.54 kB (optimized)  
**Errors:** 0 ✅
