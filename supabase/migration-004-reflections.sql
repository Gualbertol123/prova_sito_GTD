-- ============================================================================
-- Migration 004 — Daily Reflection (per member, one per day)
-- Safe on live data: creates a NEW table only; touches nothing existing.
-- Run once in Supabase → SQL Editor. The app works before this runs (the
-- Daily Reflection section just stays empty and can't save until the table
-- exists).
-- ============================================================================

create table if not exists public.reflections (
  id          text primary key,   -- "<date>::<member>" — one entry per member per day
  member      text not null,
  date        text not null,      -- yyyy-mm-dd
  done        text not null default '',   -- Done today
  well        text not null default '',   -- What went well
  improve     text not null default '',   -- What to improve
  learning    text not null default '',   -- Learning notes
  updated_at  bigint not null default 0,
  created_at  bigint not null default 0
);

create index if not exists reflections_date_idx on public.reflections (date);

-- Open access for the anon key (matches the rest of the app).
alter table public.reflections enable row level security;
drop policy if exists "anon all reflections" on public.reflections;
create policy "anon all reflections" on public.reflections
  for all to anon, authenticated using (true) with check (true);

-- Realtime so entries sync live across everyone.
alter publication supabase_realtime add table public.reflections;

-- If the real-login lockdown (migration 012) has already run on this project,
-- close this table again straight away (same transaction, so it is never open).
do $$
begin
  if to_regprocedure('private.lock_table(text)') is not null then
    perform private.lock_table('reflections');
  end if;
end $$;
