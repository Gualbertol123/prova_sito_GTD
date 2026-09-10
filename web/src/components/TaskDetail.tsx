import { useState } from "react";
import type { Op, Task } from "../lib/types";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  STATUS_ORDER,
  UNASSIGNED,
  genId,
} from "../lib/constants";
import type { Priority, Status } from "../lib/types";
import { useSyncedField } from "../lib/useSyncedField";
import { daysSince } from "../lib/dates";

interface Props {
  task: Task;
  members: string[];
  send: (op: Op) => void;
  onClose: () => void;
}

const PRIOS: Priority[] = ["P1", "P2", "P3", "P4"];

export function TaskDetail({ task, members, send, onClose }: Props) {
  const title = useSyncedField(task.title);
  const desc = useSyncedField(task.desc);
  const notes = useSyncedField(task.notes);
  const [newSub, setNewSub] = useState("");

  const patch = (p: Partial<Task>) =>
    send({ type: "updateTask", id: task.id, patch: p });

  const done = task.subtasks.filter((s) => s.done).length;
  const total = task.subtasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const addSub = () => {
    const t = newSub.trim();
    if (!t) return;
    send({
      type: "addSubtask",
      taskId: task.id,
      subtask: { id: genId(), text: t, done: false },
    });
    setNewSub("");
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 flex items-start justify-center p-4 overflow-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[16px] w-full max-w-[560px] mt-10 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#E8E6E1] flex items-start gap-3">
          <textarea
            rows={1}
            value={title.value}
            onFocus={title.onFocus}
            onBlur={() => {
              title.onBlur();
              if (title.value.trim() && title.value !== task.title)
                patch({ title: title.value.trim() });
            }}
            onChange={(e) => title.setValue(e.target.value)}
            className="flex-1 font-trajan text-[16px] text-[#0A1931] outline-none resize-none leading-snug"
          />
          <button
            onClick={onClose}
            className="text-[#8A8A8A] hover:text-[#0A1931] text-[20px] leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Owner / Priority / Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block">
              <span className="font-trajan text-[10px] uppercase text-[#A8A29E]">
                Owner
              </span>
              <select
                value={task.owner}
                onChange={(e) => patch({ owner: e.target.value })}
                className="mt-1 w-full h-9 rounded-lg bg-[#F5F3EF] border border-[#E8E6E1] px-2 text-[13px] outline-none focus:border-[#C9A96E]"
              >
                <option value={UNASSIGNED}>{UNASSIGNED}</option>
                {members.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="font-trajan text-[10px] uppercase text-[#A8A29E]">
                Priorità
              </span>
              <select
                value={task.priority}
                onChange={(e) =>
                  patch({ priority: e.target.value as Priority })
                }
                className="mt-1 w-full h-9 rounded-lg bg-[#F5F3EF] border border-[#E8E6E1] px-2 text-[13px] outline-none focus:border-[#C9A96E]"
              >
                {PRIOS.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="font-trajan text-[10px] uppercase text-[#A8A29E]">
                Scadenza
              </span>
              <input
                type="date"
                value={task.dueDate ?? ""}
                onChange={(e) =>
                  send({
                    type: "setDueDate",
                    id: task.id,
                    dueDate: e.target.value || undefined,
                  })
                }
                className="mt-1 w-full h-9 rounded-lg bg-[#F5F3EF] border border-[#E8E6E1] px-2 text-[13px] outline-none focus:border-[#C9A96E]"
              />
            </label>
          </div>

          {/* Status buttons */}
          <div>
            <span className="font-trajan text-[10px] uppercase text-[#A8A29E]">
              Stato
            </span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  onClick={() =>
                    send({ type: "moveTask", id: task.id, status: s as Status })
                  }
                  className={`h-8 px-3 rounded-full text-[11px] font-semibold border transition-colors ${
                    task.status === s
                      ? "bg-[#0A1931] text-[#C9A96E] border-[#0A1931]"
                      : "bg-white text-[#0A1931] border-[#E8E6E1] hover:border-[#C9A96E]"
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            {task.status === "WAITING" && task.waitingSince && (
              <p className="mt-1 text-[11px] text-[#92400E]">
                In attesa da {daysSince(task.waitingSince)} giorni
              </p>
            )}
          </div>

          {/* Description */}
          <label className="block">
            <span className="font-trajan text-[10px] uppercase text-[#A8A29E]">
              Descrizione
            </span>
            <textarea
              rows={2}
              value={desc.value}
              onFocus={desc.onFocus}
              onBlur={() => {
                desc.onBlur();
                if (desc.value !== task.desc) patch({ desc: desc.value });
              }}
              onChange={(e) => desc.setValue(e.target.value)}
              className="mt-1 w-full rounded-lg bg-[#F5F3EF] border border-[#E8E6E1] p-2 text-[13px] outline-none focus:border-[#C9A96E] resize-none"
            />
          </label>

          {/* Subtasks */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="font-trajan text-[11px] uppercase text-[#8A8A8A]">
                Sotto-attività {total ? `${done}/${total} · ${pct}%` : ""}
              </span>
            </div>
            {total > 0 && (
              <div className="h-1.5 rounded-full bg-[#E8E6E1] mb-2 overflow-hidden">
                <div
                  className="h-full bg-[#C9A96E] transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
            <div className="space-y-1">
              {task.subtasks.map((s) => (
                <div key={s.id} className="flex items-center gap-2 group">
                  <input
                    type="checkbox"
                    checked={s.done}
                    onChange={(e) =>
                      send({
                        type: "updateSubtask",
                        taskId: task.id,
                        subtaskId: s.id,
                        patch: { done: e.target.checked },
                      })
                    }
                    className="accent-[#C9A96E]"
                  />
                  <span
                    className={`text-[13px] flex-1 ${
                      s.done ? "line-through text-[#A8A29E]" : "text-[#0A1931]"
                    }`}
                  >
                    {s.text}
                  </span>
                  <button
                    onClick={() =>
                      send({
                        type: "deleteSubtask",
                        taskId: task.id,
                        subtaskId: s.id,
                      })
                    }
                    className="opacity-0 group-hover:opacity-100 text-[#DC2626] text-[12px]"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input
                value={newSub}
                onChange={(e) => setNewSub(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSub()}
                placeholder="Aggiungi sotto-attività…"
                className="flex-1 h-8 rounded-full bg-[#F5F3EF] border border-[#E8E6E1] px-3 text-[12px] outline-none focus:border-[#C9A96E]"
              />
              <button
                onClick={addSub}
                className="h-8 px-3 rounded-full bg-[#0A1931] text-[#C9A96E] text-[12px] font-semibold"
              >
                +
              </button>
            </div>
          </div>

          {/* Notes */}
          <label className="block">
            <span className="font-trajan text-[10px] uppercase text-[#A8A29E]">
              Note
            </span>
            <textarea
              rows={2}
              value={notes.value}
              onFocus={notes.onFocus}
              onBlur={() => {
                notes.onBlur();
                if (notes.value !== task.notes) patch({ notes: notes.value });
              }}
              onChange={(e) => notes.setValue(e.target.value)}
              className="mt-1 w-full rounded-lg bg-[#F5F3EF] border border-[#E8E6E1] p-2 text-[13px] outline-none focus:border-[#C9A96E] resize-none"
            />
          </label>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E8E6E1] flex justify-between items-center">
          <button
            onClick={() => {
              if (confirm("Eliminare task?")) {
                send({ type: "deleteTask", id: task.id });
                onClose();
              }
            }}
            className="h-9 px-4 rounded-full text-[12px] font-semibold text-[#DC2626] border border-[#FECACA] hover:bg-[#FEF2F2]"
          >
            Elimina
          </button>
          <button
            onClick={onClose}
            className="h-9 px-5 rounded-full text-[12px] font-semibold bg-[#0A1931] text-[#C9A96E]"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
