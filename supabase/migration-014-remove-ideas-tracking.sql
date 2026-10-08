-- ============================================================================
-- Migration 014 — remove the data of the IDEE (ideas) and TRACKING tabs
--
-- Run in Supabase → SQL Editor AFTER the site version without those tabs is
-- deployed. THIS DELETES DATA and cannot be undone: if you want a copy of the
-- ideas, export them first (Table Editor → suggestions → … → Export → CSV).
--
-- Removed:
--   * IDEE: the table public.suggestions (every anonymous idea);
--   * TRACKING: its password — the 'tracking' row of private.app_secrets (a
--     bcrypt hash) — and the two functions that used it,
--     public.tracking_login and private.admin_set_tracking_password.
--     private.app_secrets itself goes too if nothing else is left in it.
--
-- Untouched: everything else. In particular what the TRACKING tab *showed* —
-- tasks and everyone's reflections — belongs to the Board and Reflection tabs
-- and is not modified. The script counts the rows of every other table before
-- and after and stops (rolling everything back) if any count changed.
--
-- One transaction: if anything fails, nothing is changed. Safe to run again.
-- ============================================================================

begin;

-- ---- Row counts of everything that must stay as it is ----------------------
create temporary table keep_counts (name text primary key, n bigint) on commit drop;
do $$
declare
  t text;
  n bigint;
begin
  foreach t in array array[
    'public.board_meta', 'public.tasks', 'public.weekly', 'public.reflections',
    'public.projects', 'public.personal_notes', 'public.reflection_access',
    'private.team_accounts'
  ] loop
    if to_regclass(t) is not null then
      execute format('select count(*) from %s', t) into n;
      insert into keep_counts values (t, n);
    end if;
  end loop;
end $$;

-- ---- IDEE ----------------------------------------------------------------
do $$
begin
  if to_regclass('public.suggestions') is not null then
    if exists (select 1 from pg_publication_tables
                where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'suggestions') then
      alter publication supabase_realtime drop table public.suggestions;
    end if;
    drop table public.suggestions;
  end if;
end $$;

-- ---- TRACKING ------------------------------------------------------------
drop function if exists public.tracking_login(text);
drop function if exists private.admin_set_tracking_password(text);
do $$
begin
  if to_regclass('private.app_secrets') is not null then
    delete from private.app_secrets where name = 'tracking';
    if not exists (select 1 from private.app_secrets) then
      drop table private.app_secrets;
    end if;
  end if;
end $$;

-- ---- Check: nothing else changed ------------------------------------------
do $$
declare
  r record;
  n bigint;
begin
  for r in select * from keep_counts loop
    execute format('select count(*) from %s', r.name) into n;
    if n <> r.n then
      raise exception 'Row count of % changed (% → %): nothing has been changed.', r.name, r.n, n;
    end if;
  end loop;
end $$;

commit;
