-- ============================================================================
-- TEAM GTD — Supabase schema (FRESH INSTALL)
--
-- For a brand-new, empty Supabase project only. An existing project with data
-- is upgraded with the migration-0XX files instead (see README.md §11); this
-- script refuses to run where the board tables already exist.
--
-- Before running this:
--   1. Authentication → Sign In / Providers: turn OFF "Allow new users to
--      sign up".
--   2. Authentication → Users → Add user → Create new user: the shared team
--      e-mail + a strong password, tick "Auto Confirm User".
--   3. Put that e-mail, and a Tracking password, on the LAST lines of this file.
-- Then: SQL Editor → New query → paste all of this → Run.
--
-- Result: only the team account can read or write anything; every password
-- is stored as a bcrypt hash and checked on the server.
-- ============================================================================

begin;

do $$
begin
  if to_regclass('public.board_meta') is not null or to_regclass('public.tasks') is not null then
    raise exception 'This project already has the board tables. schema.sql is for an empty project only; upgrade with the migration files (README §11).';
  end if;
end $$;

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---- Tables ----------------------------------------------------------------

-- Single-row table holding board name, team members and app settings.
create table public.board_meta (
  id              text primary key,
  board_name      text  not null default 'TEAM GTD FINALE',
  members         text[] not null default '{}',
  subtitle_it     text,
  subtitle_en     text,
  login_days      integer default 7,
  logo_url        text,
  favicon_url     text
);

-- One row per task.
create table public.tasks (
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
  file_dir       text,                          -- shared network file path
  done_at        bigint,                        -- when it entered DONE (archive timer)
  updated_at     bigint not null default 0,
  created_at     bigint not null default 0,     -- ordering within a column
  assignees      text[]                         -- everyone on a shared task
);

-- One row per team member per day — the Daily Reflection.
create table public.reflections (
  id          text primary key,   -- "<date>::<member>"
  member      text not null,
  date        text not null,      -- yyyy-mm-dd
  done        text not null default '',
  well        text not null default '',
  improve     text not null default '',
  learning    text not null default '',
  updated_at  bigint not null default 0,
  created_at  bigint not null default 0
);
create index reflections_date_idx on public.reflections (date);

-- Per-member Reflection password, as a bcrypt hash. Never readable from the
-- browser; checked and changed only through the functions further down.
create table public.reflection_access (
  member          text primary key,
  updated_at      bigint not null default 0,
  password_hash   text not null,
  failed_attempts integer not null default 0,
  locked_until    timestamptz
);

-- One row per project — each project is a checklist of items (like subtasks).
create table public.projects (
  id          text primary key,
  name        text  not null default '',
  items       jsonb not null default '[]'::jsonb,
  created_at  bigint not null default 0,
  updated_at  bigint not null default 0
);
create index projects_created_idx on public.projects (created_at);

-- One row per anonymous improvement suggestion (no author column, by design).
create table public.suggestions (
  id          text primary key,
  body        text   not null default '',
  created_at  bigint not null default 0
);
create index suggestions_created_idx on public.suggestions (created_at);

-- One row per personal note, tagged with the member who wrote it.
create table public.personal_notes (
  id          text primary key,
  member      text   not null default '',
  body        text   not null default '',
  created_at  bigint not null default 0,
  updated_at  bigint not null default 0
);
create index personal_notes_member_idx on public.personal_notes (member, updated_at desc);

-- One row per weekly-review item.
create table public.weekly (
  id          text primary key,
  bucket      text   not null,                  -- well | learnings | improve | blockers | focus
  body        text   not null default '',       -- the item text
  created_at  bigint not null default 0
);

-- Server-only secrets (the Tracking tab password), as bcrypt hashes.
create table private.app_secrets (
  name            text primary key,
  password_hash   text not null,
  failed_attempts integer not null default 0,
  locked_until    timestamptz,
  updated_at      timestamptz not null default now()
);
revoke all on table private.app_secrets from public, anon, authenticated;

-- The Supabase Auth user id(s) allowed to use the board.
create table private.team_accounts (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  added_at  timestamptz not null default now()
);
revoke all on table private.team_accounts from public, anon, authenticated;

-- ---- Team check ------------------------------------------------------------
-- True when the caller is logged in as a team account with a live session.

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

-- ---- Access (Row Level Security) -------------------------------------------
-- Only a logged-in team account can read or write. The public (anon) key that
-- ships in the website gets nothing. private.lock_table() applies the rule;
-- run it for any table you add later.

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

select private.lock_table(t) from unnest(array[
  'board_meta', 'tasks', 'weekly', 'reflections', 'projects',
  'suggestions', 'personal_notes', 'reflection_access'
]) as t;

