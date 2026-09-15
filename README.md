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
| **BOARD** | Kanban with 6 columns (Backlog · Next · In Progress · Waiting · Done · Maybe) **and** a List view (toggle, remembered). Cards expand **inline** (no popups) into a full editor: owner, priority pills, due date, description, notes, a **File Directory** field with a copy button, a "move to section" dropdown, prev/next arrows, and subtasks. Columns fill the width edge-to-edge, wrap instead of scrolling, can be shown/hidden (**Columns** editor), and resized in an **edit-layout** mode (neighbours adjust). A **Team** panel (collapsed) manages members; a collapsible **priority distribution** chart; a full new-task bar (choose owner/priority/status/due up front); search + owner/priority/Focus-P1 filters. |
| **WEEKLY** | Weekly review. A "Recap — everything completed" block auto-fills from DONE tasks (with owner + subtask progress), plus 5 editable retro columns: WINS · LEARNINGS · TO IMPROVE · BLOCKERS · FOCUS NEXT WEEK. |
| **CALENDAR** | Month grid; drag a task onto a day to set its due date. Click any task to open its full details in the left panel. Day cells grow to fit all their items. |
| **REFLECTION** | Daily Reflection: pick who you are (remembered per device), log one entry per day with 4 fields (Done today · What went well · What to improve · Learning notes). Shows recent entries, and a **spaced-repetition review** that resurfaces past learning notes at 1/3/7/14/30-day intervals (+ a random review). |
| **TRACKING 🔒** | Password-gated per-member workload monitor (active tasks, P1 count, Ok/High/Overloaded). Its password lives in code — see §8. |
| **INSTRUCTIONS** | Reference for statuses, priorities and workflow. |
| **SETTINGS** | Custom logo (round header box) + favicon upload (rasterised & downscaled, ≤5 MB input); shared access password; login duration; log out this device. Subtitle is edited **inline** by double-clicking it in the header. |

Header extras: editable board title + subtitle (double-click), a **"You"**
identity picker, a live-connection badge, an **IT/EN** toggle, and a **Mail
update** generator (Completed = DONE, Next steps = FOCUS + NEXT, → clipboard /
mail client). The whole app sits behind a shared-password gate and is
`noindex`.

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
  Postgres tables (RLS open to the anon key) + realtime publication
