-- ============================================================================
-- HYT FOUNDATION - COMPLETE PRODUCTION FEATURES SQL SCRIPT
-- ============================================================================
-- Purpose: Geofencing, Hour Calculations, Application Review, Event Limits
-- Run this entire script in Supabase SQL Editor
-- ============================================================================

-- STEP 1: ADD GEOLOCATION COLUMNS TO ATTENDANCE_LOGS
-- ============================================================================

ALTER TABLE public.attendance_logs 
ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS location_name VARCHAR(100);

COMMENT ON COLUMN public.attendance_logs.latitude IS 'Clock-in latitude for geofencing verification';
COMMENT ON COLUMN public.attendance_logs.longitude IS 'Clock-in longitude for geofencing verification';
COMMENT ON COLUMN public.attendance_logs.location_name IS 'HYT Building or Atlanta Office';

-- STEP 2: CREATE HAVERSINE DISTANCE FUNCTION (5 METER VALIDATION)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_distance(
    lat1 NUMERIC,
    lon1 NUMERIC,
    lat2 NUMERIC,
    lon2 NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    earth_radius NUMERIC := 6371000; -- Earth radius in meters
    dlat NUMERIC;
    dlon NUMERIC;
    a NUMERIC;
    c NUMERIC;
    distance NUMERIC;
BEGIN
    -- Convert degrees to radians
    dlat := RADIANS(lat2 - lat1);
    dlon := RADIANS(lon2 - lon1);
    
    -- Haversine formula
    a := SIN(dlat / 2) * SIN(dlat / 2) +
         COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
         SIN(dlon / 2) * SIN(dlon / 2);
    
    c := 2 * ATAN2(SQRT(a), SQRT(1 - a));
    
    distance := earth_radius * c;
    
    RETURN distance;
END;
$$;

-- STEP 3: CREATE GEOFENCE VALIDATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_geofence(
    user_lat NUMERIC,
    user_lon NUMERIC
)
RETURNS TABLE(
    is_valid BOOLEAN,
    location_name TEXT,
    distance_meters NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
    hyt_building_lat NUMERIC := 14.6401;
    hyt_building_lon NUMERIC := 121.0189;
    atlanta_office_lat NUMERIC := 14.6435;
    atlanta_office_lon NUMERIC := 121.0175;
    max_distance NUMERIC := 5; -- 5 meters strict
    dist_hyt NUMERIC;
    dist_atlanta NUMERIC;
BEGIN
    -- Calculate distances
    dist_hyt := calculate_distance(user_lat, user_lon, hyt_building_lat, hyt_building_lon);
    dist_atlanta := calculate_distance(user_lat, user_lon, atlanta_office_lat, atlanta_office_lon);
    
    -- Check HYT Building first
    IF dist_hyt <= max_distance THEN
        RETURN QUERY SELECT TRUE, 'HYT Building'::TEXT, dist_hyt;
        RETURN;
    END IF;
    
    -- Check Atlanta Office
    IF dist_atlanta <= max_distance THEN
        RETURN QUERY SELECT TRUE, 'Atlanta Office'::TEXT, dist_atlanta;
        RETURN;
    END IF;
    
    -- Not within range of either location
    RETURN QUERY SELECT FALSE, 'Outside allowed locations'::TEXT, LEAST(dist_hyt, dist_atlanta);
END;
$$;

-- STEP 4: CREATE TRIGGER FOR AUTOMATIC HOUR CALCULATION ON APPROVAL
-- ============================================================================

-- Function to update rendered hours when attendance is approved
CREATE OR REPLACE FUNCTION public.update_rendered_hours_on_attendance_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only process if status changed to 'Approved'
    IF NEW.status = 'Approved' AND (OLD.status IS NULL OR OLD.status != 'Approved') THEN
        -- Update user's rendered_hours
        UPDATE public.users
        SET rendered_hours = rendered_hours + COALESCE(NEW.rendered_hours, 0),
            updated_at = NOW()
        WHERE id = NEW.user_id;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS attendance_approval_update_hours ON public.attendance_logs;

-- Create trigger
CREATE TRIGGER attendance_approval_update_hours
    AFTER UPDATE OF status ON public.attendance_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_rendered_hours_on_attendance_approval();

-- STEP 5: CREATE TRIGGER FOR AUTOMATIC HOUR CALCULATION ON OT APPROVAL
-- ============================================================================

-- Function to update rendered hours when OT request is approved
CREATE OR REPLACE FUNCTION public.update_rendered_hours_on_ot_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only process if status changed to 'Approved'
    IF NEW.status = 'Approved' AND (OLD.status IS NULL OR OLD.status != 'Approved') THEN
        -- Add OT hours to user's rendered_hours
        UPDATE public.users
        SET rendered_hours = rendered_hours + COALESCE(NEW.requested_hours, 0),
            updated_at = NOW()
        WHERE id = NEW.user_id;
        
        -- Also add to the associated attendance record if exists
        IF NEW.attendance_id IS NOT NULL THEN
            UPDATE public.attendance_logs
            SET rendered_hours = rendered_hours + COALESCE(NEW.requested_hours, 0),
                updated_at = NOW()
            WHERE id = NEW.attendance_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS ot_approval_update_hours ON public.ot_requests;

-- Create trigger
CREATE TRIGGER ot_approval_update_hours
    AFTER UPDATE OF status ON public.ot_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_rendered_hours_on_ot_approval();

-- STEP 6: CREATE PROGRESS CALCULATION VIEW
-- ============================================================================

CREATE OR REPLACE VIEW public.user_progress_view AS
SELECT 
    id,
    email,
    full_name,
    role,
    school,
    required_hours,
    rendered_hours,
    (required_hours - rendered_hours) AS remaining_hours,
    CASE 
        WHEN required_hours > 0 THEN 
            LEAST(100, (rendered_hours / required_hours * 100))
        ELSE 0 
    END AS progress_percent,
    is_active,
    created_at
FROM public.users
WHERE role IN ('OJT/Intern', 'Trainee');

-- Grant access to view
GRANT SELECT ON public.user_progress_view TO authenticated, service_role;

-- STEP 7: CREATE 3-EVENT BOOKING LIMIT FUNCTION
-- ============================================================================

-- First, ensure applications table exists with proper structure
CREATE TABLE IF NOT EXISTS public.applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE,
    opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Cancelled')),
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    admin_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT application_type_check CHECK (
        (program_id IS NOT NULL AND opportunity_id IS NULL) OR
        (program_id IS NULL AND opportunity_id IS NOT NULL)
    )
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON public.applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications(status);

-- Function to check 3-event limit
CREATE OR REPLACE FUNCTION public.check_event_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    active_count INTEGER;
BEGIN
    -- Count active applications (Pending or Approved) for opportunities only
    SELECT COUNT(*) INTO active_count
    FROM public.applications
    WHERE user_id = NEW.user_id
        AND opportunity_id IS NOT NULL
        AND status IN ('Pending', 'Approved')
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);
    
    -- Enforce 3-event limit
    IF active_count >= 3 AND NEW.opportunity_id IS NOT NULL AND NEW.status IN ('Pending', 'Approved') THEN
        RAISE EXCEPTION 'You have reached the maximum limit of 3 active event bookings. Please cancel an existing booking before applying to a new event.';
    END IF;
    
    RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS enforce_event_limit ON public.applications;

-- Create trigger
CREATE TRIGGER enforce_event_limit
    BEFORE INSERT OR UPDATE ON public.applications
    FOR EACH ROW
    EXECUTE FUNCTION public.check_event_limit();

-- STEP 8: ADD APPLICATION REVIEW COLUMNS TO USERS TABLE
-- ============================================================================

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS application_status VARCHAR(20) DEFAULT 'Pending' 
    CHECK (application_status IN ('Pending', 'Approved', 'Rejected')),
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.users(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

COMMENT ON COLUMN public.users.application_status IS 'Initial account approval status by admin';
COMMENT ON COLUMN public.users.reviewed_by IS 'Admin who reviewed the application';
COMMENT ON COLUMN public.users.reviewed_at IS 'Timestamp of account approval/rejection';
COMMENT ON COLUMN public.users.rejection_reason IS 'Reason for account rejection';

-- Update existing users to have Approved status if they're active
UPDATE public.users 
SET application_status = 'Approved' 
WHERE application_status IS NULL AND is_active = TRUE;

-- STEP 9: CREATE RPC FUNCTION FOR APPLICATION APPROVAL
-- ============================================================================

CREATE OR REPLACE FUNCTION public.approve_user_application(
    target_user_id UUID,
    admin_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    -- Check if admin has permission
    IF NOT EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = admin_id AND role = 'ADMIN'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only admins can approve applications';
    END IF;
    
    -- Update user application status
    UPDATE public.users
    SET 
        application_status = 'Approved',
        is_active = TRUE,
        reviewed_by = admin_id,
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = target_user_id;
    
    -- Return success
    SELECT json_build_object(
        'success', true,
        'message', 'Application approved successfully',
        'user_id', target_user_id
    ) INTO result;
    
    RETURN result;
END;
$$;

-- STEP 10: CREATE RPC FUNCTION FOR APPLICATION REJECTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reject_user_application(
    target_user_id UUID,
    admin_id UUID,
    reason TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    -- Check if admin has permission
    IF NOT EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = admin_id AND role = 'ADMIN'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only admins can reject applications';
    END IF;
    
    -- Validate reason
    IF reason IS NULL OR LENGTH(TRIM(reason)) < 10 THEN
        RAISE EXCEPTION 'Rejection reason must be at least 10 characters';
    END IF;
    
    -- Update user application status
    UPDATE public.users
    SET 
        application_status = 'Rejected',
        is_active = FALSE,
        reviewed_by = admin_id,
        reviewed_at = NOW(),
        rejection_reason = reason,
        updated_at = NOW()
    WHERE id = target_user_id;
    
    -- Return success
    SELECT json_build_object(
        'success', true,
        'message', 'Application rejected',
        'user_id', target_user_id
    ) INTO result;
    
    RETURN result;
END;
$$;

-- STEP 11: CREATE RPC FUNCTION FOR GEOFENCED CLOCK-IN
-- ============================================================================

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
    
    IF v_existing_record.id IS NOT NULL AND v_existing_record.time_in IS NOT NULL THEN
        SELECT json_build_object(
            'success', false,
            'error', 'Already clocked in',
            'message', 'You have already clocked in today'
        ) INTO result;
        RETURN result;
    END IF;
    
    -- Create or update attendance record
    IF v_existing_record.id IS NULL THEN
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
            'Pending'
        ) RETURNING id INTO v_attendance_id;
    ELSE
        UPDATE public.attendance_logs
        SET 
            time_in = NOW(),
            latitude = p_latitude,
            longitude = p_longitude,
            location_name = v_validation.location_name
        WHERE id = v_existing_record.id
        RETURNING id INTO v_attendance_id;
    END IF;
    
    -- Return success
    SELECT json_build_object(
        'success', true,
        'message', format('Successfully clocked in at %s', v_validation.location_name),
        'location', v_validation.location_name,
        'attendance_id', v_attendance_id,
        'time_in', NOW()
    ) INTO result;
    
    RETURN result;
END;
$$;

-- STEP 12: UPDATE RLS POLICIES FOR NEW TABLES
-- ============================================================================

-- Applications table RLS
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_view_own_applications" ON public.applications;
CREATE POLICY "users_view_own_applications"
ON public.applications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins_view_all_applications" ON public.applications;
CREATE POLICY "admins_view_all_applications"
ON public.applications FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid() AND users.role = 'ADMIN'
    )
);

DROP POLICY IF EXISTS "users_insert_own_applications" ON public.applications;
CREATE POLICY "users_insert_own_applications"
ON public.applications FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_applications" ON public.applications;
CREATE POLICY "users_update_own_applications"
ON public.applications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins_update_all_applications" ON public.applications;
CREATE POLICY "admins_update_all_applications"
ON public.applications FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid() AND users.role = 'ADMIN'
    )
);