alter default privileges for role postgres in schema public revoke all on tables    from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;
revoke all on all sequences in schema public from anon;

-- ---- Password checks the website calls ------------------------------------
-- Team accounts only; 5 wrong guesses in a row lock that password for 5
-- minutes. Results: 'ok' | 'wrong' | 'locked' | 'unknown' | 'invalid' | 'forbidden'.

create or replace function public.reflection_login(p_member text, p_password text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r public.reflection_access%rowtype;
begin
  if not public.is_team_member() then
    return 'forbidden';
  end if;
  -- Only names that are on the board's member list.
  if p_member is null or not exists (
    select 1 from public.board_meta where id = 'main' and p_member = any (members)
  ) then
    return 'unknown';
  end if;

  select * into r from public.reflection_access where member = p_member for update;
  if not found then
    -- A member who never had a row still has the initial password 'password'.
    insert into public.reflection_access (member, password_hash, updated_at)
    values (p_member,
            extensions.crypt('password', extensions.gen_salt('bf', 10)),
            (extract(epoch from now()) * 1000)::bigint)
    on conflict (member) do nothing;
    select * into r from public.reflection_access where member = p_member for update;
  end if;

  if r.locked_until is not null and r.locked_until > now() then
    return 'locked';
  end if;

  if r.password_hash is not null
     and r.password_hash = extensions.crypt(coalesce(p_password, ''), r.password_hash) then
    update public.reflection_access
       set failed_attempts = 0, locked_until = null
     where member = p_member;
    return 'ok';
  end if;

  update public.reflection_access
     set failed_attempts = case when r.failed_attempts + 1 >= 5 then 0 else r.failed_attempts + 1 end,
         locked_until    = case when r.failed_attempts + 1 >= 5 then now() + interval '5 minutes' else null end
   where member = p_member;
  return 'wrong';
end;
$$;

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

create or replace function public.tracking_login(p_password text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s private.app_secrets%rowtype;
begin
  if not public.is_team_member() then
    return 'forbidden';
  end if;
  select * into s from private.app_secrets where name = 'tracking' for update;
  if not found then
    return 'wrong';
  end if;
  if s.locked_until is not null and s.locked_until > now() then
    return 'locked';
  end if;
  if s.password_hash = extensions.crypt(coalesce(p_password, ''), s.password_hash) then
    update private.app_secrets set failed_attempts = 0, locked_until = null where name = 'tracking';
    return 'ok';
  end if;
  update private.app_secrets
     set failed_attempts = case when s.failed_attempts + 1 >= 5 then 0 else s.failed_attempts + 1 end,
         locked_until    = case when s.failed_attempts + 1 >= 5 then now() + interval '5 minutes' else null end
   where name = 'tracking';
  return 'wrong';
end;
$$;

revoke all on function public.reflection_login(text, text)                   from public, anon;
revoke all on function public.reflection_change_password(text, text, text)   from public, anon;
revoke all on function public.tracking_login(text)                           from public, anon;
grant execute on function public.reflection_login(text, text)                 to authenticated;
grant execute on function public.reflection_change_password(text, text, text) to authenticated;
grant execute on function public.tracking_login(text)                         to authenticated;

-- ---- Admin tools: run these from the Supabase SQL Editor only -------------

create or replace function private.admin_add_team_account(p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then
    raise exception 'No user with e-mail % in Authentication → Users. Create it there first (Add user → Create new user, tick "Auto Confirm User").', p_email;
  end if;
  insert into private.team_accounts (user_id) values (uid) on conflict do nothing;
  return 'Team account enabled: ' || p_email;
end;
$$;

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

revoke all on function private.admin_add_team_account(text)                  from public, anon, authenticated;
revoke all on function private.admin_remove_team_account(text)               from public, anon, authenticated;
revoke all on function private.admin_set_team_password(text, boolean, text)  from public, anon, authenticated;
revoke all on function private.admin_set_reflection_password(text, text)     from public, anon, authenticated;
revoke all on function private.admin_set_tracking_password(text)             from public, anon, authenticated;

-- ---- Realtime --------------------------------------------------------------
-- Change events for the board tables (they respect the policies above).
-- reflection_access is deliberately NOT published.

alter publication supabase_realtime add table
  public.board_meta, public.tasks, public.weekly, public.reflections,
  public.projects, public.suggestions, public.personal_notes;

-- ---- The team account -------------------------------------------------------
-- >>> Replace the e-mail below with the team user you created. <<<
select private.admin_add_team_account('team@example.com');

-- Pick the Tracking tab password here (change it any time with the same call).
-- >>> Replace the placeholder with a password of your choice. <<<
select private.admin_set_tracking_password('CHANGE-ME-tracking-password');

commit;
