import { useEffect, useMemo, useRef, useState } from "react";
import type { Board, Priority, Status, Task } from "../lib/types";
import { PRIORITY_ORDER, STATUS_ORDER, isArchived } from "../lib/constants";
import { useT } from "../lib/i18n";
import { useMe } from "../lib/identity";
import { isOwnedBy } from "../lib/owners";
import { boardTasks } from "../lib/projects";
import { readPref, writePref } from "../lib/prefs";
import { STATUS_VAR } from "./ui";
import { TaskList } from "./TaskList";
import { useNav } from "./nav";
import { IconClose, IconPlus, IconSearch } from "./icons";
import type { Send } from "./actions";

const sortTasks = (a: Task, b: Task) =>
  PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
  (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
  (a.createdAt ?? 0) - (b.createdAt ?? 0);

function readCol(): number {
  const i = STATUS_ORDER.indexOf((readPref("mBoardCol") ?? "NEXT") as Status);
  return i < 0 ? 1 : i;
}

/**
 * The board, one column per page: swipe sideways between columns, or tap a
 * column's pill. Inside a column, cards are sorted by priority, then due
 * date. DONE shows this week; older ones are one tap away.
 */
export function BoardScreen({ board, send }: { board: Board; send: Send }) {
  const { t } = useT();
  const { me } = useMe();
  const nav = useNav();
  const [col, setCol] = useState(readCol);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [mine, setMine] = useState(false);
  const [prio, setPrio] = useState<Priority | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const pager = useRef<HTMLDivElement>(null);
  const pills = useRef<HTMLDivElement>(null);
  const programmatic = useRef(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return boardTasks(board).filter(
      (tk) =>
        (!q || tk.title.toLowerCase().includes(q) || tk.desc.toLowerCase().includes(q) || tk.notes.toLowerCase().includes(q)) &&
        (!mine || !me || isOwnedBy(tk, me)) &&
        (!prio || tk.priority === prio)
    );
  }, [board, query, mine, me, prio]);

  const columns = useMemo(() => {
    const m = new Map<Status, Task[]>(STATUS_ORDER.map((s) => [s, []]));
    for (const tk of visible) m.get(tk.status)?.push(tk);
    for (const list of m.values()) list.sort(sortTasks);
    const done = m.get("DONE")!;
    done.sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
    return m;
  }, [visible]);

  // Start on the remembered column.
  useEffect(() => {
    const el = pager.current;
    if (el) el.scrollLeft = col * el.clientWidth;
  }, []);

  // Keep the active pill in view.
  useEffect(() => {
    writePref("mBoardCol", STATUS_ORDER[col]);
    const pill = pills.current?.children[col] as HTMLElement | undefined;
    pill?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [col]);

  const goTo = (i: number) => {
    const el = pager.current;
    if (!el) return;
    programmatic.current = true;
    setCol(i);
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
    setTimeout(() => (programmatic.current = false), 450);
  };

  const onScroll = () => {
    const el = pager.current;
    if (!el || programmatic.current) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== col && i >= 0 && i < STATUS_ORDER.length) setCol(i);
  };

  return (
    <div className="m-page" style={{ paddingTop: 10 }}>
      {searching ? (
        <div className="m-search">
          <IconSearch size={18} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("m.searchPh")}
            enterKeyHint="search"
          />
          <button
            aria-label={t("m.close")}
            onClick={() => {
              setQuery("");
              setSearching(false);
            }}
          >
            <IconClose size={18} />
          </button>
        </div>
      ) : null}

      <div className="m-pills" style={{ marginBottom: 6 }}>
        {!searching && (
          <button className="m-pill" aria-label={t("m.search")} onClick={() => setSearching(true)} style={{ padding: "0 11px" }}>
            <IconSearch size={17} />
          </button>
        )}
        {me && (
          <button className="m-pill" aria-pressed={mine} onClick={() => setMine((v) => !v)}>
            {t("m.onlyMine")}
          </button>
        )}
        {(["P1", "P2", "P3", "P4"] as Priority[]).map((p) => (
          <button key={p} className="m-pill" aria-pressed={prio === p} onClick={() => setPrio((v) => (v === p ? null : p))}>
            {p}
          </button>
        ))}
      </div>

      <div className="m-pills" ref={pills} role="tablist" style={{ marginBottom: 2 }}>
        {STATUS_ORDER.map((s, i) => {
          const list = columns.get(s)!;
          const n = s === "DONE" ? list.filter((tk) => !isArchived(tk)).length : list.length;
          return (
            <button key={s} role="tab" className="m-pill" aria-selected={i === col} onClick={() => goTo(i)}>
              <span className="m-dot" style={{ background: STATUS_VAR[s] }} />
              {t(`m.status.${s}`)}
              <span className="m-pill__n">{n}</span>
            </button>
          );
        })}
      </div>
      <div className="m-dots" aria-hidden="true">
        {STATUS_ORDER.map((s, i) => (
          <span key={s} data-on={i === col} />
        ))}
      </div>

      <div className="m-pager" ref={pager} onScroll={onScroll}>
        {STATUS_ORDER.map((s) => {
          const all = columns.get(s)!;
          const list = s === "DONE" ? all.filter((tk) => !isArchived(tk)) : all;
          const archived = s === "DONE" ? all.filter((tk) => isArchived(tk)) : [];
          return (
            <section key={s} className="m-pager__page" aria-label={t(`m.status.${s}`)}>
              <div className="m-sub" style={{ margin: "6px 2px 10px" }}>
                {t(`m.statusHint.${s}`)}
              </div>
              {list.length ? (
                <TaskList tasks={list} send={send} />
              ) : (
                <div className="m-empty">{query || mine || prio ? t("m.noMatch") : t("m.emptyCol")}</div>
              )}
              {s !== "DONE" ? (
                <button
                  className="m-btn m-btn--block"
                  style={{ marginTop: 12, background: "transparent", border: "1.5px dashed var(--m-line-strong)", color: "var(--m-text-2)" }}
                  onClick={() => nav.add({ status: s })}
                >
                  <IconPlus size={18} /> {t("m.addHere")}
                </button>
              ) : (
                archived.length > 0 && (
                  <>
                    <button className="m-btn m-btn--block" style={{ marginTop: 14 }} onClick={() => setShowArchived((v) => !v)}>
                      {showArchived ? t("m.hideArchived") : t("m.showArchived").replace("{n}", String(archived.length))}
                    </button>
                    {showArchived && (
                      <div style={{ marginTop: 10 }}>
                        <TaskList tasks={archived} send={send} />
                      </div>
                    )}
                  </>
                )
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
