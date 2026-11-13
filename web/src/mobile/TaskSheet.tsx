import { useState } from "react";
import type { Priority, Task } from "../lib/types";
import { STATUS_ORDER, UNASSIGNED, genId } from "../lib/constants";
import { useT } from "../lib/i18n";
import { useSyncedField } from "../lib/useSyncedField";
import { ownersPatch, taskOwners } from "../lib/owners";
import { useProjects } from "../lib/projectsContext";
import { projectColor } from "../lib/projects";
import { daysSince, toISODate } from "../lib/dates";
import { AutoTextarea } from "../components/AutoTextarea";
import { Avatar, Sheet, STATUS_VAR } from "./ui";
import { IconCheck, IconClose, IconTrash } from "./icons";
import { useTaskActions, type Send } from "./actions";

const PRIOS: Priority[] = ["P1", "P2", "P3", "P4"];

function addDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** Next Monday (or the one after, if today is Monday). */
function nextMonday(): string {
  const d = new Date();
  const add = ((8 - d.getDay()) % 7) || 7;
  d.setDate(d.getDate() + add);
  return toISODate(d);
}

/** Everything about one task, editable, in a full-height sheet. */
export function TaskSheet({
  task,
  members,
  multiAssign,
  send,
  onClose,
}: {
  task: Task;
  members: string[];
  multiAssign: boolean;
  send: Send;
  onClose: () => void;
}) {
  const { t } = useT();
  const { moveTo, remove, fail } = useTaskActions(send);
  const { projects, available: projectsOn } = useProjects();
  const title = useSyncedField(task.title);
  const desc = useSyncedField(task.desc);
  const notes = useSyncedField(task.notes);
  const fileDir = useSyncedField(task.fileDir ?? "");
  const [newSub, setNewSub] = useState("");
  const [copied, setCopied] = useState(false);

  const patch = (p: Partial<Task>) => send({ type: "updateTask", id: task.id, patch: p }, fail);
  const owners = taskOwners(task);
  const subDone = task.subtasks.filter((s) => s.done).length;

  const toggleOwner = (name: string) => {
    if (!multiAssign) return patch(ownersPatch([name]));
    const next = owners.includes(name) ? owners.filter((o) => o !== name) : [...owners.filter((o) => o !== UNASSIGNED), name];
    patch(ownersPatch(next.length ? next : [UNASSIGNED]));
  };

  const addSub = () => {
    const v = newSub.trim();
    if (!v) return;
    send({ type: "addSubtask", taskId: task.id, subtask: { id: genId(), text: v, done: false } }, fail);
    setNewSub("");
  };

  const dueChoices: { k: string; v?: string }[] = [
    { k: "m.when.today", v: addDays(0) },
    { k: "m.when.tomorrow", v: addDays(1) },
    { k: "m.when.monday", v: nextMonday() },
    { k: "m.when.none", v: undefined },
  ];

  return (
    <Sheet onClose={onClose} full title={t("m.task")}>
      <AutoTextarea
        className="m-title-input"
        value={title.value}
        placeholder={t("m.titlePh")}
        onChange={(e) => title.setValue(e.target.value)}
        onFocus={title.onFocus}
        onBlur={() => {
          title.onBlur();
          const v = title.value.trim();
          if (v && v !== task.title) patch({ title: v });
          else title.setValue(task.title);
        }}
      />
      {task.status === "WAITING" && task.waitingSince && (
        <div className="m-sub" style={{ marginTop: 6 }}>
          {t("m.waitingSince").replace("{n}", String(daysSince(task.waitingSince)))}
        </div>
      )}

      <div className="m-field">
        <span className="m-label">{t("m.f.status")}</span>
        <div className="m-pills" role="radiogroup">
          {STATUS_ORDER.map((s) => (
            <button key={s} className="m-pill" aria-pressed={task.status === s} onClick={() => moveTo(task, s)}>
              <span className="m-dot" style={{ background: STATUS_VAR[s] }} />
              {t(`m.status.${s}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="m-field">
        <span className="m-label">{t("m.f.priority")}</span>
        <div className="m-seg">
          {PRIOS.map((p) => (
            <button key={p} aria-pressed={task.priority === p} onClick={() => patch({ priority: p })}>
              {p} · {t(`prio.${p}short`)}
            </button>
          ))}
        </div>
      </div>

      <div className="m-field">
        <span className="m-label">{t("m.f.due")}</span>
        <div className="m-choices">
          {dueChoices.map((c) => (
            <button
              key={c.k}
              className="m-choice"
              aria-pressed={(task.dueDate ?? undefined) === c.v}
              onClick={() => send({ type: "setDueDate", id: task.id, dueDate: c.v }, fail)}
            >
              {t(c.k)}
            </button>
          ))}
        </div>
        <input
          type="date"
          className="m-input"
          style={{ marginTop: 8 }}
          value={task.dueDate ?? ""}
          onChange={(e) => send({ type: "setDueDate", id: task.id, dueDate: e.target.value || undefined }, fail)}
          aria-label={t("m.f.due")}
        />
      </div>

      <div className="m-field">
        <span className="m-label">{multiAssign ? t("m.f.people") : t("m.f.person")}</span>
        <div className="m-choices">
          {members.map((m) => (
            <button key={m} className="m-choice" aria-pressed={owners.includes(m)} onClick={() => toggleOwner(m)}>
              <Avatar name={m} /> {m}
            </button>
          ))}
        </div>
      </div>

      {projectsOn && projects.length > 0 && (
        <div className="m-field">
          <span className="m-label">{t("m.f.project")}</span>
          <div className="m-choices">
            <button className="m-choice" aria-pressed={!task.projectId} onClick={() => patch({ projectId: undefined })}>
              {t("m.noProject")}
            </button>
            {projects.map((p) => (
              <button key={p.id} className="m-choice" aria-pressed={task.projectId === p.id} onClick={() => patch({ projectId: p.id })}>
                <span className="m-chip__dot" style={{ background: projectColor(p) }} /> {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="m-field">
        <span className="m-label">
          {t("m.f.subtasks")} {task.subtasks.length ? `· ${subDone}/${task.subtasks.length}` : ""}
        </span>
        {task.subtasks.length > 0 && (
          <div className="m-progress" style={{ marginBottom: 8 }}>
            <span style={{ width: `${(subDone / task.subtasks.length) * 100}%` }} />
          </div>
        )}
        <div className="m-panel m-list">
          {task.subtasks.map((s) => (
            <div key={s.id} className="m-sub-row">
              <button
                className="m-check"
                role="checkbox"
                aria-checked={s.done}
                aria-label={s.text}
                onClick={() =>
                  send(
                    {
                      type: "updateSubtask",
                      taskId: task.id,
                      subtaskId: s.id,
                      patch: { done: !s.done, doneAt: s.done ? undefined : Date.now() },
                    },
                    fail
                  )
                }
              >
                <IconCheck size={13} />
              </button>
              <span className={`m-sub-row__text${s.done ? " m-sub-row__text--done" : ""}`}>{s.text}</span>
              <button
                aria-label={t("m.delete")}
                style={{ color: "var(--m-text-3)", padding: 2 }}
                onClick={() => send({ type: "deleteSubtask", taskId: task.id, subtaskId: s.id }, fail)}
              >
                <IconClose size={16} />
              </button>
            </div>
          ))}
          <div className="m-sub-row" style={{ alignItems: "center" }}>
            <span className="m-check" style={{ borderStyle: "dashed" }} />
            <input
              className="m-sub-row__text"
              style={{ background: "transparent", border: 0, outline: "none", color: "var(--m-text)", fontSize: 16 }}
              placeholder={t("m.addSubtask")}
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSub()}
              enterKeyHint="done"
            />
            {newSub.trim() && (
              <button style={{ color: "var(--m-gold)", fontWeight: 700, fontSize: 14 }} onClick={addSub}>
                {t("m.add")}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="m-field">
        <label htmlFor="m-desc">{t("m.f.desc")}</label>
        <AutoTextarea
          id="m-desc"
          className="m-textarea"
          value={desc.value}
          placeholder={t("m.descPh")}
          onChange={(e) => desc.setValue(e.target.value)}
          onFocus={desc.onFocus}
          onBlur={() => {
            desc.onBlur();
            if (desc.value !== task.desc) patch({ desc: desc.value });
          }}
        />
      </div>

      <div className="m-field">
        <label htmlFor="m-notes">{t("m.f.notes")}</label>
        <AutoTextarea
          id="m-notes"
          className="m-textarea"
          value={notes.value}
          placeholder={t("m.notesPh")}
          onChange={(e) => notes.setValue(e.target.value)}
          onFocus={notes.onFocus}
          onBlur={() => {
            notes.onBlur();
            if (notes.value !== task.notes) patch({ notes: notes.value });
          }}
        />
      </div>

      <div className="m-field">
        <label htmlFor="m-file">{t("m.f.file")}</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            id="m-file"
            className="m-input"
            value={fileDir.value}
            placeholder="\\\\server\\share\\…"
            onChange={(e) => fileDir.setValue(e.target.value)}
            onFocus={fileDir.onFocus}
            onBlur={() => {
              fileDir.onBlur();
              if (fileDir.value !== (task.fileDir ?? "")) patch({ fileDir: fileDir.value || undefined });
            }}
          />
          {fileDir.value && (
            <button
              className="m-btn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(fileDir.value);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  /* clipboard blocked */
                }
              }}
            >
              {copied ? t("m.copied") : t("m.copy")}
            </button>
          )}
        </div>
      </div>

      <button
        className="m-btn m-btn--danger m-btn--block"
        style={{ marginTop: 28 }}
        onClick={() => {
          remove(task);
          onClose();
        }}
      >
        <IconTrash size={18} /> {t("m.deleteTask")}
      </button>
    </Sheet>
  );
}
