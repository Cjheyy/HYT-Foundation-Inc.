# 🚀 Deployment Guide - HYT Foundation

## ✅ PRE-DEPLOYMENT CHECKLIST

- [x] All 10 tasks completed
- [x] Build successful (0 errors)
- [x] AppContext.js crash fixed
- [x] Token refresh errors handled
- [x] Documentation complete
- [ ] SQL script ready to run
- [ ] Production environment configured

---

## 📋 STEP-BY-STEP DEPLOYMENT

### 1. Run SQL Script (REQUIRED)

**File:** `AUTO_VOID_INCOMPLETE_LOGS.sql`

**Location:** Root directory of project

**Instructions:**
1. Open Supabase Dashboard
2. Navigate to SQL Editor
3. Copy entire contents of `AUTO_VOID_INCOMPLETE_LOGS.sql`
4. Paste into SQL Editor
5. Click "Run" button
6. Verify success message

**What it does:**
- Creates `auto_void_incomplete_logs()` function
- Creates trigger `trigger_void_yesterday_logs`
- Automatically marks incomplete attendance logs as VOID
- Runs when new attendance log is inserted

**Verification:**
```sql
-- Test the function manually
SELECT auto_void_incomplete_logs();

-- Check for logs that would be voided
SELECT id, time_in, time_out, status, hours_rendered
FROM attendance_logs
WHERE time_in IS NOT NULL 
  AND time_out IS NULL
  AND status = 'PENDING'
  AND (
    DATE(time_in) < CURRENT_DATE
    OR (DATE(time_in) = CURRENT_DATE AND CURRENT_TIME > TIME '18:05:00')
  );
```

---

### 2. Build Production Bundle

```bash
cd hyt-foundation
npm run build
```

**Expected Output:**
```
Compiled with warnings.
File sizes after gzip:
  227.97 kB  build/static/js/main.*.js
  19.65 kB   build/static/css/main.*.css
```

**Build Location:** `hyt-foundation/build/`

---

### 3. Deploy Build Folder

**Option A: Static Hosting (Vercel, Netlify)**
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd hyt-foundation
vercel --prod
```

**Option B: Custom Server**
```bash
# Install serve globally
npm install -g serve

# Test locally
serve -s build -p 3000

