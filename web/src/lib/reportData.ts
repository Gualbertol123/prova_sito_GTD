import type { Board, Subtask, Task } from "./types";
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

export interface ReportTask {
  task: Task;
  completedAt: number;
  subtasks: Subtask[]; // every subtask of the task, done or not
}

export interface ReportProgress {
  task: Task; // NOT completed in this period
  subtasks: Subtask[]; // only the subtasks ticked inside the period
}

export interface ReportOwnerStat {
  owner: string;
  tasks: number;
  subtasks: number;
}

export interface ReportData {
  period: Period;
  boardName: string;
  completed: ReportTask[];
  progress: ReportProgress[];
  byOwner: ReportOwnerStat[];
  totalTasks: number;
  totalSubtasks: number; // subtasks ticked inside the period, both sections
}

// Everything the team finished inside `period`:
//  - tasks that entered DONE in the window (with all their subtasks), and
//  - subtasks ticked in the window on tasks that are still open, so partial
//    progress on long-running activities is not lost from the report.
//
// Subtask timestamps only exist from the release that added them, so the
// "still open" half of the report necessarily starts empty for older data.
export function collectReport(board: Board, period: Period): ReportData {
  const { start, end } = periodBounds(period);
  const inRange = (ms?: number) => typeof ms === "number" && ms >= start && ms < end;

  const completed: ReportTask[] = [];
  const progress: ReportProgress[] = [];

  for (const task of board.tasks) {
    const done = task.status === "DONE" && inRange(taskCompletedAt(task));
    if (done) {
      completed.push({
        task,
        completedAt: taskCompletedAt(task),
        subtasks: task.subtasks ?? [],
      });
      continue;
    }
    const ticked = (task.subtasks ?? []).filter((s) => s.done && inRange(s.doneAt));
    if (ticked.length > 0) progress.push({ task, subtasks: ticked });
  }

  completed.sort(
    (a, b) => a.completedAt - b.completedAt || a.task.title.localeCompare(b.task.title)
  );
  progress.sort((a, b) => a.task.title.localeCompare(b.task.title));

  // Per-owner totals. Subtasks count only the ones ticked inside the period, so
  // the figure means "work done this week", not "subtasks attached to it".
  const stats = new Map<string, ReportOwnerStat>();
  const bump = (owner: string, tasks: number, subtasks: number) => {
    const cur = stats.get(owner) ?? { owner, tasks: 0, subtasks: 0 };
    cur.tasks += tasks;
    cur.subtasks += subtasks;
    stats.set(owner, cur);
  };
  let totalSubtasks = 0;
  for (const c of completed) {
    // Subtasks ticked before subtask timestamps existed carry no doneAt. On a
    // task that WAS completed in the window, count them as part of that
    // completion rather than dropping them from the figures.
    const ticked = c.subtasks.filter(
      (s) => s.done && (s.doneAt == null || inRange(s.doneAt))
    ).length;
    totalSubtasks += ticked;
    bump(c.task.owner, 1, ticked);
  }
  for (const p of progress) {
    totalSubtasks += p.subtasks.length;
    bump(p.task.owner, 0, p.subtasks.length);
  }

  const byOwner = [...stats.values()].sort(
    (a, b) => b.tasks - a.tasks || b.subtasks - a.subtasks || a.owner.localeCompare(b.owner)
  );

  return {
    period,
    boardName: board.boardName,
    completed,
    progress,
    byOwner,
    totalTasks: completed.length,
    totalSubtasks,
  };
}
