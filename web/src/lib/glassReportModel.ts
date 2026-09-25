import type { Board, Project, Status, Task, Weekly, WeeklyItem } from "./types";
import type { ReportData } from "./reportData";

// -----------------------------------------------------------------------------
// The Liquid Glass weekly report: its content as a flat list of blocks.
//
// The report is laid out as A4 pages in HTML. Content is cut into blocks —
// a section heading, one task card, one project, one planner band, one retro
// bucket — and GlassReport measures every block and packs them onto pages, so
// nothing is ever split across a page break. Like the Word report, it is
// name-free: no owner is shown anywhere.
// -----------------------------------------------------------------------------

export type SectionKey = "done" | "next" | "projects" | "planner" | "retro";

export const SECTION_ORDER: SectionKey[] = ["done", "next", "projects", "planner", "retro"];

export type Block =
  | { kind: "section"; id: string; key: SectionKey; n: number; count: number }
  | { kind: "task"; id: string; task: Task; mode: "done" | "next"; completedAt: number | null }
  | { kind: "project"; id: string; project: Project }
  | { kind: "band"; id: string; status: Status; tasks: Task[] }
  | { kind: "retro"; id: string; bucket: keyof Weekly; items: WeeklyItem[] }
  | { kind: "empty"; id: string; key: SectionKey };

export const RETRO_ORDER: (keyof Weekly)[] = ["well", "learnings", "improve", "blockers", "focus"];

export interface CoverStats {
  done: number;
  subtasks: number;
  inProgress: number;
  next: number;
  waiting: number;
  /** Share of the week's active work that got finished: done / (done + in progress + next). */
  closeRate: number;
  /** Average completion of the projects' checklists, 0..1 (null without projects). */
  projectAvg: number | null;
}

export function coverStats(board: Board, data: ReportData): CoverStats {
  const count = (s: Status) => board.tasks.filter((t) => t.status === s).length;
  const inProgress = count("IN PROGRESS");
  const next = count("NEXT");
  const waiting = count("WAITING");
  const done = data.totalTasks;
  const open = done + inProgress + next;
  const withItems = data.projects.filter((p) => p.items.length > 0);
  const projectAvg = withItems.length
    ? withItems.reduce((a, p) => a + p.items.filter((i) => i.done).length / p.items.length, 0) / withItems.length
    : null;
  return {
    done,
    subtasks: data.totalSubtasks,
    inProgress,
    next,
    waiting,
    closeRate: open ? done / open : 0,
    projectAvg,
  };
}

/** Every block after the cover, in reading order. Hidden block ids are left out. */
export function buildBlocks(board: Board, data: ReportData, hidden: Set<string>): Block[] {
  const out: Block[] = [];
  const keep = <B extends Block>(b: B) => !hidden.has(b.id);
  let n = 0;

  const section = (key: SectionKey, body: Block[]) => {
    n += 1;
    const visible = body.filter(keep);
    out.push({ kind: "section", id: `sec.${key}`, key, n, count: visible.length });
    if (visible.length) out.push(...visible);
    else out.push({ kind: "empty", id: `empty.${key}`, key });
  };

  section(
    "done",
    data.done.map((r) => ({
      kind: "task" as const,
      id: `task.${r.task.id}`,
      task: r.task,
      mode: "done" as const,
      completedAt: r.completedAt,
    }))
  );
  section(
    "next",
    data.next.map((r) => ({
      kind: "task" as const,
      id: `next.${r.task.id}`,
      task: r.task,
      mode: "next" as const,
      completedAt: null,
    }))
  );
  section(
    "projects",
    data.projects.map((p) => ({ kind: "project" as const, id: `proj.${p.id}`, project: p }))
  );
  section(
    "planner",
    data.planner.map((c) => ({ kind: "band" as const, id: `band.${c.status}`, status: c.status, tasks: c.tasks }))
  );
  section(
    "retro",
    RETRO_ORDER.filter((b) => (board.weekly[b] ?? []).length > 0).map((b) => ({
      kind: "retro" as const,
      id: `retro.${b}`,
      bucket: b,
      items: board.weekly[b],
    }))
  );
  return out;
}

export function reportPdfName(data: ReportData): string {
  return `Weekly_Report_${data.period.from}_${data.period.to}.pdf`;
}
