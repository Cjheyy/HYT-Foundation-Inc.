-- ==========================================================================
-- CHECK ONE ACCOUNT  ·  read-only
--
-- Paste the whole file in the Supabase SQL Editor. It only SELECTs, so nothing
-- can be changed by accident.
--
-- Why this file exists: the anon key the app ships with cannot read
-- `public.users` (RLS returns a single row for everyone else), so "does this
-- account exist?" cannot be answered from outside the database. The SQL Editor
-- runs as the owner and can see both `public.users` and `auth.users`.
--
-- TWO SPELLINGS ARE CHECKED ON PURPOSE
--
--   form / sheet : jhonaslsisura.dreamacademy@gmail.com   (jhonas + lsisura)
--   typed        : jhonaselsisura.dreamacademy@gmail.com  (jhonas + elsisura)
--                                  ^ the "e" is the difference
--
-- The name is "Elsisura", so the second spelling is the natural one and the
-- sheet looks like it is missing a letter. Which of the two is the real Google
-- account decides everything below, so both are queried side by side.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. The profile row(s), either spelling
-- --------------------------------------------------------------------------
SELECT id,
       email,
       full_name,
       role,
       application_status,
       is_active,
       required_hours,
       rendered_hours,
       created_at
FROM public.users
WHERE lower(email) LIKE '%jhonas%sisura%'
ORDER BY created_at;

-- --------------------------------------------------------------------------
-- 2. The Auth account itself (this is what login actually checks)
--    `email_confirmed_at` NULL means the confirmation link was never clicked.
-- --------------------------------------------------------------------------
SELECT id,
       email,
       email_confirmed_at,
       created_at,
       last_sign_in_at,
       (email_confirmed_at IS NOT NULL) AS email_confirmed
FROM auth.users
WHERE lower(email) LIKE '%jhonas%sisura%'
ORDER BY created_at;

-- --------------------------------------------------------------------------
-- 3. The verdict - the same rule the login screen applies
--
--    pending  -> allowed (direct login; admin approval is enforced when
--                applying for a posting and when clocking in)
--    rejected -> blocked
--    is_active = false AND the account has already been reviewed -> blocked
--                (that is a real deactivation, not the old registration
--                default, which is why pending accounts are exempt)
-- --------------------------------------------------------------------------
SELECT u.email,
       u.application_status,
       u.is_active,
       UPPER(COALESCE(u.application_status, '')) AS status_norm,
       CASE
         WHEN UPPER(COALESCE(u.application_status, '')) IN ('REJECTED', 'DECLINED', 'DENIED')
           THEN 'BLOCKED - application rejected'
         WHEN COALESCE(u.is_active, TRUE) = FALSE
              AND UPPER(COALESCE(u.application_status, '')) NOT IN
                  ('PENDING', 'PENDING_APPROVAL', 'PENDING_APPLICATION', 'SUBMITTED', 'APPLIED')
           THEN 'BLOCKED - account deactivated (admin must reactivate)'
         WHEN COALESCE(u.is_active, TRUE) = FALSE
              AND UPPER(COALESCE(u.application_status, '')) = ''
           THEN 'BLOCKED - is_active = false with NO application_status (set one of them)'
         ELSE 'CAN LOG IN'
       END AS login_verdict
FROM public.users u
WHERE lower(u.email) LIKE '%jhonas%sisura%';

-- --------------------------------------------------------------------------
-- 4. Can he actually clock in? Needs an APPROVED placement of either kind.
--    An approved EVENT does not count - it is not a placement.
-- --------------------------------------------------------------------------
SELECT u.email,
       a.id AS application_id,
       a.status,
       CASE
         WHEN a.opportunity_id IS NOT NULL THEN 'OJT Posting'
         WHEN a.program_id IS NOT NULL THEN 'Trainee Program'
         WHEN a.event_id IS NOT NULL THEN 'Event (does NOT unlock clock-in)'
         ELSE 'unknown target'
       END AS kind,
       a.created_at
FROM public.users u
JOIN public.applications a ON a.user_id = u.id
WHERE lower(u.email) LIKE '%jhonas%sisura%'
ORDER BY a.created_at DESC;

-- --------------------------------------------------------------------------
-- 5. What is already recorded for him
-- --------------------------------------------------------------------------
SELECT u.email,
       COUNT(*) FILTER (WHERE TRUE) AS attendance_rows,
       COUNT(*) FILTER (WHERE UPPER(al.status) = 'APPROVED') AS approved_rows,
       COALESCE(SUM(al.rendered_hours), 0) AS total_hours
FROM public.users u
LEFT JOIN public.attendance_logs al ON al.user_id = u.id
WHERE lower(u.email) LIKE '%jhonas%sisura%'
GROUP BY u.email;

-- ==========================================================================
-- HOW TO READ THE RESULT
--
--   * Query 1 returns nothing  -> the account was never created (or was created
--     with a third spelling). Nothing else in this file can work until it
--     exists.
--
--   * Query 1 returns ONE row, query 2 returns ONE row, both the same spelling
--     -> good. Query 3 says whether he can sign in.
--
--   * Query 2 returns a row but query 1 does not -> the Auth user exists with no
--     profile. The `handle_new_user` trigger did not fire. He can authenticate
--     but the app will say "profile is incomplete".
--
--   * Query 2 shows email_confirmed_at NULL -> he never clicked the confirmation
--     email. He cannot sign in and will see "Invalid email or password".
--
--   * Query 3 says "is_active = false with NO application_status" -> this is the
--     one combination that the deactivation rule treats as a real deactivation.
--     Fix it with:
--
--         UPDATE public.users
--            SET application_status = 'PENDING_APPROVAL'
--          WHERE lower(email) LIKE '%jhonas%sisura%'
--            AND COALESCE(application_status, '') = '';
--
--   * Query 4 returns only an Event, or nothing -> he can log in but the
--     Attendance page will stay locked ("apply for an OJT Posting"). An admin
--     has to approve an OJT Posting or Trainee Program application first.
-- ==========================================================================
