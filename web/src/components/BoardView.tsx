import { useState } from "react";
import type { Board, Op, Priority, Status, Task } from "../lib/types";
import { STATUS_ORDER, PRIORITY_ORDER } from "../lib/constants";
import { priorityLabel, statusLabel, useT } from "../lib/i18n";
import { TaskCard } from "./TaskCard";
import { QuickAdd } from "./QuickAdd";
import { MembersBar } from "./MembersBar";
import { PriorityDistribution } from "./PriorityDistribution";
import { readHidden, writeHidden } from "../lib/prefs";
import type { FilterState } from "./Filters";

interface Props {
  board: Board;
  members: string[];
  send: (op: Op) => void;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
}

const PRIOS: Priority[] = ["P1", "P2", "P3", "P4"];

export function BoardView({ board, members, send, filters, setFilters }: Props) {
  const { t, lang } = useT();
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(readHidden()));
  const [editorOpen, setEditorOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Status | null>(null);

  const toggleHidden = (s: Status) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      writeHidden([...next]);
      return next;
    });
  };

  // Filter + priority-sort.
  const q = filters.search.trim().toLowerCase();
  const tasks: Task[] = board.tasks
    .filter((tk) => {
      const text =
        !q || tk.title.toLowerCase().includes(q) || tk.desc.toLowerCase().includes(q);
      const owner = filters.owner === "all" || tk.owner === filters.owner;
      const prio = filters.priority === "all" || tk.priority === filters.priority;
      const focus = !filters.focusP1 || tk.priority === "P1";
      return text && owner && prio && focus;
    })
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  const visibleCols = STATUS_ORDER.filter((s) => !hidden.has(s));

  const drop = (status: Status) => {
    if (dragId) send({ type: "moveTask", id: dragId, status });
    setDragId(null);
    setOverCol(null);
  };

  const filtersActive =
    q || filters.owner !== "all" || filters.priority !== "all" || filters.focusP1;

  const control =
    "h-9 rounded-full bg-white border border-[#E8E6E1] text-[13px] outline-none focus:border-[#C9A96E]";

  return (
    <div className="space-y-4">
      {/* Toolbar: search + filters + columns editor */}
      <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E] text-[13px]">⌕</span>
            <input
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder={t("filters.search")}
              className={`${control} w-full pl-8 pr-4`}
            />
          </div>
          <select
            value={filters.owner}
            onChange={(e) => setFilters((f) => ({ ...f, owner: e.target.value }))}
            className={`${control} px-3`}
          >
            <option value="all">{t("filters.allMembers")}</option>
            <option value="Unassigned">{t("members.unassigned")}</option>
            {members.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select
            value={filters.priority}
            onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
            className={`${control} px-3`}
          >
            <option value="all">{t("filters.allPriorities")}</option>
            {PRIOS.map((p) => (
              <option key={p} value={p}>{priorityLabel(t, p)}</option>
            ))}
          </select>
          <button
            onClick={() => setFilters((f) => ({ ...f, focusP1: !f.focusP1 }))}
            className={`h-9 px-4 rounded-full text-[12px] font-semibold border transition-colors ${
              filters.focusP1
                ? "bg-[#DC2626] text-white border-[#DC2626]"
                : "bg-white text-[#DC2626] border-[#FECACA] hover:border-[#DC2626]"
            }`}
          >
            {t("filters.focusP1")}
          </button>
          {filtersActive && (
            <button
              onClick={() =>
                setFilters({ search: "", owner: "all", priority: "all", focusP1: false })
              }
              className="h-9 px-4 rounded-full text-[12px] font-semibold bg-white text-[#8A8A8A] border border-[#E8E6E1] hover:border-[#C9A96E]"
            >
              {t("filters.reset")}
            </button>
          )}

          <button
            onClick={() => setEditorOpen((o) => !o)}
            className={`ml-auto h-9 px-4 rounded-full text-[12px] font-semibold border transition-colors inline-flex items-center gap-1.5 ${
              editorOpen
                ? "bg-[#0A1931] text-[#C9A96E] border-[#0A1931]"
                : "bg-white text-[#0A1931] border-[#E8E6E1] hover:border-[#C9A96E]"
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

        {/* Inline columns editor (no popup) */}
        {editorOpen && (
          <div className="mt-3 pt-3 border-t border-[#E8E6E1]">
            <div className="text-[10px] uppercase tracking-widest text-[#8A8A8A] mb-2">
              {t("view.columnsHint")}
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_ORDER.map((s) => {
                const shown = !hidden.has(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggleHidden(s)}
                    className={`h-8 px-3 rounded-full text-[12px] font-semibold border inline-flex items-center gap-1.5 transition-colors ${
                      shown
                        ? "bg-[#0A1931] text-[#C9A96E] border-[#0A1931]"
                        : "bg-white text-[#A8A29E] border-[#E8E6E1] line-through"
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
      </div>

      {/* Quick add */}
      <QuickAdd members={members} send={send} />

      {/* Team + priority distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
        <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-3">
          <MembersBar board={board} send={send} />
        </div>
        <PriorityDistribution tasks={board.tasks} />
      </div>

      <p className="text-[12px] text-[#6B6B6B]">{t("board.help")}</p>

      {/* Columns — edge to edge, wrap instead of horizontal scroll */}
      <div className="flex flex-wrap gap-3 items-start">
        {visibleCols.map((status) => {
          const colTasks = tasks.filter((tk) => tk.status === status);
          return (
            <div
              key={status}
              onDragOver={(e) => {
                e.preventDefault();
                setOverCol(status);
              }}
              onDragLeave={() => setOverCol((c) => (c === status ? null : c))}
              onDrop={() => drop(status)}
              className={`grow shrink basis-[200px] min-w-[190px] rounded-[14px] bg-[#EFECE6] p-2 ${
                overCol === status ? "drop-target" : ""
              }`}
            >
              <div className="flex items-center justify-between px-2 py-2 gap-2">
                <div className="min-w-0">
                  <div className="font-trajan text-[12px] uppercase tracking-wide text-[#0A1931]">
                    {statusLabel(lang, status)}
                  </div>
                  <div className="text-[10px] text-[#8A8A8A] truncate">
                    {t(`status.${status}.help`)}
                  </div>
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
                    draggable
                    onDragStart={(e) => {
                      setDragId(tk.id);
                      e.dataTransfer.setData("text/plain", tk.id);
                      e.dataTransfer.effectAllowed = "move";
                      (e.currentTarget as HTMLElement).classList.add("dragging");
                    }}
                    onDragEnd={(e) => {
                      (e.currentTarget as HTMLElement).classList.remove("dragging");
                      setDragId(null);
                    }}
                  />
                ))}
                {colTasks.length === 0 && (
                  <div className="text-[11px] text-[#A8A29E] text-center py-6">
                    {status === "DONE" ? t("col.emptyDone") : t("col.empty")}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
