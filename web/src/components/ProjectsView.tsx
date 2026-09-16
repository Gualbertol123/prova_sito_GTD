import { useEffect, useState } from "react";
import type { Board, Op, Project, Subtask } from "../lib/types";
import { genId } from "../lib/constants";
import { useT } from "../lib/i18n";
import { useSyncedField } from "../lib/useSyncedField";
import { SortableSubtasks } from "./SortableSubtasks";

interface Props {
  board: Board;
  send: (op: Op) => void;
}

// Each project is simply a checklist of items — the same interaction as the
// Kanban subtasks list (reusing SortableSubtasks).
export function ProjectsView({ board, send }: Props) {
  const { t } = useT();
  const projects = board.projects;
  const [selectedId, setSelectedId] = useState<string | null>(projects[0]?.id ?? null);
  const [creating, setCreating] = useState("");

  // Keep a valid selection as projects change.
  useEffect(() => {
    if (projects.length === 0) {
      if (selectedId !== null) setSelectedId(null);
    } else if (!projects.some((p) => p.id === selectedId)) {
      setSelectedId(projects[0].id);
    }
  }, [projects, selectedId]);

  const selected = projects.find((p) => p.id === selectedId) ?? null;

  const create = () => {
    const name = creating.trim();
    if (!name) return;
    const project: Project = {
      id: genId(),
      name,
      items: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    send({ type: "projectAdd", project });
    setCreating("");
    setSelectedId(project.id);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 items-start">
      {/* Sidebar: project list */}
      <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-3 space-y-2">
        <h3 className="font-trajan text-[11px] uppercase tracking-widest text-[#8A8A8A] px-1">
          {t("projects.title")}
        </h3>
        {projects.length === 0 && (
          <div className="text-[12px] text-[#A8A29E] px-1 py-2">{t("projects.none")}</div>
        )}
        <div className="space-y-1">
          {projects.map((p) => {
            const done = p.items.filter((i) => i.done).length;
            const total = p.items.length;
            const active = p.id === selectedId;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-[13px] flex items-center justify-between gap-2 transition-colors ${
                  active ? "bg-[#0A1931] text-[#C9A96E]" : "hover:bg-[#F5F3EF] text-[#0A1931]"
                }`}
              >
                <span className="truncate font-medium">{p.name || "—"}</span>
                <span className={`text-[10px] shrink-0 ${active ? "text-[#8BA1C2]" : "text-[#8A8A8A]"}`}>
                  {total ? `${done}/${total}` : "0"}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-1.5 pt-1">
          <input
            value={creating}
            onChange={(e) => setCreating(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder={t("projects.newName")}
            className="flex-1 min-w-0 h-8 rounded-full bg-[#F5F3EF] border border-[#E8E6E1] px-3 text-[12px] outline-none focus:border-[#C9A96E]"
          />
          <button
            onClick={create}
            className="h-8 w-8 shrink-0 flex items-center justify-center rounded-full bg-[#0A1931] text-[#C9A96E] text-[14px] font-semibold"
            title={t("projects.new")}
          >
            +
          </button>
        </div>
      </div>

      {/* Selected project */}
      {selected ? (
        <ProjectPanel key={selected.id} project={selected} send={send} />
      ) : (
        <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-8 text-center text-[13px] text-[#A8A29E]">
          {t("projects.empty")}
        </div>
      )}
    </div>
  );
}

function ProjectPanel({ project, send }: { project: Project; send: (op: Op) => void }) {
  const { t } = useT();
  const name = useSyncedField(project.name);
  const [confirmDel, setConfirmDel] = useState(false);
  const [newItem, setNewItem] = useState("");

  const setItems = (items: Subtask[]) => send({ type: "projectUpdate", id: project.id, patch: { items } });
  const done = project.items.filter((i) => i.done).length;
  const total = project.items.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const addItem = () => {
    const v = newItem.trim();
    if (!v) return;
    setItems([...project.items, { id: genId(), text: v, done: false }]);
    setNewItem("");
  };

  return (
    <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <input
          value={name.value}
          onFocus={name.onFocus}
          onChange={(e) => name.setValue(e.target.value)}
          onBlur={() => {
            name.onBlur();
            const v = name.value.trim();
            if (v && v !== project.name) send({ type: "projectUpdate", id: project.id, patch: { name: v } });
          }}
          className="flex-1 min-w-0 font-trajan text-[16px] text-[#0A1931] bg-transparent outline-none border-b border-transparent focus:border-[#C9A96E]"
        />
        {confirmDel ? (
          <span className="flex items-center gap-2 text-[12px] shrink-0">
            <span className="text-[#DC2626]">{t("projects.confirmDelete")}</span>
            <button onClick={() => send({ type: "projectDelete", id: project.id })} className="font-semibold text-[#DC2626]">
              {t("task.yes")}
            </button>
            <button onClick={() => setConfirmDel(false)} className="text-[#8A8A8A]">
              {t("task.no")}
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmDel(true)}
            className="shrink-0 h-8 px-3 rounded-full text-[12px] font-semibold text-[#8A8A8A] border border-[#E8E6E1] hover:text-[#DC2626] hover:border-[#FECACA]"
          >
            {t("projects.delete")}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="font-trajan text-[10px] uppercase tracking-wide text-[#8A8A8A]">
          {t("projects.items")} {total ? `${done}/${total} · ${pct}%` : ""}
        </span>
        <div className="flex-1 h-1.5 rounded-full bg-[#EFECE6] overflow-hidden">
          <div className="h-full bg-[#C9A96E] transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="bg-[#EFECE6] rounded-[12px] border border-[#E3DFD7] p-2.5">
        <SortableSubtasks
          items={project.items}
          onReorder={(items) => setItems(items)}
          onToggle={(id, doneNow) =>
            setItems(project.items.map((i) => (i.id === id ? { ...i, done: doneNow } : i)))
          }
          onText={(id, text) => setItems(project.items.map((i) => (i.id === id ? { ...i, text } : i)))}
          onDelete={(id) => setItems(project.items.filter((i) => i.id !== id))}
        />
        <div className="flex items-center gap-1.5 mt-2">
          <span className="w-5 text-right text-[11px] font-semibold text-[#A8A29E] tabular-nums shrink-0">
            {total + 1}.
          </span>
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            placeholder={t("projects.addItem")}
            className="flex-1 min-w-0 h-8 rounded-full bg-white border border-[#E8E6E1] px-3 text-[12px] outline-none focus:border-[#C9A96E]"
          />
          <button
            onClick={addItem}
            className="h-8 w-8 shrink-0 flex items-center justify-center rounded-full bg-[#0A1931] text-[#C9A96E] text-[14px] font-semibold"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
