import { supabase } from "./supabaseClient";
import type { Board, Op, Task, Weekly, WeeklyItem } from "./types";
import {
  SEED_BOARD_NAME,
  SEED_MEMBERS,
  seedTasks,
  seedWeeklyRows,
} from "./seed";

const EMPTY_WEEKLY: Weekly = {
  well: [],
  learnings: [],
  improve: [],
  blockers: [],
  focus: [],
};

// ---- Row <-> type mapping ---------------------------------------------------
// DB columns are snake_case; a few app names are SQL keywords (desc, column),
// so they map to description / bucket / body.

interface TaskRow {
  id: string;
  title: string;
  description: string;
  owner: string;
  priority: Task["priority"];
  status: Task["status"];
  notes: string;
  subtasks: Task["subtasks"];
  due_date: string | null;
  waiting_since: string | null;
  updated_at: number;
  created_at: number;
}

function rowToTask(r: TaskRow): Task {
  return {
    id: r.id,
    title: r.title,
    desc: r.description ?? "",
    owner: r.owner,
    priority: r.priority,
    status: r.status,
    notes: r.notes ?? "",
    subtasks: Array.isArray(r.subtasks) ? r.subtasks : [],
    dueDate: r.due_date ?? undefined,
    waitingSince: r.waiting_since ?? undefined,
    updatedAt: r.updated_at,
    createdAt: r.created_at,
  };
}

function taskToRow(t: Task): TaskRow {
  return {
    id: t.id,
    title: t.title,
    description: t.desc ?? "",
    owner: t.owner,
    priority: t.priority,
    status: t.status,
    notes: t.notes ?? "",
    subtasks: t.subtasks ?? [],
    due_date: t.dueDate ?? null,
    waiting_since: t.waitingSince ?? null,
    updated_at: t.updatedAt ?? Date.now(),
    created_at: t.createdAt ?? Date.now(),
  };
}

// Map a partial Task patch to snake_case DB columns.
function patchToRow(patch: Partial<Task>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ("title" in patch) out.title = patch.title;
  if ("desc" in patch) out.description = patch.desc;
  if ("owner" in patch) out.owner = patch.owner;
  if ("priority" in patch) out.priority = patch.priority;
  if ("status" in patch) out.status = patch.status;
  if ("notes" in patch) out.notes = patch.notes;
  if ("subtasks" in patch) out.subtasks = patch.subtasks;
  if ("dueDate" in patch) out.due_date = patch.dueDate ?? null;
  if ("waitingSince" in patch) out.waiting_since = patch.waitingSince ?? null;
  out.updated_at = Date.now();
  return out;
}

// ---- Read -------------------------------------------------------------------

export async function fetchBoard(): Promise<Board> {
  const [meta, tasks, weekly] = await Promise.all([
    supabase.from("board_meta").select("*").eq("id", "main").maybeSingle(),
    supabase.from("tasks").select("*").order("created_at", { ascending: true }),
    supabase.from("weekly").select("*").order("created_at", { ascending: true }),
  ]);

  if (meta.error) throw meta.error;
  if (tasks.error) throw tasks.error;
  if (weekly.error) throw weekly.error;

  const weeklyGrouped: Weekly = {
    well: [],
    learnings: [],
    improve: [],
    blockers: [],
    focus: [],
  };
  for (const row of (weekly.data ?? []) as { id: string; bucket: keyof Weekly; body: string }[]) {
    const item: WeeklyItem = { id: row.id, text: row.body };
    if (weeklyGrouped[row.bucket]) weeklyGrouped[row.bucket].push(item);
  }

  return {
    id: "board",
    boardName: meta.data?.board_name ?? SEED_BOARD_NAME,
    members: meta.data?.members ?? SEED_MEMBERS,
    tasks: ((tasks.data ?? []) as TaskRow[]).map(rowToTask),
    weekly: weeklyGrouped,
    updatedAt: Date.now(),
  };
}

// ---- Seed (first run) -------------------------------------------------------
// Uses upserts keyed on fixed ids so two clients seeding at once can't create
// duplicates. Only runs when the board_meta row is absent.

