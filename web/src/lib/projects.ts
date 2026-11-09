// -----------------------------------------------------------------------------
// Project maths, shared by the Projects tab, the board and the weekly report.
//
// A project's work is the board tasks linked to it (Task.projectId).
// Its status is never set by hand:
//   • ongoing   — no linked task yet, or some still open
//   • completed — it has linked tasks and every one of them is DONE;
//                 completed on the day its last task was.
// Completed projects are "recent" for a week, like the board's Done bar, and
// "older" after that.
// -----------------------------------------------------------------------------

import type { Priority, Project, ProjectStatus, Status, Task } from "./types";
import { ARCHIVE_DAYS, PRIORITY_ORDER, STATUS_ORDER, genId } from "./constants";
import { daysUntil } from "./dates";

export const PROJECT_STATUS_COLOR: Record<ProjectStatus, string> = {
  ongoing: "#007AFF",
  done: "#34C759",
};

/** Per board column, for the task breakdown bars. Apple light palette. */
export const TASK_STATUS_COLOR: Record<Status, string> = {
  BACKLOG: "#8E8E93",
  NEXT: "#007AFF",
  "IN PROGRESS": "#AF52DE",
  WAITING: "#FF9500",
  DONE: "#34C759",
  MAYBE: "#C7C7CC",
};

export const PROJECT_COLORS = [
  "#007AFF",
  "#5856D6",
  "#AF52DE",
  "#FF2D55",
  "#FF9500",
  "#34C759",
  "#32ADE6",
  "#A2845E",
];

/** The project's accent: its own colour, or one picked steadily from its id. */
export function projectColor(p: Pick<Project, "id" | "color">): string {
  if (p.color && /^#[0-9a-f]{6}$/i.test(p.color)) return p.color;
  let h = 0;
  for (const ch of p.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PROJECT_COLORS[h % PROJECT_COLORS.length];
}

export function projectPriority(p: Project): Priority {
  return p.priority ?? "P2";
}

/** When a task was completed (same rule as the report and the archive). */
function completedAt(t: Task): number {
  return t.doneAt ?? t.updatedAt ?? 0;
}

/** Every task linked to the project, in board order. */
export function projectTasks(tasks: Task[], projectId: string): Task[] {
  return tasks.filter((t) => t.projectId === projectId);
}

export type Health = "done" | "overdue" | "atRisk" | "onTrack" | "noDate";

export const HEALTH_COLOR: Record<Health, string> = {
  done: "#34C759",
  overdue: "#FF3B30",
  atRisk: "#FF9500",
  onTrack: "#34C759",
  noDate: "#8E8E93",
};

export interface ProjectStats {
  tasks: Task[];
  total: number;
  done: number;
  /** 0..1 */
  share: number;
  /** Linked tasks per board column. */
  byStatus: Record<Status, number>;
  status: ProjectStatus;
  /** When the last task was completed; null while ongoing. */
  completedAt: number | null;
  /** Completed within the last week. */
  recent: boolean;
  /** Open linked tasks past their due date. */
  overdueTasks: number;
  /** The open linked task due soonest. */
  nextDue: Task | null;
  daysLeft: number | null;
  health: Health;
}

function isoDiffDays(fromIso: string, toIso: string): number {
  return Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86400000);
}

export function projectStats(p: Project, allTasks: Task[], now = Date.now()): ProjectStats {
  const tasks = projectTasks(allTasks, p.id);
  const byStatus = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<Status, number>;
  for (const t of tasks) byStatus[t.status] += 1;
  const total = tasks.length;
  const done = byStatus.DONE;
  const share = total ? done / total : 0;
  const complete = total > 0 && done === total;
  const finishedAt = complete ? Math.max(...tasks.map(completedAt)) : null;

  const open = tasks.filter((t) => t.status !== "DONE");
  const overdueTasks = open.filter((t) => {
    const d = daysUntil(t.dueDate);
    return d !== null && d < 0;
  }).length;
  const nextDue =
    open.filter((t) => t.dueDate).sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))[0] ?? null;

  const daysLeft = daysUntil(p.targetDate);
  let health: Health;
  if (complete) health = "done";
  else if (daysLeft === null) health = overdueTasks ? "atRisk" : "noDate";
  else if (daysLeft < 0) health = "overdue";
  else {
    // Behind when progress trails the share of time already used, or when
    // the end is a week away and most of the work is still open.
    let expected = 0;
    if (p.startDate && p.targetDate) {
      const span = isoDiffDays(p.startDate, p.targetDate);
      if (span > 0) expected = Math.min(1, Math.max(0, (span - daysLeft) / span));
    }
    const behind = total > 0 && share + 0.2 < expected;
    const tight = daysLeft <= 7 && share < 0.75;
    health = behind || tight || overdueTasks > 0 ? "atRisk" : "onTrack";
  }

  return {
    tasks,
    total,
    done,
    share,
    byStatus,
    status: complete ? "done" : "ongoing",
    completedAt: finishedAt,
    recent: finishedAt !== null && now - finishedAt < ARCHIVE_DAYS * 86400000,
    overdueTasks,
    nextDue,
    daysLeft,
    health,
  };
}

export type ProjectSort = "target" | "progress" | "priority" | "name" | "updated";

export function sortProjects(list: Project[], by: ProjectSort, stats: Map<string, ProjectStats>): Project[] {
  const out = [...list];
  out.sort((a, b) => {
    let c = 0;
    switch (by) {
      case "target":
        c = (a.targetDate ?? "9999").localeCompare(b.targetDate ?? "9999");
        break;
      case "progress":
        c = (stats.get(b.id)?.share ?? 0) - (stats.get(a.id)?.share ?? 0);
        break;
      case "priority":
        c = PRIORITY_ORDER[projectPriority(a)] - PRIORITY_ORDER[projectPriority(b)];
        break;
      case "name":
        c = a.name.localeCompare(b.name);
        break;
      case "updated":
        c = (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
        break;
    }
    return c || a.name.localeCompare(b.name);
  });
  return out;
}

/**
 * The projects the weekly report shows: left-out ones dropped, and completed
 * ones only if they were completed inside the report period. Ongoing first,
 * then by priority.
 */
export function reportProjects(
  list: Project[],
  tasks: Task[],
  bounds: { start: number; end: number }
): { project: Project; stats: ProjectStats }[] {
  return list
    .filter((p) => !p.reportHidden)
    .map((project) => ({ project, stats: projectStats(project, tasks) }))
    .filter(({ stats }) => stats.status === "ongoing" || (stats.completedAt! >= bounds.start && stats.completedAt! < bounds.end))
    .sort(
      (a, b) =>
        (a.stats.status === "done" ? 1 : 0) - (b.stats.status === "done" ? 1 : 0) ||
        PRIORITY_ORDER[projectPriority(a.project)] - PRIORITY_ORDER[projectPriority(b.project)] ||
        (a.project.createdAt ?? 0) - (b.project.createdAt ?? 0)
    );
}

/** A brand-new project with every field set (so every column is written). */
export function newProject(name: string, owners: string[] = []): Project {
  const now = Date.now();
  return {
    id: genId(),
    name,
    items: [],
    createdAt: now,
    updatedAt: now,
    description: "",
    notes: "",
    owners,
    priority: "P2",
    startDate: undefined,
    targetDate: undefined,
    color: "",
  };
}
