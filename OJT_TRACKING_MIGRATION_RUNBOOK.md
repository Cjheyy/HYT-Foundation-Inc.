# OJT production migration runbook

Run these steps against the Supabase project used by the React app. The client-side code is complete, but the database owns authentication state, atomic attendance transitions, hour crediting, RLS, and Realtime publication.

## 1. Back up and apply

1. Create a Supabase backup or clone the project to staging.
2. Open **SQL Editor** and run `OJT_TRACKING_PRODUCTION_MIGRATION.sql` as one transaction/script.
3. Do not run the old attendance or registration repair scripts again. They contain incompatible status values and overlapping triggers.

The migration is written to be rerunnable. It replaces the old auth profile trigger and legacy approval RPCs, removes the legacy immediate-clock-in RPC, adds the two-stage attendance columns/statuses, installs atomic RPCs, removes duplicate hour-credit triggers, hardens the relevant RLS policies, and adds dashboard tables to `supabase_realtime`.

## 2. Verify the installation

Run these read-only checks:

```sql
select current_setting('TimeZone');

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'attendance_logs'
  and column_name in ('requested_at', 'pending_end_time', 'duration_seconds', 'approved_by', 'approved_at')
order by column_name;

select proname, proargnames
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in (
    'request_clock_in', 'request_clock_out',
    'approve_clock_in_request', 'approve_attendance_request',
    'reject_attendance_request', 'review_daily_report', 'approve_user_application',
    'reject_user_application', 'get_admin_dashboard_stats', 'expire_hyt_events'
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
```

Expected attendance triggers are the HYT freeze and credit triggers. Only one trigger may credit `users.rendered_hours` for an approved attendance transition.

## 3. Configure the client

Use either Supabase key name in `.env`:

```env
REACT_APP_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
REACT_APP_SUPABASE_ANON_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
```

`REACT_APP_SUPABASE_PUBLISHABLE_KEY` is also supported by `src/config/supabase.js`. Never put a `service_role` key in the browser.

## 4. Smoke-test the lifecycle

1. Register a new account. It must show **Please wait for the admin to confirm your account**, and no trainee session may remain.
2. Try logging in before approval. The app must sign out and show the pending message.
3. In `/admin/application-review`, approve the account. The Total Applications card must decrease and Accepted Applications must increase.
4. Submit Clock In. The trainee must see **Clock-in request submitted. Waiting for Admin approval** and no running timer.
5. Accept the clock-in request. The trainee timer must start at the approval timestamp.
6. Submit Clock Out. The timer must freeze immediately at the server duration.
7. Accept the clock-out request. `users.rendered_hours` must increase once, the trainee timer must show `00:00:00`, and Pending Attendance must decrease.
8. Refresh both browser tabs. The Supabase session and pending states must survive without a new login.
9. Create a Program/Opportunity, refresh, and verify it remains in Supabase. Set a past deadline and verify it is hidden from active views.

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

The migration schedules `expire_hyt_events` hourly when `pg_cron` is enabled. Without pg_cron, the admin dashboard invokes the same RPC on load and public pages always filter expired deadlines.
