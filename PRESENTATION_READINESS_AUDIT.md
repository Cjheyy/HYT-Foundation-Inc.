# HYT Foundation — Presentation Readiness Audit

**Audited:** 14 Oct 2026
**Scope:** Full app — ~130 source files, ~60 routes, live Supabase DB (`qlulnldctvcjlzflpupe`)
**Verdict:** **Not ready yet — but you are 1 focused day away.** Nothing is broken in the code. What will hurt you in the presentation is the *data on screen* and *one security hole*.

---

## 🔴 BLOCKER 1 — Your database is a public leak (FIX BEFORE PRESENTING)

I probed your live DB with the public anon key — the exact key that ships inside your website's JavaScript bundle. **Any visitor can read your entire `users` table.**

```
GET /rest/v1/users?select=*
→ [{
    "email": "mabbayad.christianjay.gazzingan@gmail.com",
    "password_hash": "",          ← column is exposed
    "full_name": "Mabbayad, Christian Jay G.",
    "role": "OJT/Intern",
    "required_hours": 486,
    "is_active": false,
    ...
  }]
```

**Why this is a blocker and not a nice-to-have:** in a presentation, anyone with the browser DevTools open — or a panelist who knows Supabase — can pull your user list in one line. Right now there is 1 user so the blast radius is small, but the *policy* is what's broken. If you seed 50 demo students and then present, you've just exposed 50 real emails and names on a public endpoint.

**The `password_hash` column being empty is good news** — you're using Supabase Auth, so the real hashes live in the protected `auth.users` table, not here. This column is dead weight and should be dropped.

**Fix:** `users` should have RLS enabled with policies allowing:
- `SELECT` own row only → `id = auth.uid()`
- `SELECT` all rows → `public.is_hyt_admin()`
- plus the admin policies you already use elsewhere

I have **not touched RLS** — it can lock you out of your own app if done blind. Say the word and I'll write it as a reviewable `.sql` file first.

---

## 🔴 BLOCKER 2 — Embarrassing junk data is live on your public pages

These are **published** rows, visible to anyone:

| Table | Title | Description | Problem |
|---|---|---|---|
| `events` | **Try poo** | "HAHAHAHAH namo" | profanity test row, Published |
| `events` | Pitas Calamansi | "Pawis, Initm Asim niyan" | typo'd ("Initm"), unprofessional |
| `opportunities` | **Ge** | "qq" (org: "Brains") | placeholder gibberish, Published |
| `announcements` | New event: Pitas Calamansi | auto-generated from the junk event | junk propagates |

A panelist opening your Events page sees **"Try poo"** as the first card. This will sink the demo faster than any bug.

**Fix:** delete the junk rows, seed 5–6 realistic ones (see Blocker 3).

---

## 🔴 BLOCKER 3 — The app is functionally empty

Your code is done. Your data isn't. Live row counts:

```
programs         0   ← your flagship page is BLANK
daily_reports    0
attendance_logs  0
applications     0
requirements     0
ojt_records      0
certificates     0
opportunities    1   ← and it's "Ge"
events           2   ← and one is "Try poo"
announcements    3
users            1
```

**What a panelist will actually click through:**

| Page | What they see | Impact |
|---|---|---|
| Home | hero + motion (fine) | ✅ |
| **Programs** | empty grid | 🔴 flagship looks unfinished |
| **Events** | "Try poo" | 🔴 |
| **Opportunities** | "Ge" | 🔴 |
| Impact / About | static copy (fine) | ✅ |
| Student dashboard | login → empty everything | 🔴 |

**Fix:** seed realistic data across `programs`, `events`, `opportunities`, plus one demo student account with reports/attendance so the dashboard has something to show. This is the single highest-value hour you can spend.

---

## 🟠 HIGH — UI still in Tagalog (mixed language)

Last remaining Filipino UI file I found:

**`src/pages/admin/DtrSummary.js`** — 6 user-facing strings, lines 164, 168, 192, 241, 252:

```js
164:  showToast('Pumili muna ng OJT/trainee.', 'warning');
168:  showToast('Walang attendance record sa napiling range.', 'warning');
192:  placeholder={loading ? 'Loading…' : 'Pumili ng trainee'}
241:  <p className="dtr-empty">Pumili ng OJT/trainee para makita ang DTR preview.</p>
252:  <p className="dtr-empty">Walang attendance record sa napiling range.</p>
```

