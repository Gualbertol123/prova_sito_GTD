import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Board, Priority, Project, Status, Subtask, Task } from "../lib/types";
import type { PlannerColumn, ReportData } from "../lib/reportData";
import { statusLabel, useT } from "../lib/i18n";
import {
  buildBlocks,
  coverStats,
  type Block,
  type CoverStats,
  type SectionKey,
} from "../lib/glassReportModel";

// -----------------------------------------------------------------------------
// The Liquid Glass weekly report — light mode, A4 pages, written in HTML.
//
// Every text on the pages can be edited in place (click and type). Edits are
// kept in memory for as long as the report is open and are what the PDF
// shows; cards can be hidden from the report with their × button. After every
// edit the blocks are measured again and re-packed onto pages, so a longer
// text simply pushes the next card to the following page.
// -----------------------------------------------------------------------------

// A4 at 96 dpi, in CSS px.
export const PAGE_W = 794;
export const PAGE_H = 1123;
const PAD_X = 56;
const HEAD = 100; // top of the content area
const FOOT = 72; // space kept for the footer
const CONTENT_W = PAGE_W - PAD_X * 2;
const CONTENT_H = PAGE_H - HEAD - FOOT;
const GAP = 14;

const PRIORITY_COLOR: Record<Priority, string> = {
  P1: "#FF3B30",
  P2: "#FF9500",
  P3: "#007AFF",
  P4: "#8E8E93",
};
const STATUS_COLOR: Partial<Record<Status, string>> = {
  BACKLOG: "#8E8E93",
  NEXT: "#007AFF",
  "IN PROGRESS": "#AF52DE",
  WAITING: "#FF9500",
};
const SECTION_COLOR: Record<SectionKey, string> = {
  done: "#34C759",
  next: "#007AFF",
  projects: "#5856D6",
  planner: "#AF52DE",
  retro: "#FF2D55",
};

// ---- Editable text ------------------------------------------------------------

interface EditCtx {
  enabled: boolean;
  get: (id: string) => string | undefined;
  set: (id: string, text: string) => void;
}

function Ed({
  id,
  value,
  edit,
  className = "",
  multiline = false,
  tag: Tag = "span",
}: {
  id: string;
  value: string;
  edit: EditCtx;
  className?: string;
  multiline?: boolean;
  tag?: "span" | "div" | "h1" | "h2" | "h3" | "p";
}) {
  const text = edit.get(id) ?? value;
  return (
    <Tag
      // Re-mounted when the stored text changes, so React never fights the
      // browser over what contentEditable put in the DOM.
      key={text}
      className={`gr-ed ${className}`}
      contentEditable={edit.enabled}
      suppressContentEditableWarning
      spellCheck={false}
      data-placeholder="…"
      onBlur={(e) => {
        const next = (e.currentTarget as HTMLElement).innerText.replace(/\n+$/, "");
        if (next !== text) edit.set(id, next);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !multiline) {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
        }
        if (e.key === "Escape") (e.currentTarget as HTMLElement).blur();
      }}
    >
      {text}
    </Tag>
  );
}

// ---- Small pieces ---------------------------------------------------------------

function PriorityPill({ p }: { p: Priority }) {
  return (
    <span className="gr-pill" style={{ color: PRIORITY_COLOR[p], background: `${PRIORITY_COLOR[p]}17` }}>
      <span className="gr-dot" style={{ background: PRIORITY_COLOR[p] }} />
      {p}
    </span>
  );
}

