# 🚀 SUPABASE SETUP GUIDE (TAGALOG)

Boss, eto yung **EXACT STEPS** para ma-setup yung users sa database!

---

## ✅ **METHOD 1: AUTO-CREATE 3 DEMO USERS (2 MINUTES - RECOMMENDED)**

### **STEP 1: Pumunta sa SQL Editor**

**Direct Link:** 
👉 **https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/editor**

O kaya:
1. Open mo yung Supabase Dashboard: https://supabase.com/dashboard
2. Click yung project mo: **qlulnldctvcjlzflpupe**
3. Sa left sidebar, hanapin mo yung icon na mukhang **</>** o **SQL Editor**
4. Click yan

---

### **STEP 2: Open New Query**

Sa SQL Editor page:
1. May makikita kang button na **"+ New query"** (green/blue button sa taas-kanan)
2. Click yan
3. May lalabas na blank text area (malaking white box)

---

### **STEP 3: Copy yung Seed Data File**

**Sa VS Code mo:**
1. Hanapin yung file na **`supabase-seed-data.sql`** (nasa root folder)
2. Open mo yung file
3. **Select All** - Press `Ctrl + A` (Windows) o `Cmd + A` (Mac)
4. **Copy** - Press `Ctrl + C` (Windows) o `Cmd + C` (Mac)

**Yung file mo dapat may ganito:**
```sql
-- Insert demo users
INSERT INTO auth.users ...
INSERT INTO public.users ...
-- Insert programs
INSERT INTO programs ...
-- etc...
```

---

### **STEP 4: Paste sa SQL Editor**

**Balik sa Supabase SQL Editor:**
1. Click yung malaking white text box
2. **Paste** - Press `Ctrl + V` (Windows) o `Cmd + V` (Mac)
3. Dapat makita mo na yung buong SQL code

---

### **STEP 5: RUN!**

1. Sa bottom-right o top-right, may button na **"Run"** o **"▶️ Run"**
2. **Click yan!**
3. Wait 2-3 seconds
4. Dapat mag-green yung result at may message:
   - ✅ "Success. No rows returned"
   - OR ✅ "X rows inserted"

**KUNG MAY ERROR:**
- Screenshot mo yung error
- Send mo sakin
- Ayusin natin

---

### **STEP 6: Verify na May Users Na**

**Check if successful:**
1. Sa left sidebar, click **"Authentication"** (icon: 🔒 lock)
2. Click **"Users"** 
3. **Dapat may 3 users ka na dito:**
   - ✅ admin@hyt-foundation.org
   - ✅ christian.jay@hyt-demo.com
   - ✅ maria.santos@hyt-demo.com

**Direct Link:** https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/auth/users

---

### **STEP 7: Disable Email Verification (IMPORTANTE!)**

**Para di na mag-require ng email verification:**
1. Go to: https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/auth/settings
2. Scroll down sa **"Email Auth"** section
3. Find **"Confirm email"**
4. **Toggle OFF** (grey dapat, not green)
5. Click **"Save"** if may button

---

### **STEP 8: LOGIN SA WEBSITE! 🎉**

**Balik sa website mo:**
1. Go to http://localhost:3002 (or kung anong port mo)
2. Click **"Login"**
3. **Option A: Use Demo Login**
   - Click **"Login as Student (Demo)"** button
   
4. **Option B: Manual Login**
   - Email: `christian.jay@hyt-demo.com`
   - Password: `demo123`
   - Account Type: Select **"Training"**
   - Click **"Login"**

5. ✅ **SUCCESS!** Dapat:
   - May **toast notification**: "✅ Login successful"
   - **Redirect** to `/student` dashboard
   - May **data** na from Supabase (programs, opportunities, etc.)

---

## 🎯 **DEMO ACCOUNTS CREATED:**

After running seed data, meron ka nang:

### **1. Admin Account**
- Email: `admin@hyt-foundation.org`
- Password: `admin123`
- Access: Admin dashboard, all features

### **2. Student Account 1 (Christian)**
- Email: `christian.jay@hyt-demo.com`
- Password: `demo123`
- Account Type: Training
- Access: Student dashboard, applications, OJT

### **3. Student Account 2 (Maria)**
- Email: `maria.santos@hyt-demo.com`
- Password: `demo123`
- Account Type: Personal Development
- Access: Student dashboard, applications

---

## ❌ **TROUBLESHOOTING:**

### **Problem: Hindi ko makita yung SQL Editor**
**Solution:** 
- Direct link: https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/editor
- Refresh yung page
- Make sure naka-login ka sa Supabase

### **Problem: May error pagka-run ng SQL**
**Solution:**
- Check if may existing data na (baka nag-run ka na before)
- Try to clear table first, then run ulit
- Screenshot yung error, send mo sakin

### **Problem: May users na pero di pa rin maka-login**
**Solution:**
- Check if email verification is OFF (Step 7)
- Try yung Demo Login button instead
- Check console for errors (F12)

### **Problem: Naka-login pero walang data**
**Solution:**
- Check if nag-run successfully yung seed data
- Check Table Editor: https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/editor
- Dapat may data sa: programs, opportunities, announcements

### **Problem: "Invalid login credentials" pa rin**
**Solution:**
- Verify na may users sa Authentication > Users
- Verify na may data sa Table Editor > users table
- Check if passwords match (demo123)

---

## 📱 **QUICK LINKS:**

- **SQL Editor:** https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/editor
- **Authentication Users:** https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/auth/users
- **Auth Settings:** https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/auth/settings
- **Table Editor:** https://supabase.com/dashboard/project/qlulnldctvcjlzflpupe/editor

---

## 🎯 **SUMMARY:**

1. ✅ Open SQL Editor (link sa taas)
2. ✅ Click "New query"
3. ✅ Copy `supabase-seed-data.sql` from VS Code
4. ✅ Paste sa SQL Editor
5. ✅ Click "Run"
6. ✅ Check Authentication > Users (dapat may 3)
7. ✅ Disable "Confirm email" sa Auth Settings
8. ✅ Login sa website using demo accounts
9. ✅ DONE! 🎉

---

**TAPOS NA YAN IN 2 MINUTES! Let's gooo!** 🚀

**Sabihin mo sakin kung nag-work or kung may error!**
