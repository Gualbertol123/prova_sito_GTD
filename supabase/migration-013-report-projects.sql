-- ============================================================================
-- Migration 013 — projects left out of the weekly report
-- Safe on live data: ADDS one column with a default; nothing else changes.
-- Run once in Supabase → SQL Editor (running it again does nothing).
--
-- report_hidden is set by the × on a project card in the REPORT tab and
-- cleared from REPORT → "Progetti esclusi". A project with it set stays out
-- of every weekly report until it is put back. Existing and new projects
-- start included. The table keeps its team-only access rule (migration 012).
-- ============================================================================

alter table public.projects add column if not exists report_hidden boolean not null default false;