function Check({ done }: { done: boolean }) {
  return (
    <span className={`gr-check ${done ? "gr-check-on" : ""}`} aria-hidden>
      {done && (
        <svg viewBox="0 0 12 12" width="9" height="9">
          <path d="M2.5 6.3 5 8.6 9.6 3.6" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="gr-bar">
      <div className="gr-bar-fill" style={{ width: `${Math.round(value * 100)}%`, background: color }} />
    </div>
  );
}

function HideButton({ onHide }: { onHide?: () => void }) {
  const { t } = useT();
  if (!onHide) return null;
  return (
    <button type="button" className="gr-hide gr-noexport" title={t("gr.hide")} onClick={onHide}>
      ×
    </button>
  );
}

// ---- Blocks -------------------------------------------------------------------

interface BlockProps {
  block: Block;
  edit: EditCtx;
  fmtDate: (msOrIso: number | string) => string;
  onHide?: (id: string) => void;
}

function Subtasks({ task, edit, limit = 8 }: { task: Task; edit: EditCtx; limit?: number }) {
  const { t } = useT();
  const subs: Subtask[] = task.subtasks ?? [];
  if (!subs.length) return null;
  const shown = subs.slice(0, limit);
  return (
    <ul className="gr-subs">
      {shown.map((s) => (
        <li key={s.id} className={s.done ? "gr-sub-done" : ""}>
          <Check done={s.done} />
          <Ed id={`sub.${task.id}.${s.id}`} value={s.text} edit={edit} />
        </li>
      ))}
      {subs.length > limit && <li className="gr-more">{t("gr.more", { n: subs.length - limit })}</li>}
    </ul>
  );
}

function TaskCard({ block, edit, fmtDate, onHide }: BlockProps & { block: Extract<Block, { kind: "task" }> }) {
  const { t } = useT();
  const { task } = block;
  const subs = task.subtasks ?? [];
  const doneSubs = subs.filter((s) => s.done).length;
  const accent = block.mode === "done" ? SECTION_COLOR.done : PRIORITY_COLOR[task.priority];
  return (
    <div className="gr-glass gr-card">
      <span className="gr-accent" style={{ background: accent }} />
      <HideButton onHide={onHide && (() => onHide(block.id))} />
      <div className="gr-card-top">
        <PriorityPill p={task.priority} />
        <span className="gr-meta">
          {block.mode === "done" && block.completedAt
            ? `✓ ${t("gr.completedOn")} ${fmtDate(block.completedAt)}`
            : task.dueDate
              ? `${t("gr.due")} ${fmtDate(task.dueDate)}`
              : ""}
        </span>
      </div>
      <Ed tag="h3" id={`${block.id}.title`} value={task.title} edit={edit} className="gr-card-title" />
      {(edit.get(`${block.id}.desc`) ?? task.desc) && (
        <Ed tag="p" id={`${block.id}.desc`} value={task.desc} edit={edit} className="gr-card-desc" multiline />
      )}
      {subs.length > 0 && (
        <div className="gr-progress-row">
          <Bar value={doneSubs / subs.length} color={accent} />
          <span className="gr-progress-label">
            {doneSubs}/{subs.length}
          </span>
        </div>
      )}
      <Subtasks task={task} edit={edit} />
    </div>
  );
}

function ProjectCard({ block, edit, onHide }: BlockProps & { block: Extract<Block, { kind: "project" }> }) {
  const { t } = useT();
  const p: Project = block.project;
  const done = p.items.filter((i) => i.done).length;
  const share = p.items.length ? done / p.items.length : 0;
  const limit = 10;
  return (
    <div className="gr-glass gr-card">
      <span className="gr-accent" style={{ background: SECTION_COLOR.projects }} />
      <HideButton onHide={onHide && (() => onHide(block.id))} />
      <div className="gr-project-head">
        <Ed tag="h3" id={`${block.id}.name`} value={p.name || t("gr.untitled")} edit={edit} className="gr-card-title" />
        <span className="gr-big-pct">{Math.round(share * 100)}%</span>
      </div>
      <div className="gr-progress-row">
        <Bar value={share} color="linear-gradient(90deg,#5856D6,#AF52DE)" />
        <span className="gr-progress-label">
          {done}/{p.items.length}
        </span>
      </div>
      {p.items.length > 0 && (
        <ul className="gr-subs gr-subs-2col">
          {p.items.slice(0, limit).map((it) => (
            <li key={it.id} className={it.done ? "gr-sub-done" : ""}>
              <Check done={it.done} />
              <Ed id={`${block.id}.item.${it.id}`} value={it.text} edit={edit} />
            </li>
          ))}
          {p.items.length > limit && <li className="gr-more">{t("gr.more", { n: p.items.length - limit })}</li>}
        </ul>
      )}
    </div>
  );
}

function Retro({ block, edit, onHide }: BlockProps & { block: Extract<Block, { kind: "retro" }> }) {
  const { t } = useT();
  return (
    <div className="gr-glass gr-card">
      <span className="gr-accent" style={{ background: SECTION_COLOR.retro }} />
      <HideButton onHide={onHide && (() => onHide(block.id))} />
      <div className="gr-eyebrow" style={{ color: SECTION_COLOR.retro }}>
        {t(`gr.retro.${block.bucket}`)}
      </div>
      <ul className="gr-bullets">
        {block.items.map((it) => (
          <li key={it.id}>
            <Ed id={`${block.id}.${it.id}`} value={it.text} edit={edit} multiline />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectionHead({ block, edit }: BlockProps & { block: Extract<Block, { kind: "section" }> }) {
  const { t } = useT();
  const color = SECTION_COLOR[block.key];
  return (
    <div className="gr-section">
      <div className="gr-eyebrow" style={{ color }}>
        {String(block.n).padStart(2, "0")} · {t(`gr.sec.${block.key}.eyebrow`)}
      </div>
      <div className="gr-section-row">
        <Ed tag="h2" id={`${block.id}.title`} value={t(`gr.sec.${block.key}.title`)} edit={edit} className="gr-h2" />
        <span className="gr-count gr-count-lg" style={{ color, background: `${color}17` }}>
          {block.count}
        </span>
      </div>
    </div>
  );
}

function BlockView(props: BlockProps) {
  const { block } = props;
  const { t } = useT();
  switch (block.kind) {
    case "section":
      return <SectionHead {...props} block={block} />;
    case "task":
      return <TaskCard {...props} block={block} />;
    case "project":
      return <ProjectCard {...props} block={block} />;
    case "retro":
      return <Retro {...props} block={block} />;
    case "empty":
      return <div className="gr-glass gr-empty">{t(`gr.sec.${block.key}.empty`)}</div>;
  }
}

// ---- Pages --------------------------------------------------------------------

function PageChrome({
  children,
  index,
  total,
  boardName,
  periodText,
  pageRef,
  landscape = false,
}: {
  children: React.ReactNode;
  index: number;
  total: number;
  boardName: string;
  periodText: string;
  pageRef: (el: HTMLDivElement | null) => void;
  landscape?: boolean;
}) {
  const { t } = useT();
  return (
    <div
      className={`gr-page gr-bg-${index % 4} ${landscape ? "gr-landscape" : ""}`}
      ref={pageRef}
      style={{ width: landscape ? PAGE_H : PAGE_W, height: landscape ? PAGE_W : PAGE_H }}
    >
      <div className="gr-blob gr-blob-a" />
      <div className="gr-blob gr-blob-b" />
      <div className="gr-blob gr-blob-c" />
      {index > 0 && (
        <div className="gr-header" style={{ left: PAD_X, right: PAD_X }}>
          <span className="gr-header-brand">
            <span className="gr-logo-dot" />
            {boardName}
          </span>
          <span className="gr-header-period">{periodText}</span>
        </div>
      )}
      {children}
      <div className="gr-footer" style={{ left: PAD_X, right: PAD_X }}>
        <span>{t("gr.footer")}</span>
        <span>
          {index + 1} / {total}
        </span>
      </div>
    </div>
  );
}

// The planner: always one landscape page, the four columns side by side. When
// the columns hold more than fits, the whole board is scaled down to fit.
const L_CONTENT_W = PAGE_H - PAD_X * 2;
const L_CONTENT_H = PAGE_W - HEAD - FOOT;

function PlannerPage({
  n,
  columns,
  edit,
  fmtDate,
}: {
  n: number;
  columns: PlannerColumn[];
  edit: EditCtx;
  fmtDate: (v: number | string) => string;
}) {
  const { t, lang } = useT();
  const boardRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const total = columns.reduce((a, c) => a + c.tasks.length, 0);

  useLayoutEffect(() => {
    const fit = () => {
      const el = boardRef.current;
      const head = headRef.current;
      if (!el || !head) return;
      const avail = L_CONTENT_H - head.offsetHeight - GAP;
      const natural = el.scrollHeight; // unaffected by the transform
      setScale(natural > avail ? Math.max(0.45, avail / natural) : 1);
    };
    fit();
    document.fonts?.ready.then(fit).catch(() => {});
  }, [columns, edit]);

  return (
    <div className="gr-content" style={{ left: PAD_X, top: HEAD, width: L_CONTENT_W, height: L_CONTENT_H }}>
      <div ref={headRef}>
        <SectionHead
          block={{ kind: "section", id: "sec.planner", key: "planner", n, count: total }}
          edit={edit}
          fmtDate={fmtDate}
        />
      </div>
      <div
        ref={boardRef}
        className="gr-planner"
        style={{
          marginTop: GAP,
          width: `${100 / scale}%`,
          transform: scale < 1 ? `scale(${scale})` : undefined,
          transformOrigin: "top left",
        }}
      >
        {columns.map((col) => {
          const color = STATUS_COLOR[col.status] ?? "#8E8E93";
          return (
            <div key={col.status} className="gr-glass gr-col">
              <div className="gr-band-head">
                <span className="gr-dot gr-dot-lg" style={{ background: color }} />
                <span className="gr-band-title">{statusLabel(lang, col.status)}</span>
                <span className="gr-count" style={{ color, background: `${color}17` }}>
                  {col.tasks.length}
                </span>
              </div>
              {col.tasks.length === 0 ? (
                <div className="gr-muted gr-col-empty">{t("gr.bandEmpty")}</div>
              ) : (
                <div className="gr-col-list">
                  {col.tasks.map((task) => (
                    <div key={task.id} className="gr-col-item">
                      <span className="gr-dot" style={{ background: PRIORITY_COLOR[task.priority], marginTop: 5 }} />
                      <div className="gr-col-text">
                        <Ed id={`plan.${task.id}`} value={task.title} edit={edit} className="gr-col-title" />
                        {task.dueDate && (
                          <span className="gr-col-meta">
                            {t("gr.due")} {fmtDate(task.dueDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Cover --------------------------------------------------------------------

/** Tasks that can be put in the cover's highlights, grouped as on the board. */
function highlightCandidates(board: Board, data: ReportData): { status: Status; tasks: Task[] }[] {
  const doneIds = new Set(data.done.map((r) => r.task.id));
  return [
    { status: "DONE" as Status, tasks: data.done.map((r) => r.task) },
    ...(["IN PROGRESS", "NEXT", "WAITING"] as Status[]).map((status) => ({
      status,
      tasks: board.tasks.filter((t) => t.status === status && !doneIds.has(t.id)),
    })),
  ].filter((g) => g.tasks.length > 0);
}

const MAX_HIGHLIGHTS = 8;

function HighlightPicker({
  groups,
  selected,
  onChange,
  onClose,
}: {
  groups: { status: Status; tasks: Task[] }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  onClose: () => void;
}) {
  const { t, lang } = useT();
  const toggle = (id: string) =>
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : selected.length < MAX_HIGHLIGHTS
          ? [...selected, id]
          : selected
    );
  return (
    <div className="gr-picker gr-noexport">
      <div className="gr-picker-head">
        <span>{t("gr.pick.title", { n: selected.length, max: MAX_HIGHLIGHTS })}</span>
        <button type="button" className="gr-picker-btn" onClick={onClose}>
          {t("gr.pick.done")}
        </button>
      </div>
      <div className="gr-picker-body">
        {groups.map((g) => (
          <div key={g.status} className="gr-picker-group">
            <div className="gr-picker-status">
              <span className="gr-dot" style={{ background: g.status === "DONE" ? "#34C759" : STATUS_COLOR[g.status] }} />
              {g.status === "DONE" ? t("gr.pick.doneGroup") : statusLabel(lang, g.status)}
            </div>
            {g.tasks.map((task) => {
              const on = selected.includes(task.id);
              return (
                <label key={task.id} className={`gr-picker-row ${on ? "gr-picker-on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={!on && selected.length >= MAX_HIGHLIGHTS}
                    onChange={() => toggle(task.id)}
                  />
                  <span className="gr-dot" style={{ background: PRIORITY_COLOR[task.priority] }} />
                  <span>{task.title}</span>
                </label>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function Cover({
  board,
  data,
  stats,
  periodText,
  edit,
  highlights,
  setHighlights,
}: {
  board: Board;
  data: ReportData;
  stats: CoverStats;
  periodText: string;
  edit: EditCtx;
  highlights: string[];
  setHighlights: (ids: string[]) => void;
}) {
  const { t } = useT();
  const [picking, setPicking] = useState(false);
  const groups = useMemo(() => highlightCandidates(board, data), [board, data]);
  const byId = useMemo(() => new Map(groups.flatMap((g) => g.tasks.map((task) => [task.id, task] as const))), [groups]);
  const chosen = highlights.map((id) => byId.get(id)).filter((x): x is Task => !!x);
  const doneIds = useMemo(() => new Set(data.done.map((r) => r.task.id)), [data]);

  const tiles: { k: string; v: number; c: string }[] = [
    { k: "gr.stat.done", v: stats.done, c: "#34C759" },
    { k: "gr.stat.subtasks", v: stats.subtasks, c: "#32ADE6" },
    { k: "gr.stat.inProgress", v: stats.inProgress, c: "#AF52DE" },
    { k: "gr.stat.next", v: stats.next, c: "#007AFF" },
    { k: "gr.stat.waiting", v: stats.waiting, c: "#FF9500" },
  ];
  return (
    <div className="gr-cover" style={{ left: PAD_X, right: PAD_X }}>
      <div className="gr-cover-top">
        <span className="gr-glass gr-period-pill">
          <span className="gr-logo-dot" />
          <Ed id="cover.board" value={board.boardName} edit={edit} />
        </span>
        <span className="gr-glass gr-period-pill">{periodText}</span>
      </div>

      <div className="gr-cover-title-wrap">
        <div className="gr-eyebrow gr-eyebrow-cover">{t("gr.cover.eyebrow")}</div>
        <Ed tag="h1" id="cover.title" value={t("gr.cover.title")} edit={edit} className="gr-h1" />
        <Ed tag="p" id="cover.subtitle" value={t("gr.cover.subtitle")} edit={edit} className="gr-lede" multiline />
      </div>

      <div className="gr-tiles gr-tiles-5">
        {tiles.map((tile) => (
          <div key={tile.k} className="gr-glass gr-tile">
            <span className="gr-tile-v" style={{ color: tile.c }}>
              {tile.v}
            </span>
            <span className="gr-tile-k">{t(tile.k)}</span>
          </div>
        ))}
      </div>

      <div className={`gr-glass gr-highlights ${chosen.length ? "" : "gr-noexport"}`}>
        <div className="gr-highlights-head">
          <span className="gr-eyebrow" style={{ color: "#34C759" }}>
            {t("gr.cover.highlights")}
          </span>
          {edit.enabled && (
            <button type="button" className="gr-picker-btn gr-noexport" onClick={() => setPicking((v) => !v)}>
              {t("gr.pick.open")}
            </button>
          )}
        </div>
        {chosen.length === 0 ? (
          <div className="gr-muted gr-noexport" style={{ marginTop: 10 }}>
            {t("gr.pick.empty")}
          </div>
        ) : (
          <ul>
            {chosen.map((task) => (
              <li key={task.id}>
                {doneIds.has(task.id) ? (
                  <Check done />
                ) : (
                  <span className="gr-hl-dot" style={{ background: STATUS_COLOR[task.status] ?? "#8E8E93" }} />
                )}
                <span>{edit.get(`task.${task.id}.title`) ?? edit.get(`next.${task.id}.title`) ?? task.title}</span>
              </li>
            ))}
          </ul>
        )}
        {picking && (
          <HighlightPicker
            groups={groups}
            selected={highlights}
            onChange={setHighlights}
            onClose={() => setPicking(false)}
          />
        )}
      </div>

      <div className="gr-glass gr-note">
        <div className="gr-eyebrow" style={{ color: "#007AFF" }}>
          {t("gr.cover.noteTitle")}
        </div>
        <Ed tag="p" id="cover.note" value={t("gr.cover.note")} edit={edit} className="gr-note-text" multiline />
      </div>
    </div>
  );
}

// ---- The report -----------------------------------------------------------------

export interface GlassReportProps {
  board: Board;
  data: ReportData;
  periodText: string;
  /** Filled with the page elements, in order, for the PDF export. */
  pagesRef: React.MutableRefObject<HTMLDivElement[]>;
}

// Pack measured blocks onto pages; returns block ids per page. A section
// heading always travels with its first card.
function pack(blocks: Block[], heights: Map<string, number>): string[][] {
  const pages: string[][] = [];
  let cur: string[] = [];
  let used = 0;
  blocks.forEach((b, i) => {
    const h = heights.get(b.id) ?? 0;
    const nextH = b.kind === "section" && i + 1 < blocks.length ? GAP + (heights.get(blocks[i + 1].id) ?? 0) : 0;
    if (cur.length && used + GAP + h + nextH > CONTENT_H) {
      pages.push(cur);
      cur = [];
      used = 0;
    }
    used += (cur.length ? GAP : 0) + h;
    cur.push(b.id);
  });
  if (cur.length) pages.push(cur);
  return pages;
}

export function GlassReport({ board, data, periodText, pagesRef }: GlassReportProps) {
  const { lang } = useT();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [highlights, setHighlights] = useState<string[]>(() =>
    [...data.done]
      .sort((a, b) => a.task.priority.localeCompare(b.task.priority))
      .slice(0, 4)
      .map((r) => r.task.id)
  );
  const [layout, setLayout] = useState<{ before: string[][]; after: string[][] } | null>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  const input = useMemo(() => buildBlocks(board, data, hidden), [board, data, hidden]);
  const all = useMemo(() => [...input.before, ...input.after], [input]);
  const byId = useMemo(() => new Map(all.map((b) => [b.id, b])), [all]);
  const stats = useMemo(() => coverStats(board, data), [board, data]);

  const fmtDate = useCallback(
    (v: number | string) => {
      const d =
        typeof v === "number"
          ? new Date(v)
          : (() => {
              const [y, m, dd] = v.split("-").map(Number);
              return new Date(y, m - 1, dd);
            })();
      return d.toLocaleDateString(lang === "it" ? "it-IT" : "en-GB", { day: "numeric", month: "short" });
    },
    [lang]
  );

  const edit: EditCtx = useMemo(
    () => ({
      enabled: true,
      get: (id) => edits[id],
      set: (id, text) => setEdits((e) => ({ ...e, [id]: text })),
    }),
    [edits]
  );
  const measureEdit: EditCtx = useMemo(() => ({ ...edit, enabled: false }), [edit]);
  const hide = useCallback((id: string) => setHidden((h) => new Set(h).add(id)), []);

  // Measure every block at page width and pack each run onto pages.
  useLayoutEffect(() => {
    let cancelled = false;
    const run = () => {
      const host = measureRef.current;
      if (!host || cancelled) return;
      const heights = new Map<string, number>();
      host.querySelectorAll<HTMLElement>(":scope > [data-block]").forEach((el) => {
        heights.set(el.dataset.block!, el.getBoundingClientRect().height);
      });
      setLayout({ before: pack(input.before, heights), after: pack(input.after, heights) });
    };
    run();
    document.fonts?.ready.then(run).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [input, edits]);

  // Page list: cover, portrait pages, the landscape planner, portrait pages.
  // Ids a stale layout still names but that are gone (just hidden) are skipped.
  const flowPages = (ids: string[][]) =>
    ids.map((page) => page.map((id) => byId.get(id)).filter((b): b is Block => !!b)).filter((p) => p.length);
  const before = layout ? flowPages(layout.before) : [];
  const after = layout ? flowPages(layout.after) : [];
  const total = 1 + before.length + 1 + after.length;
  const boardName = edits["cover.board"] ?? board.boardName;

  pagesRef.current = [];
  const setPage = (i: number) => (el: HTMLDivElement | null) => {
    if (el) pagesRef.current[i] = el;
  };

  const flow = (blocks: Block[], index: number) => (
    <PageChrome key={`p${index}`} index={index} total={total} boardName={boardName} periodText={periodText} pageRef={setPage(index)}>
      <div className="gr-content" style={{ left: PAD_X, top: HEAD, width: CONTENT_W, height: CONTENT_H }}>
        {blocks.map((b) => (
          <div key={b.id} className="gr-block">
            <BlockView block={b} edit={edit} fmtDate={fmtDate} onHide={hide} />
          </div>
        ))}
      </div>
    </PageChrome>
  );

  return (
    <div className="gr-root">
      {/* Off-screen copy used only to measure block heights. */}
      <div ref={measureRef} className="gr-measure" style={{ width: CONTENT_W }} aria-hidden>
        {all.map((b) => (
          <div key={b.id} data-block={b.id} className="gr-block">
            <BlockView block={b} edit={measureEdit} fmtDate={fmtDate} />
          </div>
        ))}
      </div>

      <div className="gr-pages">
        <PageChrome index={0} total={total} boardName={boardName} periodText={periodText} pageRef={setPage(0)}>
          <Cover
            board={board}
            data={data}
            stats={stats}
            periodText={periodText}
            edit={edit}
            highlights={highlights}
            setHighlights={setHighlights}
          />
        </PageChrome>
        {layout && (
          <>
            {before.map((blocks, i) => flow(blocks, 1 + i))}
            <PageChrome
              key="planner"
              index={1 + before.length}
              total={total}
              boardName={boardName}
              periodText={periodText}
              pageRef={setPage(1 + before.length)}
              landscape
            >
              <PlannerPage n={input.planner.n} columns={input.planner.columns} edit={edit} fmtDate={fmtDate} />
            </PageChrome>
            {after.map((blocks, i) => flow(blocks, 2 + before.length + i))}
          </>
        )}
      </div>
    </div>
  );
}
