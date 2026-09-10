import { useMemo, useState } from "react";
import { useBoard } from "./lib/useBoard";
import { PRIORITY_ORDER, TABS, type TabId } from "./lib/constants";
import type { Task } from "./lib/types";
import { TopBar } from "./components/TopBar";
import { Filters, type FilterState } from "./components/Filters";
import { BoardView } from "./components/BoardView";
import { WeeklyView } from "./components/WeeklyView";
import { CalendarView } from "./components/CalendarView";
import { TrackingView } from "./components/TrackingView";
import { InstructionsView } from "./components/InstructionsView";
import { MailModal } from "./components/MailModal";
import { ConnBadge } from "./components/ConnBadge";

export default function App() {
  const { board, conn, error, send } = useBoard();
  const [tab, setTab] = useState<TabId>("board");
  const [mailOpen, setMailOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    owner: "all",
    priority: "all",
    focusP1: false,
  });

  const members = board?.members ?? [];

  // Filtered + priority-sorted tasks (mirrors the original memo).
  const filtered: Task[] = useMemo(() => {
    if (!board) return [];
    const q = filters.search.trim().toLowerCase();
    return board.tasks
      .filter((t) => {
        const matchText =
          !q ||
          t.title.toLowerCase().includes(q) ||
          t.desc.toLowerCase().includes(q);
        const matchOwner = filters.owner === "all" || t.owner === filters.owner;
        const matchPrio =
          filters.priority === "all" || t.priority === filters.priority;
        const matchFocus = !filters.focusP1 || t.priority === "P1";
        return matchText && matchOwner && matchPrio && matchFocus;
      })
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  }, [board, filters]);

  if (!board) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F3EF]">
        <div className="text-center">
          <div className="font-trajan text-[22px] tracking-widest text-[#0A1931]">
            TEAM GTD
          </div>
          <div className="mt-3 text-[13px] text-[#8A8A8A]">
            {conn === "offline"
              ? "Connessione al server non riuscita. Riprova."
              : "Connessione in corso…"}
          </div>
          {error && (
            <div className="mt-2 text-[11px] text-[#DC2626] max-w-[360px]">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F3EF] text-[#0A1931] pb-16">
      <TopBar
        board={board}
        conn={conn}
        onRename={(name) => send({ type: "renameBoard", name })}
        onOpenMail={() => setMailOpen(true)}
        rightSlot={<ConnBadge conn={conn} />}
      />

      {/* Tabs */}
      <div className="max-w-[1400px] mx-auto px-4 mt-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                data-tab={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 h-9 rounded-full text-[12px] font-semibold tracking-wide transition-colors border ${
                  active
                    ? "bg-[#0A1931] text-[#C9A96E] border-[#0A1931]"
                    : "bg-white text-[#0A1931] border-[#E8E6E1] hover:border-[#C9A96E]"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters — visible on board & calendar */}
      {(tab === "board" || tab === "calendario") && (
        <div className="max-w-[1400px] mx-auto px-4 mt-4">
          <Filters
            filters={filters}
            setFilters={setFilters}
            members={members}
          />
        </div>
      )}

      <div className="max-w-[1400px] mx-auto px-4 mt-4">
        {tab === "board" && (
          <BoardView
            board={board}
            tasks={filtered}
            members={members}
            send={send}
          />
        )}
        {tab === "weekly" && <WeeklyView board={board} send={send} />}
        {tab === "calendario" && (
          <CalendarView board={board} tasks={filtered} send={send} />
        )}
        {tab === "tracking" && <TrackingView board={board} />}
        {tab === "istruzioni" && <InstructionsView />}
      </div>

      {mailOpen && (
        <MailModal board={board} onClose={() => setMailOpen(false)} />
      )}
    </div>
  );
}