export async function seedIfEmpty(): Promise<boolean> {
  const { data, error } = await supabase
    .from("board_meta")
    .select("id")
    .eq("id", "main")
    .maybeSingle();
  if (error) throw error;
  if (data) return false; // already seeded

  await supabase
    .from("board_meta")
    .upsert(
      { id: "main", board_name: SEED_BOARD_NAME, members: SEED_MEMBERS },
      { onConflict: "id", ignoreDuplicates: true }
    );
  await supabase
    .from("tasks")
    .upsert(seedTasks().map(taskToRow), { onConflict: "id", ignoreDuplicates: true });
  await supabase
    .from("weekly")
    .upsert(
      seedWeeklyRows().map((r) => ({
        id: r.id,
        bucket: r.bucket,
        body: r.body,
        created_at: r.createdAt,
      })),
      { onConflict: "id", ignoreDuplicates: true }
    );
  return true;
}

// ---- Write (one op -> one or more Supabase writes) --------------------------

export async function writeOp(op: Op, board: Board): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  switch (op.type) {
    case "addTask": {
      const t = { ...op.task, createdAt: op.task.createdAt ?? Date.now() };
      await must(supabase.from("tasks").insert(taskToRow(t)));
      break;
    }
    case "updateTask":
      await must(supabase.from("tasks").update(patchToRow(op.patch)).eq("id", op.id));
      break;
    case "deleteTask":
      await must(supabase.from("tasks").delete().eq("id", op.id));
      break;
    case "moveTask": {
      const cur = board.tasks.find((t) => t.id === op.id);
      const update: Record<string, unknown> = {
        status: op.status,
        updated_at: Date.now(),
      };
      if (op.status === "WAITING") {
        update.waiting_since = cur?.waitingSince ?? today;
      } else {
        update.waiting_since = null;
      }
      await must(supabase.from("tasks").update(update).eq("id", op.id));
      break;
    }
    case "setDueDate":
      await must(
        supabase
          .from("tasks")
          .update({ due_date: op.dueDate ?? null, updated_at: Date.now() })
          .eq("id", op.id)
      );
      break;
    case "addSubtask": {
      const cur = board.tasks.find((t) => t.id === op.taskId);
      const next = [...(cur?.subtasks ?? []), op.subtask];
      await must(
        supabase
          .from("tasks")
          .update({ subtasks: next, updated_at: Date.now() })
          .eq("id", op.taskId)
      );
      break;
    }
    case "updateSubtask": {
      const cur = board.tasks.find((t) => t.id === op.taskId);
      const next = (cur?.subtasks ?? []).map((s) =>
        s.id === op.subtaskId ? { ...s, ...op.patch } : s
      );
      await must(
        supabase
          .from("tasks")
          .update({ subtasks: next, updated_at: Date.now() })
          .eq("id", op.taskId)
      );
      break;
    }
    case "deleteSubtask": {
      const cur = board.tasks.find((t) => t.id === op.taskId);
      const next = (cur?.subtasks ?? []).filter((s) => s.id !== op.subtaskId);
      await must(
        supabase
          .from("tasks")
          .update({ subtasks: next, updated_at: Date.now() })
          .eq("id", op.taskId)
      );
      break;
    }
    case "setMembers":
      await must(
        supabase.from("board_meta").update({ members: op.members }).eq("id", "main")
      );
      break;
    case "renameBoard":
      await must(
        supabase.from("board_meta").update({ board_name: op.name }).eq("id", "main")
      );
      break;
    case "weeklyAdd":
      await must(
        supabase.from("weekly").insert({
          id: op.item.id,
          bucket: op.column,
          body: op.item.text,
          created_at: Date.now(),
        })
      );
      break;
    case "weeklyUpdate":
      await must(supabase.from("weekly").update({ body: op.text }).eq("id", op.id));
      break;
    case "weeklyDelete":
      await must(supabase.from("weekly").delete().eq("id", op.id));
      break;
    case "weeklyClear":
      // Delete-all needs a filter in supabase-js; match every real row.
      await must(supabase.from("weekly").delete().neq("id", "__never__"));
      break;
  }
}

// Throw on a Supabase error result.
async function must<T extends { error: unknown }>(p: PromiseLike<T>): Promise<T> {
  const res = await p;
  if (res.error) throw res.error;
  return res;
}

export { EMPTY_WEEKLY };
