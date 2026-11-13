# TEAM GTD FINALE — realtime collaborative board (handoff)

A team GTD + Kanban board, rebuilt from the original single-file HTML artifact
into a modern React app with **real-time multi-user collaboration**, hosted for
free on **Netlify** (frontend) + **Supabase** (Postgres + realtime).

This README doubles as the project handoff: what it does, how it's built, the
full file map, how to run and deploy it, and how to extend it.

- **Stack:** React 18 + Vite + TypeScript + Tailwind CSS · Supabase (Postgres
  realtime, auto REST) · Netlify static hosting.
- **Repo:** `Gualbertol123/prova_sito_GTD`. Active work is on branch
  `claude/hopeful-noether-u6oblf` (Netlify currently deploys this branch). The
  frontend lives entirely in `web/`; there is **no custom backend server** — the
  browser talks straight to Supabase.
- **Look:** navy `#0A1931`, gold `#C9A96E`, cream backgrounds; **Cinzel**
  (display) + **Inter** (body) fonts. Bilingual **Italian / English**.

---

## 1. Feature tour (by tab)

| Tab | What it does |
| --- | --- |
| **BOARD** | Kanban with 6 columns (Backlog · Next · In Progress · Waiting · Done · Maybe) **and** a List view (toggle, remembered). Cards expand **inline** (no popups) into a full editor: assignees, priority pills, due date, description, notes, a **File Directory** field with a copy button, a "move to section" dropdown, prev/next arrows, and drag-reorderable subtasks. Columns fill the width edge-to-edge, wrap instead of scrolling, can be shown/hidden (**Columns** editor), and resized in an **edit-layout** mode (neighbours adjust). Below the columns are two full-width collapsible bars, each with its own search: a **Done** bar (this week's completed tasks — a searchable mirror of the DONE column, cards stay in the column too) and an **Archived** bar (tasks completed more than a week ago, auto-moved out of the DONE column). A **Team** panel (collapsed) manages members; a collapsible **priority distribution** chart; a full new-task bar (choose assignees/priority/status/due up front); search + owner/priority/Focus-P1 filters. A task can be held by **one person or several** — open the assignee pill to tick names; the first one stays the `owner` column, so filters and the weekly recap all count a shared task for everyone on it. Below Archived, a **Menu mensa** bar (open by default) shows the canteen menu of today and the next four menu days — today highlighted, its dish of the day in the bar's header — from `web/src/data/menu.json` (§8, updated monthly; past days never shown). A **Names** toggle next to **Columns** blanks every owner name on the board (cards, list rows, the expanded editor and the new-task bar) so you can screenshot it — it is per-session only and names are always back on next load. |
| **PROJECTS** | Two filters, **Ongoing** and **Completed**. A project's status is never set by hand: it is *ongoing* until it has linked board tasks and **every one is DONE**, then it moves to *completed* on its own (dated by its last task's completion), and back to ongoing if a task is reopened or a new one is added. **Ongoing** shows figures (ongoing, completed this week, need attention, open tasks), search, a lead filter, sorting, and two views: **Cards** (colour, priority, progress ring, a bar of its tasks by status, overdue count, next task due, leads, target date, health badge) and **Timeline** (start-to-target bars with progress and a line for today). **Completed** works like the board's Done/Archived: **Recently completed** (last 7 days) as cards, then a collapsible **Older** list. A project's **page** has name, priority, start/target dates, colour, leads, a short description, a progress ring, health (on track / at risk / overdue), tasks per status, a time-vs-work strip, a small **Notes** box, and the **Tasks** section: a status breakdown, a new-task form (title, status, priority, holder, due date) that creates the task on the board already linked, a picker to link an existing board task, search and a person filter, and two views — a **List** grouped by status (tick done, change status inline, due/overdue chips, holders, subtasks, waiting days, unlink, open the full task editor; completed tasks hidden until shown) and a **Board** of the project's tasks where cards are dragged between columns. Progress = linked tasks in DONE ÷ linked tasks. Each project also chooses how its tasks reach the main board (**On the BOARD**: *All tasks* · *In sequence* · *Project only*): in sequence only the current step — the first task in the project's order that is not DONE — is on the BOARD, and when it is done the next one appears there by itself (the list then shows numbered steps with ▲ ▼ to reorder; board cards show *Step n/N*); *Project only* keeps them off the BOARD altogether. Tasks kept off the BOARD are also left out of the report's Next and Planner pages and the mail update's next steps, but still count in Done and appear in the Calendar. On the BOARD, a task card shows its project as a coloured chip and the task editor has a project picker. Projects used to have checklists; a project that still holds one shows it once, with **Turn into tasks** / **Copy into notes**. Needs migration 015 (§3); before it, projects have a name only and the tab says what to run. |
| **WEEKLY** | Weekly review: a "Recap" block auto-fills from tasks completed **this week** (with owner + subtask progress), a collapsible **Archived** section for tasks done more than a week ago, plus 5 editable retro columns: WINS · LEARNINGS · TO IMPROVE · BLOCKERS · FOCUS NEXT WEEK. |
| **REPORT** | Builds the weekly report as **A4 pages in Liquid Glass** (light mode) right in the tab (see §5): a cover with the week's numbers, then Done, Next, Projects and the Planner. Click any text on the pages to edit it; hover a card and press × to leave it out; **Download PDF** saves exactly what is on screen. The old Intesa Sanpaolo Word template is still one click away as **Word (classic template)**. |
| **CALENDAR** | Month grid; drag a task onto a day to set its due date. Click any task to open its full details in the left panel. Day cells grow to fit all their items. |
| **REFLECTION** | **Personal**, behind a per-user password (initial password `password`; choose your name + password to enter, with a "remember on this device for" duration incl. Forever). Log one entry per day with 4 fields (Done today · What went well · What to improve · Learning notes); see only **your own** recent entries and a **spaced-repetition review** (1/3/7/14/30-day intervals + random). Inside you can change your own password (the current one is required). Passwords are stored as **bcrypt hashes** and checked by the database (`reflection_login`); 5 wrong tries lock that name for 5 minutes; an admin resets a forgotten one from Supabase (§11). A **Diary / Notes** switch at the top of the tab, behind the same password, holds **Personal notes**: free-form notes only you see, in the `personal_notes` table (the chip carries their count, and the tab reopens on whichever half you used last). Private from outsiders, but *within the team* the privacy is in the interface only — see §11. |
| **SETTINGS** | Custom logo (round header box) + favicon upload (rasterised & downscaled, ≤5 MB input); change the shared team password (current one required; logs every other device out); login duration; log out this device. Subtitle is edited **inline** by double-clicking it in the header. |

