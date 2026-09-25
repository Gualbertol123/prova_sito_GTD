-- ============================================================================
-- Migration 010 — personal notes
-- Safe on live data: creates a NEW table only. Run once in Supabase SQL Editor.
--
-- One row per note, tagged with the member who wrote it. The app only ever
-- shows you the notes written under your own reflection login.
--
-- NOTE ON PRIVACY: like every other table in this project, the row-level
-- security policy below is open to the anon key, which ships in the browser.
-- These notes are private in the interface, not in the database — treat them
-- as team-visible-if-someone-looks, exactly like the daily reflections.
-- ============================================================================

create table if not exists public.personal_notes (
  id          text primary key,
  member      text   not null default '',
  body        text   not null default '',
  created_at  bigint not null default 0,
  updated_at  bigint not null default 0
);
create index if not exists personal_notes_member_idx
  on public.personal_notes (member, updated_at desc);

alter table public.personal_notes enable row level security;
drop policy if exists "anon all personal_notes" on public.personal_notes;
create policy "anon all personal_notes" on public.personal_notes
  for all to anon, authenticated using (true) with check (true);

alter publication supabase_realtime add table public.personal_notes;

-- If the real-login lockdown (migration 012) has already run on this project,
-- close this table again straight away (same transaction, so it is never open).
do $$
begin
  if to_regprocedure('private.lock_table(text)') is not null then
    perform private.lock_table('personal_notes');
  end if;
end $$;
