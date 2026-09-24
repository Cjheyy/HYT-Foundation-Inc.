# 🚀 Production Features Setup Guide

## Overview
This guide covers the setup and implementation of 8 critical production features for the HYT Foundation platform.

---

## 📋 Features Implemented

### 1. ✅ Geofencing Clock-In System (5m Radius)
**Locations:**
- HYT Building: 14.6401, 121.0189
- Atlanta Office: 14.6435, 121.0175

**Files Created/Modified:**
- `COMPLETE_PRODUCTION_FEATURES.sql` - Haversine distance function, geofence validation
- `src/pages/student/Attendance.jsx` - Updated clock-in with geolocation
- `src/services/supabaseService.js` - Updated to use RPC geofenced_clock_in

**How It Works:**
1. User clicks "Clock In"
2. Browser requests high-accuracy location
3. Location sent to Supabase RPC function
4. Haversine formula calculates distance
5. If within 5 meters of either location → Success
6. Location name, latitude, longitude saved to attendance_logs

**Testing:**
```javascript
// In browser console at HYT Building location
navigator.geolocation.getCurrentPosition(
  (pos) => console.log(pos.coords),
  (err) => console.error(err),
  { enableHighAccuracy: true }
);
```

---

### 2. ✅ Automatic Hour Calculation on Approval

**Database Triggers:**
- `update_rendered_hours_on_attendance_approval()` - Adds hours when attendance approved
- `update_rendered_hours_on_ot_approval()` - Adds OT hours when request approved

**How It Works:**
1. Admin approves attendance or OT request
2. Trigger fires automatically
3. `users.rendered_hours` updated
4. Progress percentage recalculated: `(rendered / required) * 100`

**View:**
- `user_progress_view` - Shows progress for all users

**Testing:**
```sql
-- Check triggers are active
SELECT tgname, tgenabled FROM pg_trigger 
WHERE tgname IN ('attendance_approval_update_hours', 'ot_approval_update_hours');

-- View user progress
SELECT * FROM user_progress_view WHERE id = 'user_id_here';
```

---

### 3. ✅ Forgot Password with OTP Verification

**Files Created:**
- `src/pages/public/ForgotPassword.jsx` - 3-step password reset flow
- `src/pages/public/Auth.css` - Styling for auth pages

**Flow:**
1. **Step 1:** User enters email → Supabase sends 6-digit OTP
2. **Step 2:** User enters OTP → Verification
3. **Step 3:** User sets new password → Reset complete

**Route to Add:**
```javascript
// In App.js
import { ForgotPassword } from './pages/public/ForgotPassword';

<Route path="/forgot-password" element={
  <PublicLayout><ForgotPassword /></PublicLayout>
} />
```

**Link from Login:**
```jsx
<Link to="/forgot-password">Forgot Password?</Link>
```

---

### 4. ✅ Dynamic Landing Page with Sign-In Wall

**Files Created:**
- `src/components/SignInWall.jsx` - Authentication modal
- `src/components/SignInWall.css` - Modal styling
- `src/components/ContactForm.jsx` - Email contact form
- `src/components/ContactForm.css` - Contact form styling

**Features:**
- Dynamically fetches programs and opportunities from Supabase
- Sign-in wall modal when unauthenticated users click "Apply Now"
- Contact form sends to augosteeval@gmail.com via EmailJS

**EmailJS Setup:**
1. Create account at https://www.emailjs.com/
2. Get Service ID, Template ID, and Public Key
3. Update `ContactForm.jsx`:
```javascript
emailjs.init('YOUR_PUBLIC_KEY');
const serviceId = 'YOUR_SERVICE_ID';
const templateId = 'YOUR_TEMPLATE_ID';
```

**EmailJS Template Variables:**
```
{{from_name}} - Sender name
{{from_email}} - Sender email
{{subject}} - Message subject
{{message}} - Message content
{{to_email}} - augosteeval@gmail.com
```

---

### 5. ✅ Onboarding Guidance Modals

**Files Created:**
- `src/components/OnboardingModal.jsx` - Educational modals
- `src/components/OnboardingModal.css` - Modal styling

**Content:**

**OJT/Intern Modal:**
- School endorsement requirement
- Hour tracking (486 hrs)
- Logbook submissions
- Performance evaluation
- Certificate upon completion