### 1b. On a phone

A phone-sized screen (767 px wide or less) gets a separate **mobile version**
built for one hand, on the same board, live sync, data and operations; nothing
about the desktop changes. Five tabs at the bottom:

| Tab | What it does |
| --- | --- |
| **Oggi / Today** | What needs *you*: your overdue and due-today tasks, what you are in the middle of, the next 7 days, what you are waiting on (longest first), the week's done count, and the canteen's dish of the day (tap for the full menu). The tab shows a badge with your overdue + due-today count. |
| **Board** | One column per page: swipe sideways, or tap a column pill (with counts). Cards are sorted by priority, then due date. Search, **Only mine** and P1–P4 filters. DONE shows this week; archived ones are one tap away. Each column has **Add here**. |
| **Progetti / Projects** | Ongoing / Completed. Cards with a progress ring, a bar of tasks by status, health, target date, open and overdue counts. A project opens as a sheet: its tasks by column, add a task to it, notes. Dates, colour, leads and step order are edited on the desktop. |
| **Agenda** | A week strip (dots = tasks due), the chosen day's tasks, overdue ones on today, then the next two weeks. Add a task straight onto a day. Shows every dated task, like the desktop calendar. |
| **Altro / More** | Weekly review (stacked, mobile-native), Mail update, and the desktop Report, Reflection, Products and Settings screens. |

On any task card the round check on the left (its ring is the priority
colour: red P1, orange P2, grey P3) marks it done; **swipe right** does the
same; **swipe left** opens *Move to…*; **tap** opens the task as a
full-height sheet: the title with its check, then the details as a grouped
list (Status, Priority, Due, Assigned to, Project), where each row opens its
own chooser. The project chooser shows every project with its colour, a
progress ring, open tasks, target date and health, completed ones apart.
Then subtasks, description, notes, file folder, and Delete / Mark as done.
Done, move and delete each show a toast with **Undo** instead of an "are you
sure?". The blue **+** next to the tab bar adds a task: type a title; the
other properties (priority, due, people, status, project) start from
defaults and sit below it as tokens, each one tap from the same choosers.

The avatar in the header (or **More → you**) sets who you are on this device,
the language, light or dark, and **Use the desktop version**. The desktop
layout on a phone then shows a **Mobile version →** bar at the top to switch
back. The choice is per device (`gtd-layout` in localStorage: `auto`, `mobile`
or `desktop`). The mobile app wears the same **Liquid Glass** as the desktop
(§10): it reads the desktop skin's own tokens — wallpaper, glass film, rims,
sheen, Apple's system colours, label steps — so it follows light / dark with
it. The tab bar floats as a glass capsule with the + beside it, as on iOS 26.
With the classic skin it falls back to the cream / navy / gold look.

### 1c. Addresses and the Back button

Where you are is part of the address (`lib/history.ts`), so the browser's
**Back** and **Forward** work and a link or a reload opens the same place:
`#/board`, `#/projects`, `#/projects/<id>` (an open project), `#/weekly`,
`#/calendario`, … on the desktop; `#/today`, `#/board`, `#/projects`,
`#/agenda`, `#/more`, `#/more/weekly`, … on a phone. Each layout understands
the other's addresses (the desktop calendar is the phone's Agenda, the
desktop Weekly is *More → Weekly*), so switching layout keeps your place.
Sheets and pop-ups (the task, project, add and chooser sheets on a phone, the
mail pop-up on the desktop) add a step of their own: Back closes the one on
top first. Closing one with ×, a swipe or Escape removes its step again.

### 1d. Install it as an app (PWA)

The site is an installable app. On Android / Chrome / Edge: the **Install the
app** button in the phone's *You* sheet (or the browser's own install icon on
a computer). On iPhone / iPad: Safari → **Share → Add to Home Screen** (the
same button shows these steps). It then opens full screen from its own icon,
with long-press shortcuts **New task**, **Today** and **Agenda**. On iOS the
installed app keeps its own login, so the team password is asked once more.

`public/manifest.webmanifest` describes it (name, colours, icons in
`public/icons/`, shortcuts); `public/sw.js` is the service worker, registered
in production only (`lib/pwa.ts`). It caches the app's **code only** — the
HTML shell, the hashed `/assets` files, icons, fonts — so it opens fast and
still opens offline (it then says it cannot reach the server). It never
caches board data: Supabase is on another origin and is never intercepted,
and only GET requests to the site itself are handled, so tasks, notes and
reflections still live in memory only. Page loads go to the network first,
so a new deploy shows up at once. To throw away every cached file, change
`VERSION` in `sw.js`. Netlify serves `sw.js` and the manifest with
`Cache-Control: no-cache` (`netlify.toml`).

Header extras: editable board title + subtitle (double-click), a **"You"**
identity picker, a live-connection badge, an **IT/EN** toggle, a **Glass**
switch (§10, on by default), and a **Mail update** generator (Completed = DONE, Next steps = FOCUS + NEXT, → clipboard /
mail client). The whole app sits behind a real login (one shared Supabase Auth
account, §11) and is `noindex`.

---

## 2. How it works (architecture)

```
Browser — React SPA (state in memory only)
  │
  │  reads  : @supabase/supabase-js  → SELECT board_meta / tasks / weekly / reflections
  │  writes : one "Op" per edit      → INSERT / UPDATE / DELETE
  │  live   : Postgres realtime (WebSocket) → change events → debounced refetch
  ▼
Supabase project (free tier)
  Supabase Auth (one shared team account) → JWT on every request
  Postgres tables (RLS: logged-in team account only) + realtime publication
```

**Operation model.** The UI never writes SQL. Every edit is a typed `Op`
(`web/src/lib/types.ts`) dispatched through `send(op)`:

1. `useBoard.send(op)` applies the change **optimistically** in memory via
   `applyOpLocal` (`localReducer.ts`) so the UI updates instantly.
2. `writeOp(op, board)` (`db.ts`) translates the op into the matching Supabase
   write(s), mapping camelCase app fields to snake_case columns.
3. Supabase Postgres realtime broadcasts the change; **every** client (including
   the sender) re-reads **just the changed row** (`fetchChange` in `db.ts`;
   for reflections, personal notes and settings, just that table) and folds it
   in (`applyRowChange`, `rowSync.ts`), so the optimistic state reconciles with
   the authoritative rows without re-downloading the board. A burst of more
   than 20 changed rows takes one full `fetchBoard` instead.
