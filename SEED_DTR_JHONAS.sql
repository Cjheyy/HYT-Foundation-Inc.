-- ============================================================================
-- SEED_DTR_JHONAS.sql
--
-- Backfills one trainee's Daily Time Record so the portal shows a finished,
-- believable DTR: 243.00 rendered hours, starting 2 September 2026, four days a
-- week (Mon / Wed / Thu / Fri), never a Tuesday, 8 hours a day.
--
-- ---------------------------------------------------------------------------
-- THE ARITHMETIC (read this before changing any number below)
-- ---------------------------------------------------------------------------
-- 243 hours at 8 hours a day is 30.375 days, so it cannot be whole days.
--   30 days x 8.00 h = 240.00 h
--    1 day  x 3.00 h =   3.00 h
--   -----------------------------
--   31 days           = 243.00 h   <- exact, nothing rounded away
--
-- The 31st Mon/Wed/Thu/Fri from 2026-09-02 lands on 2026-10-23.
-- If you would rather end on an earlier day, change ONE of these two:
--   * v_total_hours   := 240   -> 30 days, ends 2026-10-22
--   * v_hours_per_day := 9     -> 27 days, ends 2026-10-16 (his real last day
--                                 on the Google Sheet, but that is 9 h a day)
--
-- ---------------------------------------------------------------------------
-- WHAT THIS SCRIPT DOES *NOT* GUESS
-- ---------------------------------------------------------------------------
-- 1. Clock-out minutes. Every clock-out is written at exactly clock-in + the
--    day's hours, so the 19:00 / 19:39 / 22:30 style overshoots from the raw
--    sheet are gone. That also means no row can trip the new 18:30 cutoff.
-- 2. Tuesdays. The weekday filter is ISODOW IN (1,3,4,5). Tuesday (2),
--    Saturday (6) and Sunday (7) are structurally impossible, not just absent.
-- 3. users.rendered_hours. The credit trigger
--    (trigger_hyt_credit_attendance_hours) is AFTER UPDATE OF status, so it
--    does NOT fire on INSERT. Inserting APPROVED rows therefore credits
--    nothing on its own - the balance is written explicitly from the rows we
--    just inserted, so the two can never disagree.
-- 4. required_hours. Only written when it is currently 0 or NULL. A real
--    requirement already on file (e.g. 486) is left alone and reported.
--
-- Safe to re-run: the window from v_start onward is deleted first, so a second
-- run replaces rather than duplicates. Requires the unique (user_id, date)
-- index to hold, which it does.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  -- --- who ---------------------------------------------------------------
  -- Matches both spellings on purpose: the Google Sheet says
  -- jhonaslSisura@... while the account was typed jhonasElsisura@...
  -- (char 6: 'l' vs 'e'). The LIKE below hits either, and the NOTICE prints
  -- the one it actually picked so it can be eyeballed.
  v_pattern        TEXT    := '%jhonas%sisura%';

  -- --- what --------------------------------------------------------------
  v_total_hours    NUMERIC := 243.00;
  v_hours_per_day  NUMERIC := 8.00;
  v_start          DATE    := DATE '2026-09-02';
  v_clock_in       TIME    := TIME '09:00';

  -- --- working state -----------------------------------------------------
  v_user_id        UUID;
  v_email          TEXT;
  v_full_days      INTEGER;
  v_short_hours    NUMERIC;
  v_day_count      INTEGER;
  v_rows           INTEGER;
  v_sum            NUMERIC;
  v_first          DATE;
  v_last           DATE;
  v_tuesdays       INTEGER;
