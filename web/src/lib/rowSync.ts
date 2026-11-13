import type { Board, PersonalNote, Project, Reflection, Task, Weekly, WeeklyItem } from "./types";

// One authoritative change, ready to fold into the board in memory. Built by
// useBoard from a realtime event: a deleted row arrives as null, a changed or
// new row is re-read on its own (never the whole board).
export type RowChange =
  | { table: "tasks"; id: string; row: Task | null }
  | { table: "weekly"; id: string; row: { bucket: keyof Weekly; item: WeeklyItem } | null }
  | { table: "projects"; id: string; row: Project | null }
  | { table: "reflections"; list: Reflection[] }
  | { table: "personal_notes"; list: PersonalNote[]; error?: string }
  | { table: "board_meta"; meta: Partial<Board> };

const WEEKLY_KEYS: (keyof Weekly)[] = ["well", "learnings", "improve", "blockers", "focus"];

/** Replace, insert (in createdAt order) or remove one item by id. */
function upsertById<T extends { id: string; createdAt?: number }>(list: T[], id: string, row: T | null): T[] {
  const i = list.findIndex((x) => x.id === id);
  if (!row) return i < 0 ? list : list.filter((x) => x.id !== id);
  if (i >= 0) {
    const next = list.slice();
    next[i] = row;
    return next;
  }
  // New: keep the oldest-first order the full fetch uses.
  const at = row.createdAt ?? Infinity;
  const j = list.findIndex((x) => (x.createdAt ?? 0) > at);
  return j < 0 ? [...list, row] : [...list.slice(0, j), row, ...list.slice(j)];
}

export function applyRowChange(board: Board, ch: RowChange): Board {
  switch (ch.table) {
    case "tasks":
      return { ...board, tasks: upsertById(board.tasks, ch.id, ch.row) };
    case "projects":
      return { ...board, projects: upsertById(board.projects, ch.id, ch.row) };
    case "weekly": {
      const weekly = { ...board.weekly };
      for (const k of WEEKLY_KEYS) {
        const list = weekly[k];
        const i = list.findIndex((x) => x.id === ch.id);
        if (ch.row && ch.row.bucket === k) {
          weekly[k] = i >= 0 ? list.map((x) => (x.id === ch.id ? ch.row!.item : x)) : [...list, ch.row.item];
        } else if (i >= 0) {
          weekly[k] = list.filter((x) => x.id !== ch.id);
        }
      }
      return { ...board, weekly };
    }
    case "reflections":
      return { ...board, reflections: ch.list };
    case "personal_notes":
      return { ...board, personalNotes: ch.list, personalNotesError: ch.error };
    case "board_meta":
      return { ...board, ...ch.meta };
  }
}