4. Subtask edits (add, tick, edit, reorder, delete) go through database
   functions (migration 017) that change only that one subtask against the
   row as it is now, so two people editing the same task's subtasks at once
   do not overwrite each other. Before 017 runs, the app falls back to writing
   the whole array.

**Live-sync robustness** (`useBoard.ts`): realtime is the primary path, backed
by a 30s safety-net full reload while the tab is visible, plus a refetch on tab-focus
and on network `online`, and a full re-pull on every (re)subscribe. So clients
converge even if a realtime packet is missed.

**The report runs entirely in the browser.** It is laid out, edited and turned
into a PDF on the device; no report content is ever uploaded anywhere.

**What is cached in the browser.** Board **data is never cached** — it lives in
memory only, so closing the tab leaves no copy of any task. `localStorage` holds
the **login session** (Supabase access + refresh token, never the password; key
`gtd-session`, `supabaseClient.ts`) and **per-device UI preferences**
(`prefs.ts`):

| Key | Meaning |
| --- | --- |
| `gtd-lang` | UI language (it/en) |
| `gtd-view-mode` | board / list view |
| `gtd-hidden-cols` | hidden Kanban columns |
| `gtd-col-weights` | per-column widths (edit-layout mode) |
| `gtd-prio-collapsed` | priority chart collapsed |
| `gtd-me` | which member "you" are |
| `gtd-reviewed` | learnings reviewed today (spaced review) |
| `gtd-session` | the Supabase Auth session (tokens, not the password) |
| `gtd-auth` | when this device's login ends `{exp}` (Settings → login duration) |
| `gtd-refl-auth` | per-member Reflection login cache (`member → expiry \| "never"`) |
| `gtd-report-draft:<period>` | that week's report edits, kept 7 days; removed on logout |
| `gtd-skin` | mirror of the skin cookie (`glass` default / `classic`) |
| `gtd-appearance` | mirror of the appearance cookie (`dark` default / `light`) |
| `gtd-projects-view` | PROJECTS overview as `cards` or `timeline` |
| `gtd-project-tasks-view` | a project's tasks as `list` or `board` |
| `gtd-layout` | `auto` (phone-sized → mobile) / `mobile` / `desktop` |
| `gtd-m-tab` | the mobile tab left open |
| `gtd-m-board-col` | the mobile board's column left open |

---

## 3. Data model (Supabase)

Seven tables in `public`, all with **RLS enabled and one policy: the logged-in
team account only** (`is_team_member()`; the anon key alone gets nothing — §11).
All except `reflection_access` are in the `supabase_realtime` publication. A
`private` schema, which the website's API cannot reach, holds the team list.

**`board_meta`** — one row, `id = 'main'`, holds board-wide state:
`board_name`, `members text[]`, `subtitle_it`, `subtitle_en`, `login_days`
(default 7), `logo_url`, `favicon_url` (data URLs). (The old clear-text
`access_password` column is dropped by migration 012.)

**`tasks`** — one row per task: `id`, `title`, `description` (app `desc`),
`owner`, `assignees text[]`, `priority`, `status`, `notes`, `subtasks jsonb`, `due_date`,
`waiting_since`, `file_dir`, `done_at` (completion time → auto-archive after a
week), `updated_at`, `created_at` (ordering within a column). Each entry in
`subtasks` is `{id, text, done, doneAt?}` — `doneAt` is stamped when the subtask
is ticked and cleared when it is unticked, which is what lets the weekly report
attribute partial progress to a week. It lives inside the existing jsonb, so it
needs no migration.

**`weekly`** — one row per weekly-review item: `id`, `bucket`
(well/learnings/improve/blockers/focus), `body`, `created_at`.

**`reflections`** — one row per member per day: `id = "<date>::<member>"`,
`member`, `date`, `done`, `well`, `improve`, `learning`, `updated_at`,
`created_at`.

**`projects`** — one row per project: `id`, `name`, `items jsonb` (the old
checklist, `[{id,text,done,doneAt}]` — no longer edited, offered for
conversion), `created_at`, `updated_at`, `report_hidden`, and since migration
015 `description`, `notes`, `owners text[]`, `priority` (P1–P4), `start_date`,
`target_date` (ISO text) and `color` (`#rrggbb`, empty = automatic). There is
**no status column**: ongoing/completed is worked out from the linked tasks
(`web/src/lib/projects.ts`, which also holds progress, health and the report
selection).

Since migration 016 also `board_mode` (`all` / `sequential` / `none`) and
`task_order` (jsonb array of task ids, the step order). Which tasks the BOARD
shows is worked out from these (`hiddenFromBoard` / `boardTasks` in
`projects.ts`); nothing is written when a step finishes.

**`tasks.project_id`** (migration 015) — the project a task belongs to;
`on delete set null`, so deleting a project unlinks its tasks and keeps them.

**`reflection_access`** — one row per member: `member`, `password_hash`
(bcrypt), `failed_attempts`, `locked_until`, `updated_at`. **Not readable from
the browser at all**; used only by the `reflection_login` /
`reflection_change_password` database functions. Reset a password with
`private.admin_set_reflection_password` (§11) — editing the table by hand does
not work any more.

**`personal_notes`** — one row per note: `id`, `member`, `body`, `created_at`,
`updated_at`.

**`private.team_accounts`** — the Supabase Auth user id(s) allowed to use the
board.

SQL files in `supabase/`:

- `schema.sql` — the **complete** schema for a fresh, empty project (all
  tables, team-only policies, password functions, realtime). Not for a project
  that already has data — use the migrations.
- `migration-002-settings.sql` — adds subtitle / access-password / login-days
  columns to `board_meta`.
- `migration-003-branding-filedir.sql` — adds `logo_url` / `favicon_url` and
  `tasks.file_dir`.
