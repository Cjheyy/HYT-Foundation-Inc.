-- ============================================
-- FIX ATTENDANCE CLOCK-OUT 406 ERROR
-- ============================================
-- This fixes the RLS policy to allow users to update their own attendance logs
-- for clock-out operations, regardless of current status

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can update own pending attendance logs" ON public.attendance_logs;

-- Create a more permissive policy for clock-out
-- Users can update their own attendance logs (for time_out field)
CREATE POLICY "Users can update own attendance logs"
  ON public.attendance_logs FOR UPDATE
  USING (auth.uid() = user_id);

-- Note: This allows users to clock in/out on their own records
-- Admin approval logic is handled at application level
-- Admins still have full update access via their separate policy

-- Verify policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'attendance_logs' 
ORDER BY policyname;
