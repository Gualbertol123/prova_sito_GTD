import { useState } from "react";
import type { Op, Priority, Status, Task } from "../lib/types";
import { STATUS_ORDER, genId } from "../lib/constants";
import { priorityLabel, statusLabel, useT } from "../lib/i18n";
import { useSyncedField } from "../lib/useSyncedField";
import { daysSince } from "../lib/dates";
import { AutoTextarea } from "./AutoTextarea";
import { SortableSubtasks } from "./SortableSubtasks";

const PRIOS: Priority[] = ["P1", "P2", "P3", "P4"];

interface Props {
  task: Task;
  members: string[];
  send: (op: Op) => void;
  showNames?: boolean; // false hides the owner name (screenshot mode)
  onDeleted?: () => void;
}

// The full editable body for a task. Reused by the inline board card and the
// calendar side panel — no popups anywhere.
export function TaskDetails({ task, members, send, showNames = true, onDeleted }: Props) {
  const { t, lang } = useT();
  const [confirmDel, setConfirmDel] = useState(false);
  const [newSub, setNewSub] = useState("");

  const title = useSyncedField(task.title);
  const notes = useSyncedField(task.notes);
  const desc = useSyncedField(task.desc);
  const fileDir = useSyncedField(task.fileDir ?? "");
  const [copied, setCopied] = useState(false);

  const copyFileDir = async () => {
    if (!fileDir.value) return;
    try {
      await navigator.clipboard.writeText(fileDir.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — ignore */
    }
  };

  const done = task.subtasks.filter((s) => s.done).length;
  const total = task.subtasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const patch = (p: Partial<Task>) => send({ type: "updateTask", id: task.id, patch: p });
  const idx = STATUS_ORDER.indexOf(task.status);
  const move = (dir: -1 | 1) => {
    const next = STATUS_ORDER[idx + dir];
    if (next) send({ type: "moveTask", id: task.id, status: next });
  };
  const initial = (task.owner || "?").charAt(0).toUpperCase();

  const addSub = () => {
    const v = newSub.trim();
    if (!v) return;
    send({ type: "addSubtask", taskId: task.id, subtask: { id: genId(), text: v, done: false } });
    setNewSub("");
  };

  return (
    <div className="space-y-3">
      <AutoTextarea
        value={title.value}
        onFocus={title.onFocus}
        onChange={(e) => title.setValue(e.target.value)}
        onBlur={() => {
          title.onBlur();
          if (title.value.trim() && title.value !== task.title) patch({ title: title.value.trim() });
        }}
        className="w-full font-semibold text-[14px] leading-snug text-[#0A1931] bg-[#F5F3EF] rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-[#C9A96E]"
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1.5 bg-[#F5F3EF] rounded-full pl-1 pr-2 h-8 border border-[#E8E6E1]">
          <span className="w-6 h-6 rounded-full bg-[#0A1931] text-white text-[10px] font-bold flex items-center justify-center">
            {showNames ? initial : "•"}
          </span>
          {showNames ? (
            <select
              value={task.owner}
              onChange={(e) => patch({ owner: e.target.value })}
              className="bg-transparent text-[12px] text-[#0A1931] outline-none cursor-pointer"
            >
              <option value="Unassigned">{t("members.unassigned")}</option>
              {members.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          ) : (
            <span className="text-[12px] text-[#A8A29E] px-1">—</span>
          )}
        </div>

        <label className="inline-flex items-center gap-1.5 bg-[#F5F3EF] rounded-full px-3 h-8 border border-[#E8E6E1] text-[12px] text-[#6B6B6B]">
          {t("task.due")}
          <input
            type="date"
            value={task.dueDate ?? ""}
            onChange={(e) => send({ type: "setDueDate", id: task.id, dueDate: e.target.value || undefined })}
            className="bg-transparent outline-none text-[12px] text-[#0A1931]"
          />
        </label>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {PRIOS.map((p) => (
          <button
            key={p}
            onClick={() => patch({ priority: p })}
            title={priorityLabel(t, p)}
            className={`h-7 px-2.5 rounded-full text-[11px] font-semibold border transition-all ${
              task.priority === p
                ? p === "P1"
                  ? "bg-[#DC2626] text-white border-[#DC2626]"
                  : p === "P2"
                  ? "bg-[#C9A96E] text-[#0A1931] border-[#C9A96E]"
                  : p === "P3"
                  ? "bg-[#C9C5BE] text-[#0A1931] border-[#C9C5BE]"
                  : "bg-[#0A1931] text-white border-[#0A1931]"
                : "bg-white text-[#8A8A8A] border-[#E8E6E1] hover:border-[#C9A96E]"
            }`}
          >
            {p}
          </button>
        ))}
        <span className="text-[11px] text-[#8A8A8A] ml-1">{t(`prio.${task.priority}short`)}</span>
      </div>

      {task.status === "WAITING" && task.waitingSince && (
        <div className="text-[11px] text-[#92400E]">
          {t("task.waiting")} · {daysSince(task.waitingSince)} {t("task.days")}
        </div>
      )}

      {/* Subtasks — styled like a small kanban column */}
      <div className="bg-[#EFECE6] rounded-[12px] border border-[#E3DFD7] p-2.5">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="font-trajan text-[10px] uppercase tracking-wide text-[#8A8A8A]">
            {t("task.subtasks")} {total ? `${done}/${total} · ${pct}%` : ""}
          </span>
        </div>
        {total > 0 && (
          <div className="h-1.5 rounded-full bg-[#DED9D0] overflow-hidden mb-2.5 mx-0.5">
            <div className="h-full bg-[#C9A96E] transition-all" style={{ width: `${pct}%` }} />
          </div>
        )}
        <SortableSubtasks
          items={task.subtasks}
          onReorder={(subtasks) => patch({ subtasks })}
          onToggle={(subtaskId, done) =>
            send({
              type: "updateSubtask",
              taskId: task.id,
              subtaskId,
              patch: { done, doneAt: done ? Date.now() : undefined },
            })
          }
          onText={(subtaskId, text) =>
            send({ type: "updateSubtask", taskId: task.id, subtaskId, patch: { text } })
          }
          onDelete={(subtaskId) => send({ type: "deleteSubtask", taskId: task.id, subtaskId })}
        />
        <div className="flex items-center gap-1.5 mt-2">
          <span className="w-5 text-right text-[11px] font-semibold text-[#A8A29E] tabular-nums shrink-0">
            {total + 1}.
          </span>
          <input
            value={newSub}
            onChange={(e) => setNewSub(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSub()}
            placeholder={t("task.addSubtask")}
            className="flex-1 min-w-0 h-8 rounded-full bg-white border border-[#E8E6E1] px-3 text-[12px] outline-none focus:border-[#C9A96E]"
          />
          <button onClick={addSub} className="h-8 w-8 shrink-0 flex items-center justify-center rounded-full bg-[#0A1931] text-[#C9A96E] text-[14px] font-semibold">
            +
          </button>
        </div>
      </div>

      <div>
        <div className="font-trajan text-[10px] uppercase tracking-wide text-[#A8A29E] mb-1">
          {t("task.description")}
        </div>
        <AutoTextarea
          value={desc.value}
          onFocus={desc.onFocus}
          onChange={(e) => desc.setValue(e.target.value)}
          onBlur={() => {
            desc.onBlur();
            if (desc.value !== task.desc) patch({ desc: desc.value });
          }}
          placeholder={t("task.descPlaceholder")}
          className="w-full min-h-[3.2rem] rounded-lg bg-[#F5F3EF] border border-[#E8E6E1] p-2 text-[12px] outline-none focus:border-[#C9A96E]"
        />
      </div>

      <div>
        <div className="font-trajan text-[10px] uppercase tracking-wide text-[#A8A29E] mb-1">
          {t("task.notes")}
        </div>
        <AutoTextarea
          value={notes.value}
          onFocus={notes.onFocus}
          onChange={(e) => notes.setValue(e.target.value)}
          onBlur={() => {
            notes.onBlur();
            if (notes.value !== task.notes) patch({ notes: notes.value });
          }}
          placeholder={t("task.notesPlaceholder")}
          className="w-full min-h-[3.2rem] rounded-lg bg-[#F5F3EF] border border-[#E8E6E1] p-2 text-[12px] outline-none focus:border-[#C9A96E]"
        />
      </div>

      {/* File Directory — shared network path with a copy button */}
      <div>
        <div className="font-trajan text-[10px] uppercase tracking-wide text-[#A8A29E] mb-1">
          {t("task.fileDir")}
        </div>
        <div className="flex items-center gap-2 bg-[#F5F3EF] border border-[#E8E6E1] rounded-lg pl-2 pr-1 focus-within:border-[#C9A96E]">
          <span className="text-[#A8A29E] text-[12px] shrink-0">🗂</span>
          <input
            value={fileDir.value}
            onFocus={fileDir.onFocus}
            onChange={(e) => fileDir.setValue(e.target.value)}
            onBlur={() => {
              fileDir.onBlur();
              if (fileDir.value !== (task.fileDir ?? "")) patch({ fileDir: fileDir.value });
            }}
            placeholder={t("task.fileDirPlaceholder")}
            spellCheck={false}
            className="flex-1 min-w-0 bg-transparent py-2 text-[12px] font-mono text-[#0A1931] outline-none"
          />
          <button
            onClick={copyFileDir}
            disabled={!fileDir.value}
            title={t("task.copy")}
            className="shrink-0 h-8 px-3 my-0.5 rounded-md bg-[#0A1931] text-[#C9A96E] text-[11px] font-semibold disabled:opacity-30"
          >
            {copied ? t("task.copied") : t("task.copy")}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => move(-1)}
            disabled={idx <= 0}
            title={t("task.prev")}
            className="w-8 h-8 rounded-full border border-[#E8E6E1] text-[#0A1931] disabled:opacity-30 hover:border-[#C9A96E]"
          >
            ‹
          </button>
          <button
            onClick={() => move(1)}
            disabled={idx >= STATUS_ORDER.length - 1}
            title={t("task.next")}
            className="w-8 h-8 rounded-full bg-[#0A1931] text-white disabled:opacity-30"
          >
            ›
          </button>
          {/* Move directly to any section */}
          <select
            value={task.status}
            onChange={(e) => send({ type: "moveTask", id: task.id, status: e.target.value as Status })}
            title={t("quick.status")}
            className="h-8 rounded-full bg-[#F5F3EF] border border-[#E8E6E1] px-2 text-[12px] text-[#0A1931] outline-none focus:border-[#C9A96E] cursor-pointer"
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{statusLabel(lang, s)}</option>
            ))}
          </select>
        </div>
        {confirmDel ? (
          <div className="flex items-center gap-2 text-[13px] bg-[#FEF2F2] border border-[#FECACA] rounded-full pl-3 pr-1 py-1">
            <span className="text-[#DC2626] font-semibold">{t("task.confirmDelete")}</span>
            <button
              onClick={() => {
                send({ type: "deleteTask", id: task.id });
                onDeleted?.();
              }}
              className="h-8 px-4 rounded-full bg-[#DC2626] text-white text-[12px] font-semibold"
            >
              {t("task.yes")}
            </button>
            <button
              onClick={() => setConfirmDel(false)}
              className="h-8 px-4 rounded-full bg-white text-[#6B6B6B] border border-[#E8E6E1] text-[12px] font-semibold"
            >
              {t("task.no")}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDel(true)}
            className="h-8 px-4 rounded-full text-[12px] font-semibold text-[#8A8A8A] border border-[#E8E6E1] hover:text-[#DC2626] hover:border-[#FECACA]"
          >
            {t("task.delete")}
          </button>
        )}
      </div>
    </div>
  );
}
