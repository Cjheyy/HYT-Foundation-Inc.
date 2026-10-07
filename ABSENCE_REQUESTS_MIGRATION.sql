-- ==========================================================================
-- ABSENCE REQUESTS
--
-- Lets an OJT/Intern or Trainee tell the administrator, in advance, that they
-- cannot attend — with a reason — and lets the administrator acknowledge it.
--
-- This is intentionally NOT an approval workflow.  There are exactly two
-- states:
--
--   Submitted  the request has been filed and is waiting to be seen
--   Noted      the administrator has seen it ("Noted")
--
-- Acknowledging a request never credits or removes hours and never touches
-- attendance_logs.  Run this once, after COMPLETE_REFACTOR_SCHEMA.sql.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.absence_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  absence_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Submitted'
    CHECK (status IN ('Submitted', 'Noted')),
  admin_note TEXT,
  noted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  noted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_absence_requests_user_id
  ON public.absence_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_absence_requests_status
  ON public.absence_requests(status);
CREATE INDEX IF NOT EXISTS idx_absence_requests_date
  ON public.absence_requests(absence_date DESC);
CREATE INDEX IF NOT EXISTS idx_absence_requests_created_at
  ON public.absence_requests(created_at DESC);

-- Keep updated_at honest without relying on the client clock.
CREATE OR REPLACE FUNCTION update_absence_request_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_absence_request_timestamp ON public.absence_requests;
CREATE TRIGGER trigger_update_absence_request_timestamp
  BEFORE UPDATE ON public.absence_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_absence_request_timestamp();

-- ==========================================================================
-- ROW LEVEL SECURITY
--
-- A trainee may read and file only their own requests.  An administrator may
-- read every request and is the only role allowed to acknowledge one.
-- ==========================================================================

ALTER TABLE public.absence_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS absence_requests_select_own ON public.absence_requests;
CREATE POLICY absence_requests_select_own ON public.absence_requests
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS absence_requests_select_admin ON public.absence_requests;
CREATE POLICY absence_requests_select_admin ON public.absence_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND UPPER(u.role) = 'ADMIN'
    )
  );

DROP POLICY IF EXISTS absence_requests_insert_own ON public.absence_requests;
CREATE POLICY absence_requests_insert_own ON public.absence_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS absence_requests_update_admin ON public.absence_requests;
CREATE POLICY absence_requests_update_admin ON public.absence_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND UPPER(u.role) = 'ADMIN'
    )
  );

-- A trainee may correct the reason while it is still unacknowledged, but may
-- never set the status themselves.
DROP POLICY IF EXISTS absence_requests_update_own_pending ON public.absence_requests;
CREATE POLICY absence_requests_update_own_pending ON public.absence_requests
  FOR UPDATE USING (auth.uid() = user_id AND status = 'Submitted')
  WITH CHECK (auth.uid() = user_id AND status = 'Submitted');

-- ==========================================================================
-- REALTIME
--
-- So a filed request reaches the administrator without a manual refresh, and
-- the "Noted" reply reaches the trainee the same way.
-- ==========================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.absence_requests;
    EXCEPTION WHEN duplicate_object THEN
      NULL; -- already published
    END;
  END IF;
END $$;
