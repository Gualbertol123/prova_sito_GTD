import { useState } from "react";
import { isOwnedBy, withoutOwner } from "../lib/owners";
import type { Board, Op } from "../lib/types";
import { useT } from "../lib/i18n";

interface Props {
  board: Board;
  send: (op: Op) => void;
}

// Inline members management — no browser prompts/popups.
export function MembersBar({ board, send }: Props) {
  const { t } = useT();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);

  const commitAdd = () => {
    const v = name.trim();
    if (v && !board.members.includes(v)) {
      send({ type: "setMembers", members: [...board.members, v] });
    }
    setName("");
    setAdding(false);
  };

  const remove = (m: string) => {
    send({ type: "setMembers", members: board.members.filter((x) => x !== m) });
    // Take the departing member off every task they held. A task shared with
    // other people keeps them; only a task nobody else holds goes unassigned.
    board.tasks
      .filter((tk) => isOwnedBy(tk, m))
      .forEach((tk) =>
        send({ type: "updateTask", id: tk.id, patch: withoutOwner(tk, m) })
      );
    setConfirm(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-trajan text-[10px] uppercase tracking-widest text-[#8A8A8A] mr-1">
        {t("members.team")}
      </span>
      {board.members.map((m) => (
        <span
          key={m}
          className="group inline-flex items-center gap-1.5 h-8 pl-1 pr-2 rounded-full bg-white border border-[#E8E6E1] text-[12px] text-[#0A1931]"
        >
          <span className="w-6 h-6 rounded-full bg-[#0A1931] text-white text-[10px] font-bold flex items-center justify-center">
            {m.charAt(0).toUpperCase()}
          </span>
          {m}
          {confirm === m ? (
            <>
              <button onClick={() => remove(m)} className="text-[#DC2626] font-semibold text-[11px]">
                {t("task.yes")}
              </button>
              <button onClick={() => setConfirm(null)} className="text-[#8A8A8A] text-[11px]">
                {t("task.no")}
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirm(m)}
              className="text-[#C9C5BE] hover:text-[#DC2626] text-[13px]"
              title={t("members.remove")}
            >
              ×
            </button>
          )}
        </span>
      ))}

      {adding ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitAdd}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitAdd();
            if (e.key === "Escape") {
              setName("");
              setAdding(false);
            }
          }}
          placeholder={t("members.newName")}
          className="h-8 rounded-full bg-white border border-[#C9A96E] px-3 text-[12px] outline-none"
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="h-8 px-3 rounded-full border border-dashed border-[#C9A96E] text-[#8B6F3E] text-[12px] font-semibold hover:bg-[#FFFBF2]"
        >
          + {t("members.add")}
        </button>
      )}
    </div>
  );
}
