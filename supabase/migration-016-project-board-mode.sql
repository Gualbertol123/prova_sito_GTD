-- ============================================================================
-- Migration 016 — how a project's tasks reach the main board
-- Safe on live data: ADDS two columns with defaults; run once in Supabase →
-- SQL Editor (running it again does nothing). Needs migration 015 first.
--
-- projects gains:
--   board_mode  all        every linked task is on the BOARD (as before)
--               sequential only the current step — the first task, in
--                          task_order, that is not DONE — is on the BOARD;
--                          when it is done the next one appears there
--               none       the project's tasks stay in the project only
--   task_order  the project's task ids in step order (jsonb array). Tasks not
--               listed follow, oldest first.
--
-- Nothing on tasks changes: which ones the BOARD shows is worked out in the
-- app from these two columns.
-- ============================================================================

alter table public.projects add column if not exists board_mode text  not null default 'all';
alter table public.projects add column if not exists task_order jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'projects_board_mode_check') then
    alter table public.projects
      add constraint projects_board_mode_check check (board_mode in ('all', 'sequential', 'none'));
  end if;
end $$;
