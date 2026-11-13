import { useEffect, useMemo, useState } from "react";
import type { Board, Task } from "../lib/types";
import { PRIORITY_ORDER, isArchived } from "../lib/constants";
import { useT } from "../lib/i18n";
import { useMe } from "../lib/identity";
import { isOwnedBy } from "../lib/owners";
import { boardTasks } from "../lib/projects";
import { daysSince, daysUntil, toISODate } from "../lib/dates";
import { loadMenu, upcomingMenu, type MenuDay } from "../lib/menu";
import { Sheet } from "./ui";
import { TaskList } from "./TaskList";
import { useNav } from "./nav";
import { IconCheck, IconChevron, IconClock, IconFork, IconToday, IconUser } from "./icons";
import type { Send } from "./actions";

const byPriorityThenDue = (a: Task, b: Task) =>
  PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9");

/**
 * The first screen: what needs *you* today. Your late and due-today work,
 * what you are in the middle of, the week ahead and what you are waiting
 * on — then the canteen's dish of the day.
 */
export function TodayScreen({ board, send }: { board: Board; send: Send }) {
  const { t, lang } = useT();
  const { me } = useMe();
  const nav = useNav();
  const known = !!me && board.members.includes(me);

  const groups = useMemo(() => {
    const mine = boardTasks(board).filter((tk) => tk.status !== "DONE" && (!known || isOwnedBy(tk, me)));
    const late: Task[] = [];
    const today: Task[] = [];
    const doing: Task[] = [];
    const soon: Task[] = [];
    const waiting: Task[] = [];
    for (const tk of mine) {
      const d = daysUntil(tk.dueDate);
      if (d !== null && d < 0) late.push(tk);
      else if (d === 0) today.push(tk);
      else if (tk.status === "IN PROGRESS") doing.push(tk);
      else if (tk.status === "WAITING") waiting.push(tk);
      else if (d !== null && d <= 7 && tk.status !== "MAYBE") soon.push(tk);
    }
    late.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
    today.sort(byPriorityThenDue);
    doing.sort(byPriorityThenDue);
    soon.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
    waiting.sort((a, b) => daysSince(b.waitingSince) - daysSince(a.waitingSince));
    return { late, today, doing, soon, waiting };
  }, [board, me, known]);

  const doneWeek = board.tasks.filter((tk) => tk.status === "DONE" && !isArchived(tk)).length;
  const hour = new Date().getHours();
  const hello = hour < 13 ? t("m.hello.morning") : hour < 18 ? t("m.hello.afternoon") : t("m.hello.evening");
  const dateLine = new Date().toLocaleDateString(lang === "it" ? "it-IT" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const nothing = Object.values(groups).every((g) => g.length === 0);

  const section = (key: string, list: Task[], showStatus?: boolean) =>
    list.length > 0 && (
      <>
        <h2 className="m-h2" id={`m-sec-${key.split(".").pop()}`} style={{ scrollMarginTop: 80 }}>
          {t(key)} <span className="m-count">{list.length}</span>
        </h2>
        <TaskList tasks={list} send={send} showStatus={showStatus} />
      </>
    );

  return (
    <div className="m-page">
      <div className="m-eyebrow">{dateLine}</div>
      <div className="m-greeting">
        {hello}
        {known && (
          <>
            , <em>{me}</em>
          </>
        )}
      </div>

      <div className="m-stats">
        <button className="m-glass m-stat" onClick={() => groups.late.length && document.getElementById("m-sec-late")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
          <span className="m-stat__icon" style={{ ["--tile" as string]: "var(--m-red)" }}>
            <IconClock size={16} />
          </span>
          <div className="m-stat__v">{groups.late.length}</div>
          <div className="m-stat__k">{t("m.stat.late")}</div>
        </button>
        <button className="m-glass m-stat" onClick={() => groups.today.length && document.getElementById("m-sec-today")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
          <span className="m-stat__icon" style={{ ["--tile" as string]: "var(--m-orange)" }}>
            <IconToday size={16} />
          </span>
          <div className="m-stat__v">{groups.today.length}</div>
          <div className="m-stat__k">{t("m.stat.today")}</div>
        </button>
        <button className="m-glass m-stat" onClick={() => nav.go("board")}>
          <span className="m-stat__icon" style={{ ["--tile" as string]: "var(--m-green)" }}>
            <IconCheck size={16} />
          </span>
          <div className="m-stat__v">{doneWeek}</div>
          <div className="m-stat__k">{t("m.stat.doneWeek")}</div>
        </button>
      </div>

      {!known && (
        <button className="m-panel m-row" style={{ marginTop: 14 }} onClick={nav.openMe}>
          <span className="m-row__icon" style={{ ["--tile" as string]: "var(--m-blue)" }}>
            <IconUser size={18} />
          </span>
          <span className="m-row__main">
            <span className="m-row__title">{t("m.pickMe")}</span>
            <span className="m-row__hint" style={{ display: "block" }}>
              {t("m.pickMeHint")}
            </span>
          </span>
          <IconChevron size={18} />
        </button>
      )}

      {section("m.sec.late", groups.late, true)}
      {section("m.sec.today", groups.today, true)}
      {section("m.sec.doing", groups.doing)}
      {section("m.sec.soon", groups.soon, true)}
      {section("m.sec.waiting", groups.waiting)}

      {nothing && (
        <>
          <h2 className="m-h2">{t("m.sec.today")}</h2>
          <div className="m-empty">{t("m.allClear")}</div>
        </>
      )}

      <CanteenCard />
    </div>
  );
}

function CanteenCard() {
  const { t, lang } = useT();
  const [days, setDays] = useState<MenuDay[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    loadMenu().then((m) => alive && setDays(upcomingMenu(m)));
    return () => {
      alive = false;
    };
  }, []);

  const day = days?.[0];
  if (!day) return null;
  const isToday = day.date === toISODate(new Date());
  const dish = day.courses.find((c) => c.course === "daily")?.items[0]?.name;
  const label = isToday
    ? t("menuBar.today")
    : new Date(day.date + "T00:00:00").toLocaleDateString(lang === "it" ? "it-IT" : "en-GB", {
        weekday: "long",
        day: "numeric",
      });

  return (
    <>
      <h2 className="m-h2">{t("menuBar.title")}</h2>
      <button className="m-panel m-row" onClick={() => setOpen(true)} style={{ alignItems: "flex-start" }}>
        <span className="m-row__icon" style={{ ["--tile" as string]: "var(--m-orange)" }}>
          <IconFork size={18} />
        </span>
        <span className="m-row__main">
          <span className="m-row__hint" style={{ display: "block", textTransform: "capitalize", marginTop: 0 }}>
            {label}
          </span>
          <span className="m-row__title" style={{ display: "block", fontWeight: 500, lineHeight: 1.35, marginTop: 2 }}>
            {dish ?? t("m.menuOpen")}
          </span>
        </span>
        <IconChevron size={18} />
      </button>
      {open && (
        <Sheet title={t("menuBar.title")} onClose={() => setOpen(false)}>
          {(days ?? []).slice(0, 5).map((d) => (
            <div key={d.date} className="m-panel" style={{ padding: "12px 14px", marginBottom: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--m-warm)", textTransform: "capitalize" }}>
                {new Date(d.date + "T00:00:00").toLocaleDateString(lang === "it" ? "it-IT" : "en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "short",
                })}
              </div>
              {d.courses.map((c) => (
                <div key={c.course}>
                  <div className="m-menu-course">{t(`menuBar.course.${c.course}`)}</div>
                  {c.items.map((it) => (
                    <div key={it.name} className="m-menu-dish">
                      {it.name}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </Sheet>
      )}
    </>
  );
}
