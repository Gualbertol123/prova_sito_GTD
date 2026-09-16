-- ============================================================================
-- Migration 005 — Projects (each project = a checklist of items)
-- Safe on live data: creates a NEW table only. Run once in Supabase SQL Editor.
-- The app works before this runs (the Projects tab stays empty and can't save
-- until the table exists).
-- ============================================================================

create table if not exists public.projects (
  id          text primary key,
  name        text  not null default '',
  items       jsonb not null default '[]'::jsonb,  -- [{id,text,done}] like subtasks
  created_at  bigint not null default 0,
  updated_at  bigint not null default 0
);
create index if not exists projects_created_idx on public.projects (created_at);

alter table public.projects enable row level security;
drop policy if exists "anon all projects" on public.projects;
create policy "anon all projects" on public.projects
  for all to anon, authenticated using (true) with check (true);

alter publication supabase_realtime add table public.projects;
