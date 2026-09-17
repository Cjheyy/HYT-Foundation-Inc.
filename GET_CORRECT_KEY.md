# 🔑 HOW TO GET THE CORRECT SUPABASE KEY

Boss, may problema - yung key mo is **WRONG TYPE**!

---

## ❌ What You Have Now (WRONG):
```
sb_publishable_lTmWk0VU_LB2RdEhVcw4gA_4Y5uGF1o
```

This is a **PUBLISHABLE KEY** - for Stripe billing/payments. **NOT for Supabase!**

---

## ✅ What You Need (CORRECT):
A JWT token that looks like:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsdWxubGRjdHZjamx6ZmxwdXBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDk4NjQwMDAsImV4cCI6MjAyNTQ0MDAwMH0.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```
(Around 300+ characters, starts with `eyJ`)

---

## 📋 Steps to Get It:

### 1. Go to Supabase API Settings:
**Direct link:** https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/settings/api

### 2. Scroll down to "Project API keys" section

You'll see something like:
```
┌─────────────────────────────────────────────┐
│ Project API keys                            │
├─────────────────────────────────────────────┤
│                                             │
│ ✅ anon                        public       │
│    eyJhbGciOiJIUzI1NiIsInR5cCI6IkpX...     │
│    [📋 Copy]  👈 CLICK THIS ONE!            │
│                                             │
│ ❌ service_role                secret       │
│    eyJhbGciOiJIUzI1NiIsInR5cCI6IkpX...     │
│    [📋 Copy]  DON'T CLICK THIS!             │
│                                             │
└─────────────────────────────────────────────┘
```

### 3. Copy the **"anon" "public"** key
- Click the 📋 Copy button on the FIRST key (anon)
- NOT the second one (service_role)
- NOT the sb_publishable_ key

### 4. Open `.env` file in your project

### 5. Replace this line:
```env
REACT_APP_SUPABASE_ANON_KEY=sb_publishable_lTmWk0VU_LB2RdEhVcw4gA_4Y5uGF1o
```

### 6. With:
```env
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
(Paste the key you copied)

### 7. Save the file

### 8. Restart server:
```bash
Ctrl+C
npm start
```

---

## ✅ How to Know if Correct:

After restart, check console:
- ❌ If you see: **"MISSING SUPABASE CREDENTIALS"** or **"WRONG KEY TYPE"** → Key is still wrong
- ✅ If those errors are gone → Key is correct!

---

## 🎯 Visual Guide:

**Where to look in Supabase Dashboard:**

```
Supabase Dashboard
└── Your Project (qlulnldctvcjlzflpupe)
    └── Settings (⚙️ icon on left sidebar)
        └── API
            └── Project API keys
                └── anon / public 👈 THIS ONE!
                    [📋 Copy]
```

---

## 🚨 Common Mistakes:

1. ❌ Using `sb_publishable_...` (this is for Stripe payments)
2. ❌ Using `service_role` key (this is secret, for backend only)
3. ❌ Using project reference ID instead of JWT token
4. ❌ Forgetting to restart server after changing .env

---

## 💡 Once you have the correct key:

The website will:
- ✅ Connect to Supabase
- ✅ Show login page without errors
- ✅ Allow you to register/login
- ✅ Fetch data from database

---

**Just get that anon key and paste it - that's it!** 🎉
