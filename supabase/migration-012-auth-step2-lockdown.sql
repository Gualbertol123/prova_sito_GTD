-- ============================================================================
-- Migration 012 — real login, step 2 of 2 (LOCKDOWN)
--
-- Run this in Supabase → SQL Editor only when ALL of these are true:
--   1. migration-011-auth-step1.sql has run;
--   2. the new version of the site is deployed on Netlify;
--   3. you have logged in to that new site with the team password and the
--      board shows your tasks.
--
-- What it does:
--   * closes every table to the public (anon) key — only a logged-in team
--     account can read or write board data from now on;
--   * makes the Reflection password table unreadable from the browser;
--   * deletes the clear-text passwords (board_meta.access_password and
--     reflection_access.password). The hashes made by step 1 stay, so
--     everyone keeps their current Reflection password.
--
-- Board data (tasks, weekly, reflections, projects, notes, ideas, settings) is
-- not touched: only access rules and the two password columns change.
-- Browsers still running the OLD site will stop syncing after this and need a
-- reload.
--
-- If a check below fails, the script stops and nothing is changed.
-- ============================================================================

begin;

-- ---- Safety checks ---------------------------------------------------------
do $$
begin
  if to_regprocedure('public.is_team_member()') is null
     or to_regclass('private.team_accounts') is null then
    raise exception 'Run migration-011-auth-step1.sql first.';
  end if;
  if not exists (select 1 from private.team_accounts) then
    raise exception 'No team account is registered, so this would lock everyone out. Run: select private.admin_add_team_account(''team e-mail'');';
  end if;
  if exists (select 1 from public.reflection_access where password_hash is null) then
    raise exception 'Some Reflection passwords are not hashed yet. Re-run migration-011-auth-step1.sql, then this.';
  end if;
end $$;

-- ---- Board tables: team accounts only --------------------------------------
do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'board_meta', 'tasks', 'weekly', 'reflections', 'projects',
    'suggestions', 'personal_notes'
  ] loop
    if to_regclass('public.' || t) is null then
      continue;  -- that feature's migration was never run; nothing to protect
    end if;

    execute format('alter table public.%I enable row level security', t);

    -- Remove every existing policy on the table (the old open "anon all ..."
    -- ones and anything else), then add the single team-only policy.
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;

    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using ((select public.is_team_member())) with check ((select public.is_team_member()))',
      'team only ' || t, t);

    -- Belt and braces: the public key gets no table rights at all.
    execute format('revoke all on table public.%I from anon', t);
  end loop;
end $$;

-- ---- Reflection passwords: invisible to the browser ------------------------
do $$
declare
  p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'reflection_access' loop
    execute format('drop policy %I on public.reflection_access', p.policyname);
  end loop;
end $$;
alter table public.reflection_access enable row level security;
revoke all on table public.reflection_access from anon, authenticated;

do $$
begin
  if exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reflection_access'
  ) then
    alter publication supabase_realtime drop table public.reflection_access;
  end if;
end $$;

-- ---- Delete the clear-text passwords ---------------------------------------
drop trigger if exists reflection_access_sync_hash on public.reflection_access;
drop function if exists private.reflection_access_sync_hash();
alter table public.reflection_access drop column if exists password;
alter table public.reflection_access alter column password_hash set not null;

alter table public.board_meta drop column if exists access_password;

commit;

-- After this: change the Tracking password (it used to be in the site's code):
--   select private.admin_set_tracking_password('a new password');
