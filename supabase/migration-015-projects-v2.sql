-- ============================================================================
-- Migration 015 — Projects, reworked
-- Safe on live data: ADDS columns with defaults; nothing is renamed, dropped
-- or rewritten. Run once in Supabase → SQL Editor (running it again does
-- nothing). Every existing project keeps its name and checklist and starts as
-- "active", priority P2, no dates, no phases.
--
-- projects gains:
--   description  free text shown on the project page and in the report
--   owners       the people leading it (text[], like tasks.assignees)
--   status       planned | active | onhold | done
--   priority     P1..P4
--   start_date   ISO yyyy-mm-dd (text, like tasks.due_date)
--   target_date  ISO yyyy-mm-dd
--   color        a #rrggbb accent, '' = automatic
--   phases       [{id, name, dueDate?}] — checklist items point at a phase
--                through their own "phaseId" key inside projects.items
--
-- tasks gains:
--   project_id   the project a board task belongs to (one at most). Deleting
--                a project unlinks its tasks; the tasks themselves stay.
--
-- The app works before this runs: the Projects tab shows the old checklist
-- features and a note asking for this migration.
-- ============================================================================

alter table public.projects add column if not exists description text   not null default '';
alter table public.projects add column if not exists owners      text[] not null default '{}';
alter table public.projects add column if not exists status      text   not null default 'active';
alter table public.projects add column if not exists priority    text   not null default 'P2';
alter table public.projects add column if not exists start_date  text;
alter table public.projects add column if not exists target_date text;
alter table public.projects add column if not exists color       text   not null default '';
alter table public.projects add column if not exists phases      jsonb  not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'projects_status_check'
  ) then
    alter table public.projects
      add constraint projects_status_check
      check (status in ('planned', 'active', 'onhold', 'done'));
  end if;
end $$;

alter table public.tasks add column if not exists project_id text
  references public.projects (id) on delete set null;
create index if not exists tasks_project_idx on public.tasks (project_id);

-- Both tables keep their team-only access rule (migration 012) and stay in
-- the realtime publication; new columns need nothing extra.
