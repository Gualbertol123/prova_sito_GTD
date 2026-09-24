import { useState } from "react";
import type { Op, Priority, Status, Task } from "../lib/types";
import { STATUS_ORDER, UNASSIGNED, genId } from "../lib/constants";
import { ownerInitial, ownersLabel, ownersPatch } from "../lib/owners";
import { priorityLabel, statusLabel, useT } from "../lib/i18n";
import { useMe } from "../lib/identity";

const PRIOS: Priority[] = ["P1", "P2", "P3", "P4"];

interface Props {
  members: string[];
  send: (op: Op) => void;
  showNames?: boolean; // false hides the owner name (screenshot mode)
  /** False before migration 009: a new task can only be given to one person. */
  multiAssign?: boolean;
}

// Full new-task bar: choose who it goes to, priority, status and due date up
// front — nothing is assumed. The assignee control holds as many people as you
// like, the same as the picker inside a task.
export function QuickAdd({ members, send, showNames = true, multiAssign = true }: Props) {
  const { t, lang } = useT();
  const { me } = useMe();
  const [title, setTitle] = useState("");
  const [owners, setOwners] = useState<string[]>([
    me && members.includes(me) ? me : members[0] ?? UNASSIGNED,
  ]);
  const [pickOpen, setPickOpen] = useState(false);
  const [priority, setPriority] = useState<Priority>("P2");
  const [status, setStatus] = useState<Status>("NEXT");
  const [due, setDue] = useState("");

  const memberLabel = (name: string) => (name === UNASSIGNED ? t("members.unassigned") : name);

  // Same rule as the picker inside a task: a name adds when several people can
  // share, replaces when they cannot, and Unassigned never shares.
  const toggleOwner = (name: string) => {
    if (!multiAssign || name === UNASSIGNED) {
      setOwners([name]);
      return;
    }
    setOwners((prev) =>
      prev.includes(name)
        ? prev.filter((o) => o !== name).length
          ? prev.filter((o) => o !== name)
          : [UNASSIGNED]
        : [...prev.filter((o) => o !== UNASSIGNED), name]
    );
  };

  const create = () => {
    const v = title.trim();
    if (!v) return;
    const task: Task = {
      id: genId(),
      title: v,
      desc: "",
      ...ownersPatch(owners),
      priority,
      status,
      notes: "",
      subtasks: [],
      dueDate: due || undefined,
      updatedAt: Date.now(),
      createdAt: Date.now(),
    };
    send({ type: "addTask", task });
    setTitle("");
    setDue("");
    setPickOpen(false);
  };

  const field =
    "h-11 rounded-full bg-white border border-[#E8E6E1] text-[13px] outline-none focus:border-[#C9A96E]";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && create()}
        placeholder={t("quick.title")}
        className={`${field} flex-1 min-w-[200px] px-5`}
      />
      {showNames ? (
        <button
          type="button"
          onClick={() => setPickOpen((v) => !v)}
          aria-expanded={pickOpen}
          title={t("quick.owner")}
          className={`${field} pl-1.5 pr-3 inline-flex items-center gap-1.5 text-[#0A1931]`}
        >
          <span className="flex -space-x-1.5">
            {owners.slice(0, 3).map((name, i) => (
              <span
                key={`${name}-${i}`}
                className="w-7 h-7 rounded-full bg-[#0A1931] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white"
              >
                {ownerInitial(name)}
              </span>
            ))}
          </span>
          <span>{ownersLabel({ owner: owners[0] ?? UNASSIGNED, assignees: owners }, memberLabel)}</span>
          <span className="text-[9px] text-[#8A8A8A]">{pickOpen ? "▾" : "▸"}</span>
        </button>
      ) : (
        // Screenshot mode: the selected owner is still used on submit, just not shown.
        <span className={`${field} px-4 inline-flex items-center text-[#A8A29E]`} title={t("quick.owner")}>
          —
        </span>
      )}
      <select
        value={priority}
        onChange={(e) => setPriority(e.target.value as Priority)}
        title={t("quick.priority")}
        className={`${field} px-3`}
      >
        {PRIOS.map((p) => (
          <option key={p} value={p}>{priorityLabel(t, p)}</option>
        ))}
      </select>
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as Status)}
        title={t("quick.status")}
        className={`${field} px-3`}
      >
        {STATUS_ORDER.map((s) => (
          <option key={s} value={s}>{statusLabel(lang, s)}</option>
        ))}
      </select>
      <input
        type="date"
        value={due}
        onChange={(e) => setDue(e.target.value)}
        title={t("quick.due")}
        className={`${field} px-3`}
      />
      <button
        onClick={create}
        className="h-11 px-6 rounded-full bg-[#0A1931] text-[#C9A96E] text-[13px] font-semibold tracking-wide hover:bg-[#112040] uppercase"
      >
        + {t("quick.add")}
      </button>
      </div>

      {showNames && pickOpen && (
        <div className="rounded-[12px] border border-[#E8E6E1] bg-[#F5F3EF] p-2.5 space-y-2">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <span className="font-trajan text-[10px] uppercase tracking-wide text-[#A8A29E]">
              {t("assign.title")}
            </span>
            <span className="text-[10px] text-[#8A8A8A]">
              {t(multiAssign ? "assign.hintMulti" : "assign.hintSingle")}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[UNASSIGNED, ...members].map((m) => {
              const on = owners.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleOwner(m)}
                  aria-pressed={on}
                  className={`h-7 px-3 rounded-full text-[11px] border ${
                    on
                      ? "bg-[#0A1931] text-[#C9A96E] border-[#0A1931]"
                      : "bg-white text-[#0A1931] border-[#E8E6E1]"
                  }`}
                >
                  {memberLabel(m)}
                </button>
              );
            })}
          </div>
          {!multiAssign && (
            <p className="text-[10px] text-[#DC2626]">{t("assign.migrationNote")}</p>
          )}
        </div>
      )}
    </div>
  );
}
