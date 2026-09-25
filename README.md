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
| **REFLECTION** | **Personal**, behind a per-user password (initial password `password`; choose your name + password to enter, with a "remember on this device for" duration incl. Forever). Log one entry per day with 4 fields (Done today · What went well · What to improve · Learning notes); see only **your own** recent entries and a **spaced-repetition review** (1/3/7/14/30-day intervals + random). Inside you can change your own password (the current one is required). Passwords are stored as **bcrypt hashes** and checked by the database (`reflection_login`); 5 wrong tries lock that name for 5 minutes; an admin resets a forgotten one from Supabase (§11). A **Diary / Notes** switch at the top of the tab, behind the same password, holds **Personal notes**: free-form notes only you see, in the `personal_notes` table (the chip carries their count, and the tab reopens on whichever half you used last). Private from outsiders, but *within the team* the privacy is in the interface only — see §11. |
| **TRACKING 🔒** | Password-gated per-member workload monitor (active tasks, P1 count, Ok/High/Overloaded), **plus a central review of everyone's Daily Reflections** (filter by member). Its password is a bcrypt hash in the database, checked by `tracking_login`; set it from Supabase (§11). |
| **IDEAS** | Anonymous suggestions for improving the site. Nothing identifying is stored — the row is only `{id, body, created_at}`, and the composer ignores the "You" identity the rest of the app uses. The browser that posted an idea keeps its ids in `localStorage` so it can delete its own; that list never leaves the device, and nobody can delete anyone else's. |
| **SETTINGS** | Custom logo (round header box) + favicon upload (rasterised & downscaled, ≤5 MB input); change the shared team password (current one required; logs every other device out); login duration; log out this device. Subtitle is edited **inline** by double-clicking it in the header. |

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
| `gtd-my-suggestions` | ids of the anonymous ideas posted from this browser |
| `gtd-skin` | mirror of the skin cookie (`glass` default / `classic`) |
| `gtd-appearance` | mirror of the appearance cookie (`dark` default / `light`) |

---

## 3. Data model (Supabase)

Eight tables in `public`, all with **RLS enabled and one policy: the logged-in
team account only** (`is_team_member()`; the anon key alone gets nothing — §11).
All except `reflection_access` are in the `supabase_realtime` publication. A
`private` schema, which the website's API cannot reach, holds the team list and
the Tracking password hash.

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

**`projects`** — one row per project: `id`, `name`, `items jsonb`
(`[{id,text,done,doneAt}]`, same shape as subtasks), `created_at`, `updated_at`.

**`reflection_access`** — one row per member: `member`, `password_hash`
(bcrypt), `failed_attempts`, `locked_until`, `updated_at`. **Not readable from
the browser at all**; used only by the `reflection_login` /
`reflection_change_password` database functions. Reset a password with
`private.admin_set_reflection_password` (§11) — editing the table by hand does
not work any more.

**`personal_notes`** — one row per note: `id`, `member`, `body`, `created_at`,
`updated_at`.

**`private.team_accounts`** — the Supabase Auth user id(s) allowed to use the
board. **`private.app_secrets`** — the Tracking password hash.

**`suggestions`** — one row per anonymous idea: `id`, `body`, `created_at`.
Deliberately **no author column**.

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
- `migration-012-auth-step2-lockdown.sql` — **real login, step 2.** Closes all
  tables to the anon key, hides `reflection_access`, deletes the clear-text
  password columns. Run only after the new site is live and you have logged in
  with it. See §11.

Migrations 002–011 are additive and safe on live data; run any you haven't yet.
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
│   └── migration-012-auth-step2-lockdown.sql ← real login, step 2 (lockdown)
└── web/                          ← the entire frontend (Vite root)
    ├── index.html                ← HTML shell (fonts, noindex meta, #root)
    ├── package.json              ← deps: react, react-dom, @supabase/supabase-js, fflate, superdoc
    ├── vite.config.ts · tailwind.config.js · postcss.config.js · tsconfig.json
    ├── .env.example              ← VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_TEAM_EMAIL
    ├── public/robots.txt         ← Disallow: / (noindex)
    ├── public/report-template.docx ← the Intesa Sanpaolo Word template the report is built on
    ├── public/fonts/             ← EB Garamond + Cinzel TTFs embedded in the PDF (OFL)
    ├── vite.config.ts            ← incl. manualChunks: SuperDoc/Supabase cached separately
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
        │   ├── auth.ts           ← team login/logout/password change + Reflection/Tracking checks
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
        │   ├── reportPdf.ts      ← redraws the editor's pages as a real-text PDF (lazy)
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
            ├── CalendarView.tsx  ← month grid + left detail panel
            ├── WeeklyView.tsx    ← recap + 5 retro columns
            ├── DailyReflection.tsx ← reflection form + recent + spaced review
            ├── TrackingView.tsx  ← password-gated workload monitor
            ├── SuggestionsView.tsx ← anonymous improvement ideas
            ├── SettingsView.tsx  ← branding upload, team password change, login duration
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
         (starts on tab open)      to disk here)                          (layout → jsPDF)
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