-- Grant permissions
GRANT ALL ON public.applications TO authenticated, service_role;
GRANT SELECT ON public.applications TO anon;

-- STEP 13: CREATE PENDING APPLICATIONS VIEW FOR ADMIN
-- ============================================================================

CREATE OR REPLACE VIEW public.pending_user_applications AS
SELECT 
    u.id,
    u.email,
    u.full_name,
    u.role,
    u.school,
    u.required_hours,
    u.address,
    u.birthday,
    u.application_status,
    u.created_at,
    u.updated_at
FROM public.users u
WHERE u.application_status = 'Pending'
    AND u.role IN ('OJT/Intern', 'Trainee')
ORDER BY u.created_at ASC;

-- Grant access
GRANT SELECT ON public.pending_user_applications TO authenticated, service_role;

-- STEP 14: ADD INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_application_status ON public.users(application_status);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_location ON public.attendance_logs(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_user_date ON public.attendance_logs(user_id, date);

-- STEP 15: VERIFICATION QUERIES
-- ============================================================================

-- Test geofence validation (should return valid for HYT Building)
SELECT * FROM public.validate_geofence(14.6401, 121.0189);

-- Test geofence validation (should return invalid for random location)
SELECT * FROM public.validate_geofence(14.5000, 121.0000);

-- Check if triggers are active
SELECT 
    tgname AS trigger_name,
    tgenabled AS enabled,
    tgrelid::regclass AS table_name
FROM pg_trigger
WHERE tgname IN (
    'attendance_approval_update_hours',
    'ot_approval_update_hours',
    'enforce_event_limit'
)
ORDER BY tgname;

-- Count pending applications
SELECT 
    role,
    COUNT(*) AS pending_count
FROM public.users
WHERE application_status = 'Pending'
GROUP BY role;

-- ============================================================================
-- SCRIPT COMPLETE
-- ============================================================================

RAISE NOTICE '✅ Production features installed successfully!';
RAISE NOTICE '📍 Geofencing: HYT Building (14.6401, 121.0189) & Atlanta Office (14.6435, 121.0175)';
RAISE NOTICE '⏱️  Automatic hour calculation triggers active';
RAISE NOTICE '🎟️  3-event booking limit enforced';
RAISE NOTICE '✉️  Application review system ready';
