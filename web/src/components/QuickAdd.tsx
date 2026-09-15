import { useState } from "react";
import type { Op, Priority, Status, Task } from "../lib/types";
import { STATUS_ORDER, genId } from "../lib/constants";
import { priorityLabel, statusLabel, useT } from "../lib/i18n";
import { useMe } from "../lib/identity";

const PRIOS: Priority[] = ["P1", "P2", "P3", "P4"];

interface Props {
  members: string[];
  send: (op: Op) => void;
}

// Full new-task bar: choose owner, priority, status and due date up front —
// nothing is assumed.
export function QuickAdd({ members, send }: Props) {
  const { t, lang } = useT();
  const { me } = useMe();
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState(
    me && members.includes(me) ? me : members[0] ?? "Unassigned"
  );
  const [priority, setPriority] = useState<Priority>("P2");
  const [status, setStatus] = useState<Status>("NEXT");
  const [due, setDue] = useState("");

  const create = () => {
    const v = title.trim();
    if (!v) return;
    const task: Task = {
      id: genId(),
      title: v,
      desc: "",
      owner,
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
  };

  const field =
    "h-11 rounded-full bg-white border border-[#E8E6E1] text-[13px] outline-none focus:border-[#C9A96E]";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && create()}
        placeholder={t("quick.title")}
        className={`${field} flex-1 min-w-[200px] px-5`}
      />
      <select
        value={owner}
        onChange={(e) => setOwner(e.target.value)}
        title={t("quick.owner")}
        className={`${field} px-3`}
      >
        <option value="Unassigned">{t("members.unassigned")}</option>
        {members.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
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
  );
}