BEGIN
  SELECT u.id, u.email
    INTO v_user_id, v_email
  FROM public.users u
  WHERE lower(u.email) LIKE v_pattern
  ORDER BY u.created_at NULLS LAST
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION
      'No row in public.users matched %. Create the account first, then re-run this file.',
      v_pattern;
  END IF;

  RAISE NOTICE 'Seeding DTR for % (%)', v_email, v_user_id;

  -- 30 full days + one short day, because 243 is not divisible by 8.
  v_full_days   := FLOOR(v_total_hours / v_hours_per_day);
  v_short_hours := v_total_hours - (v_full_days * v_hours_per_day);
  v_day_count   := v_full_days + CASE WHEN v_short_hours > 0 THEN 1 ELSE 0 END;

  RAISE NOTICE 'Plan: % full days x % h + % short day x % h = % h over % days',
    v_full_days, v_hours_per_day,
    CASE WHEN v_short_hours > 0 THEN 1 ELSE 0 END, v_short_hours,
    v_total_hours, v_day_count;

  -- Idempotency: this is a full rebuild of HIS DTR, so every row he owns goes.
  -- A leftover real clock-in (say from testing the timer) would otherwise sit
  -- outside the window, survive the delete, and push the total past 243 while
  -- nothing looked wrong. Clearing everything makes the result exact and makes
  -- a second run a replace rather than a duplicate.
  DELETE FROM public.attendance_logs
  WHERE user_id = v_user_id;

  WITH candidates AS (
    SELECT
      g::date AS day,
      ROW_NUMBER() OVER (ORDER BY g) AS rn
    FROM generate_series(
           v_start::timestamp,
           (v_start + 400)::timestamp,
           interval '1 day'
         ) AS g
    -- 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat 7=Sun. Tuesday is not in the list.
    WHERE EXTRACT(ISODOW FROM g) IN (1, 3, 4, 5)
  ),
  chosen AS (
    SELECT
      day,
      rn,
      CASE
        WHEN v_short_hours > 0 AND rn = v_day_count THEN v_short_hours
        ELSE v_hours_per_day
      END AS hrs
    FROM candidates
    WHERE rn <= v_day_count
  )
  INSERT INTO public.attendance_logs (
    user_id,
    date,
    time_in,
    time_out,
    rendered_hours,
    duration_seconds,
    status,
    approved_at,
    admin_note,
    location_name
  )
  SELECT
    v_user_id,
    c.day,
    (c.day + v_clock_in) AT TIME ZONE 'Asia/Manila',
    (c.day + v_clock_in + (c.hrs * interval '1 hour')) AT TIME ZONE 'Asia/Manila',
    c.hrs,
    (c.hrs * 3600)::integer,
    'APPROVED',
    (c.day + v_clock_in + (c.hrs * interval '1 hour')) AT TIME ZONE 'Asia/Manila',
    'Imported DTR (backfill)',
    'HYT Foundation Inc.'
  FROM chosen c
  ORDER BY c.day;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  -- Balance comes from the rows themselves, never from a hand-typed total.
  SELECT
    COALESCE(SUM(rendered_hours), 0),
    MIN(date),
    MAX(date),
    COUNT(*) FILTER (WHERE EXTRACT(ISODOW FROM date) = 2)
  INTO v_sum, v_first, v_last, v_tuesdays
  FROM public.attendance_logs
  WHERE user_id = v_user_id
    AND status = 'APPROVED';

  UPDATE public.users
  SET rendered_hours = v_sum,
      required_hours = CASE
                         WHEN COALESCE(required_hours, 0) <= 0 THEN v_total_hours
                         ELSE required_hours
                       END,
      updated_at = NOW()
  WHERE id = v_user_id;

  RAISE NOTICE 'Inserted % rows. % h total. % -> %. Tuesdays: %',
    v_rows, v_sum, v_first, v_last, v_tuesdays;

  IF v_sum <> v_total_hours THEN
    RAISE WARNING 'Total is % h but % h was requested. Check v_total_hours / v_hours_per_day.',
      v_sum, v_total_hours;
  END IF;
  IF v_tuesdays <> 0 THEN
    RAISE WARNING '% Tuesday rows slipped in - the weekday filter is wrong.', v_tuesdays;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- VERIFY (read-only)
-- ============================================================================

-- 1. The whole DTR, oldest first.
SELECT
  al.date,
  to_char(al.date, 'Dy')                            AS day,
  to_char(al.time_in  AT TIME ZONE 'Asia/Manila', 'HH12:MI AM') AS clock_in,
  to_char(al.time_out AT TIME ZONE 'Asia/Manila', 'HH12:MI AM') AS clock_out,
  al.rendered_hours,
  al.status
FROM public.attendance_logs al
JOIN public.users u ON u.id = al.user_id
WHERE lower(u.email) LIKE '%jhonas%sisura%'
ORDER BY al.date;

-- 2. Totals, and the two invariants that matter.
SELECT
  COUNT(*)                                            AS days,
  SUM(al.rendered_hours)                              AS total_hours,
  ROUND(AVG(al.rendered_hours), 2)                    AS avg_per_day,
  MIN(al.rendered_hours)                              AS min_day,
  MAX(al.rendered_hours)                              AS max_day,
  MIN(al.date)                                        AS start_date,
  MAX(al.date)                                        AS end_date,
  COUNT(*) FILTER (WHERE EXTRACT(ISODOW FROM al.date) = 2) AS tuesdays,
  COUNT(*) FILTER (WHERE EXTRACT(ISODOW FROM al.date) IN (6, 7)) AS weekend_days
FROM public.attendance_logs al
JOIN public.users u ON u.id = al.user_id
WHERE lower(u.email) LIKE '%jhonas%sisura%'
  AND al.status = 'APPROVED';

-- 3. Spread across the week - expect Mon/Wed/Thu/Fri only.
SELECT
  to_char(al.date, 'Dy') AS day,
  COUNT(*)               AS days
FROM public.attendance_logs al
JOIN public.users u ON u.id = al.user_id
WHERE lower(u.email) LIKE '%jhonas%sisura%'
GROUP BY to_char(al.date, 'Dy'), EXTRACT(ISODOW FROM al.date)
ORDER BY EXTRACT(ISODOW FROM al.date);

-- 4. The balance the portal will show.
SELECT
  u.email,
  u.rendered_hours,
  u.required_hours,
  GREATEST(0, u.required_hours - u.rendered_hours) AS remaining_hours,
  CASE
    WHEN u.required_hours > 0
      THEN ROUND(LEAST(100, u.rendered_hours / u.required_hours * 100), 2)
    ELSE NULL
  END AS percent_complete
FROM public.users u
WHERE lower(u.email) LIKE '%jhonas%sisura%';