```

**Operation model.** The UI never writes SQL. Every edit is a typed `Op`
(`web/src/lib/types.ts`) dispatched through `send(op)`:

1. `useBoard.send(op)` applies the change **optimistically** in memory via
   `applyOpLocal` (`localReducer.ts`) so the UI updates instantly.
2. `writeOp(op, board)` (`db.ts`) translates the op into the matching Supabase
   write(s), mapping camelCase app fields to snake_case columns.
3. Supabase Postgres realtime broadcasts the change; **every** client (including
   the sender) refetches the whole board (`fetchBoard`) and re-renders, so the
   optimistic state reconciles with the authoritative rows.

**Live-sync robustness** (`useBoard.ts`): realtime is the primary path, backed
by a 12s safety-net poll while the tab is visible, plus a refetch on tab-focus
and on network `online`, and a full re-pull on every (re)subscribe. So clients
converge even if a realtime packet is missed.

**What is cached in the browser.** Board **data is never cached** — the Supabase
client runs memory-only with `persistSession:false` (`supabaseClient.ts`), so
closing the tab leaves no copy of any task. Only **per-device UI preferences**
live in `localStorage` (`prefs.ts`):

| Key | Meaning |
| --- | --- |
| `gtd-lang` | UI language (it/en) |
| `gtd-view-mode` | board / list view |
| `gtd-hidden-cols` | hidden Kanban columns |
| `gtd-col-weights` | per-column widths (edit-layout mode) |
| `gtd-prio-collapsed` | priority chart collapsed |
| `gtd-me` | which member "you" are |
| `gtd-reviewed` | learnings reviewed today (spaced review) |
| `gtd-auth` | access-gate token `{exp}` (login cache) |

---

## 3. Data model (Supabase)

Four tables, all with **RLS enabled and an open policy for the anon key** (any
signed-out visitor with the anon key can read/write — see §8) and all in the
`supabase_realtime` publication.

**`board_meta`** — one row, `id = 'main'`, holds board-wide state:
`board_name`, `members text[]`, `subtitle_it`, `subtitle_en`, `access_password`
(default in code), `login_days` (default 7), `logo_url`, `favicon_url` (data
URLs).

**`tasks`** — one row per task: `id`, `title`, `description` (app `desc`),
`owner`, `priority`, `status`, `notes`, `subtasks jsonb`, `due_date`,
`waiting_since`, `file_dir`, `updated_at`, `created_at` (ordering within a
column).

**`weekly`** — one row per weekly-review item: `id`, `bucket`
(well/learnings/improve/blockers/focus), `body`, `created_at`.

**`reflections`** — one row per member per day: `id = "<date>::<member>"`,
`member`, `date`, `done`, `well`, `improve`, `learning`, `updated_at`,
`created_at`.

SQL files in `supabase/`:

- `schema.sql` — the **complete** schema for a fresh project (all tables +
  policies + realtime).
- `migration-002-settings.sql` — adds subtitle / access-password / login-days
  columns to `board_meta`.
- `migration-003-branding-filedir.sql` — adds `logo_url` / `favicon_url` and
  `tasks.file_dir`.
- `migration-004-reflections.sql` — adds the `reflections` table.

The migrations are additive and safe on live data; run any you haven't yet. The
app degrades gracefully before they're applied (settings can't save, reflections
stay empty) thanks to tolerant reads and fallbacks.

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
│   └── migration-004-reflections.sql
└── web/                          ← the entire frontend (Vite root)
    ├── index.html                ← HTML shell (fonts, noindex meta, #root)
    ├── package.json              ← deps: react, react-dom, @supabase/supabase-js
    ├── vite.config.ts · tailwind.config.js · postcss.config.js · tsconfig.json
    ├── .env.example              ← VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
    ├── public/robots.txt         ← Disallow: / (noindex)
    └── src/
        ├── main.tsx              ← mounts <LangProvider><IdentityProvider><AuthGate><App/>
        ├── App.tsx               ← tabs, top bar, filters state, favicon effect, routing
        ├── index.css             ← Tailwind + small globals (drop-target, fonts)
        ├── lib/                  ← non-UI logic
        │   ├── types.ts          ← Task/Subtask/Weekly/Reflection/Board + the Op union
        │   ├── constants.ts      ← statuses, priorities, tabs, weekly columns, passwords
        │   ├── supabaseConfig.ts ← URL + anon key (env or placeholder)
        │   ├── supabaseClient.ts ← createClient, memory-only, persistSession:false
        │   ├── db.ts             ← row<->type mapping, fetchBoard, seedIfEmpty, writeOp
        │   ├── localReducer.ts   ← applyOpLocal (optimistic in-memory updates)
        │   ├── useBoard.ts       ← load + realtime + poll + optimistic send()  (core hook)
        │   ├── seed.ts           ← initial data for a brand-new empty project
        │   ├── i18n.tsx          ← LangProvider + full IT/EN dictionary + label helpers
        │   ├── identity.tsx      ← IdentityProvider ("who am I", cached per device)
        │   ├── prefs.ts          ← all localStorage read/write helpers
        │   ├── image.ts          ← logo/favicon validate + rasterise + downscale
        │   ├── dates.ts          ← date math/formatting helpers
        │   └── useSyncedField.ts ← text field that syncs w/o clobbering active typing
        └── components/
            ├── TopBar.tsx        ← logo, editable title + subtitle, mail button, right slot
            ├── ConnBadge.tsx · LangToggle.tsx · IdentityPicker.tsx   ← header controls
            ├── AuthGate.tsx      ← shared-password gate (cached login)
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
            ├── CalendarView.tsx  ← month grid + left detail panel
            ├── WeeklyView.tsx    ← recap + 5 retro columns
            ├── DailyReflection.tsx ← reflection form + recent + spaced review
            ├── TrackingView.tsx  ← password-gated workload monitor
            ├── InstructionsView.tsx
            ├── SettingsView.tsx  ← branding upload, access password, login duration
            └── MailModal.tsx     ← mail-update text generator
```

