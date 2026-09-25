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
--   * closes EVERY table in the public schema to the public (anon) key — the
--     board tables, and anything else there (e.g. the old app's `boards`
--     table): only a logged-in team account can read or write from now on;
--   * refuses sessions that were logged out or revoked, straight away;
--   * makes the Reflection password table unreadable from the browser;
--   * deletes the clear-text passwords (board_meta.access_password and
--     reflection_access.password). The hashes made by step 1 stay, so
--     everyone keeps their current Reflection password;
--   * makes future tables closed to the anon key by default.
--
-- Board data (tasks, weekly, reflections, projects, notes, ideas, settings) is
-- not touched: only access rules and the two password columns change.
-- Browsers still running the OLD site (including any old copy hosted
-- elsewhere) stop working after this — that is intended.
--
-- Safe to run again. If a check below fails, the script stops and nothing is
-- changed.
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

-- ---- Team check: also refuse logged-out / revoked sessions -----------------
-- A logged-out session's access token stays technically valid for up to an
-- hour; checking its session id against auth.sessions makes the database
-- refuse it at once (after "log out", a password change, or an admin reset).
create or replace function public.is_team_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from private.team_accounts t
      join auth.sessions s on s.user_id = t.user_id
     where t.user_id = auth.uid()
       and s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
  );
$$;
revoke all on function public.is_team_member() from public, anon;
grant execute on function public.is_team_member() to authenticated;

-- ---- One place that closes a table (also used by older migrations) ---------
-- Board tables: one policy, "logged-in team account only"; anon gets no rights.
-- reflection_access: no browser access at all.
create or replace function private.lock_table(p_table text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record;
begin
  if to_regclass('public.' || quote_ident(p_table)) is null then
    return;
  end if;
  execute format('alter table public.%I enable row level security', p_table);
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = p_table loop
    execute format('drop policy %I on public.%I', p.policyname, p_table);
  end loop;
  execute format('revoke all on table public.%I from anon', p_table);
  -- TRUNCATE ignores row-level security; nobody from the browser needs it.
  execute format('revoke truncate, references, trigger on table public.%I from authenticated', p_table);

  if p_table = 'reflection_access' then
    execute format('revoke all on table public.%I from authenticated', p_table);
    if exists (select 1 from pg_publication_tables
                where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = p_table) then
      execute format('alter publication supabase_realtime drop table public.%I', p_table);
    end if;
    return;
  end if;

  execute format('grant select, insert, update, delete on table public.%I to authenticated', p_table);
  execute format(
    'create policy %I on public.%I for all to authenticated '
    'using ((select public.is_team_member())) with check ((select public.is_team_member()))',
    'team only ' || p_table, p_table);
end;
$$;
revoke all on function private.lock_table(text) from public, anon, authenticated;

-- ---- Close every table in public -------------------------------------------
do $$
declare
  t record;
begin
  for t in
    select c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p')
     order by c.relname
  loop
    perform private.lock_table(t.relname);
    if t.relname not in ('board_meta', 'tasks', 'weekly', 'reflections', 'projects',
                         'suggestions', 'personal_notes', 'reflection_access') then
      raise warning 'Also closed to the public key: public.% (not used by the new site).', t.relname;
    end if;
  end loop;

  -- Views run with their owner's rights and skip row-level security: take
  -- them away from the browser entirely.
  for t in
    select c.relname, c.relkind
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('v', 'm', 'f')
  loop
    execute format('revoke all on public.%I from anon, authenticated', t.relname);
    raise warning 'View/foreign table public.% is no longer reachable from the browser.', t.relname;
  end loop;
end $$;

-- New tables, sequences and functions in public start closed to the anon key.
alter default privileges for role postgres in schema public revoke all on tables    from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;
revoke all on all sequences in schema public from anon;

-- ---- Undo anything the public key did to the password table meanwhile ------
-- Until now anyone could write reflection_access. Clear lockouts, and rebuild
-- any hash that is not a real bcrypt hash from the stored password.
update public.reflection_access set failed_attempts = 0, locked_until = null;
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'reflection_access' and column_name = 'password') then
    execute $q$
      update public.reflection_access
         set password_hash = extensions.crypt(coalesce(password, 'password'), extensions.gen_salt('bf', 10))
       where password_hash !~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$'
    $q$;
  end if;
end $$;

-- ---- Delete the clear-text passwords ---------------------------------------
drop trigger if exists reflection_access_sync_hash on public.reflection_access;
drop function if exists private.reflection_access_sync_hash();
alter table public.reflection_access drop column if exists password;
alter table public.reflection_access alter column password_hash set not null;

alter table public.board_meta drop column if exists access_password;

-- ---- Password functions: final versions ------------------------------------
-- bcrypt only uses the first 72 bytes of a password, so longer ones are
-- refused rather than silently shortened.

