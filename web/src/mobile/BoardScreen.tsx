import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Board, Priority, Status, Task } from "../lib/types";
import { PRIORITY_ORDER, STATUS_ORDER, isArchived } from "../lib/constants";
import { useT } from "../lib/i18n";
import { useMe } from "../lib/identity";
import { isOwnedBy } from "../lib/owners";
import { boardTasks } from "../lib/projects";
import { readHidden, readPref, writeHidden, writePref } from "../lib/prefs";
import { STATUS_VAR, Sheet } from "./ui";
import { TaskList } from "./TaskList";
import { useNav } from "./nav";
import { IconBoard, IconClose, IconPlus, IconSearch } from "./icons";
import type { Send } from "./actions";

const sortTasks = (a: Task, b: Task) =>
  PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
  (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
  (a.createdAt ?? 0) - (b.createdAt ?? 0);

/** Column width the board aims for: one on a phone held upright, more when wider. */
const COLUMN_PX = 300;

function readHiddenSet(): Set<Status> {
  return new Set(readHidden().filter((s): s is Status => (STATUS_ORDER as string[]).includes(s)));
}

/**
 * The board. As many columns side by side as the screen fits (about 300 px
 * each: one on a phone held upright, two or three in landscape or on a
 * tablet); swipe sideways to move along them, column by column, or tap a
 * column's pill. Columns can be hidden (shared with the desktop's Columns
 * setting on this device). A sideways swipe here always moves between
 * columns: cards are completed with their round check, never by swiping.
 */
export function BoardScreen({ board, send }: { board: Board; send: Send }) {
  const { t } = useT();
  const { me } = useMe();
  const nav = useNav();
  const [hidden, setHidden] = useState<Set<Status>>(readHiddenSet);
  const shown = useMemo(() => STATUS_ORDER.filter((s) => !hidden.has(s)), [hidden]);
  const [first, setFirst] = useState<Status>(() => {
    const saved = readPref("mBoardCol") as Status | null;
    return saved && STATUS_ORDER.includes(saved) ? saved : "NEXT";
  });
  const [perView, setPerView] = useState(1);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [mine, setMine] = useState(false);
  const [prio, setPrio] = useState<Priority | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const pager = useRef<HTMLDivElement>(null);
  const pills = useRef<HTMLDivElement>(null);
  const programmatic = useRef(false);

  // The first column in view, as an index into the shown columns (a hidden
  // remembered column falls to its nearest shown neighbour).
  const firstIdx = useMemo(() => {
    const i = shown.indexOf(first);
    if (i >= 0) return i;
    const at = STATUS_ORDER.indexOf(first);
    const next = shown.findIndex((s) => STATUS_ORDER.indexOf(s) > at);
    return next >= 0 ? next : Math.max(0, shown.length - 1);
  }, [shown, first]);
  const cols = Math.min(perView, Math.max(1, shown.length));
  const maxFirst = Math.max(0, shown.length - cols);
  const start = Math.min(firstIdx, maxFirst);

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
    m.get("DONE")!.sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
    return m;
  }, [visible]);

  // How many columns fit: follows rotation and window size.
  useLayoutEffect(() => {
    const el = pager.current;
    if (!el) return;
    const fit = () => setPerView(Math.max(1, Math.min(3, Math.floor(el.clientWidth / COLUMN_PX))));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pageWidth = () => {
    const el = pager.current;
    const page = el?.querySelector<HTMLElement>(".m-pager__page");
    return page?.offsetWidth || el?.clientWidth || 1;
  };

  // Put the remembered column in view on open, and again whenever the layout
  // changes (columns hidden or shown, rotation).
  useLayoutEffect(() => {
    const el = pager.current;
    if (!el) return;
    programmatic.current = true;
    el.scrollLeft = start * pageWidth();
    const id = setTimeout(() => (programmatic.current = false), 80);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols, shown.length]);

  // Remember it, and keep its pill in view.
  useEffect(() => {
    const s = shown[start];
    if (s) writePref("mBoardCol", s);
    const pill = pills.current?.children[start] as HTMLElement | undefined;
    pill?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [start, shown]);

  const goTo = (i: number) => {
    const el = pager.current;
    const s = shown[i];
    if (!el || !s) return;
    programmatic.current = true;
    setFirst(s);
    el.scrollTo({ left: Math.min(i, maxFirst) * pageWidth(), behavior: "smooth" });
    setTimeout(() => (programmatic.current = false), 450);
  };

  const onScroll = () => {
    const el = pager.current;
    if (!el || programmatic.current) return;
    const i = Math.round(el.scrollLeft / pageWidth());
    const s = shown[Math.max(0, Math.min(i, shown.length - 1))];
    if (s && s !== shown[start]) setFirst(s);
  };

  const toggleColumn = useCallback((s: Status) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else if (STATUS_ORDER.length - next.size > 1) next.add(s); // keep at least one
      writeHidden([...next]);
      return next;
    });
  }, []);

  const countOf = (s: Status) => {
    const list = columns.get(s)!;
    return s === "DONE" ? list.filter((tk) => !isArchived(tk)).length : list.length;
  };
  const inView = (i: number) => i >= start && i < start + cols;

  return (
    <div className="m-page" style={{ paddingTop: 10 }}>
      {searching && (
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
            className="m-hit"
            aria-label={t("m.close")}
            onClick={() => {
              setQuery("");
              setSearching(false);
            }}
          >
            <IconClose size={18} />
          </button>
        </div>
      )}

      <div className="m-pills" style={{ marginBottom: 6 }}>
        {!searching && (
          <button className="m-pill" aria-label={t("m.search")} onClick={() => setSearching(true)} style={{ padding: "0 11px" }}>
            <IconSearch size={17} />
          </button>
        )}
        <button
          className="m-pill"
          aria-pressed={hidden.size > 0}
          onClick={() => setColumnsOpen(true)}
          aria-label={t("m.columns")}
        >
          <IconBoard size={17} />
          {t("m.columns")}
          {hidden.size > 0 && <span className="m-pill__n">{shown.length}/{STATUS_ORDER.length}</span>}
        </button>
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
        {shown.map((s, i) => (
          <button key={s} role="tab" className="m-pill" aria-selected={inView(i)} onClick={() => goTo(i)}>
            <span className="m-dot" style={{ background: STATUS_VAR[s] }} />
            {t(`m.status.${s}`)}
            <span className="m-pill__n">{countOf(s)}</span>
          </button>
        ))}
      </div>
      {shown.length > cols && (
        <div className="m-dots" aria-hidden="true">
          {shown.map((s, i) => (
            <span key={s} data-on={inView(i)} />
          ))}
        </div>
      )}

      <div
        className={`m-pager${cols > 1 ? " m-pager--multi" : ""}`}
        ref={pager}
        onScroll={onScroll}
        style={{ ["--cols" as string]: cols }}
      >
        {shown.map((s) => {
          const all = columns.get(s)!;
          const list = s === "DONE" ? all.filter((tk) => !isArchived(tk)) : all;
          const archived = s === "DONE" ? all.filter((tk) => isArchived(tk)) : [];
          return (
            <section key={s} className="m-pager__page" aria-label={t(`m.status.${s}`)}>
              <div className="m-colhead">
                <span className="m-dot" style={{ background: STATUS_VAR[s], width: 10, height: 10, alignSelf: "center" }} />
                <h2>{t(`m.status.${s}`)}</h2>
                <span>{t(`m.statusHint.${s}`)}</span>
              </div>
              {list.length ? (
                <TaskList tasks={list} send={send} swipe={false} />
              ) : (
                <div className="m-empty">{query || mine || prio ? t("m.noMatch") : t("m.emptyCol")}</div>
              )}
              {s !== "DONE" ? (
                <button className="m-btn m-btn--block m-btn--ghost" style={{ marginTop: 12 }} onClick={() => nav.add({ status: s })}>
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
                        <TaskList tasks={archived} send={send} swipe={false} />
                      </div>
                    )}
                  </>
                )
              )}
            </section>
          );
        })}
      </div>

      {columnsOpen && (
        <ColumnsSheet hidden={hidden} counts={countOf} onToggle={toggleColumn} onClose={() => setColumnsOpen(false)} />
      )}
    </div>
  );
}

