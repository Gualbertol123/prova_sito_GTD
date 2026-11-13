import { useMemo, useState } from "react";
import type { Board, Task } from "../lib/types";
import { PRIORITY_ORDER } from "../lib/constants";
import { useT } from "../lib/i18n";
import { useMe } from "../lib/identity";
import { isOwnedBy } from "../lib/owners";
import { toISODate } from "../lib/dates";
import { TaskList } from "./TaskList";
import { useNav } from "./nav";
import { IconBack, IconChevron, IconPlus } from "./icons";
import type { Send } from "./actions";

function mondayOf(d: Date): Date {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

function plus(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const order = (a: Task, b: Task) =>
  Number(a.status === "DONE") - Number(b.status === "DONE") || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];

/**
 * The calendar on a phone: a week strip to pick a day, that day's tasks,
 * then the next two weeks at a glance. Like the desktop calendar, it shows
 * every dated task, including ones kept off the board by their project.
 */
export function AgendaScreen({ board, send }: { board: Board; send: Send }) {
  const { t, lang } = useT();
  const { me } = useMe();
  const nav = useNav();
  const todayIso = toISODate(new Date());
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [day, setDay] = useState(todayIso);
  const [mine, setMine] = useState(false);
  const loc = lang === "it" ? "it-IT" : "en-GB";

  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const tk of board.tasks) {
      if (!tk.dueDate) continue;
      if (mine && me && !isOwnedBy(tk, me)) continue;
      m.set(tk.dueDate, [...(m.get(tk.dueDate) ?? []), tk]);
    }
    for (const list of m.values()) list.sort(order);
    return m;
  }, [board.tasks, mine, me]);

  const late = useMemo(
    () =>
      board.tasks
        .filter((tk) => tk.dueDate && tk.dueDate < todayIso && tk.status !== "DONE" && (!mine || !me || isOwnedBy(tk, me)))
        .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "")),
    [board.tasks, todayIso, mine, me]
  );

  const week = Array.from({ length: 7 }, (_, i) => plus(weekStart, i));
  const selected = byDay.get(day) ?? [];
  const upcoming = Array.from({ length: 14 }, (_, i) => toISODate(plus(new Date(day + "T00:00:00"), i + 1))).filter(
    (iso) => (byDay.get(iso) ?? []).some((tk) => tk.status !== "DONE")
  );
  const monthLabel = weekStart.toLocaleDateString(loc, { month: "long", year: "numeric" });
  const dayLabel = (iso: string) =>
    iso === todayIso
      ? t("m.when.today")
      : new Date(iso + "T00:00:00").toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="m-page">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <button className="m-iconbtn" aria-label={t("m.prevWeek")} onClick={() => setWeekStart((w) => plus(w, -7))}>
          <IconBack size={18} />
        </button>
        <div style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: 700, textTransform: "capitalize" }}>
          {monthLabel}
        </div>
        <button className="m-iconbtn" aria-label={t("m.nextWeek")} onClick={() => setWeekStart((w) => plus(w, 7))}>
          <IconChevron size={18} />
        </button>
      </div>

      <div className="m-week m-glass">
        {week.map((d) => {
          const iso = toISODate(d);
          const n = (byDay.get(iso) ?? []).filter((tk) => tk.status !== "DONE").length;
          return (
            <button key={iso} className="m-day" aria-pressed={iso === day} data-today={iso === todayIso} onClick={() => setDay(iso)}>
              {d.toLocaleDateString(loc, { weekday: "narrow" })}
              <b>{d.getDate()}</b>
              <span className="m-day__dots">
                {Array.from({ length: Math.min(n, 3) }, (_, i) => (
                  <i key={i} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="m-pills" style={{ marginTop: 12, marginBottom: 4 }}>
        <button
          className="m-pill"
          aria-pressed={day === todayIso && weekStart.getTime() === mondayOf(new Date()).getTime()}
          onClick={() => {
            setWeekStart(mondayOf(new Date()));
            setDay(todayIso);
          }}
        >
          {t("m.when.today")}
        </button>
        {me && (
          <button className="m-pill" aria-pressed={mine} onClick={() => setMine((v) => !v)}>
            {t("m.onlyMine")}
          </button>
        )}
      </div>

      {day === todayIso && late.length > 0 && (
        <>
          <h2 className="m-h2" style={{ color: "var(--m-red)" }}>
            {t("m.sec.late")} <span className="m-count">{late.length}</span>
          </h2>
          <TaskList tasks={late} send={send} />
        </>
      )}

      <h2 className="m-h2" style={{ textTransform: "capitalize" }}>
        {dayLabel(day)} <span className="m-count">{selected.length}</span>
        <button className="m-link" onClick={() => nav.add({ dueDate: day })}>
          <IconPlus size={14} /> {t("m.add")}
        </button>
      </h2>
      {selected.length ? <TaskList tasks={selected} send={send} showStatus /> : <div className="m-empty">{t("m.nothingDue")}</div>}

      {upcoming.length > 0 && (
        <>
          <h2 className="m-h2">{t("m.comingUp")}</h2>
          {upcoming.map((iso) => (
            <div key={iso} style={{ marginBottom: 14 }}>
              <div className="m-label" style={{ textTransform: "capitalize" }}>
                {dayLabel(iso)}
              </div>
              <TaskList tasks={(byDay.get(iso) ?? []).filter((tk) => tk.status !== "DONE")} send={send} showStatus />
            </div>
          ))}
        </>
      )}
    </div>
  );
}
