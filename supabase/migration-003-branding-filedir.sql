-- ============================================================================
-- Migration 003 — custom logo/favicon + per-task file directory
-- Safe on live data: only ADDS nullable columns. Run once in Supabase SQL Editor.
-- The app works before this runs (features degrade gracefully / stay hidden).
-- ============================================================================

alter table public.board_meta add column if not exists logo_url    text;  -- data URL or link
alter table public.board_meta add column if not exists favicon_url text;  -- data URL or link

alter table public.tasks add column if not exists file_dir text;          -- shared network path
