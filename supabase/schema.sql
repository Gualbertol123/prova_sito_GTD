-- ============================================================================
-- TEAM GTD — Supabase schema
-- Run this once in your Supabase project: Dashboard → SQL Editor → New query →
-- paste all of this → Run.
-- Creates the tables, opens access for the anonymous key, and turns on realtime
-- so every connected browser stays in sync.
-- ============================================================================

-- ---- Tables ----------------------------------------------------------------

-- Single-row table holding board name + team members.
create table if not exists public.board_meta (
  id          text primary key,
  board_name  text  not null default 'TEAM GTD FINALE',
  members     text[] not null default '{}'
);

-- One row per task.
create table if not exists public.tasks (
  id             text primary key,
  title          text   not null default '',
  description    text   not null default '',   -- app field "desc"
  owner          text   not null default 'Unassigned',
  priority       text   not null default 'P3', -- P1..P4
  status         text   not null default 'NEXT',
  notes          text   not null default '',
  subtasks       jsonb  not null default '[]'::jsonb,
  due_date       text,                          -- ISO yyyy-mm-dd
  waiting_since  text,                          -- ISO yyyy-mm-dd
  updated_at     bigint not null default 0,
  created_at     bigint not null default 0      -- ordering within a column
);

-- One row per weekly-review item.
create table if not exists public.weekly (
  id          text primary key,
  bucket      text   not null,                  -- well | learnings | improve | blockers | focus
  body        text   not null default '',       -- the item text
  created_at  bigint not null default 0
);

-- ---- Access (Row Level Security) -------------------------------------------
-- Open policies: anyone holding the public anon key can read and write. This
-- matches the original app, which had no login. It means anyone who knows the
-- site URL can edit the board. To lock it down later, replace these policies
-- with ones that require authentication.

alter table public.board_meta enable row level security;
alter table public.tasks      enable row level security;
alter table public.weekly     enable row level security;

drop policy if exists "anon all board_meta" on public.board_meta;
drop policy if exists "anon all tasks"      on public.tasks;
drop policy if exists "anon all weekly"     on public.weekly;

create policy "anon all board_meta" on public.board_meta
  for all to anon, authenticated using (true) with check (true);
create policy "anon all tasks" on public.tasks
  for all to anon, authenticated using (true) with check (true);
create policy "anon all weekly" on public.weekly
  for all to anon, authenticated using (true) with check (true);

-- ---- Realtime --------------------------------------------------------------
-- Add the tables to the realtime publication so change events are broadcast.
-- (If a line errors with "already member of publication", ignore it.)

alter publication supabase_realtime add table public.board_meta;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.weekly;
