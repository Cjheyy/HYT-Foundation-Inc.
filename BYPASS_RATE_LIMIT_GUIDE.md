# How to Bypass Supabase Email Rate Limit (429 Errors)

## Problem
Supabase enforces email rate limits during development, causing `429 Too Many Requests` errors when testing registration/login frequently.

## Solutions

### Option 1: Use Email Confirmations Disabled (Quickest for Local Dev)

1. **Go to Supabase Dashboard:**
   ```
   https://supabase.com/dashboard/project/YOUR_PROJECT_ID/auth/settings
   ```

2. **Navigate to:** Authentication → Settings → Email Auth

3. **Disable Email Confirmations:**
   - Toggle OFF: "Enable email confirmations"
   - This allows instant signups without email verification

4. **Update Your Code** (if needed):
   ```javascript
   // In your authService.js
   const { data, error } = await supabase.auth.signUp({
     email,
     password,
     options: {
       data: { full_name, role, school, etc... },
       emailRedirectTo: undefined // No email confirmation needed
     }
   });
   ```

### Option 2: Use Unique Emails with Timestamp (Testing)

```javascript
// Generate unique test emails
const testEmail = `test+${Date.now()}@gmail.com`;
const testEmail2 = `demo+${Math.random().toString(36)}@gmail.com`;

// Gmail ignores everything after + so all go to test@gmail.com
// But Supabase treats them as different accounts
```

### Option 3: Use Gmail + Trick (Unlimited Emails)

Gmail ignores dots and plus signs:
```
yourname+test1@gmail.com
yourname+test2@gmail.com
your.name+dev@gmail.com
y.o.u.r.n.a.m.e@gmail.com
```

All deliver to `yourname@gmail.com` but Supabase sees them as unique.

### Option 4: Use Temporary Email Services

For quick testing without your real email:
- https://temp-mail.org
- https://10minutemail.com
- https://guerrillamail.com

### Option 5: Increase Rate Limits (Paid Plans Only)

1. Go to Project Settings → Billing
2. Upgrade to Pro plan ($25/month)
3. Rate limits increase significantly

### Option 6: Use Service Role Key for Testing (Backend Only)

**⚠️ NEVER expose this in frontend code!**

```javascript
// Only for backend/testing scripts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'YOUR_SUPABASE_URL',
  'YOUR_SERVICE_ROLE_KEY' // Found in Settings → API
);

// This bypasses rate limits but is DANGEROUS in frontend
```

### Option 7: Wait and Retry

Rate limits reset after:
- **1 hour** for most auth operations
- **24 hours** for email verification requests

Add retry logic:
```javascript
const signUpWithRetry = async (email, password, userData, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: userData }
      });
      
      if (!error) return { data, error: null };
      
      if (error.message.includes('429')) {
        console.log(`Rate limited, retrying in ${(i + 1) * 5} seconds...`);
        await new Promise(resolve => setTimeout(resolve, (i + 1) * 5000));
        continue;
      }
      
      return { data: null, error };
    } catch (e) {
      if (i === retries - 1) throw e;
    }
  }
};
```

### Option 8: Use Local Supabase Instance

**For advanced development:**

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Initialize local project:
   ```bash
   cd your-project
   supabase init
   supabase start
   ```

3. Update your `.env`:
   ```
   REACT_APP_SUPABASE_URL=http://localhost:54321
   REACT_APP_SUPABASE_ANON_KEY=your_local_anon_key
   ```

4. No rate limits locally!

## Recommended for Your Project

**For Development:**
1. Disable email confirmations (Option 1)
2. Use Gmail + trick for testing (Option 3)

**For Production:**
- Re-enable email confirmations
- Set up proper SMTP (Supabase Settings → Auth → SMTP)
- Consider upgrading plan if high traffic

## Quick Fix Now

Run this in your browser console on Supabase dashboard:
```javascript
// This disables confirmations temporarily
// Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/auth/settings
// Find "Enable email confirmations" toggle
// Turn it OFF
```

Or update your registration code:
```javascript
// In src/services/authService.js
export const register = async (userData) => {
  const { data, error } = await supabase.auth.signUp({
    email: userData.email,
    password: userData.password,
    options: {
      data: {
        full_name: userData.fullName,
        role: userData.role,
        school: userData.school,
        required_hours: userData.requiredHours,
        address: userData.address,
        birthday: userData.birthday
      },
      // Add this to skip email confirmation during dev
      emailRedirectTo: window.location.origin + '/login'
    }
  });

  if (error) throw error;
  
  // User is immediately available without email confirmation
  return data;
};
```

## Testing After Fix

1. Run `FIX_SUPABASE_500_ERRORS.sql` in Supabase SQL Editor
2. Disable email confirmations in Auth settings
3. Test registration with new email
4. Should login immediately without 500 errors

---

**Need Help?** Check Supabase docs: https://supabase.com/docs/guides/auth/auth-email
