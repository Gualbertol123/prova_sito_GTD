-- ============================================================================
-- Migration 011 — real login, step 1 of 2 (ADDITIVE, safe on live data)
--
-- Run this in Supabase → SQL Editor AFTER you have created the shared team
-- user in Authentication → Users (see "Security setup" in README.md).
--
-- What it does — nothing here removes or rewrites board data:
--   * creates a `private` schema the browser API cannot reach;
--   * records which Supabase Auth user(s) count as "the team";
--   * stores the Reflection and Tracking passwords as bcrypt hashes and adds
--     server-side functions that check / change them, so the browser never
--     sees a password again;
--   * adds admin-only reset functions you run from this SQL Editor.
--
-- The site that is live right now keeps working unchanged after this runs.
-- Step 2 (migration-012) is what actually closes the database to the public;
-- run it only once the new site is deployed and you have logged in with it.
--
-- >>> EDIT ONE LINE: at the very bottom, put the team account's e-mail. <<<
-- If that e-mail does not match a user in Authentication → Users, the whole
-- script stops with an error and nothing is changed.
-- ============================================================================

begin;

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---- Who is "the team" -----------------------------------------------------
-- The Supabase Auth user id(s) allowed to use the board. Signing up is turned
-- off in the dashboard, but this list means that even an account created by
-- mistake gets nothing.
create table if not exists private.team_accounts (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  added_at  timestamptz not null default now()
);
revoke all on table private.team_accounts from public, anon, authenticated;

-- True when the caller is logged in as a team account. Used by every table
-- policy (after step 2) and by the password functions below. It only ever
-- answers about the caller, so it is safe to expose.
create or replace function public.is_team_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.team_accounts where user_id = auth.uid()
  );
$$;
revoke all on function public.is_team_member() from public, anon;
grant execute on function public.is_team_member() to authenticated;

-- ---- Reflection passwords: hash them -------------------------------------
-- The table may not exist if migration 006 was never run.
create table if not exists public.reflection_access (
  member      text primary key,
  password    text  not null default 'password',
  updated_at  bigint not null default 0
);
alter table public.reflection_access enable row level security;

alter table public.reflection_access add column if not exists password_hash   text;
alter table public.reflection_access add column if not exists failed_attempts integer not null default 0;
alter table public.reflection_access add column if not exists locked_until    timestamptz;

-- Hash every password that is stored in clear text today, so everyone keeps
-- the password they already use.
update public.reflection_access
   set password_hash = extensions.crypt(coalesce(password, 'password'), extensions.gen_salt('bf', 10))
 where password_hash is null;

-- Until step 2 the currently deployed site still writes clear-text passwords
-- into `password`. Keep the hash in step with it so nothing a member does in
-- the meantime is lost. (Dropped in step 2 together with the column.)
create or replace function private.reflection_access_sync_hash()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.password_hash is null then
      new.password_hash := extensions.crypt(coalesce(new.password, 'password'), extensions.gen_salt('bf', 10));
    end if;
  elsif new.password is distinct from old.password then
    new.password_hash := extensions.crypt(coalesce(new.password, 'password'), extensions.gen_salt('bf', 10));
  end if;
  return new;
end;
$$;

drop trigger if exists reflection_access_sync_hash on public.reflection_access;
create trigger reflection_access_sync_hash
  before insert or update on public.reflection_access
  for each row execute function private.reflection_access_sync_hash();

-- ---- Tracking password: move it out of the website's code ------------------
create table if not exists private.app_secrets (
  name            text primary key,
  password_hash   text not null,
  failed_attempts integer not null default 0,
  locked_until    timestamptz,
  updated_at      timestamptz not null default now()
);
revoke all on table private.app_secrets from public, anon, authenticated;

-- Seeded with the password the Tracking tab uses today so the tab keeps
-- working. That password has been readable in the site's code, so CHANGE IT
-- right after the upgrade: select private.admin_set_tracking_password('...');
insert into private.app_secrets (name, password_hash)
values ('tracking', extensions.crypt('Matusalemme', extensions.gen_salt('bf', 10)))
on conflict (name) do nothing;

-- ---- Password checks the website calls ------------------------------------
-- All of them: team accounts only; wrong guesses are counted, and after 5 in a
-- row that password is locked for 5 minutes. Results are plain words the app
-- understands: 'ok' | 'wrong' | 'locked' | 'unknown' | 'invalid' | 'forbidden'.

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
  if p_new is null or length(p_new) < 6 or length(p_new) > 200 then
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
-- They live in the `private` schema, which the website's API cannot call.

-- Allow a Supabase Auth user (by e-mail) to use the board.
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

-- Stop a Supabase Auth user (by e-mail) from using the board.
create or replace function private.admin_remove_team_account(p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.team_accounts
   where user_id in (select id from auth.users where lower(email) = lower(trim(p_email)));
  return 'Team account disabled: ' || p_email;
end;
$$;

-- Set a new shared team password and (by default) log every device out.
create or replace function private.admin_set_team_password(p_new text, p_sign_out_everyone boolean default true)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if p_new is null or length(p_new) < 8 then
    raise exception 'Use at least 8 characters (12 or more recommended).';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(p_new, extensions.gen_salt('bf', 10)),
         updated_at         = now()
   where id in (select user_id from private.team_accounts);
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'No team account found. Run private.admin_add_team_account(''e-mail'') first.';
  end if;
  if p_sign_out_everyone then
    delete from auth.refresh_tokens
     where user_id in (select user_id::text from private.team_accounts);
    delete from auth.sessions
     where user_id in (select user_id from private.team_accounts);
  end if;
  return 'Team password changed'
         || case when p_sign_out_everyone then '; every device must log in again (within 1 hour at most).' else '.' end;
end;
$$;

-- Set (reset) one member's Reflection password and clear any lock.
create or replace function private.admin_set_reflection_password(p_member text, p_new text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_new is null or length(p_new) < 1 then
    raise exception 'Give a password.';
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

-- Set the Tracking tab password and clear any lock.
create or replace function private.admin_set_tracking_password(p_new text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_new is null or length(p_new) < 1 then
    raise exception 'Give a password.';
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

revoke all on function private.admin_add_team_account(text)                from public, anon, authenticated;
revoke all on function private.admin_remove_team_account(text)             from public, anon, authenticated;
revoke all on function private.admin_set_team_password(text, boolean)      from public, anon, authenticated;
revoke all on function private.admin_set_reflection_password(text, text)   from public, anon, authenticated;
revoke all on function private.admin_set_tracking_password(text)           from public, anon, authenticated;
revoke all on function private.reflection_access_sync_hash()               from public, anon, authenticated;

-- ---- The team account -------------------------------------------------------
-- >>> Replace the e-mail below with the team user you created. <<<
select private.admin_add_team_account('team@example.com');

commit;
