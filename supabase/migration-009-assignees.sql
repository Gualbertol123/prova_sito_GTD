-- ============================================================================
-- Migration 009 — tasks assigned to more than one person
-- Safe on live data: adds ONE nullable column. Run once in Supabase SQL Editor.
--
-- `owner` stays exactly as it was and still holds a single name, so everything
-- written before this migration keeps working untouched. `assignees` holds the
-- full list when a task is shared; the app treats `owner` as the first name in
-- that list and falls back to `owner` alone wherever `assignees` is null.
-- Until this runs, the app simply keeps every task single-assignee and says so.
-- ============================================================================

alter table public.tasks add column if not exists assignees text[];
