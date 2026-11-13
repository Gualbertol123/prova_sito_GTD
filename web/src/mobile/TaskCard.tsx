import { useRef } from "react";
import type { Task } from "../lib/types";
import { useT } from "../lib/i18n";
import { useProjects } from "../lib/projectsContext";
import { projectColor, stepOf } from "../lib/projects";
import { daysSince } from "../lib/dates";
import { Avatars, DueChip, PRIO_VAR } from "./ui";
import { IconArrowRight, IconCheck, IconHourglass } from "./icons";

const SWIPE_AT = 88; // px past which a swipe acts

/**
 * One task in a list. Tap opens it; the round check marks it done (or
 * reopens it). Swipe right does the same as the check; swipe left asks where
 * to move it.
 */
export function TaskCard({
  task,
  onOpen,
  onToggleDone,
  onMove,
  showStatus,
}: {
  task: Task;
  onOpen: () => void;
  onToggleDone: () => void;
  onMove: () => void;
  showStatus?: boolean;
}) {
  const { t } = useT();
  const { projects, tasks } = useProjects();
  const project = task.projectId ? projects.find((p) => p.id === task.projectId) : undefined;
  const step = stepOf(task, projects, tasks);
  const done = task.status === "DONE";
  const subDone = task.subtasks.filter((s) => s.done).length;

  const card = useRef<HTMLDivElement>(null);
  const g = useRef<{ x0: number; y0: number; dx: number; mode: "?" | "x" | "y" } | null>(null);
  const swallowClick = useRef(false);

  const setX = (x: number, animate: boolean) => {
    const el = card.current;
    if (!el) return;
    el.style.transition = animate ? "transform 0.22s ease" : "none";
    el.style.transform = x ? `translateX(${x}px)` : "";
    const under = el.parentElement?.querySelectorAll<HTMLElement>(".m-swipe__under");
    under?.forEach((u) => {
      const right = u.classList.contains("m-swipe__under--done");
      u.style.opacity = (right ? x > 0 : x < 0) ? String(Math.min(1, Math.abs(x) / SWIPE_AT)) : "0";
    });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    g.current = { x0: e.clientX, y0: e.clientY, dx: 0, mode: "?" };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = g.current;
    if (!s) return;
    const dx = e.clientX - s.x0;
    const dy = e.clientY - s.y0;
    if (s.mode === "?") {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      s.mode = Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : "y";
      if (s.mode === "x") (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (s.mode !== "x") return;
    // Resist past the action point so it feels like a detent.
    s.dx = Math.abs(dx) > SWIPE_AT ? Math.sign(dx) * (SWIPE_AT + (Math.abs(dx) - SWIPE_AT) * 0.35) : dx;
    setX(s.dx, false);
  };
  const end = () => {
    const s = g.current;
    g.current = null;
    if (!s || s.mode !== "x") return;
    swallowClick.current = true;
    setTimeout(() => (swallowClick.current = false), 60);
    if (s.dx >= SWIPE_AT) {
      try {
        navigator.vibrate?.(8);
      } catch {
        /* not supported */
      }
      onToggleDone();
    } else if (s.dx <= -SWIPE_AT) {
      onMove();
    }
    setX(0, true);
  };

  const waiting = task.status === "WAITING" && task.waitingSince ? daysSince(task.waitingSince) : null;

  return (
    <div className="m-swipe">
      <div className="m-swipe__under m-swipe__under--done" style={{ opacity: 0 }}>
        <IconCheck size={20} /> {done ? t("m.reopen") : t("m.markDone")}
      </div>
      <div className="m-swipe__under m-swipe__under--move" style={{ opacity: 0 }}>
        {t("m.move")} <IconArrowRight size={20} />
      </div>
      <div
        ref={card}
        className={`m-card${done ? " m-card--done" : ""}`}
        style={{ ["--prio" as string]: PRIO_VAR[task.priority] }}
        role="button"
        tabIndex={0}
        onClick={() => !swallowClick.current && onOpen()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div className="m-card__top">
          <div className="m-card__title">{task.title || t("m.untitled")}</div>
          <button
            className="m-check"
            role="checkbox"
            aria-checked={done}
            aria-label={done ? t("m.reopen") : t("m.markDone")}
            onClick={(e) => {
              e.stopPropagation();
              onToggleDone();
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <IconCheck size={15} />
          </button>
        </div>
        {task.desc && <div className="m-card__desc">{task.desc}</div>}
        <div className="m-card__meta">
          {showStatus && <span className="m-chip">{t(`m.status.${task.status}`)}</span>}
          <DueChip task={task} />
          {waiting !== null && (
            <span className={`m-chip ${waiting >= 7 ? "m-chip--red" : "m-chip--amber"}`}>
              <IconHourglass size={12} /> {t("m.waitingDays").replace("{n}", String(waiting))}
            </span>
          )}
          {project && (
            <span className="m-chip">
              <span className="m-chip__dot" style={{ background: projectColor(project) }} />
              {project.name}
              {step ? ` · ${step.n}/${step.total}` : ""}
            </span>
          )}
          {task.subtasks.length > 0 && (
            <span className={`m-chip${subDone === task.subtasks.length ? " m-chip--green" : ""}`}>
              ☑ {subDone}/{task.subtasks.length}
            </span>
          )}
          <Avatars task={task} />
        </div>
      </div>
    </div>
  );
}
