-- ============================================================================
-- Migration 018 — music playlists
-- Safe on live data: ADDS one table; nothing else changes. Run once in
-- Supabase → SQL Editor (running it again does nothing).
--
-- The music player's playlists, shared by the team: anyone can play, edit or
-- delete any of them; `owner` is who made it (a member's name, shown only).
-- A track is { id, title, channel, thumb } — a YouTube video id plus what the
-- player shows; no audio is stored anywhere.
--
-- Same access as every other table (migration 012): the logged-in team account
-- only. The app works before this runs: the Library says what to run.
-- ============================================================================

create table if not exists public.music_playlists (
  id          text   primary key,
  name        text   not null default '',
  owner       text   not null default '',
  tracks      jsonb  not null default '[]'::jsonb,
  created_at  bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at  bigint not null default (extract(epoch from now()) * 1000)::bigint
);

do $$
begin
  if to_regprocedure('private.lock_table(text)') is not null then
    perform private.lock_table('music_playlists');
  end if;
end $$;

-- Live updates when a teammate changes a playlist.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'music_playlists'
  ) then
    alter publication supabase_realtime add table public.music_playlists;
  end if;
end $$;
