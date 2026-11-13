import { useState } from "react";
import type { Task } from "../lib/types";
import { UNASSIGNED, genId } from "../lib/constants";
import { useT } from "../lib/i18n";
import { useSyncedField } from "../lib/useSyncedField";
import { ownersPatch, taskOwners } from "../lib/owners";
import { useProjects } from "../lib/projectsContext";
import { projectColor, stepOf } from "../lib/projects";
import { daysSince, daysUntil } from "../lib/dates";
import { AutoTextarea } from "../components/AutoTextarea";
import { Avatar, PRIO_VAR, STATUS_VAR, Sheet, shortDay } from "./ui";
import { DuePicker, PeoplePicker, PriorityPicker, ProjectPicker, StatusPicker } from "./pickers";
import { IconCalendar, IconCheck, IconChevron, IconClose, IconFlag, IconFolder, IconHourglass, IconStatus, IconTrash, IconUser } from "./icons";
import { useTaskActions, type Send } from "./actions";

type Picker = "status" | "priority" | "due" | "people" | "project" | null;

/** One detail of the task: a tinted icon, its name, its value, and a chevron. */
function PropRow({
  icon,
  tile,
  label,
  value,
  valueColor,
  onClick,
}: {
  icon: React.ReactNode;
  tile: string;
  label: string;
  value: React.ReactNode;
  valueColor?: string;
  onClick?: () => void;
}) {
  return (
    <button className="m-row" onClick={onClick} disabled={!onClick} style={{ minHeight: 54 }}>
      <span className="m-row__icon" style={{ ["--tile" as string]: tile }}>
        {icon}
      </span>
      <span className="m-row__main m-row__title" style={{ fontWeight: 500, flex: "0 0 auto" }}>
        {label}
      </span>
      <span className="m-row__end" style={{ flex: 1 }}>
        <span className="m-row__value" style={valueColor ? { color: valueColor } : undefined}>
          {value}
        </span>
        {onClick && <IconChevron size={16} />}
      </span>
    </button>
  );
}

