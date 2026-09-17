# HYT Foundation - Supabase Database Setup

## Ano'ng gagawin:

### Step 1: Create Supabase Project
1. Go to [https://supabase.com](https://supabase.com)
2. Sign up / Login
3. Create new project
4. Set project name at password

### Step 2: Run yung SQL Schema
1. Sa Supabase dashboard, pumunta sa **SQL Editor**
2. Click **"New Query"**
3. Open yung file na `supabase-schema.sql`
4. Copy lahat ng content
5. Paste sa SQL Editor
6. Click **"Run"**
7. ✅ Dapat makita mo: "Success. No rows returned"

### Step 3: Load Demo Data (Optional)
1. Ulit, sa **SQL Editor**, click **"New Query"**
2. Open yung file na `supabase-seed-data.sql`
3. Copy lahat ng content
4. Paste sa SQL Editor
5. Click **"Run"**
6. ✅ Mag-create ng demo users at sample data

### Step 4: Verify
1. Go to **Table Editor** sa Supabase
2. Makikita mo yung 12 tables:
   - users
   - programs
   - opportunities
   - applications
   - ojt_records
   - attendance
   - daily_reports
   - requirements
   - certificates
   - announcements
   - notifications
   - settings

## Tapos na! 🎉

Database mo ready na sa Supabase. Pwede mo na i-connect sa frontend kapag ready ka na.

---

## Files na kailangan mo:
- ✅ `supabase-schema.sql` - Database structure (12 tables, indexes, RLS, triggers)
- ✅ `supabase-seed-data.sql` - Demo data for testing

---

## Demo Accounts (kung nag-run ka ng seed data):
- **Admin**: admin@hyt-foundation.org / admin123
- **Student (Training)**: christian.jay@hyt-demo.com / demo123
- **Student (OJT)**: maria.santos@hyt-demo.com / demo123

---

**Note**: Code changes at connections gagawin mo na lang later. Schema lang muna 'to!
