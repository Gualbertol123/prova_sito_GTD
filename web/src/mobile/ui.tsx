import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Priority, Status, Task } from "../lib/types";
import { UNASSIGNED } from "../lib/constants";
import { daysUntil } from "../lib/dates";
import { useT } from "../lib/i18n";
import { taskOwners } from "../lib/owners";
import { IconClose } from "./icons";

// ---- Colours ------------------------------------------------------------------

// Priority shows as the colour of a task's check ring (as in Reminders).
export const PRIO_VAR: Record<Priority, string> = {
  P1: "var(--m-red)",
  P2: "var(--m-orange)",
  P3: "var(--m-grey)",
  P4: "var(--m-fill-2)",
};

// The same column colours as the desktop's project bars (lib/projects.ts).
export const STATUS_VAR: Record<Status, string> = {
  BACKLOG: "var(--m-grey)",
  NEXT: "var(--m-blue)",
  "IN PROGRESS": "var(--m-purple)",
  WAITING: "var(--m-orange)",
  DONE: "var(--m-green)",
  MAYBE: "var(--m-teal)",
};

const AVATAR_COLORS = ["#2F5DA8", "#8E5BC9", "#C2563E", "#1F8A70", "#B07A1E", "#3C7DC4", "#A2456E", "#5C6B7E"];

// Team members get colours in list order, so no two share one (up to eight);
// anyone else falls back to a colour picked from the name.
let memberOrder: string[] = [];
export function setAvatarMembers(members: string[]): void {
  memberOrder = members;
}

export function avatarColor(name: string): string {
  if (name === UNASSIGNED) return "#7B8190";
  const i = memberOrder.indexOf(name);
  if (i >= 0) return AVATAR_COLORS[i % AVATAR_COLORS.length];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function Avatar({ name, large }: { name: string; large?: boolean }) {
  const letter = name === UNASSIGNED ? "?" : name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span className={`m-avatar${large ? " m-avatar--lg" : ""}`} style={{ background: avatarColor(name) }} title={name}>
      {letter}
    </span>
  );
}

export function Avatars({ task, max = 3 }: { task: Pick<Task, "owner" | "assignees">; max?: number }) {
  const names = taskOwners(task);
  return (
    <span className="m-avatars">
      {names.slice(0, max).map((n) => (
        <Avatar key={n} name={n} />
      ))}
    </span>
  );
}

// ---- Due date chip ------------------------------------------------------------

export function DueChip({ task }: { task: Task }) {
  const { t, lang } = useT();
  if (!task.dueDate || task.status === "DONE") return null;
  const d = daysUntil(task.dueDate);
  if (d === null) return null;
  let cls = "m-chip";
  let text: string;
  if (d < 0) {
    cls += " m-chip--red";
    text = t("m.due.late").replace("{n}", String(-d));
  } else if (d === 0) {
    cls += " m-chip--amber";
    text = t("m.due.today");
  } else if (d === 1) {
    cls += " m-chip--blue";
    text = t("m.due.tomorrow");
  } else {
    text = shortDay(task.dueDate, lang);
  }
  return <span className={cls}>{text}</span>;
}

export function shortDay(iso: string, lang: "it" | "en"): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(lang === "it" ? "it-IT" : "en-GB", { weekday: "short", day: "numeric", month: "short" });
}

// ---- Bottom sheet -------------------------------------------------------------

// Open sheets, oldest first: Escape and the page scroll lock act on the top one.
const sheetStack: number[] = [];
let sheetSeq = 0;

/**
 * A panel of thick glass that rises from the bottom. Closes on the ×, a tap
 * on the dimmed page, Escape (top sheet only), or dragging the handle down.
 * While any sheet is open the page behind it does not scroll.
 */
export function Sheet({
  title,
  onClose,
  children,
  full,
  headEnd,
  lead,
  tint,
}: {
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  full?: boolean;
  /** Buttons before the close button. */
  headEnd?: React.ReactNode;
  /** A button on the left of the header (e.g. Back). */
  lead?: React.ReactNode;
  /** A colour washed into the top of the sheet (a project's colour). */
  tint?: string;
}) {
  const { t } = useT();
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y0: number; dy: number } | null>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const id = ++sheetSeq;
    sheetStack.push(id);
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && sheetStack[sheetStack.length - 1] === id) close.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      sheetStack.splice(sheetStack.indexOf(id), 1);
      if (sheetStack.length === 0) document.body.style.overflow = "";
    };
  }, []);

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    drag.current = { y0: e.clientY, dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || !ref.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y0);
    ref.current.style.transform = `translateY(${drag.current.dy}px)`;
    ref.current.style.transition = "none";
  };
  const onUp = () => {
    if (!drag.current || !ref.current) return;
    const { dy } = drag.current;
    drag.current = null;
    ref.current.style.transition = "transform 0.22s ease";
    if (dy > 110) {
      ref.current.style.transform = "translateY(105%)";
      setTimeout(() => close.current(), 180);
    } else {
      ref.current.style.transform = "";
    }
  };
  const handlers = { onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onUp };

  return createPortal(
    <>
      <div className="m-backdrop" onClick={onClose} />
      <div ref={ref} className={`m-sheet${full ? " m-sheet--full" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        {tint && <div className="m-sheet__tint" style={{ ["--tint" as string]: tint }} />}
        <div className="m-sheet__grab" {...handlers} />
        <div className="m-sheet__head" {...handlers}>
          {lead}
          {title && <h3 className={headEnd ? "m-sheet__title--start" : undefined}>{title}</h3>}
          <span className="m-spacer" />
          {headEnd}
          <button className="m-iconbtn" onClick={onClose} aria-label={t("m.close")}>
            <IconClose size={18} />
          </button>
        </div>
        <div className="m-sheet__body">{children}</div>
      </div>
    </>,
    document.body
  );
}

// ---- Toast with undo ------------------------------------------------------------

interface ToastMsg {
  id: number;
  text: string;
  undo?: () => void;
}

const ToastCtx = createContext<(text: string, undo?: () => void) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const show = useCallback((text: string, undo?: () => void) => {
    clearTimeout(timer.current);
    const id = Date.now();
    setMsg({ id, text, undo });
    timer.current = setTimeout(() => setMsg((m) => (m?.id === id ? null : m)), undo ? 5000 : 2600);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && (
        <div className="m-toast" role="status" key={msg.id}>
          <span>{msg.text}</span>
          {msg.undo && (
            <button
              onClick={() => {
                msg.undo?.();
                setMsg(null);
              }}
            >
              {t("m.undo")}
            </button>
          )}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

// ---- Progress ring -----------------------------------------------------------

export function Ring({ share, color, size = 44 }: { share: number; color: string; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg className="m-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--m-fill-2)" strokeWidth={5} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={`${c * share} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fontSize={size * 0.26}
        fontWeight={700}
        fill="var(--m-text)"
      >
        {Math.round(share * 100)}
      </text>
    </svg>
  );
}
