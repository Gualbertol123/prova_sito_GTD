# TEAM GTD FINALE — realtime collaborative board

A full rebuild of the original single-file GTD + Kanban artifact as a modern
**React app with real-time multi-user collaboration**, hosted **100% free**:

- **Frontend** → **Netlify** (free static hosting, builds from GitHub).
- **Data + realtime** → **Supabase** (free Postgres + realtime + auto REST API).

Multiple people can view and edit the same board at once; every change is
saved to Supabase and pushed live to everyone connected. **The board data is
never stored or cached in the browser** — the Supabase client runs with
memory-only state and no session persistence, so closing the tab leaves no
local copy of any task. The only things kept on the device are two personal
display preferences: the chosen **language** (IT/EN) and the **board layout**
(column width, collapsed columns) — never board content.

The app is **bilingual (Italian / English)** with a header toggle; the choice
is remembered per device. The look (navy `#0A1931`, gold `#C9A96E`, cream
backgrounds) and fonts (**Cinzel** display + **Inter** body) match the original.

---

## What's in the app

| Tab | What it does |
| --- | --- |
| **BOARD** | Kanban — Backlog · Next · In Progress · Waiting · Done · Maybe. Cards expand inline (no popups), search + filters, a full new-task bar (owner/priority/status/due), drag between columns, team members bar, priority chart, saved column width + collapse. |
| **WEEKLY** | Weekly review: auto "Fatto questa settimana" (from DONE) + 5 retro columns (WINS · LEARNINGS · TO IMPROVE · BLOCKERS · FOCUS). |
| **CALENDARIO** | Month calendar; drag a task onto a date to set its due date. |
| **TRACKING 🔒** | Password-gated team-load monitor. |
| **ISTRUZIONI** | Reference for statuses, priorities and workflow. |

Plus a **Mail update** generator (DONE + FOCUS → clipboard / mail client).

---

## Architecture

```
Browser (React SPA, in-memory only)
   │  @supabase/supabase-js  ── select / insert / update / delete
   │  Postgres realtime (WebSocket)  ── live change events → refresh
   ▼
Supabase project (free)
   board_meta · tasks · weekly   (Postgres tables, RLS open to anon key)
```

- **Source of truth:** three Postgres tables. Each task is its own row, so two
  people editing different tasks never collide.
- **Live sync:** Supabase Postgres realtime broadcasts every insert/update/
  delete; each client refreshes and re-renders.
- **Snappy UI:** edits apply optimistically in memory, then reconcile with the
  authoritative row from realtime.
- **No local storage:** the Supabase client uses memory-only cache and
  `persistSession:false`, so nothing lands in `localStorage`/IndexedDB.

### Repo layout

```
web/            React + Vite + TypeScript + Tailwind frontend
  src/lib/      supabase client, data layer (db.ts), realtime hook, seed
  src/components/  board, calendar, weekly, tracking, instructions, modals
supabase/schema.sql   run once to create tables + policies + realtime
netlify.toml    Netlify build config
legacy/         the original artifact, kept for reference
```

---

## Deploy — browser only, ~15 minutes

### Part 1 — Create the Supabase backend

1. Go to **https://supabase.com** → sign in with GitHub → **New project**.
   - Name: `team-gtd`, pick a strong DB password (you won't need it again),
     region: **West EU (Ireland/Frankfurt)**. Create — it provisions in ~2 min.
2. Left sidebar → **SQL Editor** → **New query**. Open `supabase/schema.sql`
   from this repo, copy **all** of it, paste, and click **Run**. This creates
   the tables, opens access for the anon key, and enables realtime.
3. Left sidebar → **Project Settings → API**. Copy two values:
   - **Project URL** (e.g. `https://abcd1234.supabase.co`)
   - **anon public** key (a long `eyJ...` string)

### Part 2 — Deploy the frontend on Netlify

1. Go to **https://app.netlify.com** → sign in with GitHub →
   **Add new site → Import an existing project → GitHub** → pick
   `Gualbertol123/prova_sito_GTD`.
2. Netlify reads `netlify.toml`, so build command and publish dir are already
   set. Just choose the branch **`claude/hopeful-noether-u6oblf`**
   (or `main` once you've merged).
3. Before the first deploy, open **Site configuration → Environment variables**
   → **Add a variable** (add both):
   | Key | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | *(the Project URL from Part 1.3)* |
   | `VITE_SUPABASE_ANON_KEY` | *(the anon public key)* |
4. **Deploy site**. When it finishes, open the Netlify URL. The board seeds
   itself on first load and the status pill top-right reads **Live**.
5. Open the URL in a second browser and drag a card — it moves live in the
   first. That's the real-time sync working.

> Prefer not to use environment variables? You can instead paste the two values
> directly into `web/src/lib/supabaseConfig.ts` via GitHub's web editor and
> commit — Netlify will rebuild automatically. (The anon key is not secret.)

### Alternative hosts

The frontend is plain static files, so **Vercel**, **Cloudflare Pages**, or
**GitHub Pages** work identically — connect the repo, set build command
`npm --prefix web install && npm --prefix web run build`, publish `web/dist`,
and add the same two `VITE_SUPABASE_*` variables.

---

## Run locally

```bash
cd web
cp .env.example .env      # fill in your Supabase URL + anon key
npm install
npm run dev               # http://localhost:5173
```

---

## Good to know

- **Free Supabase projects pause after ~7 days of inactivity.** If nobody
  opens the board for a week, the first visitor sees errors until someone
  clicks **Restore** in the Supabase dashboard (~1–2 min). Regular weekly use
  keeps it awake. (This is the main tradeoff of the free tier.)
- **Access is open.** Anyone with the site URL can read/write the board — there
  is no login, matching the original app. The `TRACKING` tab keeps its own
  password gate (the password lives in the app code, not here). To restrict the
  whole board, add Supabase Auth and tighten the RLS policies in
  `supabase/schema.sql`.
- **Free limits** (500 MB database, 200 concurrent realtime connections, 2
  projects) are far above what a small team needs.