**Trainee Modal:**
- Community learning focus
- Flexible learning
- Hands-on experience
- Progress tracking
- Community impact

**Usage in Register.jsx:**
```jsx
import { OnboardingModal } from '../components/OnboardingModal';

const [showOnboarding, setShowOnboarding] = useState(false);
const [selectedRole, setSelectedRole] = useState(null);

<OnboardingModal
  isOpen={showOnboarding}
  onClose={() => setShowOnboarding(false)}
  onProceed={() => {
    setShowOnboarding(false);
    // Show registration form
  }}
  type={selectedRole} // 'OJT/Intern' or 'Trainee'
/>
```

---

### 6. ✅ Admin Application Review Dashboard

**Files Created:**
- `src/pages/admin/ApplicationReview.jsx` - Review interface
- Updated `src/pages/admin/Admin.css` - Tab and card styles

**Database:**
- `users.application_status` - 'Pending' | 'Approved' | 'Rejected'
- `users.reviewed_by` - Admin who reviewed
- `users.reviewed_at` - Review timestamp
- `users.rejection_reason` - Reason if rejected

**RPC Functions:**
- `approve_user_application(user_id, admin_id)` - Approve account
- `reject_user_application(user_id, admin_id, reason)` - Reject account

**Features:**
- Two tabs: OJT/Intern and Trainee applications
- View applicant details (school, hours, address, age)
- Approve with single click
- Reject with mandatory reason (min 10 characters)
- Sets `is_active = TRUE` on approval

**Route to Add:**
```javascript
// In App.js
import { ApplicationReview } from './pages/admin/ApplicationReview';

<Route path="/admin/application-review" element={
  <ProtectedRoute requiredRole="ADMIN">
    <AdminLayout><ApplicationReview /></AdminLayout>
  </ProtectedRoute>
} />
```

**AdminLayout Sidebar:**
```javascript
{ path: '/admin/application-review', label: 'Application Review', icon: '✉️' }
```

---

### 7. ✅ 3-Event Booking Limit

**Database:**
- `applications` table created with program_id and opportunity_id
- `check_event_limit()` trigger function
- `enforce_event_limit` trigger

**How It Works:**
- Counts active (Pending or Approved) opportunity applications
- Raises exception if user tries to apply for 4th event
- Only applies to opportunities, not programs

**Error Message:**
```
"You have reached the maximum limit of 3 active event bookings. 
Please cancel an existing booking before applying to a new event."
```

**Frontend Handling:**
```javascript
try {
  await createApplication(userId, opportunityId);
} catch (error) {
  if (error.message.includes('maximum limit')) {
    toast.error('You can only book 3 events at a time. Cancel one to apply.');
  }
}
```

---

### 8. ✅ Login Navigation & Scroll Fix

**Files Created:**
- `src/components/ScrollToTop.jsx` - Auto-scroll component
- `src/utils/scrollToTop.js` - Scroll utility functions

**Implementation:**

**App.js:**
```jsx
import { ScrollToTop } from './components/ScrollToTop';

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop /> {/* Add this inside BrowserRouter */}
      <Routes>
        {/* ... routes */}
      </Routes>
    </BrowserRouter>
  );
}
```

**Login Button with Scroll:**
```jsx
import { useNavigate } from 'react-router-dom';
import { scrollToTop } from '../utils/scrollToTop';

function LoginButton() {
  const navigate = useNavigate();
  
  const handleLogin = () => {
    navigate('/login');
    scrollToTop('auto'); // Instant scroll
  };
  
  return <button onClick={handleLogin}>Log In</button>;
}
```

---

## 🗄️ Database Setup

### Step 1: Run the SQL Script
```bash
# Go to Supabase SQL Editor
https://supabase.com/dashboard/project/YOUR_PROJECT/sql

# Copy and paste entire COMPLETE_PRODUCTION_FEATURES.sql
# Click RUN
```

### Step 2: Verify Installation
```sql
-- Check geolocation columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'attendance_logs' 
AND column_name IN ('latitude', 'longitude', 'location_name');

-- Test geofence (should return valid for HYT Building)
SELECT * FROM validate_geofence(14.6401, 121.0189);

-- Check triggers
SELECT tgname, tgenabled, tgrelid::regclass 
FROM pg_trigger 
WHERE tgname LIKE '%approval%' OR tgname LIKE '%event_limit%';

-- Check application columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('application_status', 'reviewed_by', 'rejection_reason');
```

