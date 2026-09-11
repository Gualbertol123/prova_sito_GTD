-- ============================================================================
-- Migration 002 — app settings on board_meta
-- Safe to run on a live database: only ADDS nullable columns, never drops or
-- rewrites existing data. Run once in Supabase → SQL Editor.
-- The app also works BEFORE this runs (it falls back to sensible defaults);
-- running it just unlocks editing the subtitle, access password and login
-- duration from the in-app Settings page.
-- ============================================================================

alter table public.board_meta add column if not exists subtitle_it     text;
alter table public.board_meta add column if not exists subtitle_en     text;
alter table public.board_meta add column if not exists access_password text default 'IBDGTDTEAM';
alter table public.board_meta add column if not exists login_days      integer default 7;

-- Give the existing row the default access password if it is currently null.
update public.board_meta
   set access_password = coalesce(access_password, 'IBDGTDTEAM'),
       login_days      = coalesce(login_days, 7)
 where id = 'main';
