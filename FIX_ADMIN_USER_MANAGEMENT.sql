-- ============================================================================
-- HYT Foundation — FIX: admin cannot Activate / Deactivate (or Delete) a user
-- ============================================================================
-- Run ONCE in the Supabase SQL Editor.  Idempotent — safe to re-run.
--
-- SYMPTOM
-- ----------------------------------------------------------------------------
--   PATCH /rest/v1/users?id=eq.<id>&select=... -> 403
--   "permission denied for table users"
--
-- CAUSE
-- ----------------------------------------------------------------------------
-- OJT_TRACKING_PRODUCTION_MIGRATION.sql deliberately restricted client writes to
-- the users table:
--
--   REVOKE INSERT, DELETE ON public.users FROM anon, authenticated;
--   REVOKE UPDATE ON public.users FROM authenticated;
--   GRANT UPDATE (full_name, first_name, last_name, profile_picture, school,
--                 course, year_level, birthday, age, address, contact_number,
--                 last_login) ON public.users TO authenticated;
--
-- `is_active` is NOT in that column list, and DELETE is revoked outright.  So the
-- admin's toggle and delete are refused.  Re-granting the columns directly would
-- be wrong: the RLS policy allows a user to update their own row, so any trainee
-- could flip their own `is_active`.
--
-- FIX
-- ----------------------------------------------------------------------------
-- Two admin-gated SECURITY DEFINER RPCs.  The table stays read-only for clients.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Activate / deactivate an account (admin only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_user_active(
  p_user_id UUID,
  p_is_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_hyt_admin() THEN
    RAISE EXCEPTION 'Administrator privileges required';
  END IF;

  UPDATE public.users
  SET is_active = COALESCE(p_is_active, FALSE),
      updated_at = NOW()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'user_id', p_user_id,
    'is_active', COALESCE(p_is_active, FALSE)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_active(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_active(UUID, BOOLEAN) TO authenticated;


-- ---------------------------------------------------------------------------
-- 2. Delete an account (admin only)
--    Removes the profile row.  The matching auth.users entry is NOT touched —
--    deleting that requires the service_role key and is out of scope here.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_hyt_admin() THEN
    RAISE EXCEPTION 'Administrator privileges required';
  END IF;

  DELETE FROM public.users WHERE id = p_user_id;

  RETURN jsonb_build_object('success', TRUE, 'user_id', p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_account(UUID) TO authenticated;


-- ---------------------------------------------------------------------------
-- 3. Verify
-- ---------------------------------------------------------------------------
SELECT p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('set_user_active', 'delete_user_account')
ORDER BY p.proname;

NOTIFY pgrst, 'reload schema';
