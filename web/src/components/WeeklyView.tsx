import { useState } from "react";
import type { Board, Op, Weekly } from "../lib/types";
import { WEEKLY_COLUMNS, genId } from "../lib/constants";
import { useT } from "../lib/i18n";

interface Props {
  board: Board;
  send: (op: Op) => void;
}

export function WeeklyView({ board, send }: Props) {
  const { t } = useT();
  const doneThisWeek = board.tasks.filter((tk) => tk.status === "DONE");
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-[12px] text-[#6B6B6B]">{t("weekly.help")}</div>
        {confirmClear ? (
          <div className="flex items-center gap-2 text-[12px]">
            <span className="text-[#DC2626]">{t("weekly.confirmClear")}</span>
            <button
              onClick={() => {
                send({ type: "weeklyClear" });
                setConfirmClear(false);
              }}
              className="font-semibold text-[#DC2626]"
            >
              {t("task.yes")}
            </button>
            <button onClick={() => setConfirmClear(false)} className="text-[#8A8A8A]">
              {t("task.no")}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmClear(true)}
            className="h-9 px-4 rounded-full text-[12px] font-semibold bg-white text-[#8A8A8A] border border-[#E8E6E1] hover:border-[#DC2626] hover:text-[#DC2626]"
          >
            {t("weekly.clear")}
          </button>
        )}
      </div>

      {/* Done this week (auto) */}
      <div className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-[14px] p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="font-trajan text-[11px] uppercase tracking-widest text-[#065F46]">
            {t("weekly.doneThisWeek")}
          </span>
          <span className="bg-white border border-[#A7F3D0] text-[#065F46] text-[11px] font-semibold rounded-full px-2 py-0.5">
            {doneThisWeek.length}
          </span>
        </div>
        {doneThisWeek.length === 0 ? (
          <div className="text-[12px] text-[#065F46]/70">{t("weekly.noneDone")}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {doneThisWeek.map((tk) => {
              const total = tk.subtasks.length;
              const done = tk.subtasks.filter((s) => s.done).length;
              return (
                <div
                  key={tk.id}
                  className="text-[13px] text-[#065F46] bg-white rounded-lg border border-[#A7F3D0] px-3 py-1.5 flex items-center justify-between gap-2"
                >
                  <span className="min-w-0">
                    <span className="font-medium">{tk.title}</span>
                    <span className="text-[#8A8A8A] text-[11px]"> · {tk.owner}</span>
                    {tk.desc && <span className="text-[#8A8A8A] text-[11px] block truncate">{tk.desc}</span>}
                  </span>
                  <span className="shrink-0 flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#ECFDF5] border border-[#A7F3D0]">
                      {tk.priority}
                    </span>
                    {total > 0 && (
                      <span className="text-[10px] text-[#8A8A8A]">
                        ☑ {done}/{total} {t("weekly.subtasksDone")}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {WEEKLY_COLUMNS.map((col) => (
          <WeeklyColumn
            key={col.key}
            colKey={col.key}
            label={col.label}
            color={col.color}
            items={board.weekly[col.key]}
            send={send}
          />
        ))}
      </div>
    </div>
  );
}

function WeeklyColumn({
  colKey,
  label,
  color,
  items,
  send,
}: {
  colKey: keyof Weekly;
  label: string;
  color: string;
  items: { id: string; text: string }[];
  send: (op: Op) => void;
}) {
  const { t } = useT();
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    send({ type: "weeklyAdd", column: colKey, item: { id: genId(), text: v } });
    setDraft("");
  };

  return (
    <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-3">
      <div
        className={`text-[10px] font-semibold uppercase tracking-widest rounded-full px-3 py-1 border inline-block mb-3 ${color}`}
      >
        {label}
      </div>
      <div className="space-y-1.5">
        {items.map((it) => (
          <div key={it.id} className="group flex items-start gap-1">
            <textarea
              rows={1}
              defaultValue={it.text}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== it.text)
                  send({ type: "weeklyUpdate", column: colKey, id: it.id, text: v });
              }}
              className="flex-1 text-[12px] text-[#0A1931] bg-[#F5F3EF] rounded-lg border border-[#E8E6E1] p-2 outline-none focus:border-[#C9A96E] resize-none"
            />
            <button
              onClick={() => send({ type: "weeklyDelete", column: colKey, id: it.id })}
              className="opacity-0 group-hover:opacity-100 text-[#DC2626] text-[12px] mt-1"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-1 mt-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={t("weekly.add")}
          className="flex-1 h-8 rounded-full bg-[#F5F3EF] border border-[#E8E6E1] px-3 text-[12px] outline-none focus:border-[#C9A96E]"
        />
        <button
          onClick={add}
          className="h-8 w-8 rounded-full bg-[#0A1931] text-[#C9A96E] text-[13px] font-semibold shrink-0"
        >
          +
        </button>
      </div>
    </div>
  );
}
