-- ===========================================================================
-- PATCH_ATTENDANCE_PHOTOS.sql
--
-- Adds the photo half of attendance verification.
--
-- What this installs
--   1. Two columns on attendance_logs: photo_in_path, photo_out_path.
--   2. A PRIVATE storage bucket, `attendance-photos`.
--   3. Storage policies: a trainee may write only inside their own folder, and
--      only the owner or an administrator may read one back.
--   4. set_attendance_photo() - the only way a photo path is attached to a row,
--      because `authenticated` has no UPDATE grant on attendance_logs.
--
-- Why the bucket is private
--   These are photographs of people's faces tied to their attendance. A public
--   bucket would make every one of them readable by anyone who ever saw a URL.
--   The app asks for a short-lived signed URL instead, and the policies below
--   decide who is allowed to ask.
--
-- Why the path is stored, not a URL
--   A signed URL expires. Storing one would leave the admin queue pointing at
--   dead links within the hour.
--
-- Every statement is idempotent and independent, so this file can be re-run.
-- Run it in the Supabase SQL Editor. It returns ONE result grid at the end.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PART 1 - columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.attendance_logs
  ADD COLUMN IF NOT EXISTS photo_in_path TEXT,
  ADD COLUMN IF NOT EXISTS photo_out_path TEXT;

COMMENT ON COLUMN public.attendance_logs.photo_in_path IS
  'Storage path (not URL) of the stamped clock-in photo, inside the attendance-photos bucket.';
COMMENT ON COLUMN public.attendance_logs.photo_out_path IS
  'Storage path (not URL) of the stamped clock-out photo, inside the attendance-photos bucket.';


-- ---------------------------------------------------------------------------
-- PART 2 - the bucket
--
-- 5 MB is generous for a 1280x960 JPEG and small enough that a runaway upload
-- cannot fill the free tier. The MIME list is deliberately narrow: only the
-- two types the camera can actually produce.
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('attendance-photos', 'attendance-photos', FALSE, 5242880, ARRAY['image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE
  SET public = FALSE,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;


-- ---------------------------------------------------------------------------
-- PART 3 - storage policies
--
-- Paths are always `<user_id>/<attendance_id>-<stage>-<timestamp>.jpg`, so the
-- first folder segment is the owner. `storage.foldername(name)` returns the
-- path as a text array, and element [1] is that first segment.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "attendance photos: owner uploads" ON storage.objects;
CREATE POLICY "attendance photos: owner uploads" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attendance-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "attendance photos: owner or admin reads" ON storage.objects;
CREATE POLICY "attendance photos: owner or admin reads" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'attendance-photos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_hyt_admin()
    )
  );

DROP POLICY IF EXISTS "attendance photos: owner deletes" ON storage.objects;
CREATE POLICY "attendance photos: owner deletes" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'attendance-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ---------------------------------------------------------------------------
-- PART 4 - set_attendance_photo()
--
-- SECURITY DEFINER because attendance_logs is RPC-only: `authenticated` holds
-- no UPDATE grant on it, by design. The function therefore has to do the
-- authorisation itself, and it checks four things before writing:
--
--   * the caller is signed in;
--   * the row exists and belongs to the caller (or the caller is an admin);
--   * the path is inside the caller's own folder;
--   * the row is still open, so a rejected request cannot be re-photographed
--     after the fact to make it look legitimate.
--
-- Returns jsonb rather than raising, so the client can log a refusal without
-- losing the attendance record that was already written.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_attendance_photo(
  p_attendance_id UUID,
  p_stage TEXT,
  p_path TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_stage  TEXT := UPPER(COALESCE(p_stage, ''));
  v_row    public.attendance_logs%ROWTYPE;
  v_status TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'You are not signed in.');
  END IF;

  IF v_stage NOT IN ('CLOCK_IN', 'CLOCK_OUT') THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Unknown photo stage.');
  END IF;

  IF p_path IS NULL OR LENGTH(TRIM(p_path)) = 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'No photo path was supplied.');
  END IF;

  SELECT * INTO v_row FROM public.attendance_logs WHERE id = p_attendance_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Attendance row not found.');
  END IF;

  IF v_row.user_id <> v_uid AND NOT public.is_hyt_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'This attendance row belongs to someone else.');
  END IF;

  -- Defence in depth: the storage policy already scopes writes to the owner's
  -- folder, but a path is just a string once it reaches this function.
  IF SPLIT_PART(p_path, '/', 1) <> v_row.user_id::text THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'That photo path does not belong to this attendance row.');
  END IF;

  v_status := UPPER(COALESCE(v_row.status, ''));
  IF v_status NOT IN ('PENDING_CLOCK_IN', 'CLOCKED_IN', 'PENDING_CLOCK_OUT', 'PENDING_OUT', 'PENDING') THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'This attendance row is already closed; its photo cannot be replaced.');
  END IF;

  IF v_stage = 'CLOCK_IN' THEN
    UPDATE public.attendance_logs
       SET photo_in_path = p_path
     WHERE id = p_attendance_id;
  ELSE
    UPDATE public.attendance_logs
       SET photo_out_path = p_path
     WHERE id = p_attendance_id;
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'stage', v_stage, 'path', p_path);
END;
$$;

REVOKE ALL ON FUNCTION public.set_attendance_photo(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_attendance_photo(UUID, TEXT, TEXT) TO authenticated;


-- PostgREST caches the schema; without this the new columns and function are
-- invisible until it notices on its own.
NOTIFY pgrst, 'reload schema';


-- ---------------------------------------------------------------------------
-- VERIFY - one grid, because the SQL Editor only displays the last result set
-- ---------------------------------------------------------------------------

SELECT section, item, value
FROM (
  SELECT 1 AS ord, '1 COLUMNS' AS section, 'photo_in_path' AS item,
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'attendance_logs' AND column_name = 'photo_in_path'
         ) THEN 'present' ELSE 'MISSING' END AS value

  UNION ALL
  SELECT 1, '1 COLUMNS', 'photo_out_path',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'attendance_logs' AND column_name = 'photo_out_path'
         ) THEN 'present' ELSE 'MISSING' END

  UNION ALL
  SELECT 2, '2 BUCKET', 'attendance-photos',
         COALESCE((
           SELECT CASE WHEN public THEN 'public (WRONG - must be private)' ELSE 'private (correct)' END
             FROM storage.buckets WHERE id = 'attendance-photos'
         ), 'MISSING')

  UNION ALL
  SELECT 3, '3 POLICIES', 'attendance photos policies',
         (SELECT COUNT(*)::text FROM pg_policies
           WHERE schemaname = 'storage' AND tablename = 'objects'
             AND policyname LIKE 'attendance photos:%') || ' installed (expect 3)'

  UNION ALL
  SELECT 4, '4 FUNCTION', 'set_attendance_photo',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = 'set_attendance_photo'
         ) THEN 'present' ELSE 'MISSING' END

  UNION ALL
  SELECT 4, '4 FUNCTION', 'security definer',
         COALESCE((
           SELECT CASE WHEN p.prosecdef THEN 'yes' ELSE 'NO - would be blocked by RLS' END
             FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = 'set_attendance_photo'
         ), 'MISSING')

  UNION ALL
  SELECT 5, '5 DATA', 'rows with a clock-in photo',
         (SELECT COUNT(*)::text FROM public.attendance_logs WHERE photo_in_path IS NOT NULL)

  UNION ALL
  SELECT 5, '5 DATA', 'rows with a clock-out photo',
         (SELECT COUNT(*)::text FROM public.attendance_logs WHERE photo_out_path IS NOT NULL)
) AS report
ORDER BY ord, item;
