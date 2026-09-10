import { PRIORITY_DOT } from "../lib/constants";
import type { Task } from "../lib/types";
import { daysSince, daysUntil, formatShort } from "../lib/dates";

interface Props {
  task: Task;
  onOpen: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
}

export function TaskCard({ task, onOpen, onDragStart, onDragEnd }: Props) {
  const done = task.subtasks.filter((s) => s.done).length;
  const total = task.subtasks.length;
  const until = daysUntil(task.dueDate);
  const waiting = task.status === "WAITING" ? daysSince(task.waitingSince) : 0;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className="group bg-white rounded-[12px] border border-[#E8E6E1] p-3 cursor-pointer hover:border-[#C9A96E] hover:shadow-sm transition-all select-none"
    >
      <div className="flex items-start gap-2">
        <span
          className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${PRIORITY_DOT[task.priority]}`}
        />
        <span className="font-semibold text-[13px] text-[#0A1931] leading-snug">
          {task.title}
        </span>
      </div>

      {task.desc && (
        <p className="text-[11px] text-[#6B6B6B] mt-1 line-clamp-2 pl-4">
          {task.desc}
        </p>
      )}

      <div className="flex items-center flex-wrap gap-1.5 mt-2 pl-4">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#8A8A8A]">
          {task.owner}
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
            {formatShort(task.dueDate)}
            {until !== null && until < 0 ? " • ritardo" : ""}
          </span>
        )}

        {task.status === "WAITING" && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F5F3EF] text-[#6B6B6B] border border-[#E8E6E1]">
            {waiting} gg
          </span>
        )}

        {total > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F5F3EF] text-[#6B6B6B] border border-[#E8E6E1]">
            ☑ {done}/{total}
          </span>
        )}
      </div>
    </div>
  );
}
