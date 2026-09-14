# HYT Foundation Platform - Quick Start Guide

## 🚀 Getting Started (3 Steps)

### 1. Install Dependencies
```bash
cd hyt-foundation
npm install
```

### 2. Start the Application
```bash
npm start
```
The app will open automatically at `http://localhost:3000`

### 3. Login with Demo Accounts

**Student Login:**
- Email: `christian.jay@hyt-demo.com`
- Password: `demo123`

**Admin Login:**
- Email: `admin@hyt-foundation.org`
- Password: `admin123`

---

## 📋 Testing the Complete Workflow

### As a Student:

1. **Browse Opportunities**
   - Click "Explore Opportunities" from the home page
   - View "IT Internship Program"

2. **View Your Dashboard**
   - Login with student credentials
   - See your dashboard with journey tracker

3. **Check OJT Progress**
   - Navigate to "OJT / Experience"
   - View hours: Required (486), Verified (240), Remaining (246)

4. **Record Attendance**
   - Go to "Attendance"
   - Click "Time In" (will request location permission)
   - System verifies location and schedule

5. **Submit Daily Report**
   - Go to "Daily Reports"
   - Click "Submit Report"
   - Fill in hours and activities
   - Note: Hours won't be added until admin approves

6. **View Requirements**
   - Go to "Requirements"
   - See requirement statuses
   - Upload documents (simulated)

### As an Admin:

1. **View Dashboard**
   - Login with admin credentials
   - See statistics and pending items

2. **Review Applications**
   - Go to "Applications"
   - Click "Update" on an application
   - Change status to "Accepted"
   - System automatically creates OJT record

3. **Verify Attendance**
   - Go to "Attendance Verification"
   - Review student time-in details
   - Check location and schedule validation
   - Click "Confirm Attendance"

4. **Approve Daily Reports**
   - Go to "Daily Reports"
   - Click "Review" on a submitted report
   - Click "Approve Report"
   - **Watch verified hours increase automatically!**

5. **Monitor OJT Progress**
   - Go to "OJT Monitoring"
   - View student progress bars
   - When verified hours ≥ required hours:
     - Button "Mark OJT Completed" appears
     - Click to complete
     - Certificate generates automatically

6. **Manage Students**
   - Go to "Students"
   - View all registered students
   - See their details

7. **Create Announcements**
   - Go to "Announcements"
   - Click "Create Announcement"
   - Fill in title and content
   - Click "Publish Announcement"
   - Students see it immediately

---

## 🎯 Key Features to Test

### ✅ Authentication & Authorization
- [x] Login with student/admin accounts
- [x] Role-based access (student can't access admin pages)
- [x] Protected routes redirect to login
- [x] Logout functionality

### ✅ Student Features
- [x] Dashboard with journey visualization
- [x] Profile editing
- [x] Browse opportunities
- [x] Apply to opportunities
- [x] View application status
- [x] Submit requirements
- [x] Record attendance with geolocation
- [x] Submit daily reports
- [x] View OJT progress
- [x] View certificates

### ✅ Admin Features
- [x] Dashboard with live statistics
- [x] Application management
- [x] Attendance verification
- [x] Daily report approval
- [x] OJT monitoring
- [x] Certificate generation
- [x] Announcement creation
- [x] Analytics and reports

### ✅ Business Logic
- [x] Application status workflow
- [x] OJT creation on acceptance
- [x] Attendance requires admin verification
- [x] Daily report approval adds verified hours
- [x] Progress calculations update automatically
- [x] Certificate generation on completion
- [x] Real-time state synchronization

### ✅ Data Persistence
- [x] All data saves to localStorage
- [x] Data persists across page refreshes
- [x] Changes in admin reflect immediately in student view
- [x] Changes in student reflect immediately in admin view

---

## 🔄 Complete End-to-End Flow

```
PUBLIC WEBSITE
↓ Browse & Register
STUDENT LOGIN
↓ View Opportunities
APPLY TO OPPORTUNITY
↓
ADMIN LOGIN
↓ Review Application
UPDATE STATUS → "Accepted"
↓ (OJT Record Auto-Created)
STUDENT: Record Attendance
↓ (Location & Schedule Verified)
ADMIN: Verify Attendance
↓ (Status: Pending → Verified)
STUDENT: Submit Daily Report
↓ (Submitted, Hours Pending)
ADMIN: Approve Daily Report
↓ (Verified Hours +8, Progress Updates)
... Repeat Daily Reports ...
↓ (Verified Hours Reach 486)
ADMIN: Mark OJT Completed
↓ (Certificate Auto-Generated)
STUDENT: View & Download Certificate
✓ COMPLETE
```

---

## 📱 Responsive Testing

Test on different screen sizes:
- Desktop: Full sidebar navigation
- Tablet: Responsive grid layouts
- Mobile: Collapsible menus, stacked cards

---

## 💾 Data Structure

All data is stored in localStorage under key: `hyt_foundation_data`

Sample data includes:
- 2 demo users (1 student, 1 admin)
- 2 opportunities
- 1 program
- 2 announcements

On first load, demo data initializes automatically.

---

## 🐛 Troubleshooting

**Location Permission Denied**
- Attendance will show error
- In real deployment, location services must be enabled

**Data Not Persisting**
- Check browser localStorage is enabled
- Check browser console for errors

**Can't Login**
- Ensure you're using exact demo credentials
- Check caps lock is off

**Build Errors**
- Run `npm install` again
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`

---

## 📦 Build for Production

```bash
npm run build
```

Creates optimized production build in `build/` folder.

To serve:
```bash
npm install -g serve
serve -s build
```

---

## 🎨 Customization

**Brand Colors** (in `src/index.css`):
- Primary Orange: `#D57156`
- Teal: `#279EB6`
- Yellow: `#F3DB6E`

**Demo Data** (in `src/services/storageService.js`):
- Edit `initializeData()` function
- Add more opportunities, programs, users

---

## ✨ What Makes This Special

This is a **fully functional system**, not a mockup:

✅ Real authentication with role-based access  
✅ Complete state management with React Context  
✅ Business logic implemented in service layer  
✅ Actual form validation throughout  
✅ Browser geolocation API integration  
✅ Automatic calculations (hours, progress, completion)  
✅ Real-time data synchronization  
✅ localStorage persistence  
✅ Ready for backend integration  

---

**Happy Testing! 🎉**

For questions or issues, refer to the main README.md
