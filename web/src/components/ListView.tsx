import { Fragment, useState } from "react";
import type { Op, Task } from "../lib/types";
import { PRIORITY_DOT } from "../lib/constants";
import { ownerLabel, statusLabel, useT, localeCode } from "../lib/i18n";
import { TaskDetails } from "./TaskDetails";

interface Props {
  tasks: Task[]; // already filtered to visible columns + search
  members: string[];
  send: (op: Op) => void;
  showNames?: boolean; // false hides owner names (screenshot mode)
}

// Flat list of every activity in the viewable columns. Click a row to expand
// its full details inline (no popup).
export function ListView({ tasks, members, send, showNames = true }: Props) {
  const { t, lang } = useT();
  const [openId, setOpenId] = useState<string | null>(null);

  if (tasks.length === 0) {
    return (
      <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-8 text-center text-[13px] text-[#A8A29E]">
        {t("list.empty")}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[14px] border border-[#E8E6E1] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[680px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-[#8A8A8A] bg-[#FAF9F6]">
              <th className="font-semibold px-4 py-2.5">{t("list.task")}</th>
              <th className="font-semibold px-3 py-2.5">{t("list.owner")}</th>
              <th className="font-semibold px-3 py-2.5">{t("list.priority")}</th>
              <th className="font-semibold px-3 py-2.5">{t("list.status")}</th>
              <th className="font-semibold px-3 py-2.5">{t("list.due")}</th>
              <th className="font-semibold px-3 py-2.5 text-center">{t("list.subtasks")}</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((tk) => {
              const done = tk.subtasks.filter((s) => s.done).length;
              const total = tk.subtasks.length;
              const dueFmt = tk.dueDate ? new Date(tk.dueDate).toLocaleDateString(localeCode(lang)) : "—";
              const isOpen = openId === tk.id;
              return (
                <Fragment key={tk.id}>
                  <tr
                    onClick={() => setOpenId(isOpen ? null : tk.id)}
                    className={`border-t border-[#F0EDE8] cursor-pointer hover:bg-[#FAF9F6] ${
                      isOpen ? "bg-[#FAF9F6]" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 mt-1 ${PRIORITY_DOT[tk.priority]}`} />
                        <span className="text-[13px] font-medium text-[#0A1931] break-words [overflow-wrap:anywhere]">
                          {tk.title}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-[#6B6B6B]">
                      {showNames ? ownerLabel(t, tk.owner) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-semibold text-[#0A1931]">{tk.priority}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full bg-[#0A1931] text-[#C9A96E]">
                        {statusLabel(lang, tk.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-[#6B6B6B]">{dueFmt}</td>
                    <td className="px-3 py-2.5 text-[12px] text-[#6B6B6B] text-center">
                      {total ? `${done}/${total}` : "—"}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-[#FAF9F6]">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="max-w-[560px]">
                          <TaskDetails
                            task={tk}
                            members={members}
                            send={send}
                            showNames={showNames}
                            onDeleted={() => setOpenId(null)}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
