import type { Board, Status, Task } from "./types";
import type { ReportData } from "./reportData";
import {
  PRIORITY_COLOR,
  SECTION_COLOR,
  STATUS_COLOR,
  type Block,
  type ReportLayoutInput,
} from "./glassReportModel";

// -----------------------------------------------------------------------------
// The weekly report as plain data, for the server-side PDF.
//
// The REPORT tab is the editor; the PDF is made on the server
// (web/netlify/functions/report-pdf.mts) so it comes out the same on every
// device. The browser sends this document: the report's structure from the
// same model the pages use, and every text exactly as it currently reads on
// the pages — with the person's edits, hidden cards and chosen highlights.
// -----------------------------------------------------------------------------

export interface DocSub {
  text: string;
  done: boolean;
}

export type DocCard =
  | {
      kind: "task";
      accent: string;
      prio: { text: string; color: string };
      meta: string;
      title: string;
      desc: string;
      progress: { value: number; label: string; color: string } | null;
      subs: DocSub[];
      more: string;
    }
  | {
      kind: "project";
      accent: string;
      title: string;
      pct: string;
      progress: { value: number; label: string; color: string };
      items: DocSub[];
      more: string;
    }
  | { kind: "retro"; accent: string; label: string; items: string[] }
  | { kind: "empty"; text: string };

export interface DocSection {
  eyebrow: string;
  title: string;
  count: string;
  color: string;
  cards: DocCard[];
}

export interface DocColumn {
  title: string;
  count: string;
  color: string;
  empty: string;
  items: { text: string; meta: string; dot: string }[];
}

export interface ReportDoc {
  version: 1;
  fileName: string;
  header: { brand: string; period: string; footer: string };
  cover: {
    board: string;
    period: string;
    eyebrow: string;
    title: string;
    subtitle: string;
    tiles: { value: string; label: string; color: string }[];
    highlights: { title: string; items: { text: string; done: boolean; color: string }[] } | null;
    note: { title: string; text: string };
  };
  before: DocSection[];
  planner: { eyebrow: string; title: string; count: string; color: string; columns: DocColumn[] };
  after: DocSection[];
}

interface BuildArgs {
  root: HTMLElement; // the report, to read the texts from
  board: Board;
  data: ReportData;
  input: ReportLayoutInput;
  hidden: Set<string>;
  highlights: string[];
  fileName: string;
}

