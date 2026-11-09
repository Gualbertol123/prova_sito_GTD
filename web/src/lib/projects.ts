// -----------------------------------------------------------------------------
// Project maths, shared by the Projects tab, the board and the weekly report.
//
// A project's progress counts two kinds of work as equal units:
//   • its checklist items (ticked = done), and
//   • the board tasks linked to it (in DONE = done).
// Phases group checklist items; a phase's progress is its own items only.
// -----------------------------------------------------------------------------

import type { Phase, Priority, Project, ProjectStatus, Subtask, Task } from "./types";
import { PRIORITY_ORDER, genId } from "./constants";
import { daysUntil } from "./dates";

export const PROJECT_STATUSES: ProjectStatus[] = ["active", "planned", "onhold", "done"];

/** Apple system colours, light variant — read well on both skins. */
export const PROJECT_STATUS_COLOR: Record<ProjectStatus, string> = {
  planned: "#8E8E93",
  active: "#007AFF",
  onhold: "#FF9500",
  done: "#34C759",
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

export function projectStatus(p: Project): ProjectStatus {
  return p.status ?? "active";
}

export function projectPriority(p: Project): Priority {
  return p.priority ?? "P2";
}

/** Every task linked to the project, in board order. */
export function projectTasks(tasks: Task[], projectId: string): Task[] {
  return tasks.filter((t) => t.projectId === projectId);
}

export type Health = "done" | "paused" | "overdue" | "atRisk" | "onTrack" | "noDate";

export const HEALTH_COLOR: Record<Health, string> = {
  done: "#34C759",
  paused: "#FF9500",
  overdue: "#FF3B30",
  atRisk: "#FF9500",
  onTrack: "#34C759",
  noDate: "#8E8E93",
};

export interface PhaseStats {
  phase: Phase;
  items: Subtask[];
  done: number;
  total: number;
  share: number;
  /** Days to its due date (negative = past), null without one. */
  daysLeft: number | null;
  overdue: boolean;
}

export interface ProjectStats {
  itemsTotal: number;
  itemsDone: number;
  tasks: Task[];
  tasksDone: number;
  total: number;
  done: number;
  /** 0..1 */
  share: number;
  phases: PhaseStats[];
  /** Checklist items not in any (existing) phase. */
  loose: Subtask[];
  daysLeft: number | null;
  health: Health;
  /** The first phase not finished yet. */
  nextPhase: PhaseStats | null;
}

function isoDiffDays(fromIso: string, toIso: string): number {
  const a = new Date(fromIso);
  const b = new Date(toIso);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function projectStats(p: Project, allTasks: Task[]): ProjectStats {
  const items = p.items ?? [];
  const phases = p.phases ?? [];
  const phaseIds = new Set(phases.map((ph) => ph.id));
  const tasks = projectTasks(allTasks, p.id);
  const itemsDone = items.filter((i) => i.done).length;
  const tasksDone = tasks.filter((t) => t.status === "DONE").length;
  const total = items.length + tasks.length;
  const done = itemsDone + tasksDone;
  const share = total ? done / total : 0;

  const phaseStats: PhaseStats[] = phases.map((phase) => {
    const its = items.filter((i) => i.phaseId === phase.id);
    const d = its.filter((i) => i.done).length;
    const left = daysUntil(phase.dueDate);
    const complete = its.length > 0 && d === its.length;
    return {
      phase,
      items: its,
      done: d,
      total: its.length,
      share: its.length ? d / its.length : 0,
      daysLeft: left,
      overdue: left !== null && left < 0 && !complete,
    };
  });
  const loose = items.filter((i) => !i.phaseId || !phaseIds.has(i.phaseId));

  const status = projectStatus(p);
  const daysLeft = daysUntil(p.targetDate);
  let health: Health;
  if (status === "done") health = "done";
  else if (status === "onhold") health = "paused";
  else if (daysLeft === null) health = "noDate";
  else if (daysLeft < 0) health = "overdue";
  else {
    // Behind schedule when progress trails the share of time already used,
    // or when the end is a week away and most of the work is still open.
    let expected = 0;
    if (p.startDate && p.targetDate) {
      const span = isoDiffDays(p.startDate, p.targetDate);
      const left = daysLeft;
      if (span > 0) expected = Math.min(1, Math.max(0, (span - left) / span));
    }
    const behind = total > 0 && share + 0.2 < expected;
    const tight = daysLeft <= 7 && total > 0 && share < 0.75;
    health = behind || tight || phaseStats.some((ph) => ph.overdue) ? "atRisk" : "onTrack";
  }

  return {
    itemsTotal: items.length,
    itemsDone,
    tasks,
    tasksDone,
    total,
    done,
    share,
    phases: phaseStats,
    loose,
    daysLeft,
    health,
    nextPhase: phaseStats.find((ph) => ph.total === 0 || ph.done < ph.total) ?? null,
  };
}

export type ProjectSort = "target" | "progress" | "priority" | "name" | "updated";

export function sortProjects(list: Project[], by: ProjectSort, stats: Map<string, ProjectStats>): Project[] {
  const out = [...list];
  const statusRank = (p: Project) => PROJECT_STATUSES.indexOf(projectStatus(p));
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
    return c || statusRank(a) - statusRank(b) || a.name.localeCompare(b.name);
  });
  return out;
}

/**
 * The projects the weekly report shows, in report order: left-out ones
 * dropped, open work first (active, planned, on hold, done), then priority.
 */
export function reportProjects(list: Project[]): Project[] {
  return list
    .filter((p) => !p.reportHidden)
    .sort(
      (a, b) =>
        PROJECT_STATUSES.indexOf(projectStatus(a)) - PROJECT_STATUSES.indexOf(projectStatus(b)) ||
        PRIORITY_ORDER[projectPriority(a)] - PRIORITY_ORDER[projectPriority(b)] ||
        (a.createdAt ?? 0) - (b.createdAt ?? 0)
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
    owners,
    status: "active",
    priority: "P2",
    startDate: undefined,
    targetDate: undefined,
    color: "",
    phases: [],
  };
}

/**
 * Put a reordered subset (one phase's items) back into the full list: the
 * subset fills the same slots it held before, so other phases don't move.
 */
export function mergeReordered(all: Subtask[], subset: Subtask[]): Subtask[] {
  const ids = new Set(subset.map((s) => s.id));
  let k = 0;
  return all.map((it) => (ids.has(it.id) ? subset[k++] ?? it : it));
}
