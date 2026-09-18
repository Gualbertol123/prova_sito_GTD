-- ============================================================================
-- Migration 007 — task completion timestamp (for auto-archiving)
-- Safe on live data: only ADDS a nullable column. Run once in Supabase SQL Editor.
--
-- done_at is stamped when a task enters DONE and cleared when it leaves. A DONE
-- task is shown as "archived" once it has been done for a week. Existing DONE
-- tasks (no done_at yet) fall back to updated_at for the archive check.
-- ============================================================================

alter table public.tasks add column if not exists done_at bigint;