- `migration-004-reflections.sql` — adds the `reflections` table.
- `migration-005-projects.sql` — adds the `projects` table.
- `migration-006-reflection-access.sql` — adds `reflection_access` (per-member
  Reflection password; edit the `password` column in the Supabase Table Editor
  to reset someone's password).
- `migration-007-done-at.sql` — adds `tasks.done_at` (completion time) for
  auto-archiving DONE tasks after a week.
- `migration-008-suggestions.sql` — adds the `suggestions` table (anonymous
  improvement ideas).
- `migration-009-assignees.sql` — adds `tasks.assignees` so one task can be
  held by several people. `owner` stays the first name in that list.
- `migration-010-personal-notes.sql` — adds the `personal_notes` table (notes
  shown only to the member who wrote them, under the daily reflections).
- `migration-011-auth-step1.sql` — **real login, step 1 (additive).** Team
  list, bcrypt-hashed Reflection/Tracking passwords, the password functions and
  the admin tools. The old site keeps working after it. See §11.
- `migration-014-remove-ideas-tracking.sql` — **deletes** the data of the
  removed IDEE and TRACKING tabs: the `suggestions` table and the Tracking
  password (its hash and the two functions). Counts the rows of every other
  table before and after and rolls back if any changed.
- `migration-013-report-projects.sql` — adds `projects.report_hidden`: a
  project taken off the weekly report with its × stays off every later report
  until put back from REPORT → **Progetti esclusi**.
- `migration-015-projects-v2.sql` — the reworked Projects tab: adds
  `description`, `notes`, `owners`, `priority`, `start_date`, `target_date`,
  `color` to `projects` and `tasks.project_id`. Additive and re-runnable (an
  earlier version also added `status`/`phases`; if you ran that one, run this
  one again — the two extra columns are simply unused). The app probes for the
  columns and only writes them once they exist.
- `migration-016-project-board-mode.sql` — adds `projects.board_mode` and
  `projects.task_order` (how a project's tasks reach the BOARD, and their step
  order). Additive; run after 015. Before it, every project task is on the BOARD.
- `migration-017-subtask-functions.sql` — adds `subtask_add`,
  `subtask_update`, `subtask_delete` and `subtask_reorder`, so concurrent
  subtask edits no longer overwrite each other. Adds functions only; no data
  changes. Re-runnable.
- `migration-012-auth-step2-lockdown.sql` — **real login, step 2.** Closes all
  tables to the anon key, hides `reflection_access`, deletes the clear-text
  password columns. Run only after the new site is live and you have logged in
  with it. See §11.

Migrations 002–011, 013, 015, 016 and 017 are additive and safe on live data; run any you haven't yet.
012 changes access rules (not data) and must follow the order in §11. The
app degrades gracefully before they're applied (settings can't save, reflections
stay empty, tasks stay single-assignee) thanks to tolerant reads and fallbacks —
and the screens that depend on a missing table now say so instead of looking
merely empty.

---

## 4. Project structure

