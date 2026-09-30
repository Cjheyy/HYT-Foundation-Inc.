-- HYT Foundation: slots + certificates hardening
-- Run this in Supabase SQL editor. All statements are idempotent.

-- 1. Total slots tracking for programs / opportunities
ALTER TABLE programs ADD COLUMN IF NOT EXISTS total_slots INTEGER;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS total_slots INTEGER;
-- Backfill total_slots from the legacy available_slots column.
UPDATE programs SET total_slots = available_slots WHERE total_slots IS NULL AND available_slots IS NOT NULL;
UPDATE opportunities SET total_slots = available_slots WHERE total_slots IS NULL AND available_slots IS NOT NULL;

-- 2. Certificates: recipient email + issuance metadata.
-- The app stores the recipient email so a certificate issued by email
-- appears on the matching dashboard even before student_id linkage is known.
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(255);
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS recipient_email VARCHAR(255);
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS certificate_type VARCHAR(100);
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS hours_completed INTEGER;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS signatory_one_name VARCHAR(255);
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS signatory_one_title VARCHAR(255);
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS signatory_two_name VARCHAR(255);
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS signatory_two_title VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_certificates_recipient_email ON certificates(recipient_email);

-- 3. Helpful indexes for slot + dashboard queries
CREATE INDEX IF NOT EXISTS idx_programs_available_slots ON programs(available_slots);
CREATE INDEX IF NOT EXISTS idx_opportunities_available_slots ON opportunities(available_slots);
CREATE INDEX IF NOT EXISTS idx_applications_type_status ON applications(type, status);

-- 4. Atomic slot decrement helper (prevents overselling when two trainees apply at once).
CREATE OR REPLACE FUNCTION decrement_event_slots(p_table TEXT, p_id UUID)
RETURNS TABLE (available_slots INTEGER, total_slots INTEGER) AS $$
DECLARE
  v_available INTEGER;
  v_total INTEGER;
BEGIN
  IF p_table = 'programs' THEN
    UPDATE programs
    SET available_slots = GREATEST(0, COALESCE(available_slots, 0) - 1),
        updated_at = NOW()
    WHERE id = p_id AND COALESCE(available_slots, 0) > 0
    RETURNING programs.available_slots, programs.total_slots INTO v_available, v_total;
  ELSIF p_table = 'opportunities' THEN
    UPDATE opportunities
    SET available_slots = GREATEST(0, COALESCE(available_slots, 0) - 1),
        updated_at = NOW()
    WHERE id = p_id AND COALESCE(available_slots, 0) > 0
    RETURNING opportunities.available_slots, opportunities.total_slots INTO v_available, v_total;
  ELSE
    RAISE EXCEPTION 'Unknown event table: %', p_table;
  END IF;

  IF v_available IS NULL THEN
    RAISE EXCEPTION 'No slots available';
  END IF;

  RETURN QUERY SELECT v_available, v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
