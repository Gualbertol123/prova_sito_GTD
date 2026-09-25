import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Board, Priority, Project, Status, Subtask, Task } from "../lib/types";
import type { PlannerColumn, ReportData } from "../lib/reportData";
import { statusLabel, useT } from "../lib/i18n";
import {
  PRIORITY_COLOR,
  STATUS_COLOR,
  SECTION_COLOR,
  buildBlocks,
  coverStats,
  type Block,
  reportPdfName,
  type CoverStats,
} from "../lib/glassReportModel";
import { buildReportDoc, type ReportDoc } from "../lib/reportDoc";
import { shortDate } from "../lib/dates";

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
  style,
  placeholder = "…",
}: {
  id: string;
  value: string;
  edit: EditCtx;
  className?: string;
  multiline?: boolean;
  tag?: "span" | "div" | "h1" | "h2" | "h3" | "p";
  style?: React.CSSProperties;
  placeholder?: string;
}) {
  const text = edit.get(id) ?? value;
  return (
    <Tag
      // Re-mounted when the stored text changes, so React never fights the
      // browser over what contentEditable put in the DOM.
      key={text}
      className={`gr-ed ${className}`}
      data-ed-id={id}
      contentEditable={edit.enabled}
      suppressContentEditableWarning
      spellCheck={false}
      data-placeholder={placeholder}
      style={style}
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

function PriorityPill({ p, id, edit }: { p: Priority; id: string; edit: EditCtx }) {
  return (
    <span className="gr-pill" style={{ color: PRIORITY_COLOR[p], background: `${PRIORITY_COLOR[p]}17` }}>
      <span className="gr-dot" style={{ background: PRIORITY_COLOR[p] }} />
      <Ed id={id} value={p} edit={edit} />
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

function Subtasks({ id, task, edit, limit = 8 }: { id: string; task: Task; edit: EditCtx; limit?: number }) {
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
      {subs.length > limit && (
        <li className="gr-more">
          <Ed id={`${id}.more`} value={t("gr.more", { n: subs.length - limit })} edit={edit} />
        </li>
      )}
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
        <PriorityPill p={task.priority} id={`${block.id}.prio`} edit={edit} />
        <Ed
          id={`${block.id}.meta`}
          className="gr-meta"
          edit={edit}
          value={
            block.mode === "done" && block.completedAt
              ? `✓ ${t("gr.completedOn")} ${fmtDate(block.completedAt)}`
              : task.dueDate
                ? `${t("gr.due")} ${fmtDate(task.dueDate)}`
                : ""
          }
        />
      </div>
      <Ed tag="h3" id={`${block.id}.title`} value={task.title} edit={edit} className="gr-card-title" />
      {(edit.get(`${block.id}.desc`) ?? task.desc) && (
        <Ed tag="p" id={`${block.id}.desc`} value={task.desc} edit={edit} className="gr-card-desc" multiline />
      )}
      {subs.length > 0 && (
        <div className="gr-progress-row">
          <Bar value={doneSubs / subs.length} color={accent} />
          <Ed id={`${block.id}.progress`} className="gr-progress-label" value={`${doneSubs}/${subs.length}`} edit={edit} />
        </div>
      )}
      <Subtasks id={block.id} task={task} edit={edit} />
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
        <Ed id={`${block.id}.pct`} className="gr-big-pct gr-gradtext" value={`${Math.round(share * 100)}%`} edit={edit} />
      </div>
      <div className="gr-progress-row">
        <Bar value={share} color="linear-gradient(90deg,#5856D6,#AF52DE)" />
        <Ed id={`${block.id}.progress`} className="gr-progress-label" value={`${done}/${p.items.length}`} edit={edit} />
      </div>
      {p.items.length > 0 && (
        <ul className="gr-subs gr-subs-2col">
          {p.items.slice(0, limit).map((it) => (
            <li key={it.id} className={it.done ? "gr-sub-done" : ""}>
              <Check done={it.done} />
              <Ed id={`${block.id}.item.${it.id}`} value={it.text} edit={edit} />
            </li>
          ))}
          {p.items.length > limit && (
            <li className="gr-more">
              <Ed id={`${block.id}.more`} value={t("gr.more", { n: p.items.length - limit })} edit={edit} />
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function Retro({ block, edit, onHide }: BlockProps & { block: Extract<Block, { kind: "retro" }> }) {
  const { t } = useT();
  const freeId = `${block.id}.text`;
  // A bucket with nothing in the Weekly tab is a blank box to write in; left
  // blank, it stays out of the PDF.
  const blank = block.items.length === 0 && !(edit.get(freeId) ?? "").trim();
  return (
    <div className={`gr-glass gr-card ${blank ? "gr-noexport gr-blank" : ""}`}>
      <span className="gr-accent" style={{ background: SECTION_COLOR.retro }} />
      <HideButton onHide={onHide && (() => onHide(block.id))} />
      <Ed
        tag="div"
        id={`${block.id}.label`}
        value={t(`gr.retro.${block.bucket}`)}
        edit={edit}
        className="gr-eyebrow"
        style={{ color: SECTION_COLOR.retro }}
      />
      {block.items.length > 0 ? (
        <ul className="gr-bullets">
          {block.items.map((it) => (
            <li key={it.id}>
              <Ed id={`${block.id}.${it.id}`} value={it.text} edit={edit} multiline />
            </li>
          ))}
        </ul>
      ) : (
        <Ed tag="p" id={freeId} value="" edit={edit} multiline className="gr-retro-free" placeholder={t("gr.retro.write")} />
      )}
    </div>
  );
}

function SectionHead({ block, edit }: BlockProps & { block: Extract<Block, { kind: "section" }> }) {
  const { t } = useT();
  const color = SECTION_COLOR[block.key];
  return (
    <div className="gr-section">
      <Ed
        tag="div"
        id={`${block.id}.eyebrow`}
        value={`${String(block.n).padStart(2, "0")} · ${t(`gr.sec.${block.key}.eyebrow`)}`}
        edit={edit}
        className="gr-eyebrow"
        style={{ color }}
      />
      <div className="gr-section-row">
        <Ed tag="h2" id={`${block.id}.title`} value={t(`gr.sec.${block.key}.title`)} edit={edit} className="gr-h2" />
        <Ed
          id={`${block.id}.count`}
          value={String(block.count)}
          edit={edit}
          className="gr-count gr-count-lg"
          style={{ color, background: `${color}17` }}
        />
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
      return (
        <div className="gr-glass gr-empty">
          <Ed id={block.id} value={t(`gr.sec.${block.key}.empty`)} edit={props.edit} multiline />
        </div>
      );
  }
}

// ---- Pages --------------------------------------------------------------------

function PageChrome({
  children,
  index,
  total,
  boardName,
  periodText,
  landscape = false,
  edit,
}: {
  children: React.ReactNode;
  index: number;
  total: number;
  boardName: string;
  periodText: string;
  landscape?: boolean;
  edit: EditCtx;
}) {
  const { t } = useT();
  return (
    <div
      className={`gr-page gr-bg-${index % 4} ${landscape ? "gr-landscape" : ""}`}
      style={{ width: landscape ? PAGE_H : PAGE_W, height: landscape ? PAGE_W : PAGE_H }}
    >
      <div className="gr-blob gr-blob-a" />
      <div className="gr-blob gr-blob-b" />
      <div className="gr-blob gr-blob-c" />
      {index > 0 && (
        <div className="gr-header" style={{ left: PAD_X, right: PAD_X }}>
          <span className="gr-header-brand">
            <span className="gr-logo-dot" />
            <Ed id="cover.board" value={boardName} edit={edit} />
          </span>
          <Ed id="page.period" value={periodText} edit={edit} className="gr-header-period" />
        </div>
      )}
      {children}
      <div className="gr-footer" style={{ left: PAD_X, right: PAD_X }}>
        <Ed id="page.footer" value={t("gr.footer")} edit={edit} />
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
  hidden,
  onHide,
}: {
  n: number;
  columns: PlannerColumn[];
  edit: EditCtx;
  fmtDate: (v: number | string) => string;
  hidden: Set<string>;
  onHide: (id: string) => void;
}) {
  const { t, lang } = useT();
  const boardRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  // Tasks taken off the board with their × are left out.
  const shown = useMemo(
    () => columns.map((c) => ({ ...c, tasks: c.tasks.filter((task) => !hidden.has(`plan.${task.id}`)) })),
    [columns, hidden]
  );
  const total = shown.reduce((a, c) => a + c.tasks.length, 0);

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
  }, [shown, edit]);

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
        {shown.map((col) => {
          const color = STATUS_COLOR[col.status] ?? "#8E8E93";
          return (
            <div key={col.status} className="gr-glass gr-col">
              <div className="gr-band-head">
                <span className="gr-dot gr-dot-lg" style={{ background: color }} />
                <Ed id={`plan.col.${col.status}`} value={statusLabel(lang, col.status)} edit={edit} className="gr-band-title" />
                <Ed
                  id={`plan.col.${col.status}.count`}
                  value={String(col.tasks.length)}
                  edit={edit}
                  className="gr-count"
                  style={{ color, background: `${color}17` }}
                />
              </div>
              {col.tasks.length === 0 ? (
                <Ed tag="div" id={`plan.col.${col.status}.empty`} value={t("gr.bandEmpty")} edit={edit} className="gr-muted gr-col-empty" />
              ) : (
                <div className="gr-col-list">
                  {col.tasks.map((task) => (
                    <div key={task.id} className="gr-col-item">
                      <button
                        type="button"
                        className="gr-item-hide gr-noexport"
                        title={t("gr.hide")}
                        onClick={() => onHide(`plan.${task.id}`)}
                      >
                        ×
                      </button>
                      <span className="gr-dot" style={{ background: PRIORITY_COLOR[task.priority], marginTop: 5 }} />
                      <div className="gr-col-text">
                        <Ed id={`plan.${task.id}`} value={task.title} edit={edit} className="gr-col-title" />
                        {task.dueDate && (
                          <Ed
                            id={`plan.${task.id}.due`}
                            value={`${t("gr.due")} ${fmtDate(task.dueDate)}`}
                            edit={edit}
                            className="gr-col-meta"
                          />
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
        <span className="gr-glass gr-period-pill">
          <Ed id="page.period" value={periodText} edit={edit} />
        </span>
      </div>

      <div className="gr-cover-title-wrap">
        <Ed tag="div" id="cover.eyebrow" value={t("gr.cover.eyebrow")} edit={edit} className="gr-eyebrow gr-eyebrow-cover" />
        <Ed tag="h1" id="cover.title" value={t("gr.cover.title")} edit={edit} className="gr-h1 gr-gradtext" />
        <Ed tag="p" id="cover.subtitle" value={t("gr.cover.subtitle")} edit={edit} className="gr-lede" multiline />
      </div>

      <div className="gr-tiles gr-tiles-5">
        {tiles.map((tile) => (
          <div key={tile.k} className="gr-glass gr-tile">
            <Ed id={`${tile.k}.v`} value={String(tile.v)} edit={edit} className="gr-tile-v" style={{ color: tile.c }} />
            <Ed id={`${tile.k}.k`} value={t(tile.k)} edit={edit} className="gr-tile-k" />
          </div>
        ))}
      </div>

      <div className={`gr-glass gr-highlights ${chosen.length ? "" : "gr-noexport"}`}>
        <div className="gr-highlights-head">
          <Ed id="cover.highlightsTitle" value={t("gr.cover.highlights")} edit={edit} className="gr-eyebrow" style={{ color: "#34C759" }} />
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
                <Ed
                  id={`hl.${task.id}`}
                  value={edit.get(`task.${task.id}.title`) ?? edit.get(`next.${task.id}.title`) ?? task.title}
                  edit={edit}
                />
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
        <Ed tag="div" id="cover.noteTitle" value={t("gr.cover.noteTitle")} edit={edit} className="gr-eyebrow" style={{ color: "#007AFF" }} />
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
  /** Set to a function that returns the report as data, for the server PDF. */
  docRef: React.MutableRefObject<(() => ReportDoc) | null>;
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

export function GlassReport({ board, data, periodText, docRef }: GlassReportProps) {
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
  const rootRef = useRef<HTMLDivElement>(null);

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
      return shortDate(d, lang);
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

  docRef.current = () =>
    buildReportDoc({
      root: rootRef.current!,
      board,
      data,
      input,
      hidden,
      highlights,
      edits,
      fileName: reportPdfName(data),
    });

  const flow = (blocks: Block[], index: number) => (
    <PageChrome key={`p${index}`} index={index} total={total} boardName={boardName} periodText={periodText} edit={edit}>
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
    <div className="gr-root" ref={rootRef}>
      {/* Off-screen copy used only to measure block heights. */}
      <div ref={measureRef} className="gr-measure" style={{ width: CONTENT_W }} aria-hidden>
        {all.map((b) => (
          <div key={b.id} data-block={b.id} className="gr-block">
            <BlockView block={b} edit={measureEdit} fmtDate={fmtDate} />
          </div>
        ))}
      </div>

      <div className="gr-pages">
        <PageChrome index={0} total={total} boardName={boardName} periodText={periodText} edit={edit}>
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
              landscape
              edit={edit}
            >
              <PlannerPage
                n={input.planner.n}
                columns={input.planner.columns}
                edit={edit}
                fmtDate={fmtDate}
                hidden={hidden}
                onHide={hide}
              />
            </PageChrome>
            {after.map((blocks, i) => flow(blocks, 2 + before.length + i))}
          </>
        )}
      </div>
    </div>
  );
}
