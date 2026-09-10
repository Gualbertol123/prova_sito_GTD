import type { Board, Op } from "../lib/types";
import { UNASSIGNED } from "../lib/constants";

interface Props {
  board: Board;
  send: (op: Op) => void;
}

export function MembersBar({ board, send }: Props) {
  const add = () => {
    const name = prompt("Nome nuovo membro?")?.trim();
    if (!name) return;
    if (board.members.includes(name)) return;
    send({ type: "setMembers", members: [...board.members, name] });
  };

  const remove = (m: string) => {
    if (!confirm(`Rimuovere ${m}? I suoi task diventeranno "${UNASSIGNED}".`))
      return;
    send({ type: "setMembers", members: board.members.filter((x) => x !== m) });
    // Reassign that member's tasks to Unassigned.
    board.tasks
      .filter((t) => t.owner === m)
      .forEach((t) =>
        send({ type: "updateTask", id: t.id, patch: { owner: UNASSIGNED } })
      );
  };

  return (
    <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-3 flex flex-wrap items-center gap-2">
      <span className="font-trajan text-[10px] uppercase tracking-widest text-[#8A8A8A] mr-1">
        Team
      </span>
      {board.members.map((m) => (
        <span
          key={m}
          className="group inline-flex items-center gap-1.5 h-8 pl-3 pr-2 rounded-full bg-[#F5F3EF] border border-[#E8E6E1] text-[12px] text-[#0A1931]"
        >
          {m}
          <button
            onClick={() => remove(m)}
            className="text-[#C9C5BE] hover:text-[#DC2626] text-[13px]"
            title="Rimuovi"
          >
            ×
          </button>
        </span>
      ))}
      <button
        onClick={add}
        className="h-8 px-3 rounded-full border border-dashed border-[#C9A96E] text-[#8B6F3E] text-[12px] font-semibold hover:bg-[#FFFBF2]"
      >
        + Membro
      </button>
    </div>
  );
}
