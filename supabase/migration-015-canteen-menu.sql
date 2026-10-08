-- ============================================================================
-- Migration 015 — the canteen menu for the weekly report
-- Safe on live data: ADDS one table; nothing else changes.
-- Run once in Supabase → SQL Editor (running it again does nothing new).
--
-- public.canteen_menu holds one row per day of the canteen's menu. The REPORT
-- tab shows next week's days in its MENU section.
--   * Only the logged-in team account can read it; nobody can write to it
--     from the website. It is filled once a month from the SQL Editor with the
--     file made by menu/menu_from_pdf.py (never committed: the repository
--     is public).
--   * Past days are invisible from the website straight away (the rule below
--     only shows today and later, Italian time) and are deleted by every
--     monthly update.
-- ============================================================================

begin;

do $$
begin
  if to_regprocedure('public.is_team_member()') is null then
    raise exception 'Run migration-011-auth-step1.sql and migration-012-auth-step2-lockdown.sql first.';
  end if;
end $$;

create table if not exists public.canteen_menu (
  day        date primary key,
  venue      text not null default '',
  courses    jsonb not null default '[]'::jsonb,  -- [{course, items: [{name, allergens: [int]}]}]
  updated_at timestamptz not null default now()
);

alter table public.canteen_menu enable row level security;
do $$
declare
  p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'canteen_menu' loop
    execute format('drop policy %I on public.canteen_menu', p.policyname);
  end loop;
end $$;
revoke all on table public.canteen_menu from public, anon, authenticated;
grant select on table public.canteen_menu to authenticated;
create policy "team reads the menu, today onwards" on public.canteen_menu
  for select to authenticated
  using ((select public.is_team_member()) and day >= (now() at time zone 'Europe/Rome')::date);

commit;