Everything else (DailyReports, DailyReportsNew) is now English. This file is the last hold-out — it's admin-only, so lower priority than the blockers, but if you demo the DTR screen in front of a panel it shows.

---

## 🟠 HIGH — Production build was broken (ALREADY FIXED)

`CI=true npx react-scripts build` was **failing** on two jsx-a11y errors in `DateField.jsx`. Vercel/Netlify run builds with `CI=true`, so **your deploy would have failed.** Fixed by adding `role="combobox"` to the date-picker trigger button.

```
Before:  Failed to compile  (DateField.jsx:443, aria-invalid / aria-required on implicit button role)
After:   Compiled successfully.
         368.54 kB (+8 B)  build/static/js/main.cc1f08af.js
         39.63 kB          build/static/css/main.ed493b9a.css
```

Also fixed earlier this session: the `daily_reports` 400 error (`PGRST204` — code sent `date`/`student_id`, live schema is `report_date`/`user_id`), the missing `slot_entries` column grant, and the unequal card heights on listing pages.

---

## 🟡 MEDIUM — Repo hygiene (looks bad if they ask to see the code)

- **67 markdown files at the repo root.** `URGENT_FIX.md`, `URGENT_FIX_NOW.md`, `RUN_THIS_NOW.md`, `SUCCESS.md`, `QUICK_FIX_SUMMARY.md`, `START_HERE.md`, `REGISTER_NOW.md`, `REFACTOR_COMPLETE_FINAL.md`… This reads as unmanaged. Keep `README.md`, move the rest to `docs/archive/`.
- **27 SQL files at the root.** Same story. Actually — the sheer number of `FIX_*` / `URGENT_*` SQL files is a story in itself; consider consolidating into one `supabase/migrations/` folder.
- **Orphan file:** `src/pages/admin/AttendanceReview.jsx` (+ its `.css`) is **not imported anywhere.** Dead code. Either wire it into `App.js` or delete it.
- **Two project copies** exist: `HYTFoundation/hyt-foundation` and `HYTFoundation-New/hyt-foundation`. The `-New` copy is missing `src/pages/admin/Events.js`. Make sure you present from the right one.

---

## ✅ What's genuinely good

Don't fix what isn't broken — I checked these and they hold up:

- **Deterministic test suite passing** (451/451 after this session's fixes).
- **Zero stray `console.log`** in source (all cleaned).
- **Zero mock/dummy data hardcoded in `src/`** — everything comes from Supabase.
- **60 routes wired correctly** across public / admin / student / trainee portals.
- **Design system is consistent** — shared `Badge`, `Button`, `Modal`, `DateField` components; card heights now aligned everywhere (verified with real Chrome measurements, not eyeballed).
- **Three-slot daily report model** (11:00 / 15:00 / 17:00) is properly modelled and tested.
- **Structured, well-commented service layer** (`supabaseService.js`) with a proper column-projection guard.

---

## Suggested order of work

| # | Task | Effort | Why first |
|---|---|---|---|
| 1 | Delete junk rows ("Try poo", "Ge", etc.) | 15 min | Visible on every demo click |
| 2 | Seed `programs` + events + opportunities + 1 demo student | 1–2 hr | Makes the app look alive |
| 3 | Fix `users` RLS exposure | 30 min | Security; do before seeding real names |
| 4 | Translate `DtrSummary.js` | 10 min | Last Tagalog hold-out |
| 5 | Repo hygiene (queue MD/SQL files) | 20 min | Only if they'll see the code |
| 6 | Delete/wire `AttendanceReview.jsx` | 5 min | Tidiness |

**Tasks 1, 3, 4, 6 I can do right now** — 1 and 4 and 6 are safe; 3 I'll give you as a reviewable SQL file first so you don't lock yourself out.

---

## Two things I need from you

1. **The `users` RLS fix** — do you want me to write it as SQL for you to review and run, or leave it alone?
2. **Seeding** — should I invent realistic HYT-style content (programs like "Community Health Outreach", "Youth Leadership Program", etc.), or do you have real content you want to paste in?