export function buildReportDoc({ root, board, data, input, hidden, highlights, fileName }: BuildArgs): ReportDoc {
  const pages = root.querySelector(".gr-pages") ?? root;
  // The text as it reads on the pages right now (defaults and edits alike).
  const txt = (id: string, fallback = ""): string => {
    const el = pages.querySelector<HTMLElement>(`[data-ed-id="${CSS.escape(id)}"]`);
    return el ? el.innerText.replace(/\n+$/, "") : fallback;
  };

  const sections = (blocks: Block[]): DocSection[] => {
    const out: DocSection[] = [];
    for (const b of blocks) {
      if (b.kind === "section") {
        out.push({
          eyebrow: txt(`${b.id}.eyebrow`),
          title: txt(`${b.id}.title`),
          count: txt(`${b.id}.count`, String(b.count)),
          color: SECTION_COLOR[b.key],
          cards: [],
        });
        continue;
      }
      const sec = out[out.length - 1];
      if (!sec) continue;
      if (b.kind === "empty") {
        sec.cards.push({ kind: "empty", text: txt(b.id) });
      } else if (b.kind === "task") {
        const t = b.task;
        const subs = t.subtasks ?? [];
        const done = subs.filter((s) => s.done).length;
        const accent = b.mode === "done" ? SECTION_COLOR.done : PRIORITY_COLOR[t.priority];
        sec.cards.push({
          kind: "task",
          accent,
          prio: { text: txt(`${b.id}.prio`, t.priority), color: PRIORITY_COLOR[t.priority] },
          meta: txt(`${b.id}.meta`),
          title: txt(`${b.id}.title`, t.title),
          desc: txt(`${b.id}.desc`),
          progress: subs.length
            ? { value: done / subs.length, label: txt(`${b.id}.progress`), color: accent }
            : null,
          subs: subs.slice(0, 8).map((s) => ({ text: txt(`sub.${t.id}.${s.id}`, s.text), done: s.done })),
          more: txt(`${b.id}.more`),
        });
      } else if (b.kind === "project") {
        const p = b.project;
        const done = p.items.filter((i) => i.done).length;
        sec.cards.push({
          kind: "project",
          accent: SECTION_COLOR.projects,
          title: txt(`${b.id}.name`, p.name),
          pct: txt(`${b.id}.pct`),
          progress: {
            value: p.items.length ? done / p.items.length : 0,
            label: txt(`${b.id}.progress`),
            color: SECTION_COLOR.projects,
          },
          items: p.items.slice(0, 10).map((i) => ({ text: txt(`${b.id}.item.${i.id}`, i.text), done: i.done })),
          more: txt(`${b.id}.more`),
        });
      } else if (b.kind === "retro") {
        const items = b.items.length
          ? b.items.map((it) => txt(`${b.id}.${it.id}`, it.text))
          : txt(`${b.id}.text`).split("\n").filter((l) => l.trim());
        // A bucket left blank stays out of the PDF, as on screen.
        if (items.length) {
          sec.cards.push({ kind: "retro", accent: SECTION_COLOR.retro, label: txt(`${b.id}.label`), items });
        }
      }
    }
    return out;
  };

  // Highlights: the chosen tasks, in the chosen order.
  const doneIds = new Set(data.done.map((r) => r.task.id));
  const allTasks = new Map<string, Task>(board.tasks.map((t) => [t.id, t]));
  const hl = highlights
    .map((id) => allTasks.get(id))
    .filter((t): t is Task => !!t)
    .map((t) => ({
      text: txt(`hl.${t.id}`, t.title),
      done: doneIds.has(t.id),
      color: STATUS_COLOR[t.status] ?? "#8E8E93",
    }));

  const tileKeys = ["gr.stat.done", "gr.stat.subtasks", "gr.stat.inProgress", "gr.stat.next", "gr.stat.waiting"];
  const tileColors = ["#34C759", "#32ADE6", "#AF52DE", "#007AFF", "#FF9500"];

  const columns: DocColumn[] = input.planner.columns.map((c) => {
    const tasks = c.tasks.filter((t) => !hidden.has(`plan.${t.id}`));
    return {
      title: txt(`plan.col.${c.status}`, c.status),
      count: txt(`plan.col.${c.status}.count`, String(tasks.length)),
      color: STATUS_COLOR[c.status as Status] ?? "#8E8E93",
      empty: txt(`plan.col.${c.status}.empty`),
      items: tasks.map((t) => ({
        text: txt(`plan.${t.id}`, t.title),
        meta: t.dueDate ? txt(`plan.${t.id}.due`) : "",
        dot: PRIORITY_COLOR[t.priority],
      })),
    };
  });

  return {
    version: 1,
    fileName,
    header: { brand: txt("cover.board", board.boardName), period: txt("page.period"), footer: txt("page.footer") },
    cover: {
      board: txt("cover.board", board.boardName),
      period: txt("page.period"),
      eyebrow: txt("cover.eyebrow"),
      title: txt("cover.title"),
      subtitle: txt("cover.subtitle"),
      tiles: tileKeys.map((k, i) => ({ value: txt(`${k}.v`), label: txt(`${k}.k`), color: tileColors[i] })),
      highlights: hl.length ? { title: txt("cover.highlightsTitle"), items: hl } : null,
      note: { title: txt("cover.noteTitle"), text: txt("cover.note") },
    },
    before: sections(input.before),
    planner: {
      eyebrow: txt("sec.planner.eyebrow"),
      title: txt("sec.planner.title"),
      count: txt("sec.planner.count"),
      color: SECTION_COLOR.planner,
      columns,
    },
    after: sections(input.after),
  };
}