/** Which columns the board shows: a switch per column; at least one stays on. */
function ColumnsSheet({
  hidden,
  counts,
  onToggle,
  onClose,
}: {
  hidden: Set<Status>;
  counts: (s: Status) => number;
  onToggle: (s: Status) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const shownCount = STATUS_ORDER.length - hidden.size;
  return (
    <Sheet title={t("m.columns")} onClose={onClose}>
      <div className="m-panel m-list">
        {STATUS_ORDER.map((s) => {
          const on = !hidden.has(s);
          const locked = on && shownCount === 1;
          return (
            <button
              key={s}
              className="m-row"
              role="switch"
              aria-checked={on}
              disabled={locked}
              onClick={() => onToggle(s)}
            >
              <span className="m-row__icon" style={{ ["--tile" as string]: STATUS_VAR[s] }}>
                <span className="m-dot" style={{ background: "#fff" }} />
              </span>
              <span className="m-row__main">
                <span className="m-row__title">{t(`m.status.${s}`)}</span>
                <span className="m-row__hint">
                  {t(`m.statusHint.${s}`)} · {counts(s)}
                </span>
              </span>
              <span className="m-switch" aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <p className="m-sub" style={{ marginTop: 12, textAlign: "center" }}>
        {t("m.columnsHint")}
      </p>
    </Sheet>
  );
}
