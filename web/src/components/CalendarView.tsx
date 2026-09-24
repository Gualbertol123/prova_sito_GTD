import { useState } from "react";
import type { Board, Op, Task } from "../lib/types";
import { PRIORITY_DOT } from "../lib/constants";
import { sameDay, toISODate } from "../lib/dates";
import { monthName, weekdayNames, useT } from "../lib/i18n";
import { TaskDetails } from "./TaskDetails";

interface Props {
  board: Board;
  tasks: Task[]; // filtered
  members: string[];
  send: (op: Op) => void;
}

export function CalendarView({ board, tasks, members, send }: Props) {
  const { t, lang } = useT();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const weekdays = weekdayNames(lang);
  const withoutDue = tasks.filter((tk) => !tk.dueDate && tk.status !== "DONE");
  const selected = board.tasks.find((tk) => tk.id === selectedId) ?? null;

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const setDue = (id: string, date: Date) => send({ type: "setDueDate", id, dueDate: toISODate(date) });

  return (
    <div className="space-y-4">
      <div className="text-[12px] text-[#6B6B6B]">{t("cal.help")}</div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 items-start">
        {/* Left panel: selected task details, or unscheduled list */}
        <div className="space-y-4">
          <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-3">
            <div className="font-trajan text-[11px] uppercase text-[#8A8A8A] mb-3">{t("cal.details")}</div>
            {selected ? (
              <TaskDetails
                task={selected}
                members={members}
                send={send}
                multiAssign={board.assigneesAvailable !== false}
                onDeleted={() => setSelectedId(null)}
              />
            ) : (
              <div className="text-[12px] text-[#A8A29E] py-4">{t("cal.selectHint")}</div>
            )}
          </div>

          <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-3">
            <div className="font-trajan text-[11px] uppercase text-[#8A8A8A] mb-2">{t("cal.noDue")}</div>
            {withoutDue.length === 0 ? (
              <div className="text-[11px] text-[#A8A29E]">{t("cal.allHaveDate")}</div>
            ) : (
              <div className="space-y-1.5">
                {withoutDue.map((tk) => (
                  <div
                    key={tk.id}
                    draggable
                    onDragStart={() => setDragId(tk.id)}
                    onDragEnd={() => setDragId(null)}
                    onClick={() => setSelectedId(tk.id)}
                    className={`flex items-center gap-2 bg-[#F5F3EF] rounded-lg border px-2 py-1.5 cursor-pointer hover:border-[#C9A96E] ${
                      selectedId === tk.id ? "border-[#C9A96E]" : "border-[#E8E6E1]"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[tk.priority]}`} />
                    <span className="text-[12px] text-[#0A1931] truncate">{tk.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Calendar grid */}
        <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              className="h-8 w-8 rounded-full border border-[#E8E6E1] hover:border-[#C9A96E]"
            >
              ‹
            </button>
            <div className="font-trajan text-[14px] uppercase tracking-widest text-[#0A1931]">
              {monthName(lang, month.getMonth())} {month.getFullYear()}
            </div>
            <button
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              className="h-8 w-8 rounded-full border border-[#E8E6E1] hover:border-[#C9A96E]"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {weekdays.map((w) => (
              <div key={w} className="text-[10px] uppercase text-[#8A8A8A] text-center font-semibold">{w}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 auto-rows-fr">
            {cells.map((date, i) => {
              if (!date) return <div key={i} />;
              const key = toISODate(date);
              const dayTasks = tasks.filter((tk) => tk.dueDate && sameDay(new Date(tk.dueDate), date));
              const isToday = sameDay(date, today);
              return (
                <div
                  key={key}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverKey(key);
                  }}
                  onDragLeave={() => setOverKey((k) => (k === key ? null : k))}
                  onDrop={() => {
                    if (dragId) setDue(dragId, date);
                    setDragId(null);
                    setOverKey(null);
                  }}
                  className={`min-h-[80px] rounded-lg border p-1 ${
                    overKey === key ? "border-[#C9A96E] bg-[#FAF9F6]" : "border-[#E8E6E1]"
                  } ${isToday ? "bg-[#F5F3EF]" : ""}`}
                >
                  <div className={`text-[11px] text-right px-1 ${isToday ? "font-bold text-[#8B6F3E]" : "text-[#8A8A8A]"}`}>
                    {date.getDate()}
                  </div>
                  <div className="space-y-0.5 mt-0.5">
                    {dayTasks.map((tk) => (
                      <button
                        key={tk.id}
                        draggable
                        onDragStart={() => setDragId(tk.id)}
                        onDragEnd={() => setDragId(null)}
                        onClick={() => setSelectedId(tk.id)}
                        title={tk.title}
                        className={`w-full flex items-center gap-1 rounded px-1 py-0.5 cursor-pointer text-left ${
                          selectedId === tk.id ? "bg-[#0A1931]" : "bg-[#F5F3EF] hover:bg-[#EFECE6]"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[tk.priority]}`} />
                        <span className={`text-[10px] truncate ${selectedId === tk.id ? "text-white" : "text-[#0A1931]"}`}>
                          {tk.title}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
