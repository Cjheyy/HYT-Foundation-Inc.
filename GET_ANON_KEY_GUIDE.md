# 🔑 How to Get Your Anon Key (TAGALOG)

Boss, sundin mo lang to EXACTLY:

---

## ✅ Step 1: Go to API Settings

**Link:** https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/settings/api

---

## ✅ Step 2: Find "Project API keys"

Scroll down until you see this section:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Project API keys
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

anon                              public
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOi...
[Copy]  👈 CLICK THIS BUTTON!

service_role                      secret
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOi...
[Copy]  ❌ DON'T copy this one!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## ✅ Step 3: Copy the ANON key

- Click **Copy** button sa **anon** row (NOT service_role!)
- Yung key should start with: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- It's a VERY LONG string (300+ characters)

---

## ✅ Step 4: Paste to .env file

Open `.env` file and replace:

```env
REACT_APP_SUPABASE_URL=https://qlulnldctvcjlzflpupe.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (paste dito!)
```

**IMPORTANT:** 
- Hindi `PUBLISHABLE_KEY` - dapat `ANON_KEY`!
- Hindi `sb_publishable_...` - dapat `eyJ...`!

---

## ✅ Step 5: Restart Server

```bash
# Press Ctrl+C to stop
npm start
```

---

## ✅ Step 6: Test

1. Open http://localhost:3000
2. Click "Login as Student (Demo)"
3. If may user na sa database, dapat mag-login!

---

## 🚨 Common Mistakes:

❌ **MALI:** `sb_publishable_lTmWk0VU_LB2RdEhVcw4gA_4Y5uGF1o`
   - Yan billing key, hindi API key!

❌ **MALI:** `service_role` key
   - Yan secret key, for backend only!

✅ **TAMA:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSI...`
   - Yung mahaba, starting with eyJ

---

## 📌 After getting key:

1. Check if may user na sa database (check Supabase Table Editor)
2. If wala pa, either:
   - Register new account, OR
   - Run `supabase-seed-data.sql` to create demo accounts

Demo accounts (after seed data):
- **Student:** christian.jay@hyt-demo.com / demo123
- **Admin:** admin@hyt-foundation.org / admin123

---

**Yan lang! Once you add the correct anon key, TAPOS NA! 🎉**