```
prova_sito_GTD/
├── README.md                     ← this file
├── netlify.toml                  ← Netlify build (command, publish, SPA + noindex headers)
├── .gitignore
├── legacy/original-artifact.html ← the original single-file app, kept for reference
├── supabase/
│   ├── schema.sql                ← full schema for a fresh project
│   ├── migration-002-settings.sql
│   ├── migration-003-branding-filedir.sql
│   ├── migration-004-reflections.sql
│   ├── migration-005-projects.sql
│   ├── migration-006-reflection-access.sql … migration-010-personal-notes.sql
│   ├── migration-011-auth-step1.sql          ← real login, step 1 (additive)
│   ├── migration-012-auth-step2-lockdown.sql ← real login, step 2 (lockdown)
│   ├── migration-013-report-projects.sql · migration-014-remove-ideas-tracking.sql
│   ├── migration-015-projects-v2.sql         ← project details + notes, tasks.project_id
│   ├── migration-016-project-board-mode.sql  ← how project tasks reach the BOARD, step order
│   └── migration-017-subtask-functions.sql   ← subtasks changed one at a time (no lost edits)
├── .github/workflows/ci.yml      ← on every push / PR: npm test + production build
├── menu/                        ← the canteen menu: monthly PDF → web/src/data/menu.json (§8)
│   ├── menu_from_pdf.py
│   └── README.md
└── web/                          ← the entire frontend (Vite root)
    ├── index.html                ← HTML shell (fonts, noindex meta, #root)
    ├── package.json              ← deps: react, react-dom, @supabase/supabase-js, fflate, @react-pdf/renderer (server PDF), @fontsource-variable/inter (screen), @fontsource/inter (PDF)
    ├── vite.config.ts · tailwind.config.js · postcss.config.js · tsconfig.json
    ├── .env.example              ← VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_TEAM_EMAIL
    ├── netlify/functions/report-pdf.mts ← POST → the weekly report PDF (team login only)
    ├── netlify/lib/reportPdf.mts ← the PDF layout (@react-pdf/renderer)
    ├── scripts/gen-pdf-fonts.mjs ← embeds Inter into the function at build time
    ├── public/robots.txt         ← Disallow: / (noindex)
    ├── public/manifest.webmanifest · public/sw.js · public/icons/ ← the installable app (§1d)
    ├── public/report-template.docx ← the Intesa Sanpaolo Word template the report is built on
    ├── public/fonts/             ← EB Garamond + Cinzel TTFs embedded in the PDF (OFL)
    ├── vite.config.ts            ← manualChunks (Supabase cached separately); fails a build without VITE_TEAM_EMAIL
    └── src/
        ├── main.tsx              ← mounts <LangProvider><IdentityProvider><AuthGate><App/>
        ├── App.tsx               ← tabs, top bar, filters state, favicon effect, routing
        ├── index.css             ← Tailwind + small globals (drop-target, fonts)
        ├── styles/glass.css      ← the Liquid Glass skin, scoped to [data-skin="glass"]
        ├── lib/                  ← non-UI logic
        │   ├── types.ts          ← Task/Subtask/Weekly/Reflection/Board + the Op union
        │   ├── constants.ts      ← statuses, priorities, tabs, weekly columns (no passwords)
        │   ├── supabaseConfig.ts ← URL + anon key + team e-mail (env or placeholder)
        │   ├── supabaseClient.ts ← createClient; the login session is kept in localStorage
        │   ├── auth.ts           ← team login/logout/password change + Reflection checks
        │   ├── db.ts             ← row<->type mapping, fetchBoard, seedIfEmpty, writeOp
        │   ├── localReducer.ts   ← applyOpLocal (optimistic in-memory updates)
        │   ├── useBoard.ts       ← load + realtime + poll + optimistic send()  (core hook)
        │   ├── rowSync.ts        ← folds one changed row (from realtime) into the board
        │   ├── history.ts        ← tabs / project / More page in the URL; Back closes sheets
        │   ├── pwa.ts            ← service worker registration + the install prompt
        │   ├── i18n.mobile.ts    ← the mobile app's IT/EN strings (merged into i18n.tsx)
        │   ├── __tests__/        ← Vitest: reducer, live sync, projects, subtask writes, i18n parity
        │   ├── seed.ts           ← initial data for a brand-new empty project
        │   ├── i18n.tsx          ← LangProvider + full IT/EN dictionary + label helpers
        │   ├── identity.tsx      ← IdentityProvider ("who am I", cached per device)
        │   ├── prefs.ts          ← all localStorage read/write helpers
        │   ├── image.ts          ← logo/favicon validate + rasterise + downscale
        │   ├── dates.ts          ← date math/formatting helpers
        │   ├── reportData.ts     ← week maths + Done / Next / Projects / Planner collection
        │   ├── glassReportModel.ts ← the Liquid Glass report as blocks + cover figures
        │   ├── reportDoc.ts      ← the report as data (texts read from the pages) for the server PDF
        │   ├── reportDocx.ts     ← the classic Word template (.docx, lazy-loaded)
        │   ├── projects.ts       ← derived status, progress, health, colours, sorting, report selection
        │   ├── projectsContext.tsx ← the board's projects for task cards / the task editor
        │   ├── skin.ts           ← which visual skin is on (glass / classic)
        │   └── useSyncedField.ts ← text field that syncs w/o clobbering active typing
        └── components/
            ├── TopBar.tsx        ← logo, editable title + subtitle, mail button, right slot
            ├── ConnBadge.tsx · LangToggle.tsx · IdentityPicker.tsx   ← header controls
            ├── GlassToggle.tsx    ← the Liquid Glass on/off switch
            ├── AuthGate.tsx      ← team login screen (Supabase Auth) + login-duration expiry
            ├── BoardView.tsx     ← toolbar, quick-add, columns, list toggle, edit-layout, DnD
            ├── QuickAdd.tsx      ← full new-task bar
            ├── TaskCard.tsx      ← compact card + inline expansion
            ├── TaskDetails.tsx   ← the reusable full task editor (card, list, calendar)
            ├── SortableSubtasks.tsx ← pointer drag-reorder subtasks (FLIP-animated cards)
            ├── AutoTextarea.tsx  ← auto-growing textarea
            ├── ListView.tsx      ← table view of all visible-column tasks
            ├── Filters.tsx       ← search/owner/priority/Focus-P1 (used by calendar)
            ├── MembersBar.tsx    ← inline add/remove team members
            ├── PriorityDistribution.tsx ← collapsible P1–P4 chart
            ├── ProjectsView.tsx  ← Projects: Ongoing (cards / timeline) and Completed (recent / older)
            ├── projects/ProjectDetail.tsx ← one project's page: details, notes, old-checklist conversion
            ├── projects/ProjectTasks.tsx ← the project's tasks: new-task form, link, list / mini board
            ├── projects/ProjectTimeline.tsx ← dated projects as bars, today line
            ├── projects/ProjectBits.tsx ← progress ring, pills, health badge, avatars
            ├── CalendarView.tsx  ← month grid + left detail panel
            ├── WeeklyView.tsx    ← recap + 5 retro columns
            ├── DailyReflection.tsx ← reflection form + recent + spaced review
            ├── SettingsView.tsx  ← branding upload, team password change, login duration
            └── MailModal.tsx     ← mail-update text generator
        └── mobile/               ← the phone version (§1b), its own lazy-loaded chunk
            ├── MobileApp.tsx     ← shell: header, bottom tab bar, add button, sheets, toasts
            ├── useLayout.ts      ← phone or desktop: screen width + the per-device choice
            ├── TodayScreen.tsx · BoardScreen.tsx · ProjectsScreen.tsx · AgendaScreen.tsx · MoreScreen.tsx
            ├── TaskCard.tsx      ← swipeable card (right = done, left = move)
            ├── TaskSheet.tsx · AddSheet.tsx ← edit a task / add one, as bottom sheets
            ├── pickers.tsx       ← choosers: status, priority, due date, people, project
            ├── actions.tsx       ← done / move / delete with Undo; the Move sheet
            ├── ui.tsx · icons.tsx · nav.ts  ← sheet, toast, avatars, chips, ring; icons; navigation
            └── mobile.css        ← every mobile style (Liquid Glass via glass.css tokens), scoped to html[data-layout="mobile"]
```

Rough size: ~7.1k lines of TS/TSX. Largest files: `i18n.tsx` (dictionary),
`BoardView.tsx`, `db.ts`, `reportDocx.ts`, `TaskDetails.tsx`,
`DailyReflection.tsx`, `SortableSubtasks.tsx`.

---

## 5. Weekly report — Liquid Glass, edited in place, exported to PDF

```
REPORT tab ─▶ pick a week (or a custom period) ─▶ Generate report
   collectReport()  ─▶ buildBlocks() ─▶ measured and packed onto A4 pages (GlassReport)
                                          │  click any text to edit · × hides a card
                                          └─▶ Download PDF ─▶ server (Netlify Function) ─▶ .pdf
```

### What is in it

| Page | Content |
| --- | --- |
| Cover | board name and period, an editable headline and subtitle, tiles for completed tasks, closed subtasks, in progress, next and waiting, an **In evidenza** list whose tasks you pick with **Scegli attività** (up to 8, from the completed, in-progress, next and waiting tasks; left out of the PDF when empty), and an editable **In sintesi** paragraph |
| 01 Completate | every task that entered DONE inside the period, with priority, completion date, its subtasks and a progress bar |
| 02 Prossimi passi | the NEXT column now, with due dates and subtasks |
| 03 Progetti | every ongoing project, plus those completed inside the period — status, target date (or completion date), task count, description, % done and its linked tasks (open first); ongoing first, then by priority — except projects taken off with their × (`projects.report_hidden`, shared by the whole team): they stay off **every** later report until put back from the **Progetti esclusi** view of the REPORT tab |
| 04 Planner | always **one landscape page**: Backlog · Next · In Progress · Waiting side by side; a very full board is scaled down to fit |

Only the Done section is period-filtered; the rest is how the board stands when
the report is generated. Like the old Word report it is **name-free**: no owner
appears anywhere.

### How it is built

- **Blocks and pages.** `glassReportModel.ts` turns the data into blocks (a
  section heading, a task card, a project, a planner band).
  `GlassReport.tsx` renders every block once off-screen at page width,
  measures it, and packs blocks onto 794 × 1123 px pages (A4 at 96 dpi); a
  section heading always stays with its first card and no card is split.
  Pages are laid out by block id, so hiding a card (×) just drops it and the
  rest re-packs. The planner is its own 1123 × 794 landscape page.
