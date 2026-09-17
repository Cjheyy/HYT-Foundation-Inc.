# 🔌 Supabase Connection Guide

## ✅ Installed na:
- `@supabase/supabase-js` - Supabase client library

## 📁 Files Created:
1. **`src/config/supabase.js`** - Supabase client config
2. **`src/services/supabaseService.js`** - API functions
3. **`.env`** - Environment variables (ADD YOUR CREDENTIALS HERE!)

---

## 🔑 Step 1: Get Your Supabase Credentials

1. Go to your Supabase project dashboard
2. Click **Settings** (gear icon sa sidebar)
3. Click **API** 
4. Copy these 2 values:
   - **Project URL** (nasa "Config" section)
   - **anon public** key (nasa "Project API keys" section)

---

## 📝 Step 2: Update .env File

Open `.env` file sa root ng project mo, palitan mo yung:

```env
REACT_APP_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL_HERE
REACT_APP_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY_HERE
```

Dapat ganito ang hitsura:
```env
REACT_APP_SUPABASE_URL=https://abcdefghijklmno.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ubyIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjk...
```

**IMPORTANTE**: Huwag i-commit yung `.env` sa git! (Already in .gitignore)

---

## 🚀 Step 3: Test the Connection

```bash
npm start
```

Open browser console (F12) at tingnan kung may errors.

Kung gumagana, dapat makita mo sa Network tab:
- Requests to `*.supabase.co`
- Status 200 OK

---

## 🧪 Step 4: Test na May Data

Subukan login gamit ang demo account:
- Email: `christian.jay@hyt-demo.com`
- Password: `demo123`

Kung nag-run ka ng `supabase-seed-data.sql`, dapat may data na sa database.

---

## 📊 Available API Functions

Meron ka nang mga functions para:

### Users
- `getUsers()` - Get all users
- `getUserById(userId)` - Get specific user
- `updateUser(userId, updates)` - Update user

### Programs
- `getPrograms()` - Get all programs

### Opportunities
- `getOpportunities()` - Get all opportunities

### Applications
- `getApplications()` - Get all applications
- `createApplication(data)` - Create new application

### OJT Records
- `getOjtRecords()` - Get all OJT records

### Attendance
- `getAttendance()` - Get all attendance
- `createAttendance(data)` - Create attendance record

### Daily Reports
- `getDailyReports()` - Get all reports
- `createDailyReport(data)` - Create new report

### Requirements
- `getRequirements()` - Get all requirements

### Certificates
- `getCertificates()` - Get all certificates

### Announcements
- `getAnnouncements()` - Get published announcements

### Notifications
- `getNotifications(userId)` - Get user notifications

### Settings
- `getSettings()` - Get app settings

---

## 💡 How to Use

Example sa component mo:

```javascript
import { getOpportunities } from '../services/supabaseService';

function MyComponent() {
  useEffect(() => {
    async function fetchData() {
      try {
        const opportunities = await getOpportunities();
        console.log('Opportunities:', opportunities);
      } catch (error) {
        console.error('Error:', error);
      }
    }
    fetchData();
  }, []);
}
```

---

## ⚠️ Common Issues

### Issue: "Missing environment variables"
**Fix**: Check if `.env` file exists and has correct values

### Issue: "Failed to fetch"
**Fix**: 
1. Verify Supabase project URL is correct
2. Check if anon key is correct
3. Make sure project is not paused (free tier auto-pauses)

### Issue: "RLS policy error"
**Fix**: Run `supabase-schema.sql` again to create RLS policies

---

## ✅ Checklist

- [ ] Installed `@supabase/supabase-js`
- [ ] Created `.env` file
- [ ] Added REACT_APP_SUPABASE_URL
- [ ] Added REACT_APP_SUPABASE_ANON_KEY
- [ ] Ran `npm start` without errors
- [ ] Can see Supabase requests in Network tab
- [ ] Demo login working

---

**Ready ka na mag-code ng integrations! 🎉**

Next: Connect mo na yung AppContext para mag-fetch from Supabase instead of localStorage.