---

## 📦 NPM Dependencies to Install

```bash
cd hyt-foundation

# EmailJS for contact form
npm install @emailjs/browser

# (Optional) If not already installed
npm install react-toastify
```

---

## 🔧 Configuration

### 1. EmailJS Setup (Contact Form)

1. Sign up at https://www.emailjs.com/
2. Create email service (Gmail, Outlook, etc.)
3. Create email template:
```
From: {{from_name}} ({{from_email}})
Subject: {{subject}}

{{message}}

---
Reply to: {{reply_to}}
```

4. Update `src/components/ContactForm.jsx`:
```javascript
emailjs.init('YOUR_PUBLIC_KEY'); // Line 9
const serviceId = 'YOUR_SERVICE_ID'; // Line 53
const templateId = 'YOUR_TEMPLATE_ID'; // Line 54
```

### 2. Environment Variables

Update `.env`:
```
REACT_APP_SUPABASE_URL=your_url
REACT_APP_SUPABASE_ANON_KEY=your_key
```

---

## 🎯 Integration Checklist

### App.js Updates

```javascript
// Add imports
import { ForgotPassword } from './pages/public/ForgotPassword';
import { ApplicationReview } from './pages/admin/ApplicationReview';
import { ScrollToTop } from './components/ScrollToTop';

// Add ScrollToTop component
<BrowserRouter>
  <ScrollToTop />
  <Routes>
    {/* Add forgot password route */}
    <Route path="/forgot-password" element={
      <PublicLayout><ForgotPassword /></PublicLayout>
    } />
    
    {/* Add application review route */}
    <Route path="/admin/application-review" element={
      <ProtectedRoute requiredRole="ADMIN">
        <AdminLayout><ApplicationReview /></AdminLayout>
      </ProtectedRoute>
    } />
    
    {/* ... existing routes */}
  </Routes>
</BrowserRouter>
```

### AdminLayout.jsx Updates

```javascript
const navItems = [
  // ... existing items
  { path: '/admin/application-review', label: 'Application Review', icon: '✉️' },
  { path: '/admin/attendance-verification', label: 'Attendance Verification', icon: '✓' },
  // ... rest
];
```

### Register.jsx Updates

```javascript
import { OnboardingModal } from '../components/OnboardingModal';
import { useState } from 'react';

function Register() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedAccountType, setSelectedAccountType] = useState('');
  
  const handleAccountTypeSelect = (type) => {
    setSelectedAccountType(type);
    setShowOnboarding(true);
  };
  
  return (
    <>
      {/* Account type selection UI */}
      <button onClick={() => handleAccountTypeSelect('OJT/Intern')}>
        OJT/Intern
      </button>
      <button onClick={() => handleAccountTypeSelect('Trainee')}>
        Trainee
      </button>
      
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onProceed={() => {
          setShowOnboarding(false);
          // Show registration form
        }}
        type={selectedAccountType}
      />
    </>
  );
}
```

### Home.jsx Updates

```javascript
import { useState, useEffect } from 'react';
import { ContactForm } from '../components/ContactForm';
import { SignInWall } from '../components/SignInWall';
import { supabase } from '../config/supabase';

function Home() {
  const [programs, setPrograms] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [showSignInWall, setShowSignInWall] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  useEffect(() => {
    loadData();
    checkAuth();
  }, []);
  
  const loadData = async () => {
    const [progsRes, oppsRes] = await Promise.all([
      supabase.from('programs').select('*').eq('status', 'Published'),
      supabase.from('opportunities').select('*').eq('status', 'Published')
    ]);
    
    setPrograms(progsRes.data || []);
    setOpportunities(oppsRes.data || []);
  };
  
  const checkAuth = async () => {
    const { data } = await supabase.auth.getSession();
    setIsAuthenticated(!!data.session);
  };
  
  const handleApplyClick = () => {
    if (!isAuthenticated) {
      setShowSignInWall(true);
    } else {
      // Navigate to application
    }
  };
  
  return (
    <>
      {/* Display dynamic programs and opportunities */}
      
      {/* Contact Section */}
      <section className="section">
        <div className="container">
          <ContactForm />
        </div>
      </section>
      
      <SignInWall
        isOpen={showSignInWall}
        onClose={() => setShowSignInWall(false)}
        targetAction="apply"
      />
    </>
  );
}
```