- **Drafts.** Every change (texts, hidden cards, chosen highlights) is saved
  on this device straight away, per report period (`gtd-report-draft:<from>_<to>`
  in `localStorage`, `prefs.ts`), and kept for **7 days** after the last
  change: leave the tab or reload and the REPORT tab reopens that week's
  report as you left it. **Ripristina / Reset** throws the week's changes away.
  Drafts are deleted when the device logs out of the team.
- **Editing.** Every text on the pages is `contentEditable` — titles, labels,
  counts, dates, tile figures, headers and footers (only page numbers are
  automatic); planner items have their own × too. An edit is stored when the
  field loses focus, the blocks are measured again and re-packed — a longer
  text simply pushes the next card to the following page.
- **The look.** `styles/glassReport.css`: soft colour washes (radial
  gradients, arranged differently on each page) under white glass panels
  built from translucent fills, a bright rim, a specular sheen and soft
  shadows, in Apple's light system palette. It deliberately does not depend on
  `backdrop-filter`, so the PDF matches the screen. Type is Inter, self-hosted
  through `@fontsource-variable/inter`.

### PDF — made on the server

A PDF captured in the browser comes out differently on every device (each
lays out text with its own fonts and engine), so the PDF is made on the server
instead, by a Netlify Function: `web/netlify/functions/report-pdf.mts`.

1. **Download PDF** builds a `ReportDoc` (`web/src/lib/reportDoc.ts`): the
   report's structure from the same model the pages use, and every text
   exactly as it currently reads on the pages (each editable text carries a
   `data-ed-id`), so edits, hidden cards and the chosen highlights are all in
   it. It is POSTed to `/.netlify/functions/report-pdf` with the person's
   Supabase access token.
2. The function checks that token with the database's own
   `is_team_member()` (401/403 otherwise), then lays the report out with
   **@react-pdf/renderer** (`web/netlify/lib/reportPdf.mts`) — its own layout
   engine and the **Inter** font files embedded in the function — and returns
   the file. Nothing is stored.

So the same report gives the same PDF on every device. The text is real PDF
text (selectable, searchable, sharp at any zoom). The design follows the
pages: colour washes as SVG radial gradients, white glass cards with a soft
shadow, accent bars, pills, progress bars, checkmarks; cards are never split
across pages and a heading never ends a page; the planner is one landscape
page — its size is found by measuring: the planner page is rendered alone
and its pages counted, shrinking until it is exactly one; a long column
spreads its cards over sub-columns, and only a board too full even at the
smallest readable size ends a column with "+N" — page numbers are automatic.
The headline's colour sweep is done word by word (PDF text cannot carry a
gradient).

**Fonts** are generated into `web/netlify/lib/fonts.generated.mjs` by
`scripts/gen-pdf-fonts.mjs` on every build (from `@fontsource/inter`: Latin,
plus Latin Extended as a fallback). `@react-pdf/renderer` is shipped to the
function unbundled (`external_node_modules` in `netlify.toml`).

**Netlify needs** the existing `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` variables to be available to **Functions** too (the
default "All scopes"); the function uses them to check the login.

### Word (classic template)

The previous Intesa Sanpaolo Word report is still available as a direct
download (**Word (classic template)**): `reportDocx.ts` fills
`web/public/report-template.docx` with the same Done / Next / Projects /
Planner content. There is no Word editor any more — edit the downloaded file in
Word if needed.

---

## 6. Run locally

```bash
cd web
cp .env.example .env      # fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_TEAM_EMAIL
npm install
npm run dev               # http://localhost:5173
npm test                  # Vitest unit tests (no Supabase needed)
npm run build             # type-check (tsc -b) + production build to web/dist
```

GitHub Actions (`.github/workflows/ci.yml`) runs `npm test` and `npm run build`
on every push and pull request, so a change that breaks either shows up there
before Netlify deploys it.

You need a Supabase project (the app talks to it directly). Point `.env` at any
project set up as in §7 / §11 and log in with the team password.

---

## 7. Deploy — browser only, ~15 minutes

### Part 1 — Supabase backend

1. **https://supabase.com** → sign in → **New project** (any region; a strong DB
   password you won't reuse). Wait ~2 min.
2. **Authentication → Sign In / Providers**: turn **off** "Allow new users to
   sign up". **Authentication → Users → Add user → Create new user**: the team
   e-mail + a strong team password, tick **Auto Confirm User**.
3. **SQL Editor → New query** → paste **all** of `supabase/schema.sql`, put the
   team e-mail on its last line → **Run**.
   For an existing project with data, follow §11 instead.
4. **Project Settings → API** → copy the **Project URL** and the **anon public**
   key.

### Part 2 — Netlify frontend

1. **https://app.netlify.com** → **Add new site → Import an existing project →
   GitHub** → pick `Gualbertol123/prova_sito_GTD`.
2. `netlify.toml` already sets the build (`npm --prefix web install && npm
   --prefix web run build`, publish `web/dist`). Choose the branch that holds the
   code (currently `claude/hopeful-noether-u6oblf`; switch to `main` after
   merging).
3. **Site configuration → Environment variables** → add `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY` and `VITE_TEAM_EMAIL` (the team user's e-mail). None
   is secret: the anon key is meant to ship in the browser and gets nothing
   without the team password.
4. **Deploy**. Open the URL; enter the team password; the board seeds itself on
   first load and the badge reads **Live**. Open a second browser to see edits
   sync.

Env-var changes require a **redeploy** (Vite inlines `VITE_*` at build time).
Alternative hosts (Vercel / Cloudflare Pages / GitHub Pages) work identically —
same build command, publish `web/dist`, same three env vars.

---

## 8. Operations & gotchas

- **Free Supabase pauses after ~7 days of inactivity.** The first visitor after
  a quiet week sees errors until someone clicks **Restore** in the Supabase
  dashboard (~1–2 min). Regular use keeps it awake.
- **Access is a real login** (§11): one shared Supabase Auth account, and the
  database refuses every request that is not logged in as it. The site is also
  `noindex` (meta + robots.txt + `X-Robots-Tag`) and sends strict security
  headers (`netlify.toml`).
- **Logo/favicon are stored as data URLs in `board_meta`**, which the board
  refetches on its sync cycle. Uploads accept up to 5 MB but are **rasterised and
  downscaled** to a small icon before storage (`image.ts`) precisely so the
  shared row — and everyone's bandwidth — stays light. Don't bypass that.
- **Free-tier limits** (≈500 MB DB, ≈200 concurrent realtime connections) are far
  above a small team's needs.
- **Two identities in the header** — the "You" picker (per-device default author
  / task owner) and the Reflection login — are conveniences, not accounts; the
  only account is the shared team login.

### Canteen menu — updated once a month

The canteen sends its menu as a PDF (one page per week, courses down the left,
Monday–Friday across). To update it:

```bash
pip install pymupdf
python3 -I menu/menu_from_pdf.py Menu.pdf     # updates web/src/data/menu.json
```

then commit `web/src/data/menu.json` and deploy. The script reads each cell
from the table's grid lines (so a dish that wraps over two lines stays one
dish, even when the next line starts with a capital, as in "alla / Milanese"),
splits off the allergen numbers, **drops every day before today** (from the
PDF and from what the file already holds) and replaces the days that are in
the new PDF, so running it twice is harmless. The file is loaded only when it is
needed, by the BOARD's **Menu mensa** bar, which shows today and the next
days and never a past day. The
menu is not confidential, so it is fine that it is in this public repository.

