# HYT Foundation — Presentation Readiness Audit

**Audited:** 20 Oct 2026 (supersedes the 14 Oct audit)
**Scope:** ~130 source files, ~60 routes, live Supabase DB (`qlulnldctvcjlzflpupe`), live deployment (`hyt-foundation-inc.vercel.app`)
**Verdict:** **The code is ready. The deployment is not.** Every remaining blocker is data or process — none of it is a code defect.

> **Correction to the first 20 Oct draft.** Two claims in it were wrong, and the
> user was right both times:
>
> - **"There is no admin account"** — false. The SQL Editor shows **2** admin
>   accounts (`admin.test@hyt-demo.com`, `admin@hyt-foundation.org`). The admin
>   side *can* be demoed.
> - **"The `users` table is fully readable by the anon key"** — false. RLS is
>   doing its job: the anon key returns **1 of 14** rows, and the admin rows are
>   not visible at all.
>
> The mistake: a REST probe through the anon key is filtered by RLS, so a small
> row count proves nothing about what exists. Only the SQL Editor (service role)
> shows the true totals. Any future audit must read the table through both paths
> and compare, never through the anon key alone.

---

## Scorecard

| Area | State | Evidence |
|---|---|---|
| Test suite | ✅ 479 / 479 passing (31 suites) | `CI=true react-scripts test` |
| Production build | ✅ Compiles clean | `CI=true react-scripts build` |
| Live deployment | ✅ Up to date | live bundle contains `Ready to approve`, `Return for revision`, phone CSS |
| Mobile layout | ✅ No overflow, grids collapse | measured at 320–768 px |
| Tagalog copy | ✅ Zero remaining in `src/` | full sweep |
| Branding | ✅ Title / manifest / theme colour | verified in built output |
| Admin accounts | ✅ 2 exist | SQL Editor |
| `users` RLS | ✅ Filters correctly | anon sees 1 of 14, admin hidden |
| **Content in listings** | ❓ **Unverified** | see Blocker 1 |
| **Source of truth** | 🔴 **GitHub is 8 files behind** | see Blocker 2 |

---

## ❓ BLOCKER 1 — The public listings look empty, but the cause is unconfirmed

What is verified: a request made with the public anon key returns **0 rows** for
`programs`, `events`, and `opportunities`. A screenshot of the live
`/programs` and `/events` pages confirms they render **"No Programs Found"** and
**"No Events Found"** to a logged-out visitor.

What is *not* verified: whether the tables are empty, or whether they hold rows
that RLS simply does not expose to anonymous visitors. Given that the same probe
under-reported `users` by 13 rows, both explanations are still open.

**Run `CHECK_CONTENT.sql`** — it counts every table as the service role and
groups the listings by `status`. That separates the three possible causes:

| Finding | Meaning | Fix |
|---|---|---|
| `total_rows = 0` | Nothing was ever created | Seed content |
| Rows exist, `status` is Draft/Pending | Data is there but not published | Publish it |
| Rows exist, `status` is Published, anon sees 0 | RLS blocks the public listing | Fix the policy |

Until this is answered, "the site looks empty" is a symptom without a diagnosis.

**Known leftover either way:** an announcement still reads *"New event: Pitas
Calamansi — October 14, 2026"*, but that event has been deleted. It renders on
the student dashboard and points at nothing.

---

## 🔴 BLOCKER 2 — GitHub does not contain the current code

`origin/Main` is at commit `9e6f3ff` (14 Oct). The working tree has 7 modified
files and 1 new test file that were never committed:

```
src/pages/admin/DailyReports.js        362 +/-   ← new approval flow
src/pages/admin/DailyReports.css       178 +      ← admin layout + phone fixes
src/pages/student/DailyReports.css     115 +      ← phone fixes
src/pages/student/DailyReportsNew.jsx   29 +/-    ← review status for trainee
src/utils/dailyReportSlots.js           23 +      ← reviewStateOf
src/utils/dailyReportSlots.test.js      60 +      ← 13 new tests
src/layouts/AdminLayout.jsx              5 +/-    ← nav fix
src/__tests__/dailyReportPhoneLayout.test.js (new, 12 tests)
```

Proof the branch is stale:

```
git show origin/Main:src/pages/admin/DailyReports.js  | grep -c "Ready to approve"   → 0
git show origin/Main:src/pages/admin/DailyReports.css | grep -c "admin-report-card" → 0
```

The live site already serves this code, so it was deployed from local files, not
from GitHub. **The current code exists in exactly one place: this machine's
working tree.** If the folder is lost, or the project is rebuilt from GitHub, it
is gone.

---

## 🟡 Housekeeping

- **Test-looking accounts in the user list.** The admin Users page shows
  `admin.test@hyt-demo.com`, `ojt.test@hyt-demo.com`, `trainee.test@hyt-demo.com`,
  and seeded rows with placeholder UUIDs (`00000000-…0001`, `11111111-…`,
  `22222222-…`). In a presentation that reads as unfinished. Consider renaming to
  realistic names, or hiding them behind a filter.
- **One row still readable by anon.** RLS works overall, but the anon key does
  return one real profile (`mabbayad.christianjay.gazzingan@gmail.com`, name and
  role included). Worth closing, but it is one row, not a table leak.
- 67 markdown files and 27 SQL files at the repo root.
- `src/pages/admin/AttendanceReview.jsx` — imported nowhere.
- `src/pages/admin/ReportApprovals.jsx` — the old per-filing approval screen. No
  longer in the sidebar, but the route still exists and contradicts the new
  one-approval-per-day model.

---

## Suggested order of work

1. **Run `CHECK_CONTENT.sql`** — find out whether the listings are empty or
   merely unpublished.
2. **Commit and push** the 8 files so GitHub matches what is live.
3. **Seed or publish** the listings, based on what step 1 returns.
4. Remove the orphan "Pitas Calamansi" announcement.
5. Tidy the test-looking accounts.
6. Housekeeping.

---

## What is genuinely in good shape

The parts that normally sink a student project are the parts already done:

- 479 tests across 31 suites, including CSS-contract tests that fail the build if
  the card alignment or phone layout regresses.
- A production build that compiles under `CI=true`, where ESLint warnings are
  hard errors.
- The three-slot daily-report model (11:00 / 15:00 / 17:00) with one approval per
  day, gated on the 5 PM filing — a real workflow, not a CRUD demo.
- Responsive layout measured in a real browser, not eyeballed.
- Working RLS: anonymous visitors cannot read the admin accounts.
- Zero Tagalog, zero `console.log`, zero hardcoded mock data.
