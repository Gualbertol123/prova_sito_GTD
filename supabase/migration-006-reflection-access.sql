-- ============================================================================
-- Migration 006 — per-user Reflection passwords
-- Safe on live data: creates a NEW table only. Run once in Supabase SQL Editor.
--
-- One row per member. To reset a password an admin can edit the `password`
-- column directly in the Supabase Table Editor (Table: reflection_access).
-- The app seeds a row per member with the default password 'password'.
-- ============================================================================

create table if not exists public.reflection_access (
  member      text primary key,
  password    text  not null default 'password',
  updated_at  bigint not null default 0
);

alter table public.reflection_access enable row level security;
drop policy if exists "anon all reflection_access" on public.reflection_access;
create policy "anon all reflection_access" on public.reflection_access
  for all to anon, authenticated using (true) with check (true);

alter publication supabase_realtime add table public.reflection_access;

-- If the real-login lockdown (migration 012) has already run on this project,
-- close this table again straight away (same transaction, so it is never open).
do $$
begin
  if to_regprocedure('private.lock_table(text)') is not null then
    perform private.lock_table('reflection_access');
  end if;
end $$;