---

## 9. Extending it

Because everything flows through the `Op` union, most changes follow one path:

- **Add a task field:** add it to `Task` in `types.ts` → map it in `db.ts`
  (`rowToTask`, `taskToRow`, `patchToRow`) → add a column via a new
  `supabase/migration-00X-*.sql` (additive) → surface it in `TaskDetails.tsx`.
  Keep reads tolerant so the app still works before the migration runs.
- **Add an operation:** extend the `Op` union → handle it in both `localReducer.ts`
  (optimistic) and `db.ts` `writeOp` (persist) → dispatch it from a component via
  `send(op)`.
- **Add a tab:** add the id to `TabId`/`TABS` in `constants.ts` → add `tabs.<id>`
  to both languages in `i18n.tsx` → render it in `App.tsx`.
- **Add a table:** create it in `schema.sql` + a migration, and end the
  migration with `select private.lock_table('<table>');` — that gives it the
  same team-only policy and grants as the others (new tables are closed to the
  anon key by default, but a table without that call is not usable by the team
  either) — fetch it tolerantly in
  `db.ts` `fetchBoard`, add a realtime listener in `useBoard.ts`, and default it
  to empty in `localReducer.ts`.
- **Translations:** every user-facing string goes through `t('key')`; keep the IT
  and EN dictionaries in `i18n.tsx` at parity.

### Possible next steps (not done)
- Per-person accounts (one Supabase Auth user per member) + per-member RLS, if
  reflections and personal notes must be private *between teammates* too. With
  the shared account, every logged-in device downloads every reflection and
  note; only the Reflection password in the interface keeps them apart (§11).
- Merge `claude/hopeful-noether-u6oblf` into `main` and point Netlify at `main`.
- Drag-to-reorder for weekly items / members (subtasks already have it).
- A weekly "learning digest" and per-member reflection streaks.

---

## 10. The Liquid Glass skin

The **Glass** switch in the header turns the redesign on and off, and when it
is on a **☀ / ☾ control** next to it picks the light or dark appearance. Glass
is **on by default**, dark is the default appearance, and both choices are
remembered in **cookies** (`gtd-skin` and `gtd-appearance`, one year,
`SameSite=Lax`, `Secure` on https), mirrored into `localStorage` so they
survive cookies being cleared or blocked.

### The design

A Control Center redesign, not a tint pass. Reference points: iOS 26's Control
Center, its notification stack, and the way visionOS floats glass in space —
checked against the iOS 26 and 27 home screens, which are a deep saturated
wallpaper with translucent chrome floating over it, each panel carrying a
bright rim where the light catches its edge.

| Property of the material | How it is built |
| --- | --- |
| **Wallpaper** — Control Center is glass over a dimmed wallpaper, not over a flat fill | Deep indigo/blue/purple fields on `body`, `background-attachment: fixed` |
| **Dark glass** — panels are a light film over that wallpaper, not white cards | `rgba(255,255,255,.08…​.17)` plus `backdrop-filter: blur(32px) saturate(190%)` |
| **Lensing** — light bends at the rim, so edges read brighter than the middle | Inset hairline, brightest along the top edge |
| **Specular** — a sheen from an implied light above-left | Soft diagonal gradient on a `::before`, under the content |
| **Depth** — panels float rather than sit in a frame | Big soft shadows, no hard borders |
| **Radii** — Control Center tiles are large continuous curves | Panel radii lifted to 22px; controls stay capsules |

**Light and dark.** Liquid Glass has both on Apple's platforms and the system
palette ships a light and a dark variant of every colour, so the skin is
written entirely against tokens and `[data-appearance]` swaps the set — same
structure, same rules, different material and palette. Dark is a light film at
low alpha over a deep indigo wallpaper; light is a white film at higher alpha
over a bright one. Three colours are darkened from Apple's light values
(yellow, green, cyan) because the published ones are unreadable as text on
white glass.

Colour is Apple's system palette in its dark-mode (vibrant) variants, which is
what the platform uses on top of glass — red `#FF453A`, orange `#FF9F0A`,
yellow `#FFD60A`, green `#30D158`, cyan `#64D2FF`, blue `#0A84FF`, indigo
`#5E5CE6`, purple `#BF5AF2`, gray `#8E8E93` — with Apple's label hierarchy and
fill hierarchy. Primary actions become systemBlue, the gold accent becomes
systemOrange, priority dots and status chips map onto the system colours, and
the skin toggle itself is a systemGreen iOS switch.

Two judgement calls worth knowing:

- **Tinted, not clear.** iOS 26.1 added that choice because clear glass was
  hard to read; this app is dense small text, so it takes the tinted reading.
- **Labels are lifted above Apple's own values.** Measured against these
  wallpapers, Apple's `tertiaryLabel` came out at **2.7:1**. The lower two
  steps were raised, in both appearances, until every step clears WCAG AA on
  both card and panel surfaces — measured 16.2 / 6.4 / 6.0 in light and
  12.0 / 6.0 / 5.8 in dark.

### It is only paint

Everything lives in `web/src/styles/glass.css`, scoped to
`html[data-skin="glass"]`, targeting the utility classes the components already
carry. No component renders differently and nothing in logic reads the skin, so
`classic` restores the original stylesheet exactly. `initSkin()` runs before
React mounts so the first frame is already the right skin.

### What it deliberately does not touch

- **The report.** The weekly report has its own light Liquid Glass design
  (`styles/glassReport.css`, scoped to `.gr-root`), which the app skin does not
  restyle.
