-- ============================================
-- TIMER STATE MACHINE MIGRATION
-- Implements proper work timer approval flow
-- State Machine: CLOCKED_IN → PENDING_APPROVAL → APPROVED/REJECTED
-- ============================================

-- Step 1: Drop existing status constraint
ALTER TABLE public.attendance_logs 
DROP CONSTRAINT IF EXISTS attendance_logs_status_check;

-- Step 2: Add new status values to support state machine
-- States:
--   CLOCKED_IN: User has clocked in, timer is actively running
--   PENDING_APPROVAL: User has clocked out, timer frozen, waiting for admin approval
--   APPROVED: Admin approved the session, hours deducted from required_hours
--   REJECTED: Admin rejected the session, no hours deducted
--   VOID: Auto-voided due to missing clock-out before end of day
ALTER TABLE public.attendance_logs 
ADD CONSTRAINT attendance_logs_status_check 
CHECK (status IN ('CLOCKED_IN', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'VOID'));

-- Step 3: Add new fields to support state machine logic
-- pending_end_time: Captures the frozen timestamp when user clicks "Clock Out"
-- approved_at: Timestamp when admin approved the session
-- approved_by: Admin user ID who approved/rejected the session
-- duration_seconds: Calculated duration when clock out is triggered (frozen value)
ALTER TABLE public.attendance_logs 
ADD COLUMN IF NOT EXISTS pending_end_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.users(id),
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

-- Step 4: Update existing records to use new status values
-- Convert 'Pending' → 'PENDING_APPROVAL'
-- Keep 'Approved' → 'APPROVED'
-- Keep 'Rejected' → 'REJECTED'
UPDATE public.attendance_logs 
SET status = CASE 
  WHEN status = 'Pending' THEN 'PENDING_APPROVAL'
  WHEN status = 'Approved' THEN 'APPROVED'
  WHEN status = 'Rejected' THEN 'REJECTED'
  ELSE status
END
WHERE status IN ('Pending', 'Approved', 'Rejected');

-- Step 5: Create function to calculate and freeze duration on clock-out
CREATE OR REPLACE FUNCTION freeze_timer_on_pending()
RETURNS TRIGGER AS $$
BEGIN
  -- When status changes to PENDING_APPROVAL
  IF NEW.status = 'PENDING_APPROVAL' AND OLD.status = 'CLOCKED_IN' THEN
    -- Capture the pending end time (frozen timestamp)
    NEW.pending_end_time := NOW();
    
    -- Calculate duration in seconds (frozen value)
    IF NEW.time_in IS NOT NULL THEN
      NEW.duration_seconds := EXTRACT(EPOCH FROM (NEW.pending_end_time - NEW.time_in))::INTEGER;
    END IF;
    
    -- Calculate rendered_hours from frozen duration
    IF NEW.duration_seconds IS NOT NULL THEN
      NEW.rendered_hours := NEW.duration_seconds / 3600.0;
    END IF;
  END IF;
  
  -- When admin approves
  IF NEW.status = 'APPROVED' AND OLD.status = 'PENDING_APPROVAL' THEN
    -- Set approval timestamp
    NEW.approved_at := NOW();
    
    -- Set final time_out from pending_end_time
    NEW.time_out := NEW.pending_end_time;
    
    -- Ensure rendered_hours is calculated
    IF NEW.duration_seconds IS NOT NULL THEN
      NEW.rendered_hours := NEW.duration_seconds / 3600.0;
    END IF;
  END IF;
  
  -- When admin rejects
  IF NEW.status = 'REJECTED' AND OLD.status = 'PENDING_APPROVAL' THEN
    -- Set approval timestamp (for audit trail)
    NEW.approved_at := NOW();
    
    -- Zero out hours since rejected
    NEW.rendered_hours := 0;
    NEW.time_out := NULL;
  END IF;
  
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS trigger_calculate_attendance_hours ON public.attendance_logs;

-- Create new trigger for state machine transitions
DROP TRIGGER IF EXISTS trigger_freeze_timer_on_pending ON public.attendance_logs;
CREATE TRIGGER trigger_freeze_timer_on_pending
  BEFORE UPDATE ON public.attendance_logs
  FOR EACH ROW
  EXECUTE FUNCTION freeze_timer_on_pending();

