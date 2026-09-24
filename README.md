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
| **BOARD** | Kanban with 6 columns (Backlog · Next · In Progress · Waiting · Done · Maybe) **and** a List view (toggle, remembered). Cards expand **inline** (no popups) into a full editor: assignees, priority pills, due date, description, notes, a **File Directory** field with a copy button, a "move to section" dropdown, prev/next arrows, and drag-reorderable subtasks. Columns fill the width edge-to-edge, wrap instead of scrolling, can be shown/hidden (**Columns** editor), and resized in an **edit-layout** mode (neighbours adjust). Below the columns are two full-width collapsible bars, each with its own search: a **Done** bar (this week's completed tasks — a searchable mirror of the DONE column, cards stay in the column too) and an **Archived** bar (tasks completed more than a week ago, auto-moved out of the DONE column). A **Team** panel (collapsed) manages members; a collapsible **priority distribution** chart; a full new-task bar (choose assignees/priority/status/due up front); search + owner/priority/Focus-P1 filters. A task can be held by **one person or several** — open the assignee pill to tick names; the first one stays the `owner` column, so filters, the tracking view and the weekly recap all count a shared task for everyone on it. A **Names** toggle next to **Columns** blanks every owner name on the board (cards, list rows, the expanded editor and the new-task bar) so you can screenshot it — it is per-session only and names are always back on next load. |
| **PROJECTS** | A sidebar of projects; each project is a simple checklist of items with the same interaction as the Kanban subtasks (add, tick, inline-edit, drag-reorder, delete, progress bar). Create / rename / delete projects inline. |
| **WEEKLY** | Weekly review: a "Recap" block auto-fills from tasks completed **this week** (with owner + subtask progress), a collapsible **Archived** section for tasks done more than a week ago, plus 5 editable retro columns: WINS · LEARNINGS · TO IMPROVE · BLOCKERS · FOCUS NEXT WEEK. |
| **REPORT** | Generates the Word report on the Intesa Sanpaolo template and opens it in **SuperDoc**, a real DOCX editor running in the browser (see §5). Nothing is downloaded until asked: correct anything in the editor — text, tables, fonts — then **Download Word** or **Download PDF**. There is also a **Download without editing** button that skips the editor entirely. |
| **CALENDAR** | Month grid; drag a task onto a day to set its due date. Click any task to open its full details in the left panel. Day cells grow to fit all their items. |
| **REFLECTION** | **Personal**, behind a per-user password (default `password`; choose your name + password to enter, with a "remember on this device for" duration incl. Forever). Log one entry per day with 4 fields (Done today · What went well · What to improve · Learning notes); see only **your own** recent entries and a **spaced-repetition review** (1/3/7/14/30-day intervals + random). Inside you can view and change your own password. Passwords live in the `reflection_access` table — an admin can reset any of them in Supabase. A **Diary / Notes** switch at the top of the tab, behind the same password, holds **Personal notes**: free-form notes only you see, in the `personal_notes` table (the chip carries their count, and the tab reopens on whichever half you used last). Private in the interface, not in the database — the anon key can read that table like any other. |
| **TRACKING 🔒** | Password-gated per-member workload monitor (active tasks, P1 count, Ok/High/Overloaded), **plus a central review of everyone's Daily Reflections** (filter by member). Its password lives in code — see §9. |
| **IDEAS** | Anonymous suggestions for improving the site. Nothing identifying is stored — the row is only `{id, body, created_at}`, and the composer ignores the "You" identity the rest of the app uses. The browser that posted an idea keeps its ids in `localStorage` so it can delete its own; that list never leaves the device, and nobody can delete anyone else's. |
| **SETTINGS** | Custom logo (round header box) + favicon upload (rasterised & downscaled, ≤5 MB input); shared access password; login duration; log out this device. Subtitle is edited **inline** by double-clicking it in the header. |

Header extras: editable board title + subtitle (double-click), a **"You"**
identity picker, a live-connection badge, an **IT/EN** toggle, a **Glass**
switch (§10, on by default), and a **Mail update** generator (Completed = DONE, Next steps = FOCUS + NEXT, → clipboard /
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

**The report editor runs entirely in the browser.** SuperDoc opens the
generated `.docx`, edits it, and writes it back — no document is ever uploaded
anywhere, and its "document open" telemetry is switched off explicitly
(`telemetry: { enabled: false }`), so report contents and filenames are not
reported to a third party.

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
| `gtd-refl-auth` | per-member Reflection login cache (`member → expiry \| "never"`) |
| `gtd-my-suggestions` | ids of the anonymous ideas posted from this browser |
| `gtd-skin` | mirror of the skin cookie (`glass` default / `classic`) |
| `gtd-appearance` | mirror of the appearance cookie (`dark` default / `light`) |

---

## 3. Data model (Supabase)

Seven tables, all with **RLS enabled and an open policy for the anon key** (any
signed-out visitor with the anon key can read/write — see §9) and all in the
`supabase_realtime` publication.

**`board_meta`** — one row, `id = 'main'`, holds board-wide state:
`board_name`, `members text[]`, `subtitle_it`, `subtitle_en`, `access_password`
(default in code), `login_days` (default 7), `logo_url`, `favicon_url` (data
URLs).

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

**`projects`** — one row per project: `id`, `name`, `items jsonb`
(`[{id,text,done,doneAt}]`, same shape as subtasks), `created_at`, `updated_at`.

**`reflection_access`** — one row per member: `member`, `password`, `updated_at`.
The per-member Reflection gate; an admin resets a password by editing the
`password` cell in the Supabase Table Editor.

**`suggestions`** — one row per anonymous idea: `id`, `body`, `created_at`.
Deliberately **no author column**.

SQL files in `supabase/`:

- `schema.sql` — the **complete** schema for a fresh project (all tables +
  policies + realtime).
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

The migrations are additive and safe on live data; run any you haven't yet. The
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
│   ├── migration-006-reflection-access.sql
│   └── migration-007-done-at.sql
└── web/                          ← the entire frontend (Vite root)
    ├── index.html                ← HTML shell (fonts, noindex meta, #root)
    ├── package.json              ← deps: react, react-dom, @supabase/supabase-js, fflate, superdoc
    ├── vite.config.ts · tailwind.config.js · postcss.config.js · tsconfig.json
    ├── .env.example              ← VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
    ├── public/robots.txt         ← Disallow: / (noindex)
    ├── public/report-template.docx ← the Intesa Sanpaolo Word template the report is built on
    ├── vite.config.ts            ← incl. manualChunks: SuperDoc/Supabase cached separately
    └── src/
        ├── main.tsx              ← mounts <LangProvider><IdentityProvider><AuthGate><App/>
        ├── App.tsx               ← tabs, top bar, filters state, favicon effect, routing
        ├── index.css             ← Tailwind + small globals (drop-target, fonts)
        ├── styles/glass.css      ← the Liquid Glass skin, scoped to [data-skin="glass"]
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
        │   ├── reportData.ts     ← week maths + Done / Next / Projects / Planner collection
        │   ├── reportDocx.ts     ← builds the .docx from the template (lazy-loaded)
        │   ├── reportEditor.ts   ← SuperDoc loader, fonts, DOCX export
        │   ├── reportPdf.ts      ← captures the editor's pages into a downloaded PDF (lazy)
        │   ├── skin.ts           ← which visual skin is on (glass / classic)
        │   └── useSyncedField.ts ← text field that syncs w/o clobbering active typing
        └── components/
            ├── TopBar.tsx        ← logo, editable title + subtitle, mail button, right slot
            ├── ConnBadge.tsx · LangToggle.tsx · IdentityPicker.tsx   ← header controls
            ├── GlassToggle.tsx    ← the Liquid Glass on/off switch
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
            ├── SuggestionsView.tsx ← anonymous improvement ideas
            ├── SettingsView.tsx  ← branding upload, access password, login duration
            └── MailModal.tsx     ← mail-update text generator
```

Rough size: ~7.1k lines of TS/TSX. Largest files: `i18n.tsx` (dictionary),
`BoardView.tsx`, `db.ts`, `reportDocx.ts`, `TaskDetails.tsx`,
`DailyReflection.tsx`, `SortableSubtasks.tsx`.

---

## 5. Weekly report — generate, edit, export

The **REPORT** tab turns the board into the Word report and lets you fix it up
before it goes out, without leaving the site.

```
period ─▶ buildReportDocx()  ─┐
                              ├─▶ .docx in memory ─▶ SuperDoc editor ─┬─▶ Download Word
         preloadSuperDoc()  ──┘   (never written                      └─▶ Download PDF
         (starts on tab open)      to disk here)                          (pages → jsPDF)
```

Nothing is downloaded unless asked. **Download without editing** skips the
editor and saves the generated file directly.

### The document

Built on the real template at `web/public/report-template.docx`:
`reportDocx.ts` unzips it, replaces only the body of `word/document.xml`, and
zips it back, so `styles.xml` (Garamond 11pt), `header1.xml` (the logo
letterhead) and `footer1.xml` (`PAGE {PAGE} OF {NUMPAGES}` as real Word fields,
which is what makes page numbers automatic) all survive untouched.

| Page | Section | Filled with |
| --- | --- | --- |
| 1 (portrait) | `Weekly Report` + `dd/mm/yyyy – dd/mm/yyyy` | the selected period |
| | **Done** | tasks that entered DONE inside the period, with their subtasks |
| | **Next** | whatever is in the NEXT column right now |
| | **Current Projects** | the Projects tab, each with its checklist and `done / total` |
| 2 (landscape) | `Planner` + the same period | **Backlog · Next · In Progress · Waiting** side by side |

Only **Done** is period-filtered. No owner names anywhere, no images, no tick
marks — see the layout rules in `reportDocx.ts`.

### The editor (SuperDoc)

[SuperDoc](https://github.com/superdoc-dev/superdoc) edits DOCX natively in the
browser — it writes back to the OOXML rather than round-tripping through HTML,
so the letterhead, the footer's page-number fields and the portrait/landscape
section split all survive a round trip (there are assertions for exactly this
in the commit that added it).

- **Licence: AGPL-3.0.** Fine for internal, non-commercial use. Redistributing
  this app commercially would need SuperDoc's commercial licence instead.
- **Telemetry is off.** SuperDoc posts a document-open event to
  `ingest.superdoc.dev` by default; `telemetry: { enabled: false }` in
  `reportEditor.ts` disables it, and the test that verified this asserted zero
  requests to that host. No document ever leaves the browser.
- **Fonts.** Nine Google Fonts are registered and added to the toolbar's font
  dropdown alongside the document's own (Garamond, Trajan Pro, Arial…).
  EB Garamond leads the list because it is the open counterpart of the
  template's Garamond. The stylesheet is fetched from the same Google CDN the
  app already uses for Cinzel and Inter, and failing to load it is non-fatal —
  the editor still opens, just without the extra families. If the corporate
  network blocks Google, self-host the woff2 files and point
  `fonts.families[].faces[].url` at them instead.

### Weight and caching

SuperDoc is ~12 MB installed, so it is kept out of the main bundle entirely:

- `preloadSuperDoc()` starts the dynamic import **when the REPORT tab opens**,
  so it downloads in parallel with building the document rather than after it.
  The promise is module-level, so it loads once per page load however many
  times the editor is opened.
- `manualChunks` in `vite.config.ts` pins SuperDoc (and Supabase) to their own
  content-hashed chunks. An ordinary app deploy leaves the browser's cached
  SuperDoc valid; a SuperDoc upgrade invalidates only SuperDoc's chunk.
- `/assets/*` is served `Cache-Control: public, max-age=31536000, immutable`
  (`netlify.toml`). Safe because the filenames are content-hashed.

Net effect on everyone who never opens the tab: the main bundle went **down**,
from ~507 kB to ~285 kB, because Supabase moved into its own chunk too.

### PDF

**Download PDF** saves a `.pdf` file directly — no print dialog.
SuperDoc can only export DOCX, but it already draws every page as an exact A4
box with the letterhead and footer painted in, so `reportPdf.ts` photographs
those boxes: each `.superdoc-page` is captured with
[modern-screenshot](https://github.com/qq15725/modern-screenshot) (the browser
paints it through an SVG `foreignObject`, so fonts and table borders match the
screen) and placed full-bleed on its own page with
[jsPDF](https://github.com/parallax/jsPDF). Both libraries are lazy-loaded on
the click, so they cost nothing up front.

Things worth knowing:

- **Each PDF page keeps its orientation.** The planner is a true A4 landscape
  sheet; the other pages are A4 portrait.
- **The text in the PDF is an image** (~190 dpi, JPEG), so it cannot be
  selected or searched. When that matters, download the Word file and use
  Word's own "Save as PDF". The hint next to the button says so.
- **SuperDoc paints pages lazily.** By default it only keeps a window of pages
  near the viewport, and it only fills in a page once it has been scrolled to.
  The editor is created with `layoutEngineOptions: { virtualization: { enabled:
  false } }` so every page box exists, and the exporter scrolls each page into
  view and waits for its content before capturing it, then puts the scroll
  position back. Without this, pages beyond the first screenful come out blank.
- **Speed:** about 2 s per page (a normal 2-page report takes ~4 s). The button
  shows `PDF: page n of N…` while it works.

---

## 6. Run locally

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

## 7. Deploy — browser only, ~15 minutes

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

## 8. Operations & gotchas

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
- **SuperDoc is AGPL-3.0.** The report editor is fine for internal,
  non-commercial use, which is what this board is. Redistributing the app
  commercially, or as a hosted product, would need SuperDoc's commercial
  licence. Its telemetry is disabled in code — if you ever upgrade the package,
  re-check that `telemetry: { enabled: false }` is still honoured.
- **Free-tier limits** (≈500 MB DB, ≈200 concurrent realtime connections) are far
  above a small team's needs.
- **Two identities in the header** — the "You" picker (per-device default author
  / task owner) and the login — are conveniences, not accounts.

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
- **Add a table:** create it in `schema.sql` + a migration, fetch it tolerantly in
  `db.ts` `fetchBoard`, add a realtime listener in `useBoard.ts`, and default it
  to empty in `localReducer.ts`.
- **Translations:** every user-facing string goes through `t('key')`; keep the IT
  and EN dictionaries in `i18n.tsx` at parity.

### Possible next steps (not done)
- Real authentication (Supabase Auth) + per-user RLS if the board needs to be
  private for real. Note that today **every client downloads every reflection
  and every Reflection password** on each refetch, so the per-member Reflection
  gate is a UI convenience, not privacy.
- Merge `claude/hopeful-noether-u6oblf` into `main` and point Netlify at `main`.
- Drag-to-reorder for weekly items / members (subtasks already have it).
- Weekly items are still uncontrolled `defaultValue` textareas, so another
  person's edit to an existing weekly item only shows after a reload.
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

- **The report editor.** SuperDoc renders the actual Word document, so it must
  look like the document: no glass, no dark, no filters inside `.superdoc*` or
  `.report-print-root`, and the page keeps its white fill and `color-scheme:
  light`.
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