**Download PDF** saves a `.pdf` file directly, with no print dialog, and the
PDF has **real text**: it can be selected, searched and copied, and it stays
sharp at any zoom. SuperDoc can only export DOCX. But it lays every page out
itself as absolutely positioned lines, text runs, cell borders and fills. So
`reportPdf.ts` reads that layout back out of the DOM and redraws it with
[jsPDF](https://github.com/parallax/jsPDF):

| On the page | In the PDF |
| --- | --- |
| text runs | PDF text in embedded fonts, at the run's exact position and width |
| background fills, cell and paragraph borders | vector rectangles |
| `<img>` (the letterhead logo) | the image |
| underline / strike-through | a thin rule under / through the run |

It also carries over bold, italic, colour, letter-spacing and `text-transform`.
Each PDF page keeps its orientation, so the planner is a true A4 landscape
sheet. Nine pages take about 2 s.

**Fonts.** Garamond and Trajan Pro are commercial, so the PDF embeds their open
counterparts, which are self-hosted in `web/public/fonts/` (OFL, see the
README there): **EB Garamond** for Garamond and **Cinzel** for Trajan Pro. The
Google families in the editor's font menu (Lora, Roboto, …) are fetched from
the fontsource CDN on jsDelivr only when the document uses them. Arial, Calibri
and other sans fonts map to the PDF's built-in Helvetica; Times New Roman and
Georgia map to Times. If a font file can't be fetched, that run falls back to
the built-in font rather than failing. Screen fonts and PDF fonts differ
slightly in width. That difference is absorbed by the character spacing (capped
at 12% of the font size), so centred and right-aligned text stays in place and
glyphs are never stretched.

**Lazy painting.** SuperDoc normally keeps only a window of pages near the
viewport, and it fills a page in only once it has been scrolled to. The editor
is created with `layoutEngineOptions: { virtualization: { enabled: false } }` so
every page box exists. The exporter then scrolls each page into view and waits
for its content before reading it, and puts the scroll position back at the
end.

**Fallback.** If the vector build throws for any reason, the previous route
takes over: a picture of each page (modern-screenshot → JPEG → jsPDF). So the
button always produces a file. When that happens, a note next to the button
says the text in that PDF is not selectable.

**Known quirk:** in the footer SuperDoc places some runs a couple of pixels too
close together ("PAGE1OF2", "INTERNALUSE ONLY"). It looks the same in the
editor; the PDF just reproduces SuperDoc's layout.

---

## 6. Run locally

```bash
cd web
cp .env.example .env      # fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_TEAM_EMAIL
npm install
npm run dev               # http://localhost:5173
npm run build             # type-check (tsc -b) + production build to web/dist
```

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
   team e-mail and a Tracking password on its last lines → **Run**.
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
- **SuperDoc is AGPL-3.0.** The report editor is fine for internal,
  non-commercial use, which is what this board is. Redistributing the app
  commercially, or as a hosted product, would need SuperDoc's commercial
  licence. Its telemetry is disabled in code — if you ever upgrade the package,
  re-check that `telemetry: { enabled: false }` is still honoured.
- **Free-tier limits** (≈500 MB DB, ≈200 concurrent realtime connections) are far
  above a small team's needs.
- **Two identities in the header** — the "You" picker (per-device default author
  / task owner) and the Reflection login — are conveniences, not accounts; the
  only account is the shared team login.

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
- **Reflection and Tracking passwords are bcrypt hashes** checked by database
  functions (`reflection_login`, `reflection_change_password`,
  `tracking_login`), callable only by the logged-in team account. Five wrong
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

The Security Advisor will warn that `is_team_member`, `reflection_login`,
`reflection_change_password` and `tracking_login` are SECURITY DEFINER
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
   Reflection tab (everyone's current password still works) and Tracking
   (still `Matusalemme` until you change it in step 7).
6. **SQL Editor**: run `supabase/migration-012-auth-step2-lockdown.sql`. From
   now on **every table** is closed to everyone but the team account — it
   lists (as warnings) any extra table it closed, such as the old app's
   `boards` table. Any old copy of the site still online (e.g. a GitHub Pages
   copy of the original app) stops working, as it should. Other open tabs
   need a reload and a login.
7. **Change the passwords that were exposed** — all of them were readable
   before this upgrade:
   `select private.admin_set_tracking_password('new tracking password');`
   and have **every member** change their Reflection password in the
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
| Set the **Tracking** password (also unlocks it) | `select private.admin_set_tracking_password('new password');` |
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