create or replace function public.reflection_change_password(
  p_member text, p_current text, p_new text
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  res text;
begin
  if p_new is null or length(p_new) < 6 or octet_length(p_new) > 72 then
    return 'invalid';
  end if;
  -- Changing needs the current password, checked (and throttled) the same way
  -- as a login, so one teammate cannot change another's.
  res := public.reflection_login(p_member, p_current);
  if res <> 'ok' then
    return res;
  end if;
  update public.reflection_access
     set password_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 10)),
         updated_at    = (extract(epoch from now()) * 1000)::bigint
   where member = p_member;
  return 'ok';
end;
$$;
revoke all on function public.reflection_change_password(text, text, text) from public, anon;
grant execute on function public.reflection_change_password(text, text, text) to authenticated;

-- ---- Admin tools: final versions -------------------------------------------

create or replace function private.admin_remove_team_account(p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  select t.user_id into uid
    from private.team_accounts t join auth.users u on u.id = t.user_id
   where lower(u.email) = lower(trim(p_email));
  if uid is null then
    raise exception 'No team account with e-mail %.', p_email;
  end if;
  if (select count(*) from private.team_accounts) = 1 then
    raise exception 'That is the last team account: removing it would lock everyone out. Add another one first.';
  end if;
  delete from private.team_accounts where user_id = uid;
  delete from auth.sessions where user_id = uid;
  return 'Team account disabled: ' || p_email;
end;
$$;

-- Set a new team password and (by default) log every device out. With more
-- than one team account, say which one with p_email.
drop function if exists private.admin_set_team_password(text, boolean);
create or replace function private.admin_set_team_password(
  p_new text, p_sign_out_everyone boolean default true, p_email text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  if p_new is null or length(p_new) < 12 or octet_length(p_new) > 72 then
    raise exception 'Use 12 to 72 characters.';
  end if;
  if p_email is null then
    if (select count(*) from private.team_accounts) > 1 then
      raise exception 'There are several team accounts; name one: select private.admin_set_team_password(''new password'', true, ''e-mail'');';
    end if;
    select user_id into uid from private.team_accounts;
  else
    select t.user_id into uid
      from private.team_accounts t join auth.users u on u.id = t.user_id
     where lower(u.email) = lower(trim(p_email));
  end if;
  if uid is null then
    raise exception 'No such team account. See: select u.email from private.team_accounts t join auth.users u on u.id = t.user_id;';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(p_new, extensions.gen_salt('bf', 10)),
         updated_at         = now()
   where id = uid;
  if p_sign_out_everyone then
    delete from auth.refresh_tokens where user_id = uid::text;
    delete from auth.sessions where user_id = uid;
  end if;
  return 'Team password changed'
         || case when p_sign_out_everyone then '; every device must log in again.' else '.' end;
end;
$$;

create or replace function private.admin_set_reflection_password(p_member text, p_new text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_new is null or length(p_new) < 1 or octet_length(p_new) > 72 then
    raise exception 'Give a password of up to 72 characters.';
  end if;
  insert into public.reflection_access (member, password_hash, failed_attempts, locked_until, updated_at)
  values (p_member, extensions.crypt(p_new, extensions.gen_salt('bf', 10)), 0, null,
          (extract(epoch from now()) * 1000)::bigint)
  on conflict (member) do update
     set password_hash   = excluded.password_hash,
         failed_attempts = 0,
         locked_until    = null,
         updated_at      = excluded.updated_at;
  return 'Reflection password set for ' || p_member;
end;
$$;

create or replace function private.admin_set_tracking_password(p_new text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_new is null or length(p_new) < 1 or octet_length(p_new) > 72 then
    raise exception 'Give a password of up to 72 characters.';
  end if;
  insert into private.app_secrets (name, password_hash, failed_attempts, locked_until, updated_at)
  values ('tracking', extensions.crypt(p_new, extensions.gen_salt('bf', 10)), 0, null, now())
  on conflict (name) do update
     set password_hash   = excluded.password_hash,
         failed_attempts = 0,
         locked_until    = null,
         updated_at      = now();
  return 'Tracking password changed.';
end;
$$;

revoke all on function private.admin_remove_team_account(text)                  from public, anon, authenticated;
revoke all on function private.admin_set_team_password(text, boolean, text)     from public, anon, authenticated;
revoke all on function private.admin_set_reflection_password(text, text)        from public, anon, authenticated;
revoke all on function private.admin_set_tracking_password(text)                from public, anon, authenticated;

commit;

-- After this, change the passwords that were readable before today:
--   select private.admin_set_tracking_password('a new password');
-- and have every member change their Reflection password (Reflection tab →
-- "Your password"). See README §11.
