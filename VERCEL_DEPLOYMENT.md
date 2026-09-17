# 🚀 Vercel Deployment Guide

## ✅ Environment Variables for Vercel

When deploying to Vercel, add these environment variables:

### **In Vercel Dashboard:**

1. Go to your project → Settings → Environment Variables
2. Add these 2 variables:

```
REACT_APP_SUPABASE_URL=https://qlulnldctvcjlzflpupe.supabase.co
REACT_APP_SUPABASE_PUBLISHABLE_KEY=sb_publishable_lTmWk0VU_LB2RdEhVcw4gA_4Y5uGF1o
```

### **Important:**
- Environment: Select **All** (Production, Preview, Development)
- These are already in your `.env` file for local development

---

## 📦 Build Settings

- **Framework Preset**: Create React App
- **Build Command**: `npm run build`
- **Output Directory**: `build`
- **Install Command**: `npm install`

---

## ✅ Ready to Deploy!

Your app is now configured to work with Vercel using the publishable key.

Just push to GitHub and Vercel will auto-deploy! 🎉
