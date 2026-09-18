-- ============================================================================
-- Migration 008 — anonymous improvement suggestions
-- Safe on live data: creates a NEW table only. Run once in Supabase SQL Editor.
--
-- One row per suggestion. There is deliberately NO author column: suggestions
-- are anonymous, and nothing in the app writes an identity here. The browser
-- that posted a suggestion remembers its id locally so it can delete its own;
-- that list never leaves the device.
-- ============================================================================

create table if not exists public.suggestions (
  id          text primary key,
  body        text   not null default '',
  created_at  bigint not null default 0
);
create index if not exists suggestions_created_idx on public.suggestions (created_at);

alter table public.suggestions enable row level security;
drop policy if exists "anon all suggestions" on public.suggestions;
create policy "anon all suggestions" on public.suggestions
  for all to anon, authenticated using (true) with check (true);

alter publication supabase_realtime add table public.suggestions;