- **Printing.** Background, colour, translucency, blur and shadow are all
  stripped. Print output measures identical in both appearances and to the
  pre-skin baseline (73% ink on page 1) with white paper.

### Two things the skin required

- `backdrop-filter` makes an element the containing block for
  `position: fixed` descendants. The subtask drag preview is fixed at viewport
  coordinates, so it is portalled to `<body>` — verified to land in the
  identical position in both skins, and the mail modal checked the same way.
- Form controls opt out of the panel material. A control sitting on a panel is
  an inset well, not another sheet of glass; left as glass-on-glass inside a
  tinted panel it rendered as mud.
- The header's own pills — identity picker, connection badge, language toggle —
  take neutral fill rather than the systemBlue the primary-action rule gives
  everything else. They are containers, not actions, and in light mode blue
  pills on a white header were unreadable.

---

## 11. Security — login, passwords and admin resets

### How it works

- **One shared team account in Supabase Auth.** The login screen sends the
  password to Supabase Auth together with the team e-mail (`VITE_TEAM_EMAIL`);
  the browser never downloads any password. Supabase stores it as a bcrypt hash.
- **The database only answers to that account.** Every table in `public` has
  one policy: `to authenticated using ((select public.is_team_member()))`, and
  `anon` has no table rights at all (new tables start closed too).
  `is_team_member()` checks the caller against `private.team_accounts` **and**
  checks that the login session still exists, so an account created by mistake
  gets nothing, and a logged-out or reset session is refused at once. The anon
  key in the site's code is therefore harmless on its own.
- **Reflection passwords are bcrypt hashes** checked by database
  functions (`reflection_login`, `reflection_change_password`),
  callable only by the logged-in team account. Five wrong
  tries in a row lock that password for 5 minutes. None of them is in the code.
- **Sessions.** A device stays logged in for Settings → *Login duration* days
  (the Supabase session is kept in `localStorage`, refreshed automatically);
  then it must log in again. *Log out this device* ends it at once (and forgets
  the Reflection logins on that device); changing the team password in Settings
  logs every other device out within about 30 seconds.
- **Transport and browser.** Everything is HTTPS; `netlify.toml` sends HSTS, a
  strict Content Security Policy, `X-Frame-Options: DENY`, `nosniff`,
  `no-referrer` and a locked-down `Permissions-Policy`.

**What the shared account does not do:** separate teammates from each other.
Anyone with the team password can read every reflection and personal note
through the API; the per-member Reflection password keeps them apart in the
interface only. If that matters, move to one Supabase Auth user per member.

### Supabase settings

Keep:
- **Authentication → Sign In / Providers → "Allow new users to sign up": OFF.**
- **Email → Minimum password length: 12** (the app also asks for 12).
- **"Require current password when updating"** may be turned on — the app
  sends it.
- The team e-mail must be a **mailbox only admins can read**: anyone who can
  read it can log in through a recovery / magic-link e-mail.
- Keep the **service_role** key out of the site and out of Git — the site only
  ever needs the anon key.

Leave OFF (the app does not support them and nobody could log in): **CAPTCHA**
(Attack Protection), **MFA** on the team user, **single session per user**.

The Security Advisor will warn that `is_team_member`, `reflection_login` and
`reflection_change_password` are SECURITY DEFINER
functions callable by `authenticated`; that is intended — each one checks the
team login itself.

### Upgrading a live project (done once, in this order)

Board data is never modified by these steps; only access rules and the old
clear-text password columns change. Taking a copy first is still wise:
Table Editor → each table → **Export → CSV** (works on the free plan).

1. **Supabase → Authentication → Sign In / Providers**: turn off
   *Allow new users to sign up*.
2. **Authentication → Users → Add user → Create new user**: an e-mail for the
   team (e.g. a shared mailbox you control) and a **new** strong password —
   not the old `IBDGTDTEAM`, which has been visible in the site's code. Tick
   **Auto Confirm User**.
3. **SQL Editor**: open `supabase/migration-011-auth-step1.sql`, replace
   `team@example.com` on its last lines with that e-mail, **Run**. (If the
   e-mail does not match the user, it stops and changes nothing.) The current
   site keeps working.
4. **Netlify → Site configuration → Environment variables**: add
   `VITE_TEAM_EMAIL` = that e-mail. Then deploy the new code (push to the
   deployed branch, or *Deploys → Trigger deploy*).
5. Open the site, log in with the new team password, check the board, the
   Reflection tab (everyone's current password still works).
6. **SQL Editor**: run `supabase/migration-012-auth-step2-lockdown.sql`. From
   now on **every table** is closed to everyone but the team account — it
   lists (as warnings) any extra table it closed, such as the old app's
   `boards` table. Any old copy of the site still online (e.g. a GitHub Pages
   copy of the original app) stops working, as it should. Other open tabs
   need a reload and a login.
7. **Change the passwords that were exposed** — all of them were readable
   before this upgrade:
   have **every member** change their Reflection password in the
   Reflection tab (or reset it for them, below).

If step 5 fails, nothing is lost: the database is still open as before; fix
the cause (see the message on the login screen) before running step 6.

### Admin: resets and account changes (Supabase → SQL Editor)

These functions live in the `private` schema, which the website cannot call;
only someone signed in to the Supabase dashboard can run them.

| To… | Run |
| --- | --- |
| Reset the **team** password (12–72 characters; logs every device out) | `select private.admin_set_team_password('new password');` |
| …without logging devices out | `select private.admin_set_team_password('new password', false);` |
| …when there is more than one team account | `select private.admin_set_team_password('new password', true, 'e-mail');` |
| Reset a member's **Reflection** password (also unlocks it) | `select private.admin_set_reflection_password('Name', 'new password');` |
| Put a member back on the initial password | `select private.admin_set_reflection_password('Name', 'password');` |
| Allow another Auth user to use the board | `select private.admin_add_team_account('e-mail');` |
| Stop an Auth user from using the board (not the last one) | `select private.admin_remove_team_account('e-mail');` |
| Close a table you added | `select private.lock_table('table_name');` |

A logged-in teammate can also change the team password in Settings (the
current one is required). Stored passwords cannot be read back by anyone —
only replaced.

**Order matters only once:** 011 refuses to run after 012 (re-run 012
instead; it is safe to repeat), and `schema.sql` refuses to run on a project
that already has the board tables. The older migrations 004–010 re-close their
table automatically if run after 012.