---

## 🧪 Testing

### 1. Geofencing Test
```javascript
// Mock location for testing (use browser dev tools)
// Chrome DevTools → More Tools → Sensors → Location

// Test valid location (HYT Building)
Latitude: 14.6401
Longitude: 121.0189

// Test invalid location
Latitude: 14.5000
Longitude: 121.0000

// Expected: Valid location allows clock-in, invalid rejects with distance
```

### 2. Hour Calculation Test
```sql
-- Create test attendance
INSERT INTO attendance_logs (user_id, date, time_in, time_out, rendered_hours, status)
VALUES ('user_id', CURRENT_DATE, NOW() - INTERVAL '8 hours', NOW(), 8.0, 'Pending');

-- Approve it
UPDATE attendance_logs SET status = 'Approved' WHERE id = 'attendance_id';

-- Check user hours updated
SELECT rendered_hours FROM users WHERE id = 'user_id';
-- Should show +8 hours
```

### 3. Application Review Test
```sql
-- Create test pending application
UPDATE users 
SET application_status = 'Pending' 
WHERE email = 'test@example.com';

-- Admin should see in dashboard
-- Approve via UI
-- Check status changed to 'Approved' and is_active = TRUE
```

### 4. 3-Event Limit Test
```javascript
// Apply to 3 opportunities - should succeed
// Apply to 4th opportunity - should fail with limit message
```

### 5. Password Reset Test
1. Go to /forgot-password
2. Enter email
3. Check email for 6-digit code
4. Enter code
5. Set new password
6. Try logging in with new password

---

## 🚨 Common Issues & Solutions

### Issue: Geolocation not working
**Solution:** 
- Ensure HTTPS (geolocation requires secure context)
- Check browser permissions
- Use Chrome/Firefox (better geolocation support)

### Issue: EmailJS not sending
**Solution:**
- Verify Service ID, Template ID, Public Key
- Check EmailJS dashboard for quota
- Ensure template variables match

### Issue: Triggers not firing
**Solution:**
```sql
-- Check trigger is enabled
SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'attendance_approval_update_hours';

-- If disabled, enable it
ALTER TABLE attendance_logs ENABLE TRIGGER attendance_approval_update_hours;
```

### Issue: Application status not updating
**Solution:**
```sql
-- Check RPC function exists
SELECT proname FROM pg_proc WHERE proname = 'approve_user_application';

-- Test manually
SELECT approve_user_application('user_id', 'admin_id');
```

---

## 📊 Admin Views

### Pending Applications View
```sql
SELECT * FROM pending_user_applications;
```

### User Progress View
```sql
SELECT 
  full_name,
  role,
  rendered_hours,
  required_hours,
  remaining_hours,
  progress_percent
FROM user_progress_view
ORDER BY progress_percent DESC;
```

### Location Verification
```sql
SELECT 
  u.full_name,
  al.date,
  al.time_in,
  al.location_name,
  al.latitude,
  al.longitude,
  al.status
FROM attendance_logs al
JOIN users u ON u.id = al.user_id
WHERE al.location_name IS NOT NULL
ORDER BY al.date DESC;
```

---

## 🎉 Success Criteria

✅ **Geofencing:** Clock-in only succeeds within 5m of HYT/Atlanta  
✅ **Hour Calculation:** Automatic update on approval  
✅ **Password Reset:** 3-step OTP flow works  
✅ **Dynamic Landing:** Programs/opportunities load from DB  
✅ **Onboarding Modals:** Show before registration  
✅ **Application Review:** Admin can approve/reject  
✅ **Contact Form:** Email sends to augosteeval@gmail.com  
✅ **Scroll Fix:** Login button scrolls to top  
✅ **3-Event Limit:** Enforced on 4th booking attempt  

---

## 📞 Support

For issues or questions:
- Check Supabase logs for errors
- Verify all SQL scripts ran successfully
- Check browser console for frontend errors
- Test with sample data first

**Good luck! 🚀**
