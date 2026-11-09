-- ============================================================================
-- Migration 015 — Projects, reworked
-- Safe on live data: ADDS columns with defaults; nothing is renamed, dropped
-- or rewritten. Run once in Supabase → SQL Editor. Running it again does
-- nothing, so if you ran an earlier version of this file, just run it again.
--
-- projects gains:
--   description  a short summary shown on the project page and in the report
--   notes        free notes, shown on the project page only
--   owners       the people leading it (text[], like tasks.assignees)
--   priority     P1..P4
--   start_date   ISO yyyy-mm-dd (text, like tasks.due_date)
--   target_date  ISO yyyy-mm-dd
--   color        a #rrggbb accent, '' = automatic
--
-- tasks gains:
--   project_id   the project a board task belongs to (one at most). Deleting
--                a project unlinks its tasks; the tasks themselves stay.
--
-- A project's status is not stored: it is "ongoing" until it has linked
-- tasks and every one of them is DONE, then "completed".
--
-- The app works before this runs: the Projects tab says what to run.
-- ============================================================================

alter table public.projects add column if not exists description text   not null default '';
alter table public.projects add column if not exists notes       text   not null default '';
alter table public.projects add column if not exists owners      text[] not null default '{}';
alter table public.projects add column if not exists priority    text   not null default 'P2';
alter table public.projects add column if not exists start_date  text;
alter table public.projects add column if not exists target_date text;
alter table public.projects add column if not exists color       text   not null default '';

alter table public.tasks add column if not exists project_id text
  references public.projects (id) on delete set null;
create index if not exists tasks_project_idx on public.tasks (project_id);

-- Both tables keep their team-only access rule (migration 012) and stay in
-- the realtime publication; new columns need nothing extra.
