import { supabase } from "./supabaseClient";
import type { Board, PersonalNote, Op, Project, Reflection, Suggestion, Task, Weekly, WeeklyItem } from "./types";
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
  assignees?: string[] | null;
  priority: Task["priority"];
  status: Task["status"];
  notes: string;
  subtasks: Task["subtasks"];
  due_date: string | null;
  waiting_since: string | null;
  file_dir: string | null;
  done_at: number | null;
  updated_at: number;
  created_at: number;
}

function rowToTask(r: TaskRow): Task {
  return {
    id: r.id,
    title: r.title,
    desc: r.description ?? "",
    owner: r.owner,
    assignees: Array.isArray(r.assignees) && r.assignees.length ? r.assignees : undefined,
    priority: r.priority,
    status: r.status,
    notes: r.notes ?? "",
    subtasks: Array.isArray(r.subtasks) ? r.subtasks : [],
    dueDate: r.due_date ?? undefined,
    waitingSince: r.waiting_since ?? undefined,
    fileDir: r.file_dir ?? undefined,
    doneAt: r.done_at ?? undefined,
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
    assignees: t.assignees ?? null,
    priority: t.priority,
    status: t.status,
    notes: t.notes ?? "",
    subtasks: t.subtasks ?? [],
    due_date: t.dueDate ?? null,
    waiting_since: t.waitingSince ?? null,
    file_dir: t.fileDir ?? null,
    done_at: t.doneAt ?? null,
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
  // Only ever sent once the column is known to exist — otherwise every task
  // edit would fail on a database where migration 009 has not been run.
  if ("assignees" in patch && hasAssignees) out.assignees = patch.assignees ?? null;
  if ("priority" in patch) out.priority = patch.priority;
  if ("status" in patch) out.status = patch.status;
  if ("notes" in patch) out.notes = patch.notes;
  if ("subtasks" in patch) out.subtasks = patch.subtasks;
  if ("dueDate" in patch) out.due_date = patch.dueDate ?? null;
  if ("waitingSince" in patch) out.waiting_since = patch.waitingSince ?? null;
  if ("fileDir" in patch) out.file_dir = patch.fileDir ?? null;
  if ("doneAt" in patch) out.done_at = patch.doneAt ?? null;
  out.updated_at = Date.now();
  return out;
}

interface ReflectionRow {
  id: string;
  member: string;
  date: string;
  done: string;
  well: string;
  improve: string;
  learning: string;
  updated_at: number;
  created_at: number;
}

function rowToReflection(r: ReflectionRow): Reflection {
  return {
    id: r.id,
    member: r.member,
    date: r.date,
    done: r.done ?? "",
    well: r.well ?? "",
    improve: r.improve ?? "",
    learning: r.learning ?? "",
    updatedAt: r.updated_at,
    createdAt: r.created_at,
  };
}

function reflectionToRow(r: Reflection): ReflectionRow {
  return {
    id: r.id,
    member: r.member,
    date: r.date,
    done: r.done ?? "",
    well: r.well ?? "",
    improve: r.improve ?? "",
    learning: r.learning ?? "",
    updated_at: r.updatedAt ?? Date.now(),
    created_at: r.createdAt ?? Date.now(),
  };
}

// ---- Read -------------------------------------------------------------------

interface ProjectRow {
  id: string;
  name: string;
  items: Task["subtasks"];
  created_at: number;
  updated_at: number;
}

function rowToProject(r: ProjectRow): Project {
  return {
    id: r.id,
    name: r.name ?? "",
    items: Array.isArray(r.items) ? r.items : [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function projectToRow(p: Project): ProjectRow {
  return {
    id: p.id,
    name: p.name ?? "",
    items: p.items ?? [],
    created_at: p.createdAt ?? Date.now(),
    updated_at: p.updatedAt ?? Date.now(),
  };
}

async function fetchProjects(): Promise<Project[]> {
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: true });
    if (error || !data) return [];
    return (data as ProjectRow[]).map(rowToProject);
  } catch {
    return [];
  }
}

interface SuggestionRow {
  id: string;
  body: string;
  created_at: number;
}

// Does tasks.assignees exist? Starts false and is only turned on by a
// successful probe, so a write that somehow beats the first load omits the
// column rather than failing outright.
let hasAssignees = false;

export function assigneesAvailable(): boolean {
  return hasAssignees;
}

async function probeAssignees(): Promise<boolean> {
  try {
    const { error } = await supabase.from("tasks").select("assignees").limit(1);
    hasAssignees = !error;
  } catch {
    hasAssignees = false;
  }
  return hasAssignees;
}

interface PersonalNoteRow {
  id: string;
  member: string;
  body: string;
  created_at: number;
  updated_at: number;
}

export interface PersonalNotesResult {
  list: PersonalNote[];
  error?: string;
}

// Tolerant but not silent, for the same reason as the suggestions read: an
// unreachable table must not look like "you have not written any notes yet".
async function fetchPersonalNotes(): Promise<PersonalNotesResult> {
  try {
    const { data, error } = await supabase
      .from("personal_notes")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) return { list: [], error: error.message || String(error) };
    return {
      list: ((data ?? []) as PersonalNoteRow[]).map((r) => ({
        id: r.id,
        member: r.member ?? "",
        body: r.body ?? "",
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    };
  } catch (e) {
    return { list: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export interface SuggestionsResult {
  list: Suggestion[];
  /** Why the read failed, when it did. Undefined means the read succeeded. */
  error?: string;
}

// Tolerant like the other late-migration reads — the board still loads if this
// table is missing — but NOT silent. Returning a bare [] made an unreachable
// table (migration 008 never run, or a select blocked by RLS) look exactly like
// "nobody has posted an idea yet", so ideas could be typed in and lost with
// nothing on screen ever saying why. The reason travels with the result now.
async function fetchSuggestions(): Promise<SuggestionsResult> {
  try {
    const { data, error } = await supabase
      .from("suggestions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return { list: [], error: error.message || String(error) };
    return {
      list: ((data ?? []) as SuggestionRow[]).map((r) => ({
        id: r.id,
        body: r.body ?? "",
        createdAt: r.created_at,
      })),
    };
  } catch (e) {
    return { list: [], error: e instanceof Error ? e.message : String(e) };
  }
}

async function fetchReflections(): Promise<Reflection[]> {
  // Tolerant: the table may not exist yet (before migration-004). Any failure
  // here must NOT break the board — reflections simply come back empty.
  try {
    const { data, error } = await supabase
      .from("reflections")
      .select("*")
      .order("date", { ascending: false });
    if (error || !data) return [];
    return (data as ReflectionRow[]).map(rowToReflection);
  } catch {
    return [];
  }
}

export async function fetchBoard(): Promise<Board> {
  const [
    meta,
    tasks,
    weekly,
    reflectionList,
    projectList,
    suggestionsRes,
    notesRes,
    assignees,
  ] = await Promise.all([
    supabase.from("board_meta").select("*").eq("id", "main").maybeSingle(),
    supabase.from("tasks").select("*").order("created_at", { ascending: true }),
    supabase.from("weekly").select("*").order("created_at", { ascending: true }),
    fetchReflections(),
    fetchProjects(),
    fetchSuggestions(),
    fetchPersonalNotes(),
    probeAssignees(),
  ]);

  if (meta.error) throw meta.error;
  // seedIfEmpty has run by now, so a missing row means this session cannot
  // read the board (e.g. its access was just revoked) — never show seed data.
  if (!meta.data) throw new Error("Board not readable with this login.");
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

  const m = meta.data as Record<string, unknown> | null;
  return {
    id: "board",
    boardName: (m?.board_name as string) ?? SEED_BOARD_NAME,
    members: (m?.members as string[]) ?? SEED_MEMBERS,
    tasks: ((tasks.data ?? []) as TaskRow[]).map(rowToTask),
    weekly: weeklyGrouped,
    reflections: reflectionList,
    projects: projectList,
    suggestions: suggestionsRes.list,
    suggestionsError: suggestionsRes.error,
    personalNotes: notesRes.list,
    personalNotesError: notesRes.error,
    assigneesAvailable: assignees,
    updatedAt: Date.now(),
    subtitleIt: (m?.subtitle_it as string) ?? undefined,
    subtitleEn: (m?.subtitle_en as string) ?? undefined,
    loginDays: (m?.login_days as number) ?? undefined,
    logoUrl: (m?.logo_url as string) ?? undefined,
    faviconUrl: (m?.favicon_url as string) ?? undefined,
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
      const t = {
        ...op.task,
        createdAt: op.task.createdAt ?? Date.now(),
        doneAt: op.task.status === "DONE" ? op.task.doneAt ?? Date.now() : op.task.doneAt,
      };
      const row = taskToRow(t) as unknown as Record<string, unknown>;
      // Don't send optional columns on new tasks unless they have a value —
      // keeps inserts working even before migrations 003/007 add the columns.
      if (row.file_dir == null) delete row.file_dir;
      if (row.done_at == null) delete row.done_at;
      if (!hasAssignees || row.assignees == null) delete row.assignees;
      await must(supabase.from("tasks").insert(row));
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
      // Stamp the completion time on entering DONE; clear it on leaving.
      if (op.status === "DONE") {
        update.done_at = cur?.doneAt ?? Date.now();
      } else {
        update.done_at = null;
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
    case "setSubtitle":
      await must(
        supabase
          .from("board_meta")
          .update(op.lang === "it" ? { subtitle_it: op.text } : { subtitle_en: op.text })
          .eq("id", "main")
      );
      break;
    case "setAccess": {
      const upd: Record<string, unknown> = {};
      if (op.loginDays !== undefined) upd.login_days = op.loginDays;
      await must(supabase.from("board_meta").update(upd).eq("id", "main"));
      break;
    }
    case "setBranding": {
      const upd: Record<string, unknown> = {};
      if (op.logoUrl !== undefined) upd.logo_url = op.logoUrl; // null clears
      if (op.faviconUrl !== undefined) upd.favicon_url = op.faviconUrl;
      await must(supabase.from("board_meta").update(upd).eq("id", "main"));
      break;
    }
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
    case "reflectionSave":
      await must(
        supabase
          .from("reflections")
          .upsert(reflectionToRow(op.reflection), { onConflict: "id" })
      );
      break;
    case "reflectionDelete":
      await must(supabase.from("reflections").delete().eq("id", op.id));
      break;
    case "projectAdd":
      await must(supabase.from("projects").insert(projectToRow(op.project)));
      break;
    case "projectUpdate": {
      const upd: Record<string, unknown> = { updated_at: Date.now() };
      if (op.patch.name !== undefined) upd.name = op.patch.name;
      if (op.patch.items !== undefined) upd.items = op.patch.items;
      await must(supabase.from("projects").update(upd).eq("id", op.id));
      break;
    }
    case "projectDelete":
      await must(supabase.from("projects").delete().eq("id", op.id));
      break;
    case "suggestionAdd":
      await must(
        supabase.from("suggestions").insert({
          id: op.suggestion.id,
          body: op.suggestion.body,
          created_at: op.suggestion.createdAt,
        })
      );
      break;
    case "noteAdd":
      await must(
        supabase.from("personal_notes").insert({
          id: op.note.id,
          member: op.note.member,
          body: op.note.body,
          created_at: op.note.createdAt,
          updated_at: op.note.updatedAt,
        })
      );
      break;
    case "noteUpdate":
      await must(
        supabase
          .from("personal_notes")
          .update({ body: op.body, updated_at: Date.now() })
          .eq("id", op.id)
      );
      break;
    case "noteDelete":
      await must(supabase.from("personal_notes").delete().eq("id", op.id));
      break;
    case "suggestionDelete":
      await must(supabase.from("suggestions").delete().eq("id", op.id));
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
