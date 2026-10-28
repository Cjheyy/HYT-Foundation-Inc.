-- ============================================================================
-- DO NOT RUN - SUPERSEDED BY OJT_TRACKING_PRODUCTION_MIGRATION.sql
-- ----------------------------------------------------------------------------
-- Problems with running this file today:
--   1. Writes hours_rendered, but the canonical column is rendered_hours, so
--      the function fails against a migrated database.
--   2. Only voids status = 'PENDING'; active rows are 'CLOCKED_IN' and clock-out
--      requests are 'PENDING_CLOCK_OUT', so it never voids what it targets.
--   3. Has no scheduler, so nothing runs unless a new row is inserted.
--   4. Uses the database server timezone instead of Asia/Manila.
--
-- Replacement: public.hyt_void_stale_attendance() plus
-- public.hyt_close_previous_attendance(), both created and scheduled by
-- OJT_TRACKING_PRODUCTION_MIGRATION.sql.
-- ============================================================================
-- =====================================================
-- AUTO-VOID INCOMPLETE ATTENDANCE LOGS
-- 
-- Purpose: Automatically mark attendance logs as VOID
-- if user clocked in but failed to clock out by 6:05 PM
-- =====================================================

-- Function to auto-void incomplete logs past cutoff time
CREATE OR REPLACE FUNCTION auto_void_incomplete_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update logs that:
  -- 1. Have time_in but no time_out
  -- 2. Are older than today OR it's past 18:05 today
  -- 3. Status is still PENDING
  UPDATE attendance_logs
  SET 
    status = 'VOID',
    hours_rendered = 0.00,
    updated_at = NOW()
  WHERE 
    time_in IS NOT NULL 
    AND time_out IS NULL
    AND status = 'PENDING'
    AND (
      -- Logs from previous days
      DATE(time_in) < CURRENT_DATE
      OR
      -- Today's logs past 6:05 PM (18:05)
      (
        DATE(time_in) = CURRENT_DATE 
        AND CURRENT_TIME > TIME '18:05:00'
      )
    );
    
  RAISE NOTICE 'Auto-void incomplete logs executed successfully';
END;
$$;

-- Create a scheduled job to run this function daily at 6:10 PM
-- Note: This uses pg_cron extension (must be enabled in Supabase)
-- Alternative: Run this via a cron job or scheduled task externally

-- To manually run this function:
-- SELECT auto_void_incomplete_logs();

-- =====================================================
-- TRIGGER OPTION: Auto-void on new day
-- =====================================================

-- Create trigger function that runs when checking attendance
CREATE OR REPLACE FUNCTION check_and_void_yesterday_logs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- When a new attendance log is created, check yesterday's logs
  PERFORM auto_void_incomplete_logs();
  
  RETURN NEW;
END;
$$;

-- Create trigger that fires before INSERT on attendance_logs
DROP TRIGGER IF EXISTS trigger_void_yesterday_logs ON attendance_logs;
CREATE TRIGGER trigger_void_yesterday_logs
  BEFORE INSERT ON attendance_logs
  FOR EACH ROW
  EXECUTE FUNCTION check_and_void_yesterday_logs();

-- =====================================================
-- MANUAL EXECUTION
-- Run this to immediately void all incomplete logs:
-- =====================================================

SELECT auto_void_incomplete_logs();

-- =====================================================
-- VERIFICATION QUERY
-- Check logs that would be voided:
-- =====================================================

SELECT 
  id,
  student_id,
  time_in,
  time_out,
  status,
  hours_rendered,
  DATE(time_in) as log_date
FROM attendance_logs
WHERE 
  time_in IS NOT NULL 
  AND time_out IS NULL
  AND status = 'PENDING'
  AND (
    DATE(time_in) < CURRENT_DATE
    OR
    (DATE(time_in) = CURRENT_DATE AND CURRENT_TIME > TIME '18:05:00')
  )
ORDER BY time_in DESC;