/**
 * Everything about one task, in a full-height sheet: the title with its
 * check, then the details as a grouped list (each row opens a chooser), the
 * subtasks, the notes, and the actions.
 */
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
  const { t, lang } = useT();
  const { moveTo, toggleDone, remove, fail } = useTaskActions(send);
  const { projects, tasks, available: projectsOn } = useProjects();
  const title = useSyncedField(task.title);
  const desc = useSyncedField(task.desc);
  const notes = useSyncedField(task.notes);
  const fileDir = useSyncedField(task.fileDir ?? "");
  const [newSub, setNewSub] = useState("");
  const [copied, setCopied] = useState(false);
  const [picker, setPicker] = useState<Picker>(null);

  const patch = (p: Partial<Task>) => send({ type: "updateTask", id: task.id, patch: p }, fail);
  const owners = taskOwners(task).filter((o) => o !== UNASSIGNED);
  const subDone = task.subtasks.filter((s) => s.done).length;
  const done = task.status === "DONE";
  const project = task.projectId ? projects.find((p) => p.id === task.projectId) : undefined;
  const step = stepOf(task, projects, tasks);
  const tint = project ? projectColor(project) : undefined;
  const due = daysUntil(task.dueDate);

  const addSub = () => {
    const v = newSub.trim();
    if (!v) return;
    send({ type: "addSubtask", taskId: task.id, subtask: { id: genId(), text: v, done: false } }, fail);
    setNewSub("");
  };

  let dueText: string = t("m.when.none");
  let dueColor: string | undefined;
  if (task.dueDate && due !== null) {
    const rel = due < 0 ? t("m.due.late").replace("{n}", String(-due)) : due === 0 ? t("m.due.today") : due === 1 ? t("m.due.tomorrow") : null;
    dueText = rel ? `${rel} · ${shortDay(task.dueDate, lang)}` : shortDay(task.dueDate, lang);
    if (!done) dueColor = due < 0 ? "var(--m-red)" : due === 0 ? "var(--m-orange)" : undefined;
  }

  return (
    <Sheet onClose={onClose} full title={t("m.task")} tint={tint}>
      {/* Title, with the check that finishes it */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginTop: 4 }}>
        <button
          className="m-check"
          role="checkbox"
          aria-checked={done}
          aria-label={done ? t("m.reopen") : t("m.markDone")}
          style={{ ["--ring" as string]: PRIO_VAR[task.priority], width: 30, height: 30, marginTop: 2 }}
          onClick={() => toggleDone(task)}
        >
          <IconCheck size={17} />
        </button>
        <AutoTextarea
          className="m-title-input"
          value={title.value}
          placeholder={t("m.titlePh")}
          style={done ? { textDecoration: "line-through", color: "var(--m-text-3)" } : undefined}
          onChange={(e) => title.setValue(e.target.value)}
          onFocus={title.onFocus}
          onBlur={() => {
            title.onBlur();
            const v = title.value.trim();
            if (v && v !== task.title) patch({ title: v });
            else title.setValue(task.title);
          }}
        />
      </div>

      {/* Details */}
      <div className="m-panel m-list" style={{ marginTop: 18 }}>
        <PropRow
          icon={<IconStatus size={17} />}
          tile={STATUS_VAR[task.status]}
          label={t("m.f.status")}
          value={t(`m.status.${task.status}`)}
          onClick={() => setPicker("status")}
        />
        {task.status === "WAITING" && task.waitingSince && (
          <PropRow
            icon={<IconHourglass size={17} />}
            tile="var(--m-orange)"
            label={t("m.f.waiting")}
            value={t("m.waitingDaysLong").replace("{n}", String(daysSince(task.waitingSince)))}
            valueColor={daysSince(task.waitingSince) >= 7 ? "var(--m-red)" : undefined}
          />
        )}
        <PropRow
          icon={<IconFlag size={17} />}
          tile={task.priority === "P4" ? "var(--m-grey)" : PRIO_VAR[task.priority]}
          label={t("m.f.priority")}
          value={`${task.priority} · ${t(`prio.${task.priority}short`)}`}
          onClick={() => setPicker("priority")}
        />
        <PropRow
          icon={<IconCalendar size={17} />}
          tile="var(--m-red)"
          label={t("m.f.due")}
          value={dueText}
          valueColor={dueColor}
          onClick={() => setPicker("due")}
        />
        <PropRow
          icon={<IconUser size={17} />}
          tile="var(--m-blue)"
          label={multiAssign ? t("m.f.people") : t("m.f.person")}
          value={
            owners.length ? (
              <>
                <span className="m-avatars">
                  {owners.slice(0, 3).map((o) => (
                    <Avatar key={o} name={o} />
                  ))}
                </span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{owners.join(", ")}</span>
              </>
            ) : (
              t("members.unassigned")
            )
          }
          onClick={() => setPicker("people")}
        />
        {projectsOn && (
          <PropRow
            icon={<IconFolder size={17} />}
            tile={tint ?? "var(--m-indigo)"}
            label={t("m.f.project")}
            value={
              project ? (
                <>
                  <span className="m-chip__dot" style={{ background: tint }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{project.name}</span>
                  {step && <span className="m-chip m-chip--blue">{t("m.step").replace("{n}", String(step.n)).replace("{total}", String(step.total))}</span>}
                </>
              ) : (
                t("m.noProject")
              )
            }
            onClick={() => setPicker("project")}
          />
        )}
      </div>

      {/* Subtasks */}
      <div className="m-field">
        <div className="m-label">
          {t("m.f.subtasks")}
          {task.subtasks.length > 0 && (
            <span style={{ marginLeft: "auto", textTransform: "none", letterSpacing: 0 }}>
              {subDone}/{task.subtasks.length}
            </span>
          )}
        </div>
        <div className="m-panel m-list">
          {task.subtasks.length > 0 && (
            <div className="m-progress" style={{ margin: "12px 14px 2px", position: "relative" }}>
              <span style={{ width: `${(subDone / task.subtasks.length) * 100}%` }} />
            </div>
          )}
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
            <span className="m-check" style={{ width: 22, height: 22, borderStyle: "dashed" }} />
            <input
              className="m-sub-row__text"
              style={{ fontSize: 16 }}
              placeholder={t("m.addSubtask")}
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSub()}
              enterKeyHint="done"
            />
            {newSub.trim() && (
              <button className="m-btn m-btn--primary m-btn--sm" onClick={addSub}>
                {t("m.add")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Words */}
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
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
        <button
          className="m-btn m-btn--danger"
          aria-label={t("m.deleteTask")}
          onClick={() => {
            remove(task);
            onClose();
          }}
        >
          <IconTrash size={18} />
        </button>
        <button
          className={`m-btn m-btn--block ${done ? "" : "m-btn--done"}`}
          style={{ flex: 1 }}
          onClick={() => {
            toggleDone(task);
            if (!done) onClose();
          }}
        >
          <IconCheck size={18} /> {done ? t("m.reopen") : t("m.markDoneLong")}
        </button>
      </div>

      {picker === "status" && <StatusPicker value={task.status} onPick={(s) => moveTo(task, s)} onClose={() => setPicker(null)} />}
      {picker === "priority" && <PriorityPicker value={task.priority} onPick={(p) => patch({ priority: p })} onClose={() => setPicker(null)} />}
      {picker === "due" && (
        <DuePicker value={task.dueDate} onPick={(v) => send({ type: "setDueDate", id: task.id, dueDate: v }, fail)} onClose={() => setPicker(null)} />
      )}
      {picker === "people" && (
        <PeoplePicker
          members={members}
          value={taskOwners(task)}
          multi={multiAssign}
          onChange={(list) => patch(ownersPatch(list))}
          onClose={() => setPicker(null)}
        />
      )}
      {picker === "project" && <ProjectPicker value={task.projectId} onPick={(id) => patch({ projectId: id })} onClose={() => setPicker(null)} />}
    </Sheet>
  );
}
