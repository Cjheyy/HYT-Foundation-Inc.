-- ===========================================================================
-- VERIFY / DIAGNOSE: the clock-in approval gate
--
-- Read-only. Nothing here can change data, so a mistake in this file cannot
-- roll back anything.
--
-- Replace YOUR_EMAIL before running.
-- ===========================================================================

-- 0. THE ONE THAT MATTERS: what does your account actually look like?
--    `application_status` is the REGISTRATION state. It is not supposed to be
--    the clock-in gate any more - what matters is the approved application in
--    query 2. If `application_status` is PENDING_APPROVAL while query 2 shows an
--    APPROVED posting, the old gate was simply asking the wrong question.
SELECT id, email, role, is_active, application_status
FROM public.users
WHERE email = 'YOUR_EMAIL';

-- 1. The applications behind that account. The three keys matter - an approved
--    EVENT application must not open the clock-in gate.
SELECT a.id,
       a.status,
       a.opportunity_id,
       a.program_id,
       a.created_at
FROM public.applications a
JOIN public.users u ON u.id = a.user_id
WHERE u.email = 'YOUR_EMAIL'
ORDER BY a.created_at DESC;

-- 2. Which of those actually satisfies the new gate. Expect >= 1 row.
--    Same rule the RPC uses: a posting or a programme, not an event. Written
--    without `event_id` so this runs even if that column is missing.
SELECT a.id, a.status, a.opportunity_id, a.program_id
FROM public.applications a
JOIN public.users u ON u.id = a.user_id
WHERE u.email = 'YOUR_EMAIL'
  AND (a.program_id IS NOT NULL OR a.opportunity_id IS NOT NULL)
  AND UPPER(COALESCE(a.status, '')) IN ('APPROVED', 'ACCEPTED', 'ACTIVE');

-- 3. The guard trigger exists. Expect 1 row: hyt_guard_application_status,
--    BEFORE INSERT OR UPDATE.
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'applications'
ORDER BY trigger_name, event_manipulation;

-- 4. The RPC still has the five-argument signature (the gate change must not
--    have dropped the geofence parameters). Expect 1 row with p_accuracy.
SELECT p.proname, pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'request_clock_in';

-- 5. Self-approval is now impossible from the client. This should FAIL with
--    "Application status can only be set by an administrator".
--    Run it while signed in as the trainee, NOT as an admin, and expect an
--    error - an error here is the pass.
-- UPDATE public.applications SET status = 'Approved' WHERE user_id = auth.uid();
