import { useCallback, useRef, useState } from "react";
import type { Board, Op, Priority, Status, Task } from "../lib/types";
import { STATUS_ORDER, PRIORITY_ORDER, isArchived } from "../lib/constants";
import { priorityLabel, statusLabel, useT } from "../lib/i18n";
import { TaskCard } from "./TaskCard";
import { QuickAdd } from "./QuickAdd";
import { MembersBar } from "./MembersBar";
import { PriorityDistribution } from "./PriorityDistribution";
import { ListView } from "./ListView";
import {
  readHidden,
  writeHidden,
  readViewMode,
  writeViewMode,
  readWeights,
  writeWeights,
  type ViewMode,
} from "../lib/prefs";
import type { FilterState } from "./Filters";

interface Props {
  board: Board;
  members: string[];
  send: (op: Op) => void;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
}

const PRIOS: Priority[] = ["P1", "P2", "P3", "P4"];
const MIN_WEIGHT = 0.4;

export function BoardView({ board, members, send, filters, setFilters }: Props) {
  const { t, lang } = useT();
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(readHidden()));
  const [editorOpen, setEditorOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [archOpen, setArchOpen] = useState(false);
  const [archQuery, setArchQuery] = useState("");
  const [doneOpen, setDoneOpen] = useState(false);
  const [doneQuery, setDoneQuery] = useState("");
  const [view, setView] = useState<ViewMode>(() => readViewMode());
  const [editLayout, setEditLayout] = useState(false);
  const [weights, setWeights] = useState<Record<string, number>>(() => readWeights());
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Status | null>(null);

  const weightsRef = useRef(weights);
  weightsRef.current = weights;
  const containerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    left: Status;
    right: Status;
    startX: number;
    lwStart: number;
    rwStart: number;
    total: number;
    avail: number;
  } | null>(null);
  const pending = useRef<Record<string, number> | null>(null);

  const setViewPref = (v: ViewMode) => {
    setView(v);
    writeViewMode(v);
  };
  const toggleHidden = (s: Status) => {
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      writeHidden([...next]);
      return next;
    });
  };
  const getW = (s: string) => weightsRef.current[s] ?? 1;

  // Filter + priority-sort.
  const q = filters.search.trim().toLowerCase();
  const tasks: Task[] = board.tasks
    .filter((tk) => {
      const text = !q || tk.title.toLowerCase().includes(q) || tk.desc.toLowerCase().includes(q);
      const owner = filters.owner === "all" || tk.owner === filters.owner;
      const prio = filters.priority === "all" || tk.priority === filters.priority;
      const focus = !filters.focusP1 || tk.priority === "P1";
      return text && owner && prio && focus;
    })
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  const visibleCols = STATUS_ORDER.filter((s) => !hidden.has(s));
  const listTasks = tasks.filter((tk) => !hidden.has(tk.status));
  // Archive is self-contained: the whole archive (ignoring the board filters
  // above) with its own search box.
  const archivedAll = board.tasks.filter((tk) => isArchived(tk));
  const aq = archQuery.trim().toLowerCase();
  const archivedShown = aq
    ? archivedAll.filter(
        (tk) => tk.title.toLowerCase().includes(aq) || tk.desc.toLowerCase().includes(aq)
      )
    : archivedAll;

  // Done bar mirrors the DONE column (this week's completed) as a full-width
  // section with its own search, sitting above the Archived bar.
  const doneWeekAll = board.tasks.filter((tk) => tk.status === "DONE" && !isArchived(tk));
  const dq = doneQuery.trim().toLowerCase();
  const doneShown = dq
    ? doneWeekAll.filter(
        (tk) => tk.title.toLowerCase().includes(dq) || tk.desc.toLowerCase().includes(dq)
      )
    : doneWeekAll;

  const drop = (status: Status) => {
    if (dragId) send({ type: "moveTask", id: dragId, status });
    setDragId(null);
    setOverCol(null);
  };

  // ---- Column resize (edit mode) --------------------------------------------
  // Convert the cumulative pixel drag into a weight delta using the widths at
  // drag START (never the already-moved weights), so the boundary tracks the
  // cursor 1:1 instead of compounding.
  const onMove = useCallback((e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const sum = d.lwStart + d.rwStart; // conserved between the two columns
    // pixels-per-weight for these two columns at their combined width
    const combinedPx = (sum / d.total) * d.avail;
    let dw = combinedPx > 0 ? ((e.clientX - d.startX) / combinedPx) * sum : 0;
    // clamp so neither column drops below the minimum weight
    dw = Math.max(-(d.lwStart - MIN_WEIGHT), Math.min(d.rwStart - MIN_WEIGHT, dw));
    const next = { ...weightsRef.current, [d.left]: d.lwStart + dw, [d.right]: d.rwStart - dw };
    pending.current = next;
    setWeights(next);
  }, []);
  const onUp = useCallback(() => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    if (pending.current) writeWeights(pending.current);
    drag.current = null;
  }, [onMove]);
  const startResize = (e: React.PointerEvent, left: Status, right: Status) => {
    e.preventDefault();
    e.stopPropagation();
    const width = containerRef.current?.clientWidth ?? 1;
    const gaps = Math.max(0, visibleCols.length - 1) * 12; // gap-3 between columns
    const avail = Math.max(1, width - gaps);
    const total = visibleCols.reduce((s, st) => s + getW(st), 0);
    drag.current = {
      left,
      right,
      startX: e.clientX,
      lwStart: getW(left),
      rwStart: getW(right),
      total,
      avail,
    };
    pending.current = { ...weightsRef.current };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const resetWidths = () => {
    setWeights({});
    writeWeights({});
  };

  const filtersActive = q || filters.owner !== "all" || filters.priority !== "all" || filters.focusP1;
  const control = "h-9 rounded-full bg-white border border-[#E8E6E1] text-[13px] outline-none focus:border-[#C9A96E]";

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-3">
        <div className="font-trajan text-[10px] uppercase tracking-widest text-[#8A8A8A] mb-2 flex items-center gap-1.5">
          <span>⌕</span> {t("filters.section")}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Board / List toggle */}
          <div className="inline-flex items-center rounded-full border border-[#E8E6E1] bg-[#F5F3EF] p-0.5">
            {(["board", "list"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setViewPref(v)}
                className={`h-8 px-3 rounded-full text-[11px] font-semibold ${
                  view === v ? "bg-[#0A1931] text-[#C9A96E]" : "text-[#6B6B6B]"
                }`}
              >
                {t(`view.${v}`)}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[160px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E] text-[13px]">⌕</span>
            <input
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder={t("filters.search")}
              className={`${control} w-full pl-8 pr-4`}
            />
          </div>
          <select value={filters.owner} onChange={(e) => setFilters((f) => ({ ...f, owner: e.target.value }))} className={`${control} px-3`}>
            <option value="all">{t("filters.allMembers")}</option>
            <option value="Unassigned">{t("members.unassigned")}</option>
            {members.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select value={filters.priority} onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))} className={`${control} px-3`}>
            <option value="all">{t("filters.allPriorities")}</option>
            {PRIOS.map((p) => (
              <option key={p} value={p}>{priorityLabel(t, p)}</option>
            ))}
          </select>
          <button
            onClick={() => setFilters((f) => ({ ...f, focusP1: !f.focusP1 }))}
            className={`h-9 px-4 rounded-full text-[12px] font-semibold border transition-colors ${
              filters.focusP1 ? "bg-[#DC2626] text-white border-[#DC2626]" : "bg-white text-[#DC2626] border-[#FECACA] hover:border-[#DC2626]"
            }`}
          >
            {t("filters.focusP1")}
          </button>
          {filtersActive && (
            <button
              onClick={() => setFilters({ search: "", owner: "all", priority: "all", focusP1: false })}
              className="h-9 px-4 rounded-full text-[12px] font-semibold bg-white text-[#8A8A8A] border border-[#E8E6E1] hover:border-[#C9A96E]"
            >
              {t("filters.reset")}
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setTeamOpen((o) => !o)}
              className={`h-9 px-4 rounded-full text-[12px] font-semibold border transition-colors inline-flex items-center gap-1.5 ${
                teamOpen ? "bg-[#0A1931] text-[#C9A96E] border-[#0A1931]" : "bg-white text-[#0A1931] border-[#E8E6E1] hover:border-[#C9A96E]"
              }`}
            >
              👥 {t("team.button")}
              <span className="text-[10px] bg-[#C9A96E] text-[#0A1931] rounded-full px-1.5 py-0.5">{board.members.length}</span>
            </button>
            {view === "board" && (
              <button
                onClick={() => setEditLayout((e) => !e)}
                className={`h-9 px-4 rounded-full text-[12px] font-semibold border transition-colors ${
                  editLayout ? "bg-[#C9A96E] text-[#0A1931] border-[#C9A96E]" : "bg-white text-[#0A1931] border-[#E8E6E1] hover:border-[#C9A96E]"
                }`}
              >
                {editLayout ? t("view.editLayoutOn") : t("view.editLayout")}
              </button>
            )}
            <button
              onClick={() => setEditorOpen((o) => !o)}
              className={`h-9 px-4 rounded-full text-[12px] font-semibold border transition-colors inline-flex items-center gap-1.5 ${
                editorOpen ? "bg-[#0A1931] text-[#C9A96E] border-[#0A1931]" : "bg-white text-[#0A1931] border-[#E8E6E1] hover:border-[#C9A96E]"
              }`}
            >
              ▦ {t("view.columns")}
              {hidden.size > 0 && (
                <span className="text-[10px] bg-[#C9A96E] text-[#0A1931] rounded-full px-1.5 py-0.5">
                  {visibleCols.length}/{STATUS_ORDER.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {editorOpen && (
          <div className="mt-3 pt-3 border-t border-[#E8E6E1]">
            <div className="text-[10px] uppercase tracking-widest text-[#8A8A8A] mb-2">{t("view.columnsHint")}</div>
            <div className="flex flex-wrap gap-2">
              {STATUS_ORDER.map((s) => {
                const shown = !hidden.has(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggleHidden(s)}
                    className={`h-8 px-3 rounded-full text-[12px] font-semibold border inline-flex items-center gap-1.5 transition-colors ${
                      shown ? "bg-[#0A1931] text-[#C9A96E] border-[#0A1931]" : "bg-white text-[#A8A29E] border-[#E8E6E1] line-through"
                    }`}
                  >
                    <span>{shown ? "◉" : "◯"}</span>
                    {statusLabel(lang, s)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {editLayout && view === "board" && (
          <div className="mt-3 pt-3 border-t border-[#E8E6E1] flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[11px] text-[#8B6F3E]">{t("view.editHint")}</span>
            <button onClick={resetWidths} className="h-8 px-3 rounded-full text-[11px] font-semibold bg-white text-[#8A8A8A] border border-[#E8E6E1] hover:border-[#C9A96E]">
              {t("view.resetWidths")}
            </button>
          </div>
        )}
      </div>

      {/* Team panel (collapsed by default to declutter the top) */}
      {teamOpen && (
        <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-3">
          <MembersBar board={board} send={send} />
        </div>
      )}

      {/* New-task row — visually distinct from the search/filter row above */}
      <div className="rounded-[14px] border border-[#C9A96E]/40 bg-[#FBF6EC] p-3">
        <div className="font-trajan text-[10px] uppercase tracking-widest text-[#8B6F3E] mb-2 flex items-center gap-1.5">
          <span>＋</span> {t("quick.section")}
        </div>
        <QuickAdd members={members} send={send} />
      </div>

      {/* Priority distribution — its own space */}
      <PriorityDistribution tasks={board.tasks} />

      {view === "list" ? (
        <ListView tasks={listTasks} members={members} send={send} />
      ) : (
        <>
          <p className="text-[12px] text-[#6B6B6B]">{t("board.help")}</p>
          <div
            ref={containerRef}
            onDragLeave={(e) => {
              // Clear the highlight only when the cursor actually leaves the board.
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null);
            }}
            className="flex flex-wrap gap-3 items-start"
          >
            {visibleCols.map((status, i) => {
              const colTasks = tasks.filter((tk) => tk.status === status && !isArchived(tk));
              const isLast = i === visibleCols.length - 1;
              return (
                <div
                  key={status}
                  onDragEnter={(e) => {
                    if (dragId) {
                      e.preventDefault();
                      setOverCol(status);
                    }
                  }}
                  onDragOver={(e) => {
                    if (!dragId) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (overCol !== status) setOverCol(status);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    drop(status);
                  }}
                  style={{ flexGrow: getW(status), flexShrink: 1, flexBasis: 0, minWidth: 136, minHeight: 140 }}
                  className={`relative rounded-[14px] p-2 transition-colors ${
                    overCol === status ? "drop-target" : "bg-[#EFECE6]"
                  } ${editLayout ? "ring-1 ring-[#C9A96E]/40" : ""}`}
                >
                  <div className="flex items-center justify-between px-2 py-2 gap-2">
                    <div className="min-w-0">
                      <div className="font-trajan text-[12px] uppercase tracking-wide text-[#0A1931]">
                        {statusLabel(lang, status)}
                      </div>
                      <div className="text-[10px] text-[#8A8A8A] truncate">{t(`status.${status}.help`)}</div>
                    </div>
                    <span className="shrink-0 text-[11px] font-semibold text-[#8A8A8A] bg-white rounded-full px-2 py-0.5 border border-[#E8E6E1]">
                      {colTasks.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {colTasks.map((tk) => (
                      <TaskCard
                        key={tk.id}
                        task={tk}
                        members={members}
                        send={send}
                        draggable={!editLayout}
                        onDragStart={(e) => {
                          setDragId(tk.id);
                          e.dataTransfer.setData("text/plain", tk.id);
                          e.dataTransfer.effectAllowed = "move";
                          (e.currentTarget as HTMLElement).classList.add("dragging");
                        }}
                        onDragEnd={(e) => {
                          (e.currentTarget as HTMLElement).classList.remove("dragging");
                          setDragId(null);
                          setOverCol(null);
                        }}
                      />
                    ))}
                    {colTasks.length === 0 && (
                      <div className="text-[11px] text-[#A8A29E] text-center py-6">
                        {status === "DONE" ? t("col.emptyDone") : t("col.empty")}
                      </div>
                    )}
                  </div>

                  {/* Resize handle (edit mode, between this column and the next) */}
                  {editLayout && !isLast && (
                    <div
                      onPointerDown={(e) => startResize(e, status, visibleCols[i + 1])}
                      title={t("view.editLayout")}
                      className="absolute top-0 right-[-8px] h-full w-4 flex items-center justify-center cursor-col-resize z-10"
                    >
                      <div className="w-1.5 h-12 rounded-full bg-[#C9A96E]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Done — this week's completed DONE tasks, mirroring the DONE column
              as a full-width searchable bar (a duplicate view, not a move). */}
          <div className="bg-[#EFECE6] rounded-[14px] border border-[#E3DFD7] p-3">
            <button
              onClick={() => setDoneOpen((o) => !o)}
              className="w-full flex items-center gap-2 text-left"
            >
              <span className={`text-[#8A8A8A] text-[11px] transition-transform ${doneOpen ? "rotate-90" : ""}`}>▶</span>
              <span className="font-trajan text-[11px] uppercase tracking-widest text-[#8A8A8A]">
                {t("doneBar.title")}
              </span>
              <span className="text-[11px] font-semibold text-[#8A8A8A] bg-white rounded-full px-2 py-0.5 border border-[#E8E6E1]">
                {doneWeekAll.length}
              </span>
              <span className="text-[10px] text-[#A8A29E] ml-1 hidden sm:inline">{t("doneBar.hint")}</span>
            </button>
            {doneOpen && (
              <div className="mt-3 space-y-3">
                <div className="relative max-w-[320px]">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E] text-[13px]">⌕</span>
                  <input
                    value={doneQuery}
                    onChange={(e) => setDoneQuery(e.target.value)}
                    placeholder={t("doneBar.search")}
                    className="w-full h-9 rounded-full bg-white border border-[#E8E6E1] pl-8 pr-4 text-[13px] outline-none focus:border-[#C9A96E]"
                  />
                </div>
                {doneShown.length === 0 ? (
                  <div className="text-[12px] text-[#A8A29E] py-2">{t("doneBar.none")}</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                    {doneShown.map((tk) => (
                      <TaskCard
                        key={tk.id}
                        task={tk}
                        members={members}
                        send={send}
                        draggable={!editLayout}
                        onDragStart={(e) => {
                          setDragId(tk.id);
                          e.dataTransfer.setData("text/plain", tk.id);
                          e.dataTransfer.effectAllowed = "move";
                          (e.currentTarget as HTMLElement).classList.add("dragging");
                        }}
                        onDragEnd={(e) => {
                          (e.currentTarget as HTMLElement).classList.remove("dragging");
                          setDragId(null);
                          setOverCol(null);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Archived — DONE tasks completed more than a week ago (always shown) */}
          <div className="bg-[#EFECE6] rounded-[14px] border border-[#E3DFD7] p-3">
            <button
              onClick={() => setArchOpen((o) => !o)}
              className="w-full flex items-center gap-2 text-left"
            >
              <span className={`text-[#8A8A8A] text-[11px] transition-transform ${archOpen ? "rotate-90" : ""}`}>▶</span>
              <span className="font-trajan text-[11px] uppercase tracking-widest text-[#8A8A8A]">
                {t("archived.title")}
              </span>
              <span className="text-[11px] font-semibold text-[#8A8A8A] bg-white rounded-full px-2 py-0.5 border border-[#E8E6E1]">
                {archivedAll.length}
              </span>
              <span className="text-[10px] text-[#A8A29E] ml-1 hidden sm:inline">{t("archived.hint")}</span>
            </button>
            {archOpen && (
              <div className="mt-3 space-y-3">
                <div className="relative max-w-[320px]">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E] text-[13px]">⌕</span>
                  <input
                    value={archQuery}
                    onChange={(e) => setArchQuery(e.target.value)}
                    placeholder={t("archived.search")}
                    className="w-full h-9 rounded-full bg-white border border-[#E8E6E1] pl-8 pr-4 text-[13px] outline-none focus:border-[#C9A96E]"
                  />
                </div>
                {archivedShown.length === 0 ? (
                  <div className="text-[12px] text-[#A8A29E] py-2">{t("archived.none")}</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                    {archivedShown.map((tk) => (
                      <TaskCard
                        key={tk.id}
                        task={tk}
                        members={members}
                        send={send}
                        draggable={!editLayout}
                        onDragStart={(e) => {
                          setDragId(tk.id);
                          e.dataTransfer.setData("text/plain", tk.id);
                          e.dataTransfer.effectAllowed = "move";
                          (e.currentTarget as HTMLElement).classList.add("dragging");
                        }}
                        onDragEnd={(e) => {
                          (e.currentTarget as HTMLElement).classList.remove("dragging");
                          setDragId(null);
                          setOverCol(null);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
