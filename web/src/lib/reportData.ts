import type { Board, Project, Status, Subtask, Task } from "./types";
import { PRIORITY_ORDER } from "./constants";
import { toISODate } from "./dates";

// ---- Week maths -------------------------------------------------------------
// Weeks run Monday → Sunday (ISO), which is how the team reads a "week".

export interface Period {
  from: string; // ISO yyyy-mm-dd, inclusive
  to: string; // ISO yyyy-mm-dd, inclusive
}

// Monday of the week containing `d`, at 00:00 local time.
export function mondayOf(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const shift = (m.getDay() + 6) % 7; // Sunday(0) → 6, Monday(1) → 0
  m.setDate(m.getDate() - shift);
  return m;
}

// `offset` counts weeks back from the current one (0 = this week).
export function weekPeriod(offset = 0): Period {
  const mon = mondayOf(new Date());
  mon.setDate(mon.getDate() - offset * 7);
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  return { from: toISODate(mon), to: toISODate(sun) };
}

// Half-open millisecond bounds for a period: [start, end).
export function periodBounds(p: Period): { start: number; end: number } {
  const [fy, fm, fd] = p.from.split("-").map(Number);
  const [ty, tm, td] = p.to.split("-").map(Number);
  const start = new Date(fy, fm - 1, fd, 0, 0, 0, 0).getTime();
  const end = new Date(ty, tm - 1, td, 23, 59, 59, 999).getTime() + 1;
  return { start, end };
}

// When a task was completed. Tasks finished before migration-007 carry no
// done_at, so fall back to updated_at — the same rule the archive check uses.
export function taskCompletedAt(t: Task): number {
  return t.doneAt ?? t.updatedAt ?? 0;
}

// ---- Gathering the report's content ----------------------------------------
// The shape follows the Word template: "Done" and "Next" activity lists, a
// "Current Projects" list, and a four-column "Planner" board. No owner is
// collected anywhere — the report is deliberately name-free.

export interface ReportTask {
  task: Task;
  completedAt: number | null; // Done section only
  subtasks: Subtask[];
}

// The planner page mirrors these four kanban columns, in this order.
export const PLANNER_COLUMNS: Status[] = ["BACKLOG", "NEXT", "IN PROGRESS", "WAITING"];

export interface PlannerColumn {
  status: Status;
  tasks: Task[];
}

export interface ReportData {
  period: Period;
  done: ReportTask[]; // completed inside the period
  next: ReportTask[]; // current NEXT column
  projects: Project[]; // current projects, with their checklists
  planner: PlannerColumn[];
  totalTasks: number; // completed in the period
  totalSubtasks: number; // subtasks completed in the period
}

const byPriorityThenTitle = (a: Task, b: Task) =>
  PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
  a.title.localeCompare(b.title);

// Builds everything the template asks for:
//  • Done            — tasks that entered DONE inside the period
//  • Next            — whatever is sitting in the NEXT column right now
//  • Current Projects— the Projects tab, with each checklist
//  • Planner         — Backlog / Next / In Progress / Waiting as they stand
//
// "Done" is the only period-filtered part; the rest is a snapshot of where the
// board stands when the report is generated, which is what makes it a planner.
export function collectReport(board: Board, period: Period): ReportData {
  const { start, end } = periodBounds(period);
  const inRange = (ms?: number) => typeof ms === "number" && ms >= start && ms < end;

  const done: ReportTask[] = [];
  let totalSubtasks = 0;

  for (const task of board.tasks) {
    if (task.status !== "DONE" || !inRange(taskCompletedAt(task))) continue;
    const subtasks = task.subtasks ?? [];
    done.push({ task, completedAt: taskCompletedAt(task), subtasks });
    // Subtasks ticked before subtask timestamps existed carry no doneAt. On a
    // task that WAS completed in the window, count them as part of that
    // completion rather than dropping them from the figures.
    totalSubtasks += subtasks.filter(
      (s) => s.done && (s.doneAt == null || inRange(s.doneAt))
    ).length;
  }
  done.sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0));

  const next: ReportTask[] = board.tasks
    .filter((t) => t.status === "NEXT")
    .sort(byPriorityThenTitle)
    .map((task) => ({ task, completedAt: null, subtasks: task.subtasks ?? [] }));

  const planner: PlannerColumn[] = PLANNER_COLUMNS.map((status) => ({
    status,
    tasks: board.tasks.filter((t) => t.status === status).sort(byPriorityThenTitle),
  }));

  return {
    period,
    done,
    next,
    projects: board.projects ?? [],
    planner,
    totalTasks: done.length,
    totalSubtasks,
  };
}