-- Step 6: Create function to update user's rendered_hours when admin approves
CREATE OR REPLACE FUNCTION update_user_hours_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Only when status changes from PENDING_APPROVAL to APPROVED
  IF NEW.status = 'APPROVED' AND OLD.status = 'PENDING_APPROVAL' THEN
    -- Add approved hours to user's rendered_hours
    UPDATE public.users 
    SET rendered_hours = rendered_hours + NEW.rendered_hours,
        updated_at = NOW()
    WHERE id = NEW.user_id;
    
    -- Log for debugging
    RAISE NOTICE 'Added % hours to user % (Total rendered_hours will be updated)', 
      NEW.rendered_hours, NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update user hours on approval
DROP TRIGGER IF EXISTS trigger_update_user_hours_on_approval ON public.attendance_logs;
CREATE TRIGGER trigger_update_user_hours_on_approval
  AFTER UPDATE ON public.attendance_logs
  FOR EACH ROW
  WHEN (NEW.status = 'APPROVED' AND OLD.status = 'PENDING_APPROVAL')
  EXECUTE FUNCTION update_user_hours_on_approval();

-- Step 7: Create function to calculate milestone percentage
CREATE OR REPLACE FUNCTION get_milestone_percentage(p_user_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_required_hours NUMERIC;
  v_rendered_hours NUMERIC;
  v_percentage NUMERIC;
BEGIN
  SELECT required_hours, rendered_hours 
  INTO v_required_hours, v_rendered_hours
  FROM public.users 
  WHERE id = p_user_id;
  
  -- Calculate percentage
  IF v_required_hours > 0 THEN
    v_percentage := (v_rendered_hours / v_required_hours) * 100;
    -- Cap at 100%
    IF v_percentage > 100 THEN
      v_percentage := 100;
    END IF;
  ELSE
    v_percentage := 0;
  END IF;
  
  RETURN ROUND(v_percentage, 2);
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create view for admin attendance review
CREATE OR REPLACE VIEW admin_pending_attendance AS
SELECT 
  al.id,
  al.user_id,
  u.full_name,
  u.email,
  u.school,
  u.role,
  al.date,
  al.time_in,
  al.pending_end_time,
  al.duration_seconds,
  al.rendered_hours,
  al.status,
  al.created_at,
  al.updated_at,
  -- Calculate elapsed time display
  TO_CHAR((al.duration_seconds || ' seconds')::INTERVAL, 'HH24:MI:SS') as elapsed_time_display
FROM public.attendance_logs al
JOIN public.users u ON al.user_id = u.id
WHERE al.status = 'PENDING_APPROVAL'
ORDER BY al.created_at ASC;

-- Step 9: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_attendance_pending_approval 
  ON public.attendance_logs(status) 
  WHERE status = 'PENDING_APPROVAL';

CREATE INDEX IF NOT EXISTS idx_attendance_approved_by 
  ON public.attendance_logs(approved_by) 
  WHERE approved_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_duration 
  ON public.attendance_logs(duration_seconds) 
  WHERE duration_seconds IS NOT NULL;

-- Step 10: Add comment documentation
COMMENT ON COLUMN public.attendance_logs.status IS 'State machine: CLOCKED_IN → PENDING_APPROVAL → APPROVED/REJECTED/VOID';
COMMENT ON COLUMN public.attendance_logs.pending_end_time IS 'Frozen timestamp when user clicks Clock Out (before admin approval)';
COMMENT ON COLUMN public.attendance_logs.duration_seconds IS 'Frozen duration in seconds when Clock Out is triggered';
COMMENT ON COLUMN public.attendance_logs.approved_at IS 'Timestamp when admin approved or rejected';
COMMENT ON COLUMN public.attendance_logs.approved_by IS 'Admin user ID who approved/rejected the session';

-- Step 11: Verify migration
SELECT 
  'Migration Complete' as status,
  COUNT(*) FILTER (WHERE status = 'PENDING_APPROVAL') as pending_count,
  COUNT(*) FILTER (WHERE status = 'APPROVED') as approved_count,
  COUNT(*) FILTER (WHERE status = 'REJECTED') as rejected_count,
  COUNT(*) FILTER (WHERE status = 'VOID') as void_count
FROM public.attendance_logs;

-- Display current state machine configuration
SELECT 
  'State Machine Configured' as info,
  'CLOCKED_IN → PENDING_APPROVAL → APPROVED/REJECTED' as flow;
