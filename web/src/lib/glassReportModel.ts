import type { Board, Priority, Project, Status, Task } from "./types";
import type { PlannerColumn, ReportData } from "./reportData";
import type { MenuDay } from "./menu";

// -----------------------------------------------------------------------------
// The Liquid Glass weekly report: its content as a flat list of blocks.
//
// The report is laid out as A4 pages in HTML. Content is cut into blocks —
// a section heading, one task card, one project, one day of the menu — and
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
  menu: "#FF2D55",
};

export type SectionKey = "done" | "next" | "projects" | "planner" | "menu";

export const SECTION_ORDER: SectionKey[] = ["done", "next", "projects", "planner", "menu"];

export type Block =
  | { kind: "section"; id: string; key: SectionKey; n: number; count: number }
  | { kind: "task"; id: string; task: Task; mode: "done" | "next"; completedAt: number | null }
  | { kind: "project"; id: string; project: Project }
  | { kind: "menuDay"; id: string; day: MenuDay }
  | { kind: "menuNote"; id: string; venue: string }
  | { kind: "empty"; id: string; key: SectionKey };

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
  /** Portrait blocks after the planner: the canteen menu of the week ahead. */
  after: Block[];
}

/** The menu shown after the planner: the days of the week ahead, and where. */
export interface ReportMenu {
  venue: string;
  days: MenuDay[];
}

/** Everything after the cover, in reading order. Hidden block ids are left out. */
export function buildBlocks(
  data: ReportData,
  hidden: Set<string>,
  menu: ReportMenu = { venue: "", days: [] }
): ReportLayoutInput {
  let n = 0;
  // `lead` is shown under the heading when the section has cards, and is not counted.
  const section = (key: SectionKey, body: Block[], lead: Block[] = []): Block[] => {
    n += 1;
    const visible = body.filter((b) => !hidden.has(b.id));
    return [
      { kind: "section", id: `sec.${key}`, key, n, count: visible.length },
      ...(visible.length
        ? [...lead.filter((b) => !hidden.has(b.id)), ...visible]
        : [{ kind: "empty" as const, id: `empty.${key}`, key }]),
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
      // Projects left out of the report (× on the card) stay out of every report.
      data.projects
        .filter((p) => !p.reportHidden)
        .map((p) => ({ kind: "project" as const, id: `proj.${p.id}`, project: p }))
    ),
  ];
  n += 1;
  const planner = { n, columns: data.planner };
  const after = section(
    "menu",
    menu.days.map((day) => ({ kind: "menuDay" as const, id: `menu.${day.date}`, day })),
    menu.venue ? [{ kind: "menuNote" as const, id: "menu.note", venue: menu.venue }] : []
  );
  return { before, planner, after };
}

export function reportPdfName(data: ReportData): string {
  return `Weekly_Report_${data.period.from}_${data.period.to}.pdf`;
}
