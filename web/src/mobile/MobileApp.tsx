import { useCallback, useEffect, useMemo, useState } from "react";
import type { Board, Status } from "../lib/types";
import type { ConnState } from "../lib/useBoard";
import { useT } from "../lib/i18n";
import { useMe } from "../lib/identity";
import { isOwnedBy } from "../lib/owners";
import { boardTasks } from "../lib/projects";
import { daysUntil } from "../lib/dates";
import { readPref, writePref } from "../lib/prefs";
import { MailModal } from "../components/MailModal";
import { Avatar, ToastProvider, setAvatarMembers } from "./ui";
import { NavCtx, type MobileNav, type MobileTab } from "./nav";
import { TodayScreen } from "./TodayScreen";
import { BoardScreen } from "./BoardScreen";
import { ProjectsScreen, ProjectSheet } from "./ProjectsScreen";
import { AgendaScreen } from "./AgendaScreen";
import { MeSheet, MoreScreen, type MorePage } from "./MoreScreen";
import { TaskSheet } from "./TaskSheet";
import { AddSheet } from "./AddSheet";
import { MoveSheet, useTaskActions, type Send } from "./actions";
import { IconBoard, IconCalendar, IconMore, IconPlus, IconProjects, IconToday, IconUser } from "./icons";
import type { LayoutChoice } from "./useLayout";
import "./mobile.css";

const TABS: { id: MobileTab; icon: (p: { size?: number }) => JSX.Element }[] = [
  { id: "today", icon: IconToday },
  { id: "board", icon: IconBoard },
  { id: "projects", icon: IconProjects },
  { id: "agenda", icon: IconCalendar },
  { id: "more", icon: IconMore },
];

const CONN_COLOR: Record<ConnState, string> = {
  online: "var(--m-green)",
  connecting: "var(--m-orange)",
  reconnecting: "var(--m-orange)",
  offline: "var(--m-red)",
};

function readTab(): MobileTab {
  const v = readPref("mTab");
  return TABS.some((t) => t.id === v) ? (v as MobileTab) : "today";
}

/**
 * The phone version of the app. Same board, same live sync, same data and
 * operations as the desktop — a different layout built for one hand: a tab
 * bar at the bottom, a big add button, cards you can swipe, and sheets that
 * rise from the bottom instead of inline editors.
 */
export function MobileApp(props: {
  board: Board;
  conn: ConnState;
  error: string | null;
  send: Send;
  setLayout: (c: LayoutChoice) => void;
}) {
  return (
    <ToastProvider>
      <Shell {...props} />
    </ToastProvider>
  );
}