# Upload to server
scp -r build/* user@server:/var/www/html/
```

**Option C: Firebase Hosting**
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Initialize
firebase init

# Deploy
firebase deploy
```

---

### 4. Configure Environment Variables

**Required Variables:**
```env
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

**Hosting-Specific:**
- **Vercel:** Dashboard → Settings → Environment Variables
- **Netlify:** Site Settings → Build & Deploy → Environment
- **Custom Server:** `.env` file in deployment directory

---

### 5. Post-Deployment Verification

**Test These Features:**

#### Authentication Flow:
1. ✅ Visit /login
2. ✅ Try to access /student/dashboard without login (should redirect)
3. ✅ Login with valid credentials
4. ✅ Verify dashboard loads
5. ✅ Test logout (should redirect to /login)

#### Forgot Password:
1. ✅ Click "Forgot Password"
2. ✅ Enter email
3. ✅ Check inbox for reset link
4. ✅ Click link → redirects to /reset-password
5. ✅ Set new password
6. ✅ Login with new password

#### Registration:
1. ✅ Visit /register
2. ✅ Role selection modal appears first
3. ✅ Select OJT or Trainee
4. ✅ Read requirements
5. ✅ Click "I Understand & Agree"
6. ✅ Fill form and submit
7. ✅ Verify account created

#### Attendance:
1. ✅ Login as student
2. ✅ Go to Attendance page
3. ✅ Try clock-in before 8:55 AM (should show alert)
4. ✅ Clock-in between 8:55 AM - 6:05 PM
5. ✅ Verify confirmation modal appears
6. ✅ Confirm → verify live time tracker shows
7. ✅ Clock-out → verify confirmation modal
8. ✅ Verify hours calculated

#### Admin Dashboard:
1. ✅ Login as admin
2. ✅ Verify 7 metric cards show data
3. ✅ Verify "Live" indicator is pulsing
4. ✅ Check navigation (should have 11 items)
5. ✅ No "Applications" or "Reports" tabs

#### Real-Time Features:
1. ✅ Update profile in one browser tab
2. ✅ Verify updates in another tab (no refresh)
3. ✅ Admin: Create new user → metric updates instantly
4. ✅ Student: Clock-in → attendance count updates for admin

---

### 6. Monitor for Issues

**Check Browser Console:**
- Should be clean (no red errors)
- Warnings about unused imports are safe to ignore

**Check Supabase Logs:**
1. Open Supabase Dashboard
2. Go to Logs → API Logs
3. Look for 400/500 errors
4. Should see successful auth requests

**Check Network Tab:**
1. Open DevTools → Network
2. Refresh page
3. All requests should be 200 or 304
4. No 400 grant_type errors

---

## 🐛 TROUBLESHOOTING

### Issue: "Token refresh error"
**Solution:**
- Already handled in code
- Invalid tokens automatically cleared
- User auto-logged out

### Issue: "Metrics not updating"
**Solution:**
- Check Supabase Realtime is enabled
- Dashboard → Settings → API → Realtime enabled
- Restart Supabase if needed

### Issue: "Clock-in not working"
**Solution:**
- Check geolocation permissions in browser
- Development: Works on localhost automatically
- Production: Requires GPS/location services
- Verify coordinates: HYT Building (14.6401, 121.0189)

### Issue: "Forgot password email not received"
**Solution:**
- Check Supabase email settings
- Dashboard → Authentication → Email Templates
- Verify SMTP configured
- Check spam folder

### Issue: "Build warnings"
**Solution:**
- Warnings are non-critical
- `Home.jsx` unused imports: Safe to ignore or remove
- `AppContext.js` dependency warning: Intentional design

---

## 📊 MONITORING CHECKLIST

### Day 1 (First 24 Hours):
- [ ] Check error logs every 2 hours
- [ ] Monitor user registrations
- [ ] Verify attendance submissions
- [ ] Check admin metrics accuracy
- [ ] Test real-time features

### Week 1:
- [ ] Daily error log review
- [ ] User feedback collection
- [ ] Performance monitoring
- [ ] Database query optimization if needed

### Ongoing:
- [ ] Weekly backup verification
- [ ] Monthly performance review
- [ ] Quarterly security audit
- [ ] Regular dependency updates

---

## 🔧 ROLLBACK PLAN

**If Critical Issues Occur:**

1. **Immediate:**
   - Keep previous version available
   - Switch DNS/deployment back
   - Notify users of maintenance

2. **Diagnose:**
   - Check browser console errors
   - Review Supabase logs
   - Check network requests

3. **Fix:**
   - Apply hotfix locally
   - Test thoroughly
   - Redeploy

4. **Communicate:**
   - Update users on status
   - Provide timeline
   - Document issue

---

## 📞 SUPPORT CONTACTS

### Technical Issues:
- Check `ALL_TASKS_COMPLETE.md` for detailed docs
- Review `RUNTIME_FIXES_COMPLETE.md` for error handling
- Consult `EXECUTIVE_SUMMARY.md` for overview

### Database Issues:
- Supabase Dashboard: https://app.supabase.com
- SQL Script: `AUTO_VOID_INCOMPLETE_LOGS.sql`

---

## ✅ DEPLOYMENT SUCCESS CRITERIA

- [ ] Build deployed successfully
- [ ] SQL script executed
- [ ] All authentication flows working
- [ ] Attendance time window enforced
- [ ] Real-time features active
- [ ] Admin metrics updating live
- [ ] No console errors
- [ ] Clean logs for 24 hours

---

## 🎉 FINAL CHECKLIST

Before considering deployment complete:

- [ ] SQL script run successfully
- [ ] Build deployed to production URL
- [ ] Environment variables configured
- [ ] All 10 features tested
- [ ] No critical errors in logs
- [ ] Real-time subscriptions working
- [ ] Email reset flow tested
- [ ] Mobile responsiveness verified
- [ ] Browser compatibility checked
- [ ] Documentation reviewed

---

**Status:** ✅ READY FOR PRODUCTION DEPLOYMENT

**All systems go! Deploy with confidence! 🚀**
