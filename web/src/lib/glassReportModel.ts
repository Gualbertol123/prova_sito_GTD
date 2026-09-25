import type { Board, Priority, Project, Status, Task, Weekly, WeeklyItem } from "./types";
import type { PlannerColumn, ReportData } from "./reportData";

// -----------------------------------------------------------------------------
// The Liquid Glass weekly report: its content as a flat list of blocks.
//
// The report is laid out as A4 pages in HTML. Content is cut into blocks —
// a section heading, one task card, one project, one retro bucket — and
// GlassReport measures every block and packs them onto portrait pages, so
// nothing is ever split across a page break. The planner is different: it is
// always one landscape page, the four columns side by side. Like the Word report, it is
// name-free: no owner is shown anywhere.
// -----------------------------------------------------------------------------

// Apple's light system colours, shared by the pages and the server PDF.
export const PRIORITY_COLOR: Record<Priority, string> = {
  P1: "#FF3B30",
  P2: "#FF9500",
  P3: "#007AFF",
  P4: "#8E8E93",
};
export const STATUS_COLOR: Partial<Record<Status, string>> = {
  BACKLOG: "#8E8E93",
  NEXT: "#007AFF",
  "IN PROGRESS": "#AF52DE",
  WAITING: "#FF9500",
};
export const SECTION_COLOR: Record<SectionKey, string> = {
  done: "#34C759",
  next: "#007AFF",
  projects: "#5856D6",
  planner: "#AF52DE",
  retro: "#FF2D55",
};

export type SectionKey = "done" | "next" | "projects" | "planner" | "retro";

export const SECTION_ORDER: SectionKey[] = ["done", "next", "projects", "planner", "retro"];

export type Block =
  | { kind: "section"; id: string; key: SectionKey; n: number; count: number }
  | { kind: "task"; id: string; task: Task; mode: "done" | "next"; completedAt: number | null }
  | { kind: "project"; id: string; project: Project }
  | { kind: "retro"; id: string; bucket: keyof Weekly; items: WeeklyItem[] }
  | { kind: "empty"; id: string; key: SectionKey };

export const RETRO_ORDER: (keyof Weekly)[] = ["well", "learnings", "improve", "blockers", "focus"];

export interface CoverStats {
  done: number;
  subtasks: number;
  inProgress: number;
  next: number;
  waiting: number;
}

export function coverStats(board: Board, data: ReportData): CoverStats {
  const count = (s: Status) => board.tasks.filter((t) => t.status === s).length;
  return {
    done: data.totalTasks,
    subtasks: data.totalSubtasks,
    inProgress: count("IN PROGRESS"),
    next: count("NEXT"),
    waiting: count("WAITING"),
  };
}

export interface ReportLayoutInput {
  /** Portrait blocks before the planner: Done, Next, Projects. */
  before: Block[];
  /** The planner page's columns and its section number. */
  planner: { n: number; columns: PlannerColumn[] };
  /** Portrait blocks after the planner: the retro. */
  after: Block[];
}

/** Everything after the cover, in reading order. Hidden block ids are left out. */
export function buildBlocks(board: Board, data: ReportData, hidden: Set<string>): ReportLayoutInput {
  let n = 0;
  const section = (key: SectionKey, body: Block[]): Block[] => {
    n += 1;
    const visible = body.filter((b) => !hidden.has(b.id));
    return [
      { kind: "section", id: `sec.${key}`, key, n, count: visible.length },
      ...(visible.length ? visible : [{ kind: "empty" as const, id: `empty.${key}`, key }]),
    ];
  };

  const before = [
    ...section(
      "done",
      data.done.map((r) => ({
        kind: "task" as const,
        id: `task.${r.task.id}`,
        task: r.task,
        mode: "done" as const,
        completedAt: r.completedAt,
      }))
    ),
    ...section(
      "next",
      data.next.map((r) => ({
        kind: "task" as const,
        id: `next.${r.task.id}`,
        task: r.task,
        mode: "next" as const,
        completedAt: null,
      }))
    ),
    ...section(
      "projects",
      data.projects.map((p) => ({ kind: "project" as const, id: `proj.${p.id}`, project: p }))
    ),
  ];
  n += 1;
  const planner = { n, columns: data.planner };
  const after = section(
    "retro",
    // All five buckets, always: an empty one is a box to write in.
    RETRO_ORDER.map((b) => ({
      kind: "retro" as const,
      id: `retro.${b}`,
      bucket: b,
      items: board.weekly[b] ?? [],
    }))
  );
  return { before, planner, after };
}

export function reportPdfName(data: ReportData): string {
  return `Weekly_Report_${data.period.from}_${data.period.to}.pdf`;
}
