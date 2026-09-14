# HYT Foundation Digital Youth Development Platform

**"Bringing the Next Generation Forward"**

A complete functional React web system for Helping Youth Transcend (HYT) Foundation Inc., supporting youth development through programs, opportunities, OJT tracking, and certificate management.

## 🌟 Features

### Three Integrated Interfaces

1. **Public Website**
   - Home page with hero, features, 8 HYT thrusts, journey visualization
   - About page with mission, vision, and detailed thrust explanations
   - Programs and Opportunities listings with search and filters
   - Impact page showcasing statistics and testimonials
   - Contact form
   - Authentication (Login/Register)

2. **Student Portal**
   - Dashboard with journey tracking and progress overview
   - Profile management
   - Browse and apply to opportunities
   - Application status tracking
   - Requirements submission and tracking
   - OJT/Experience progress monitoring
   - Attendance recording with browser geolocation verification
   - Daily report submission
   - Certificate viewing and download
   - Announcements

3. **Admin Portal**
   - Dashboard with key metrics and pending items
   - Student management
   - Programs and opportunities management
   - Application review and approval
   - Attendance verification
   - OJT monitoring and completion
   - Daily report review and approval (with automatic verified hours calculation)
   - Requirements approval/rejection
   - Certificate management
   - Announcement publishing
   - Reports and analytics

## 🚀 Quick Start

### Installation

```bash
cd hyt-foundation
npm install
```

### Run Development Server

```bash
npm start
```

The application will open at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

## 👤 Demo Accounts

### Student Account
- **Email:** christian.jay@hyt-demo.com
- **Password:** demo123
- **Name:** Christian Jay
- **Student ID:** QCU-2026-001

### Admin Account
- **Email:** admin@hyt-foundation.org
- **Password:** admin123
- **Name:** HYT Administrator

## 🎯 Complete Workflow

The system supports the full youth development journey:

1. **Discovery** - Browse opportunities on public website
2. **Registration** - Create student account
3. **Application** - Apply to opportunities with required documents
4. **Review** - Admin reviews and updates application status
5. **Acceptance** - Admin accepts application and creates OJT record
6. **Attendance** - Student records attendance with location verification
7. **Verification** - Admin verifies attendance
8. **Daily Reports** - Student submits daily work reports
9. **Approval** - Admin reviews and approves reports (verified hours added automatically)
10. **Completion** - When required hours reached, admin marks OJT complete
11. **Certificate** - Certificate automatically generated and available to student

## 🏗️ Architecture

### Technology Stack

- **React** - UI framework
- **React Router** - Routing
- **Context API + useReducer** - State management
- **localStorage** - Data persistence (temporary, backend-ready)
- **Browser Geolocation API** - Attendance verification

### Project Structure

```
src/
├── components/        # Reusable UI components
├── pages/
│   ├── public/       # Public website pages
│   ├── student/      # Student portal pages
│   └── admin/        # Admin portal pages
├── layouts/          # Layout components with navigation
├── context/          # State management
├── services/         # Business logic services
├── utils/            # Helper functions
├── routes/           # Protected route components
└── App.js            # Main application with routing
```

### Key Services

- **authService** - Authentication and user management
- **applicationService** - Application workflow
- **attendanceService** - Attendance recording and verification
- **dailyReportService** - Report submission and approval
- **ojtService** - OJT tracking and completion
- **certificateService** - Certificate generation
- **requirementService** - Document requirement management
- **storageService** - localStorage persistence

## 🔐 Security Features

- Role-based access control (Student/Admin)
- Protected routes with authentication checks
- Form validation throughout
- Frontend-ready for backend integration

## 📱 Responsive Design

- Desktop-optimized layouts
- Tablet support
- Mobile-friendly interface
- Responsive navigation and sidebars

## 🎨 Brand Colors

- Primary Orange: #D57156
- Strong Orange: #D85A3E
- Yellow: #F3DB6E
- Teal Blue: #279EB6
- Light Cyan: #8DD0DE
- Very Light Cyan: #C0EFF6

## ⚡ Key Features

### Attendance Verification System

- Browser-based geolocation verification
- Schedule validation
- Admin confirmation workflow
- Location radius checking
- Status: Pending → Verified → Active → Completed

### Daily Report & Hours Tracking

- Automatic verified hours calculation
- Report must be approved before hours are credited
- Prevents duplicate approval
- Validates report hours against attendance
- Real-time progress updates

### OJT Monitoring

- Hours tracking (Required, Verified, Pending, Remaining)
- Progress percentage
- Timeline visualization
- Completion requirements enforcement
- Automatic certificate generation on completion

### The 8 HYT Thrusts

1. Education
2. Enhancement
3. Experience
4. Entrepreneurship
5. Endurance
6. Exploration
7. Empowerment
8. Enlightenment

## 🔄 Data Flow

All data flows through centralized state management:

```
User Action → Service Layer → Dispatch → Reducer → State Update → localStorage → UI Update
```

Changes in admin portal immediately reflect in student portal and vice versa.

## 🚧 Future Backend Integration

The application is structured for easy backend integration:

- Services abstracted from UI
- Clear data models
- localStorage can be replaced with API calls
- State management ready for server synchronization

Replace service functions with API calls:
```javascript
// Current
const user = login(email, password, users);

// Future
const user = await api.post('/auth/login', { email, password });
```

## 📝 Notes

- This is a frontend-only version with localStorage persistence
- Demo data initializes automatically on first load
- No backend or database required for this version
- Geolocation verification uses browser API (not GPS hardware)
- File uploads are simulated (actual files not stored)

## 🏆 System Purpose

**"HYT connects young people to programs and opportunities, manages their applications and experience, verifies their participation, tracks their development, and supports them until completion."**

---

Built for Helping Youth Transcend Foundation Inc.
