-- ============================================================================
-- DO NOT RUN - SUPERSEDED BY OJT_TRACKING_PRODUCTION_MIGRATION.sql
-- ----------------------------------------------------------------------------
-- This file creates public.geofenced_clock_in(), a SECURITY DEFINER function
-- that writes time_in = NOW() and status = 'CLOCKED_IN' immediately, for an
-- arbitrary p_user_id and without checking that the caller owns the account.
-- That is exactly the admin-approval bypass the dual-approval flow removes.
-- The canonical migration drops this function on purpose.
--
-- Canonical migration: OJT_TRACKING_PRODUCTION_MIGRATION.sql
-- ============================================================================
-- ============================================
-- UPDATE GEOFENCED_CLOCK_IN FOR STATE MACHINE
-- Sets initial status to 'CLOCKED_IN' instead of 'Pending'
-- ============================================

CREATE OR REPLACE FUNCTION public.geofenced_clock_in(
    p_user_id UUID,
    p_latitude NUMERIC,
    p_longitude NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_validation RECORD;
    v_today DATE;
    v_existing_record RECORD;
    v_attendance_id UUID;
    result JSON;
BEGIN
    -- Validate geofence
    SELECT * INTO v_validation 
    FROM public.validate_geofence(p_latitude, p_longitude);
    
    IF NOT v_validation.is_valid THEN
        SELECT json_build_object(
            'success', false,
            'error', 'Location validation failed',
            'message', format('You must be within 5 meters of HYT Building or Atlanta Office to clock in. Distance: %.2f meters', v_validation.distance_meters),
            'distance', v_validation.distance_meters
        ) INTO result;
        RETURN result;
    END IF;
    
    -- Check for existing record today
    v_today := CURRENT_DATE;
    
    SELECT * INTO v_existing_record
    FROM public.attendance_logs
    WHERE user_id = p_user_id 
        AND date = v_today
    LIMIT 1;
    
    -- Check if already clocked in today
    IF v_existing_record.id IS NOT NULL AND v_existing_record.time_in IS NOT NULL THEN
        -- If status is CLOCKED_IN, already actively clocked in
        IF v_existing_record.status = 'CLOCKED_IN' THEN
            SELECT json_build_object(
                'success', false,
                'error', 'Already clocked in',
                'message', 'You are already clocked in and timer is running'
            ) INTO result;
            RETURN result;
        END IF;
        
        -- If status is PENDING_APPROVAL, waiting for admin
        IF v_existing_record.status = 'PENDING_APPROVAL' THEN
            SELECT json_build_object(
                'success', false,
                'error', 'Clock-out pending approval',
                'message', 'Your clock-out request is pending admin approval. You cannot clock in again today.'
            ) INTO result;
            RETURN result;
        END IF;
        
        -- If status is APPROVED or REJECTED, already completed for today
        IF v_existing_record.status IN ('APPROVED', 'REJECTED', 'VOID') THEN
            SELECT json_build_object(
                'success', false,
                'error', 'Already completed for today',
                'message', 'You have already completed your attendance for today. Please try again tomorrow.'
            ) INTO result;
            RETURN result;
        END IF;
    END IF;
    
    -- Create new attendance record with CLOCKED_IN status
    INSERT INTO public.attendance_logs (
        user_id,
        date,
        time_in,
        latitude,
        longitude,
        location_name,
        status
    ) VALUES (
        p_user_id,
        v_today,
        NOW(),
        p_latitude,
        p_longitude,
        v_validation.location_name,
        'CLOCKED_IN'  -- CRITICAL: Initial state is CLOCKED_IN (timer actively running)
    ) RETURNING id INTO v_attendance_id;
    
    -- Return success
    SELECT json_build_object(
        'success', true,
        'message', 'Successfully clocked in',
        'attendance_id', v_attendance_id,
        'location', v_validation.location_name,
        'distance', v_validation.distance_meters,
        'status', 'CLOCKED_IN'
    ) INTO result;
    
    RETURN result;
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.geofenced_clock_in IS 'Clock-in with geofence validation. Sets status to CLOCKED_IN (active timer state).';
