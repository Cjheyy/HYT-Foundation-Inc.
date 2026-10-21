-- ==========================================================================
-- VERIFY · absence review
--
-- READ ONLY.  Nothing here writes.
-- ==========================================================================

-- 1. The status CHECK now allows all three decisions.  Expect one row whose
--    definition mentions Accepted and Rejected.
SELECT con.conname AS constraint_name,
       pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND rel.relname = 'absence_requests'
  AND con.contype = 'c';

-- 2. Nothing is still sitting on the retired 'Noted' value.  Expect 0.
SELECT COUNT(*) AS legacy_noted_rows
FROM public.absence_requests
WHERE UPPER(status) = 'NOTED';

-- 3. The guard trigger is installed.  Expect 1.
SELECT COUNT(*) AS guard_triggers
FROM pg_trigger t
JOIN pg_class rel ON rel.oid = t.tgrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND rel.relname = 'absence_requests'
  AND t.tgname = 'hyt_guard_absence_status_trg'
  AND NOT t.tgisinternal;

-- 4. Current spread of decisions.
SELECT status, COUNT(*) AS total
FROM public.absence_requests
GROUP BY status
ORDER BY status;

-- 5. Any rejected row without a usable reason would be a bug.  Expect 0.
SELECT COUNT(*) AS rejected_without_reason
FROM public.absence_requests
WHERE UPPER(status) = 'REJECTED'
  AND (admin_note IS NULL OR LENGTH(TRIM(admin_note)) < 10);
