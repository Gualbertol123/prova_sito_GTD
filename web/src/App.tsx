import { useEffect, useState } from "react";
import { useBoard } from "./lib/useBoard";
import { TABS, type TabId } from "./lib/constants";
import { useT } from "./lib/i18n";
import { TopBar } from "./components/TopBar";
import { Filters, type FilterState } from "./components/Filters";
import { BoardView } from "./components/BoardView";
import { WeeklyView } from "./components/WeeklyView";
import { CalendarView } from "./components/CalendarView";
import { TrackingView } from "./components/TrackingView";
import { InstructionsView } from "./components/InstructionsView";
import { SettingsView } from "./components/SettingsView";
import { DailyReflection } from "./components/DailyReflection";
import { MailModal } from "./components/MailModal";
import { ConnBadge } from "./components/ConnBadge";
import { LangToggle } from "./components/LangToggle";
import { IdentityPicker } from "./components/IdentityPicker";

export default function App() {
  const { board, conn, error, send } = useBoard();
  const { t } = useT();
  const [tab, setTab] = useState<TabId>("board");
  const [mailOpen, setMailOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    owner: "all",
    priority: "all",
    focusP1: false,
  });

  const members = board?.members ?? [];

  // Apply the custom favicon (shared) to this tab.
  const faviconUrl = board?.faviconUrl;
  useEffect(() => {
    if (!faviconUrl) return;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    const prev = link.href;
    link.href = faviconUrl;
    return () => {
      if (prev) link!.href = prev;
    };
  }, [faviconUrl]);

  if (!board) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F3EF]">
        <div className="text-center px-4">
          <div className="font-trajan text-[22px] tracking-widest text-[#0A1931]">
            {t("app.loadingTitle")}
          </div>
          <div className="mt-3 text-[13px] text-[#8A8A8A]">
            {conn === "offline" ? t("app.connectFailed") : t("app.connecting")}
          </div>
          {error && (
            <div className="mt-2 text-[11px] text-[#DC2626] max-w-[420px]">{error}</div>
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
        send={send}
        rightSlot={
          <>
            <IdentityPicker members={members} />
            <ConnBadge conn={conn} />
            <LangToggle />
          </>
        }
      />

      {/* Tabs */}
      <div className="max-w-[1500px] mx-auto px-4 mt-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tb) => {
            const active = tab === tb.id;
            return (
              <button
                key={tb.id}
                onClick={() => setTab(tb.id)}
                className={`px-4 h-9 rounded-full text-[12px] font-semibold tracking-wide transition-colors border ${
                  active
                    ? "bg-[#0A1931] text-[#C9A96E] border-[#0A1931]"
                    : "bg-white text-[#0A1931] border-[#E8E6E1] hover:border-[#C9A96E]"
                }`}
              >
                {t(`tabs.${tb.id}`)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-[1500px] mx-auto px-4 mt-4">
        {tab === "board" && (
          <BoardView
            board={board}
            members={members}
            send={send}
            filters={filters}
            setFilters={setFilters}
          />
        )}
        {tab === "weekly" && <WeeklyView board={board} send={send} />}
        {tab === "calendario" && (
          <div className="space-y-4">
            <Filters filters={filters} setFilters={setFilters} members={members} />
            <CalendarView
              board={board}
              tasks={filteredForCalendar(board.tasks, filters)}
              members={members}
              send={send}
            />
          </div>
        )}
        {tab === "reflection" && (
          <div className="max-w-[900px] mx-auto">
            <DailyReflection board={board} members={members} send={send} />
          </div>
        )}
        {tab === "tracking" && <TrackingView board={board} />}
        {tab === "istruzioni" && <InstructionsView />}
        {tab === "settings" && <SettingsView board={board} send={send} />}
      </div>

      {mailOpen && <MailModal board={board} onClose={() => setMailOpen(false)} />}
    </div>
  );
}

function filteredForCalendar(
  tasks: import("./lib/types").Task[],
  f: FilterState
) {
  const q = f.search.trim().toLowerCase();
  return tasks.filter((tk) => {
    const text = !q || tk.title.toLowerCase().includes(q) || tk.desc.toLowerCase().includes(q);
    const owner = f.owner === "all" || tk.owner === f.owner;
    const prio = f.priority === "all" || tk.priority === f.priority;
    const focus = !f.focusP1 || tk.priority === "P1";
    return text && owner && prio && focus;
  });
}
