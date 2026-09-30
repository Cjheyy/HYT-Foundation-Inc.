# OJT production migration runbook

Run these steps against the Supabase project used by the React app. The client-side code is complete, but the database owns authentication state, atomic attendance transitions, hour crediting, RLS, and Realtime publication.

## 1. Back up and apply

1. Create a Supabase backup or clone the project to staging.
2. Open **SQL Editor** and run `OJT_TRACKING_PRODUCTION_MIGRATION.sql` as one transaction/script.
3. Do not run the old attendance or registration repair scripts again. They contain incompatible status values and overlapping triggers. These files are now clearly marked **DO NOT RUN** and must stay unapplied:

   | File | Why it must not run |
   | --- | --- |
   | `UPDATE_GEOFENCED_CLOCK_IN_STATE.sql` | Recreates `geofenced_clock_in()`, a `SECURITY DEFINER` bypass that writes `time_in = NOW()` with no `auth.uid()` check. |
   | `COMPLETE_PRODUCTION_FEATURES.sql` | Same bypass plus title-case credit triggers and a 5 m geofence. |
   | `TIMER_STATE_MACHINE_MIGRATION.sql` | Restores the old single-approval state machine and a status constraint that omits `PENDING_CLOCK_IN`/`PENDING_CLOCK_OUT`. |
   | `AUTO_VOID_INCOMPLETE_LOGS.sql` | Writes the non-existent `hours_rendered` column, only targets `PENDING`, and has no scheduler. |
   | `FIX_ATTENDANCE_CLOCKOUT_RLS.sql` | Grants unrestricted `UPDATE` on the trainee's own attendance rows, which is exactly the approval bypass. |
   | `FIX_SUPABASE_500_ERRORS.sql` | Runs `GRANT ALL ON ALL TABLES`, undoing the RPC-only write model. |

The migration is written to be rerunnable. It replaces the old auth profile trigger and legacy approval RPCs, removes the legacy immediate-clock-in RPC, adds the two-stage attendance columns/statuses, installs atomic RPCs, removes duplicate hour-credit triggers, hardens the relevant RLS policies, and adds dashboard tables to `supabase_realtime`.

## 2. Verify the installation

Run these read-only checks:

```sql
select current_setting('TimeZone');

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'attendance_logs'
  and column_name in (
    'requested_at', 'pending_end_time', 'duration_seconds', 'approved_by', 'approved_at',
    'latitude', 'longitude', 'location_name'
  )
order by column_name;

select proname, proargnames
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in (
    'request_clock_in', 'request_clock_out',
    'approve_clock_in_request', 'approve_attendance_request',
    'reject_attendance_request', 'review_daily_report', 'approve_user_application',
    'reject_user_application', 'get_admin_dashboard_stats', 'expire_hyt_events',
    'hyt_void_stale_attendance', 'hyt_close_previous_attendance'
  )
order by proname;

select tgname
from pg_trigger
where tgrelid = 'public.attendance_logs'::regclass
  and not tgisinternal
order by tgname;

select pubname, schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in ('users', 'attendance_logs', 'daily_reports', 'programs', 'opportunities')
order by tablename;

-- Legacy bypass must be gone
select proname from pg_proc
where pronamespace = 'public'::regnamespace and proname = 'geofenced_clock_in';

-- Attendance must stay RPC-only
select has_table_privilege('authenticated', 'public.attendance_logs', 'INSERT') as can_insert,
       has_table_privilege('authenticated', 'public.attendance_logs', 'UPDATE') as can_update;
```

Expected attendance triggers are the HYT freeze and credit triggers. Only one trigger may credit `users.rendered_hours` for an approved attendance transition. `geofenced_clock_in` must return zero rows, and both `can_insert` and `can_update` must be `false`.

## 3. Configure the client

Use either Supabase key name in `.env`:

```env
REACT_APP_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
REACT_APP_SUPABASE_ANON_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
REACT_APP_SITE_URL=https://your-deployment-host
```

`REACT_APP_SUPABASE_PUBLISHABLE_KEY` is also supported by `src/config/supabase.js`. Never put a `service_role` key in the browser.

`REACT_APP_SITE_URL` is used for the password-reset and signup-confirmation redirects. It must be allow-listed in **Supabase → Authentication → URL Configuration → Redirect URLs**; see `AUTH_RECOVERY_SETUP.md` for the full recovery-flow requirements.

## 4. Smoke-test the lifecycle

1. Register a new account. It must show **Please wait for the admin to confirm your account**, and no trainee session may remain.
2. Try logging in before approval. The app must sign out and show the pending message.
3. In `/admin/application-review`, approve the account. The Total Applications card must decrease and Accepted Applications must increase.
4. Submit Clock In. The trainee must see **Clock-in request submitted. Waiting for Admin approval** and no running timer.
5. Accept the clock-in request. The trainee timer must start at the approval timestamp.
6. Submit Clock Out. The timer must freeze immediately at the server duration.
7. Accept the clock-out request. `users.rendered_hours` must increase once, the trainee timer must show `00:00:00`, and Pending Attendance must decrease.
8. Reject a clock-in request, then submit a new one. Approving it must start the timer at the new approval timestamp, never at the old request time.
9. Simulate a forgotten clock-out: insert a `CLOCKED_IN` row dated yesterday, then call `select public.hyt_void_stale_attendance();`. It must return at least 1 and the row must become `VOID` with `rendered_hours = 0`.
10. Refresh both browser tabs. The Supabase session and pending states must survive without a new login.
11. Open the admin dashboard in two tabs, approve a request in one, and verify the other tab's counters, queue and badge text update without a manual refresh.
12. Create a Program/Opportunity, refresh, and verify it remains in Supabase. Set a past deadline and verify it is hidden from active views.

## 5. Realtime publication

If the project uses a custom publication, add any missing tables with:

```sql
alter publication supabase_realtime add table
  public.users,
  public.attendance_logs,
  public.daily_reports,
  public.programs,
  public.opportunities;
```

The migration schedules `expire_hyt_events` hourly and `hyt_void_stale_attendance` daily at 19:05 when `pg_cron` is enabled. Without pg_cron, the admin dashboard invokes the event-expiry RPC on load, public pages always filter expired deadlines, and `request_clock_in` closes any shift left open on a previous day before creating today's row.