function Shell({
  board,
  conn,
  error,
  send,
  setLayout,
}: {
  board: Board;
  conn: ConnState;
  error: string | null;
  send: Send;
  setLayout: (c: LayoutChoice) => void;
}) {
  const { t, lang } = useT();
  const { me } = useMe();
  const [tab, setTabState] = useState<MobileTab>(readTab);
  const [morePage, setMorePage] = useState<MorePage>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [moveId, setMoveId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ status?: Status; projectId?: string; dueDate?: string } | null>(null);
  const [meOpen, setMeOpen] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const { moveTo } = useTaskActions(send);
  setAvatarMembers(board.members);

  // Mark the page so mobile.css takes over (tokens, background), and undo it
  // when switching to the desktop layout.
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.layout = "mobile";
    return () => {
      delete html.dataset.layout;
    };
  }, []);

  const setTab = useCallback((next: MobileTab) => {
    setTabState((cur) => {
      if (cur === next) window.scrollTo({ top: 0, behavior: "smooth" });
      return next;
    });
    if (next !== "more") setMorePage(null);
    writePref("mTab", next);
  }, []);

  // Changing tab starts at the top.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab, morePage]);

  const nav = useMemo<MobileNav>(
    () => ({
      go: setTab,
      openTask: (id) => setTaskId(id),
      moveTask: (id) => setMoveId(id),
      openProject: (id) => setProjectId(id),
      add: (opts) => setAdding(opts ?? {}),
      openMe: () => setMeOpen(true),
    }),
    [setTab]
  );

  const known = !!me && board.members.includes(me);
  const urgent = useMemo(
    () =>
      boardTasks(board).filter((tk) => {
        if (tk.status === "DONE" || (known && !isOwnedBy(tk, me))) return false;
        const d = daysUntil(tk.dueDate);
        return d !== null && d <= 0;
      }).length,
    [board, known, me]
  );

  const task = taskId ? board.tasks.find((tk) => tk.id === taskId) : undefined;
  const moving = moveId ? board.tasks.find((tk) => tk.id === moveId) : undefined;
  const project = projectId ? board.projects.find((p) => p.id === projectId) : undefined;
  const multiAssign = board.assigneesAvailable !== false;

  const title =
    tab === "today"
      ? board.boardName
      : tab === "more" && morePage
        ? t(`m.page.${morePage}`)
        : t(`m.tab.${tab}`);

  return (
    <NavCtx.Provider value={nav}>
      <div className="m-wall" aria-hidden="true" />
      <div className="m-app" lang={lang}>
        <header className="m-header">
          <div className="m-header__logo">
            {board.logoUrl ? <img src={board.logoUrl} alt="" /> : (board.boardName.trim().charAt(0) || "G")}
          </div>
          <div className="m-header__title">
            <h1 className={tab === "today" ? "m-display" : undefined}>{title}</h1>
            <p>
              <span className="m-dot" style={{ background: CONN_COLOR[conn] }} />
              {t(`conn.${conn === "online" ? "live" : conn}`)}
              {error && conn !== "online" ? ` · ${t("m.syncIssue")}` : ""}
            </p>
          </div>
          <button className="m-iconbtn" onClick={() => setMeOpen(true)} aria-label={t("m.me")} style={{ padding: 0 }}>
            {known ? <Avatar name={me} large /> : <IconUser size={19} />}
          </button>
        </header>

        <main>
          {tab === "today" && <TodayScreen board={board} send={send} />}
          {tab === "board" && <BoardScreen board={board} send={send} />}
          {tab === "projects" && <ProjectsScreen board={board} send={send} />}
          {tab === "agenda" && <AgendaScreen board={board} send={send} />}
          {tab === "more" && (
            <MoreScreen
              board={board}
              send={send}
              page={morePage}
              setPage={setMorePage}
              onMail={() => setMailOpen(true)}
              onMe={() => setMeOpen(true)}
            />
          )}
        </main>

        <div className="m-dock">
          <nav className="m-tabbar" aria-label={t("m.nav")}>
            {TABS.map(({ id, icon: Icon }) => (
              <button key={id} className="m-tab" aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>
                <Icon size={22} />
                {t(`m.tab.${id}`)}
                {id === "today" && urgent > 0 && <span className="m-tab__badge">{urgent}</span>}
              </button>
            ))}
          </nav>
          {tab !== "more" && (
            <button className="m-fab" aria-label={t("m.newTask")} onClick={() => nav.add()}>
              <IconPlus size={28} />
            </button>
          )}
        </div>

        {project && <ProjectSheet board={board} project={project} send={send} onClose={() => setProjectId(null)} />}
        {task && (
          <TaskSheet
            key={task.id}
            task={task}
            members={board.members}
            multiAssign={multiAssign}
            send={send}
            onClose={() => setTaskId(null)}
          />
        )}
        {moving && <MoveSheet task={moving} onPick={(s) => moveTo(moving, s)} onClose={() => setMoveId(null)} />}
        {adding && (
          <AddSheet
            members={board.members}
            multiAssign={multiAssign}
            send={send}
            onClose={() => setAdding(null)}
            initialStatus={adding.status}
            initialProject={adding.projectId}
            initialDue={adding.dueDate}
          />
        )}
        {meOpen && <MeSheet members={board.members} onClose={() => setMeOpen(false)} setLayout={setLayout} />}
        {mailOpen && <MailModal board={board} onClose={() => setMailOpen(false)} />}
      </div>
    </NavCtx.Provider>
  );
}
