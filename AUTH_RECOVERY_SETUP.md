# Password recovery & session persistence setup

The app ships a single-step Supabase recovery link (no OTP screen). This file
lists the Supabase project settings the flow depends on, plus the behaviour that
was changed so a recovery link and a normal session can no longer be confused.

## 1. Environment

```env
REACT_APP_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
REACT_APP_SUPABASE_ANON_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
REACT_APP_SITE_URL=https://your-deployment-host
```

`REACT_APP_SUPABASE_ANON_KEY` accepts either the legacy `eyJ…` anon JWT or the
newer `sb_publishable_…` key. Both are public by design; never ship a
`service_role` key to the browser. The anon key is now a client-supplied public
value, so `REACT_APP_SITE_URL` is used for every auth redirect instead of the
live `window.location.origin`.

## 2. Supabase → Authentication → URL Configuration

| Setting | Value |
| --- | --- |
| Site URL | `https://your-deployment-host` |
| Redirect URLs | `https://your-deployment-host/reset-password`, `https://your-deployment-host/auth/confirm`, `https://your-deployment-host/login`, plus `http://localhost:3000/**` for local development |

If the reset link's host is not allow-listed, Supabase silently redirects to the
Site URL and the trainee never reaches `/reset-password`.

## 3. Supabase → Authentication → Email Templates

Both reset-email templates are supported:

- **Legacy implicit** (`{{ .RedirectTo }}`): the Supabase client consumes the
  fragment automatically and fires `PASSWORD_RECOVERY`.
- **Default `{{ .TokenHash }}`**: the link lands on `/auth/confirm?token_hash=…&type=recovery`,
  which the `AuthConfirm` route exchanges with `verifyOtp()` before redirecting
  to `/reset-password`.

`src/config/supabase.js` pins `flowType: 'implicit'` so the client-side fragment
handling stays predictable; the `token_hash` path works regardless of that
setting. Email confirmation should redirect to `/login`, because a confirmed
account is still pending admin approval.

## 4. SPA deep links

`BrowserRouter` requires the host to serve `index.html` for unknown paths.
`vercel.json` and `public/_redirects` are committed for Vercel and Netlify. If
you deploy elsewhere, add the equivalent rewrite, otherwise a direct visit to
`/reset-password` returns 404.

## 5. Session behaviour after this change

- `AppContext` is the single authority for authentication. It reports
  `authenticated` only after a live Supabase session **and** the matching
  public profile validate, and every async auth job is generation-guarded so a
  logout cannot be undone by an in-flight profile request.
- `TOKEN_REFRESHED` and tab focus no longer re-download the whole portal; they
  only reconcile a changed identity.
- A failed profile read keeps the session and shows a **Try again** screen
  instead of silently signing the user out.
- Logout verifies the persisted session is gone. If Supabase returns an error,
  the stored token is cleared and the UI reports the failure rather than
  claiming success.
- `ProtectedRoute` performs no network calls; it renders only when the provider
  has validated the current identity, so a cross-tab account switch can never
  render one frame of the previous user's page.
- `/reset-password` requires a real `PASSWORD_RECOVERY` event. Opening it from a
  normal session, or reusing an expired link, shows an explicit
  "link is no longer valid" card instead of a blank page, and any normal session
  that happens to be open can no longer change the password from that page.

## 6. Verification

1. `npm run test:ci` — password policy, error mapping and attendance status
   resolution are unit tested.
2. `npm run lint` and `npm run build` must be clean.
3. Manual: request a reset link, open it in a private window, set a new
   password, and confirm the redirect to `/login` and the need to sign in again.
4. Manual: sign in, leave the tab idle past the JWT lifetime, then interact with
   a protected page. No redirect to `/login` should occur and no data reload
   storm should appear in the network tab.
5. Manual: sign out, then reload. The user must stay signed out.
