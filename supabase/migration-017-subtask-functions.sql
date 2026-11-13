-- ============================================================================
-- Migration 017 — subtasks are changed one at a time, in the database
-- Safe on live data: ADDS four functions; no table or row is changed. Run once
-- in Supabase → SQL Editor (running it again just replaces the functions).
--
-- Why: a task's subtasks are one jsonb array. Before this, the app rebuilt the
-- whole array from what the editing browser had in memory and saved all of
-- it, so two people ticking or adding subtasks on the same task within a few
-- seconds could silently undo each other. These functions change only the one
-- subtask they are asked about, against the row as it is in the database at
-- that moment, so concurrent edits all survive.
--
-- They run with the caller's rights (security invoker), so the team-only
-- access rule on public.tasks (migration 012) still applies to every call.
-- The app works before this runs: it falls back to the old whole-array write.
-- ============================================================================

create or replace function public.subtask_add(p_task text, p_subtask jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.tasks
     set subtasks = coalesce(subtasks, '[]'::jsonb) || jsonb_build_array(p_subtask),
         updated_at = (extract(epoch from clock_timestamp()) * 1000)::bigint
   where id = p_task
     -- Adding the same subtask twice (a retried request) changes nothing.
     and not exists (
       select 1 from jsonb_array_elements(coalesce(subtasks, '[]'::jsonb)) e
        where e->>'id' = p_subtask->>'id'
     );
$$;

-- p_patch holds only the fields to change; a field set to null is removed
-- (e.g. doneAt when a subtask is unticked).
create or replace function public.subtask_update(p_task text, p_id text, p_patch jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.tasks
     set subtasks = coalesce((
           select jsonb_agg(
                    case when e->>'id' = p_id then jsonb_strip_nulls(e || p_patch) else e end
                    order by ord)
             from jsonb_array_elements(coalesce(subtasks, '[]'::jsonb)) with ordinality as x(e, ord)
         ), '[]'::jsonb),
         updated_at = (extract(epoch from clock_timestamp()) * 1000)::bigint
   where id = p_task;
$$;

create or replace function public.subtask_delete(p_task text, p_id text)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.tasks
     set subtasks = coalesce((
           select jsonb_agg(e order by ord)
             from jsonb_array_elements(coalesce(subtasks, '[]'::jsonb)) with ordinality as x(e, ord)
            where e->>'id' is distinct from p_id
         ), '[]'::jsonb),
         updated_at = (extract(epoch from clock_timestamp()) * 1000)::bigint
   where id = p_task;
$$;

-- p_ids is the new order (a jsonb array of subtask ids). Subtasks it does not
-- list — e.g. one a teammate added a moment ago — keep their place at the end.
create or replace function public.subtask_reorder(p_task text, p_ids jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.tasks
     set subtasks = coalesce((
           select jsonb_agg(e order by coalesce(o.pos, 1000000 + x.ord))
             from jsonb_array_elements(coalesce(subtasks, '[]'::jsonb)) with ordinality as x(e, ord)
             left join jsonb_array_elements_text(p_ids) with ordinality as o(id, pos)
               on o.id = e->>'id'
         ), '[]'::jsonb),
         updated_at = (extract(epoch from clock_timestamp()) * 1000)::bigint
   where id = p_task;
$$;

revoke all on function public.subtask_add(text, jsonb)          from public, anon;
revoke all on function public.subtask_update(text, text, jsonb) from public, anon;
revoke all on function public.subtask_delete(text, text)        from public, anon;
revoke all on function public.subtask_reorder(text, jsonb)      from public, anon;
grant execute on function public.subtask_add(text, jsonb)          to authenticated;
grant execute on function public.subtask_update(text, text, jsonb) to authenticated;
grant execute on function public.subtask_delete(text, text)        to authenticated;
grant execute on function public.subtask_reorder(text, jsonb)      to authenticated;
