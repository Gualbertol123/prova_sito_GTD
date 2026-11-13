import { useCallback, useEffect, useMemo, useState } from "react";
import type { Board, Status } from "../lib/types";
import type { ConnState } from "../lib/useBoard";
import { useT } from "../lib/i18n";
import { useMe } from "../lib/identity";
import { isOwnedBy } from "../lib/owners";
import { boardTasks } from "../lib/projects";
import { daysUntil } from "../lib/dates";
import { readPref, writePref } from "../lib/prefs";
import { goBackTo, navigate, useRoute } from "../lib/history";
import { music } from "../lib/music";
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

type TabDef = { id: MobileTab; icon: (p: { size?: number }) => JSX.Element };

// The bar: two tabs, the add button in the middle, two tabs. "More" is the
// avatar button in the header (its page starts with your profile row).
const BAR_LEFT: TabDef[] = [
  { id: "today", icon: IconToday },
  { id: "board", icon: IconBoard },
];
const BAR_RIGHT: TabDef[] = [
  { id: "projects", icon: IconProjects },
  { id: "agenda", icon: IconCalendar },
];
const TABS: TabDef[] = [...BAR_LEFT, ...BAR_RIGHT, { id: "more", icon: IconMore }];

const CONN_COLOR: Record<ConnState, string> = {
  online: "var(--m-green)",
  connecting: "var(--m-orange)",
  reconnecting: "var(--m-orange)",
  offline: "var(--m-red)",
};

function TabButton({
  def: { id, icon: Icon },
  current,
  onPick,
  badge,
}: {
  def: TabDef;
  current: MobileTab;
  onPick: (t: MobileTab) => void;
  badge: number;
}) {
  const { t } = useT();
  return (
    <button className="m-tab" aria-current={current === id ? "page" : undefined} onClick={() => onPick(id)}>
      <span className="m-tab__icon">
        <Icon size={23} />
        {badge > 0 && <span className="m-tab__badge">{badge > 9 ? "9+" : badge}</span>}
      </span>
      <span className="m-tab__label">{t(`m.tab.${id}`)}</span>
    </button>
  );
}

function savedTab(): MobileTab {
  const v = readPref("mTab");
  return TABS.some((t) => t.id === v) ? (v as MobileTab) : "today";
}

const MORE_PAGES = new Set<string>(["weekly", "report", "reflection", "products", "settings"]);

/**
 * Where the URL points, in phone terms. The desktop's addresses are
 * translated (its calendar is the Agenda, its Weekly is a page in More), so
 * switching layout keeps your place; an empty address opens the last tab.
 */
function mobileRoute(tab: string, sub?: string): { tab: MobileTab; page: MorePage } {
  if (tab === "more") return { tab, page: sub && MORE_PAGES.has(sub) ? (sub as MorePage) : null };
  if (TABS.some((x) => x.id === tab)) return { tab: tab as MobileTab, page: null };
  if (tab === "calendario") return { tab: "agenda", page: null };
  if (tab === "music") return { tab: "more", page: null }; // the desktop MUSICA tab: the player opens on top
  if (MORE_PAGES.has(tab)) return { tab: "more", page: tab as MorePage };
  if (tab === "board" || tab === "projects") return { tab, page: null };
  return { tab: savedTab(), page: null };
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
  // Tab and More page live in the URL (#/today, #/more/weekly, …), so the
  // browser's Back moves between them; sheets add their own entries (Sheet).
  const route = useRoute();
  const { tab, page: morePage } = mobileRoute(route.tab, route.sub);
  useEffect(() => {
    // A link to the desktop's MUSICA tab opens the music player here.
    if (route.tab === "music") music.open();
    if (route.tab !== tab || (route.sub ?? null) !== (morePage ?? null))
      navigate({ tab, sub: morePage ?? undefined }, { replace: true });
  }, [route.tab, route.sub, tab, morePage]);
  const setMorePage = useCallback(
    (p: MorePage) => (p ? navigate({ tab: "more", sub: p }) : goBackTo({ tab: "more" })),
    []
  );
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

  // While you type in the page, the bar steps aside (on Android it would ride
  // up on the keyboard over the field). Sheets follow the keyboard instead:
  // --m-kb is the part of the screen it covers, --m-vvh what is left.
  useEffect(() => {
    const html = document.documentElement;
    const editable = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      (el.isContentEditable ||
        el.tagName === "TEXTAREA" ||
        el.tagName === "SELECT" ||
        (el.tagName === "INPUT" && !["checkbox", "radio", "button", "submit", "range", "color", "file"].includes((el as HTMLInputElement).type)));
    const onIn = (e: FocusEvent) => {
      if (editable(e.target)) html.dataset.typing = "1";
    };
    const onOut = () => {
      // Moving focus straight to another field keeps it hidden.
      setTimeout(() => {
        if (!editable(document.activeElement)) delete html.dataset.typing;
      }, 60);
    };
    const vv = window.visualViewport;
    const onVV = () => {
      if (!vv) return;
      const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      html.style.setProperty("--m-kb", `${kb > 60 ? kb : 0}px`);
      html.style.setProperty("--m-vvh", `${Math.round(vv.height)}px`);
    };
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    vv?.addEventListener("resize", onVV);
    vv?.addEventListener("scroll", onVV);
    onVV();
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
      vv?.removeEventListener("resize", onVV);
      vv?.removeEventListener("scroll", onVV);
      delete html.dataset.typing;
      html.style.removeProperty("--m-kb");
      html.style.removeProperty("--m-vvh");
    };
  }, []);

  // The phone's status bar / app switcher takes the page colour, light or dark.
  useEffect(() => {
    const html = document.documentElement;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) return;
    const initial = meta.content;
    const sync = () => {
      const canvas = getComputedStyle(html).getPropertyValue("--canvas").trim();
      meta.content = canvas || (html.dataset.skin === "glass" ? "#0b1020" : "#f5f3ef");
    };
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(html, { attributes: true, attributeFilter: ["data-skin", "data-appearance"] });
    return () => {
      mo.disconnect();
      meta.content = initial;
    };
  }, []);

  // The home-screen shortcut "New task" opens the app with ?new=1.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("new")) return;
    url.searchParams.delete("new");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    setAdding({});
  }, []);

  const setTab = useCallback(
    (next: MobileTab) => {
      // Tapping the tab you are on scrolls to the top (and leaves a More page).
      if (next === tab && !morePage) window.scrollTo({ top: 0, behavior: "smooth" });
      else navigate({ tab: next });
      writePref("mTab", next);
    },
    [tab, morePage]
  );

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
      <div className="m-sbscrim" aria-hidden="true" />
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
          <button
            className="m-menubtn"
            onClick={() => setTab("more")}
            aria-label={t("m.tab.more")}
            aria-current={tab === "more" ? "page" : undefined}
          >
            {known ? <Avatar name={me} large /> : <IconUser size={19} />}
            <span className="m-menubtn__dots" aria-hidden="true">
              <IconMore size={12} />
            </span>
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

        <nav className="m-dock" aria-label={t("m.nav")}>
          <div className="m-tabbar">
            {BAR_LEFT.map((d) => (
              <TabButton key={d.id} def={d} current={tab} onPick={setTab} badge={d.id === "today" ? urgent : 0} />
            ))}
            <button className="m-tab m-tab--add" aria-label={t("m.newTask")} onClick={() => nav.add()}>
              <span className="m-tab__plus">
                <IconPlus size={26} />
              </span>
            </button>
            {BAR_RIGHT.map((d) => (
              <TabButton key={d.id} def={d} current={tab} onPick={setTab} badge={0} />
            ))}
          </div>
        </nav>

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
