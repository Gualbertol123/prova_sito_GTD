import { useState } from "react";
import type { Op, Task } from "../lib/types";
import { PRIORITY_DOT } from "../lib/constants";
import { ownerLabel, statusLabel, useT, localeCode } from "../lib/i18n";
import { daysSince, daysUntil } from "../lib/dates";
import { TaskDetails } from "./TaskDetails";

interface Props {
  task: Task;
  members: string[];
  send: (op: Op) => void;
  draggable: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
}

export function TaskCard({ task, members, send, draggable, onDragStart, onDragEnd }: Props) {
  const { t, lang } = useT();
  const [open, setOpen] = useState(false);

  const done = task.subtasks.filter((s) => s.done).length;
  const total = task.subtasks.length;
  const until = daysUntil(task.dueDate);
  const waiting = task.status === "WAITING" ? daysSince(task.waitingSince) : 0;
  const dueFmt = task.dueDate ? new Date(task.dueDate).toLocaleDateString(localeCode(lang)) : "";
  const initial = (task.owner || "?").charAt(0).toUpperCase();

  return (
    <div
      draggable={draggable && !open}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="bg-white rounded-[12px] border border-[#E8E6E1] hover:border-[#C9A96E] transition-colors"
    >
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left p-3 flex items-start gap-2">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${PRIORITY_DOT[task.priority]}`} />
        <span className="flex-1 min-w-0 font-semibold text-[13px] text-[#0A1931] leading-snug break-words [overflow-wrap:anywhere]">
          {task.title}
        </span>
        <span className="shrink-0 text-[10px] font-semibold tracking-wide uppercase px-2 py-1 rounded-full bg-[#0A1931] text-[#C9A96E]">
          {statusLabel(lang, task.status)}
        </span>
      </button>

      {!open && (
        <div className="px-3 pb-3 -mt-1 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[11px] text-[#6B6B6B]">
            <span className="w-4 h-4 rounded-full bg-[#0A1931] text-white text-[8px] font-bold flex items-center justify-center">
              {initial}
            </span>
            {ownerLabel(t, task.owner)}
          </span>
          {task.dueDate && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full border ${
                until !== null && until < 0
                  ? "bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]"
                  : until !== null && until <= 2
                  ? "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]"
                  : "bg-[#F5F3EF] text-[#6B6B6B] border-[#E8E6E1]"
              }`}
            >
              {dueFmt}
            </span>
          )}
          {task.status === "WAITING" && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F5F3EF] text-[#6B6B6B] border border-[#E8E6E1]">
              {waiting} {t("task.days")}
            </span>
          )}
          {total > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F5F3EF] text-[#6B6B6B] border border-[#E8E6E1]">
              ☑ {done}/{total}
            </span>
          )}
        </div>
      )}

      {open && (
        <div className="px-3 pb-3">
          <TaskDetails task={task} members={members} send={send} />
        </div>
      )}
    </div>
  );
}
