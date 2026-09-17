# 🔧 Troubleshooting Guide

## ❌ Website not appearing / Blank page

### Check #1: Browser Console
1. Press **F12** to open Developer Tools
2. Go to **Console** tab
3. Look for errors (red text)
4. Send mo screenshot ng error if meron

### Check #2: Environment Variables
Open `.env` file - dapat may laman na:
```env
REACT_APP_SUPABASE_URL=https://qlulnldctvcjlzflpupe.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJ... (your actual anon key)
```

**If walang laman or placeholder pa:**
1. Go to https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/settings/api
2. Copy the **"anon public"** key
3. Paste sa `.env` file

**After updating .env:**
```bash
# Stop the server (Ctrl+C)
# Restart
npm start
```

### Check #3: Network Tab
1. F12 → **Network** tab
2. Refresh page
3. Look for failed requests (red)
4. Click on failed request to see error details

### Check #4: Common Errors

**Error: "Missing environment variables"**
- **Fix**: Add your Supabase URL and anon key to `.env`

**Error: "Failed to fetch"**
- **Fix**: Check internet connection
- **Fix**: Verify Supabase project is active (not paused)
- **Fix**: Check if URL and key are correct

**Error: "Cannot read properties of undefined"**
- **Fix**: Database might be empty
- **Fix**: Run `supabase-seed-data.sql` in Supabase

**Error: "RLS policy violation"**
- **Fix**: Re-run `supabase-schema.sql` to create RLS policies

**Blank white screen:**
- **Fix**: Check browser console for JavaScript errors
- **Fix**: Clear browser cache (Ctrl+Shift+Delete)
- **Fix**: Try incognito mode

### Check #5: Port Already in Use
If you see "Something is already running on port 3000":
- Close other instances
- OR choose a different port (Y)

---

## 📸 For Quick Help:
Send screenshot ng:
1. Browser console (F12)
2. Network tab errors
3. Your `.env` file (HIDE the anon key!)

---

## ✅ Quick Test
Try this in browser console (F12):
```javascript
console.log(process.env.REACT_APP_SUPABASE_URL);
```

Should show your Supabase URL. If shows `undefined`, restart server.
