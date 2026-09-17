# HYT Foundation Platform - Quick Overview

## System Summary
Web platform for managing OJT students and trainees with attendance tracking, overtime requests, and daily reporting with admin approval workflows.

## 3 User Types
1. **OJT/Intern** - Students with required hours (e.g., 486 hrs)
2. **Trainee** - No required hours, just training
3. **ADMIN** - Manages and approves everything

## Student/Trainee Features

### Attendance
- Clock In/Out daily
- Auto-calculate hours worked
- See progress: "150/486 hours done" with progress bar
- Request overtime (e.g., +2 hours) with reason
- View all attendance history

### Daily Reports
- Submit what you accomplished today
- Admin reviews and approves/rejects with feedback
- Resubmit if rejected

### Status Tracking
All submissions show status badges:
- 🟡 **Pending** - Waiting for admin
- 🟢 **Approved** - Admin approved
- 🔴 **Rejected** - Admin rejected with feedback note

## Admin Features

### 3 Approval Pages:
1. **Attendance Verification** - Approve/reject clock in/out logs
2. **OT Approvals** - Approve OT requests (auto-adds hours)
3. **Report Approvals** - Approve/reject daily reports

### Approval Rules:
- Can approve with optional note
- **Must** provide feedback when rejecting (min 10 characters)
- Hours automatically update via database triggers

## Tech Stack
- **Frontend:** React + React Router
- **Backend:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth with role-based access
- **State:** React Context API

## Database Tables
- `users` - All users (with school, required_hours, rendered_hours)
- `attendance_logs` - Daily time records
- `ot_requests` - Overtime requests
- `daily_reports` - Daily accomplishments

All with status (Pending/Approved/Rejected) and admin notes.

## Key Workflows

### OJT Student Workflow:
```
Register → Login → Clock In → Work → Clock Out → 
Submit Report → (Request OT if needed) → 
Wait for admin approval → Hours added to progress
```

### Admin Workflow:
```
Login → See pending counts → Review items → 
Approve (with optional note) OR Reject (with required note) → 
Student gets feedback
```

## Registration
- **OJT/Intern:** Must provide school name + required hours
- **Trainee:** Just name, email, address, birthday
- **Gmail only** (@gmail.com) - Enforced validation

## Security
- Row Level Security (RLS) policies
- Users only see their own data
- Admins access everything
- Hours calculated server-side (can't be manipulated)

## Build Status
✅ **SUCCESS** - No errors, ready to deploy
- Size: 219.2 kB (optimized)

## Setup Steps
1. Run `COMPLETE_REFACTOR_SCHEMA.sql` in Supabase SQL Editor
2. Deploy build folder
3. Test: Register → Clock in/out → Submit report → Admin approve

## Routes
**Student:** `/student/attendance`, `/student/daily-reports`  
**Trainee:** `/trainee/attendance`, `/trainee/daily-reports`  
**Admin:** `/admin/attendance-verification`, `/admin/ot-approvals`, `/admin/report-approvals`

---

**That's it!** Students track time and report work, admins review and approve everything. 🚀