Rough size: ~4.7k lines of TS/TSX. Largest files: `i18n.tsx` (dictionary),
`BoardView.tsx`, `db.ts`, `TaskDetails.tsx`, `DailyReflection.tsx`,
`SortableSubtasks.tsx`.

---

## 5. Run locally

```bash
cd web
cp .env.example .env      # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev               # http://localhost:5173
npm run build             # type-check (tsc -b) + production build to web/dist
```

You need a Supabase project (the app talks to it directly). Point `.env` at any
project where you've run `schema.sql`.

---

## 6. Deploy — browser only, ~15 minutes

### Part 1 — Supabase backend

1. **https://supabase.com** → sign in → **New project** (any region; a strong DB
   password you won't reuse). Wait ~2 min.
2. **SQL Editor → New query** → paste **all** of `supabase/schema.sql` → **Run**.
   For an existing project, instead run whichever `migration-00X-*.sql` files you
   haven't run yet (they're additive).
3. **Project Settings → API** → copy the **Project URL** and the **anon public**
   key.

### Part 2 — Netlify frontend

1. **https://app.netlify.com** → **Add new site → Import an existing project →
   GitHub** → pick `Gualbertol123/prova_sito_GTD`.
2. `netlify.toml` already sets the build (`npm --prefix web install && npm
   --prefix web run build`, publish `web/dist`). Choose the branch that holds the
   code (currently `claude/hopeful-noether-u6oblf`; switch to `main` after
   merging).
3. **Site configuration → Environment variables** → add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`. (Neither is secret; the anon key is meant to ship in
   the browser.)
4. **Deploy**. Open the URL; enter the access password; the board seeds itself on
   first load and the badge reads **Live**. Open a second browser to see edits
   sync.

Env-var changes require a **redeploy** (Vite inlines `VITE_*` at build time).
Alternative hosts (Vercel / Cloudflare Pages / GitHub Pages) work identically —
same build command, publish `web/dist`, same two env vars.

---

## 7. Operations & gotchas

- **Free Supabase pauses after ~7 days of inactivity.** The first visitor after
  a quiet week sees errors until someone clicks **Restore** in the Supabase
  dashboard (~1–2 min). Regular use keeps it awake.
- **Access is a soft gate, not real security.** The whole app is behind a shared
  password (stored in `board_meta.access_password`, default in
  `web/src/lib/constants.ts` → `DEFAULT_ACCESS_PASSWORD`; editable in Settings;
  login cached per device for `login_days`). The `TRACKING` tab has its own
  separate password (`constants.ts` → `TRACKING_PASSWORD`). Because the anon key
  allows DB read/write, this only deters casual access. The site is also
  `noindex` (meta + robots.txt + `X-Robots-Tag`). For true per-person access, add
  Supabase Auth and tighten the RLS policies in `schema.sql`.
- **Logo/favicon are stored as data URLs in `board_meta`**, which the board
  refetches on its sync cycle. Uploads accept up to 5 MB but are **rasterised and
  downscaled** to a small icon before storage (`image.ts`) precisely so the
  shared row — and everyone's bandwidth — stays light. Don't bypass that.
- **Free-tier limits** (≈500 MB DB, ≈200 concurrent realtime connections) are far
  above a small team's needs.
- **Two identities in the header** — the "You" picker (per-device default author
  / task owner) and the login — are conveniences, not accounts.

---

## 8. Extending it

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
- **Add a table:** create it in `schema.sql` + a migration, fetch it tolerantly in
  `db.ts` `fetchBoard`, add a realtime listener in `useBoard.ts`, and default it
  to empty in `localReducer.ts`.
- **Translations:** every user-facing string goes through `t('key')`; keep the IT
  and EN dictionaries in `i18n.tsx` at parity.

### Possible next steps (not done)
- Real authentication (Supabase Auth) + per-user RLS if the board needs to be
  private for real.
- Merge `claude/hopeful-noether-u6oblf` into `main` and point Netlify at `main`.
- Drag-to-reorder for weekly items / members (subtasks already have it).
- A weekly "learning digest" and per-member reflection streaks.
