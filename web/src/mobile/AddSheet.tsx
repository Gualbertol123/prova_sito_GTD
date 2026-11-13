import { useEffect, useRef, useState } from "react";
import type { Priority, Status, Task } from "../lib/types";
import { UNASSIGNED, genId } from "../lib/constants";
import { useT } from "../lib/i18n";
import { useMe } from "../lib/identity";
import { ownersPatch } from "../lib/owners";
import { useProjects } from "../lib/projectsContext";
import { projectColor } from "../lib/projects";
import { toISODate } from "../lib/dates";
import { Avatar, PRIO_VAR, STATUS_VAR, Sheet, shortDay, useToast } from "./ui";
import { DuePicker, PeoplePicker, PriorityPicker, ProjectPicker, StatusPicker } from "./pickers";
import { IconCalendar, IconFlag, IconFolder, IconStatus, IconUser } from "./icons";
import type { Send } from "./actions";

type Picker = "status" | "priority" | "due" | "people" | "project" | null;

/**
 * New task. Type a title; everything else starts from a sensible default
 * (you, P2, the column, day or project you came from) shown as a row of
 * tokens, each one tap away from a chooser. "Add & continue" keeps the sheet
 * open for the next one.
 */
export function AddSheet({
  members,
  multiAssign,
  send,
  onClose,
  initialStatus = "NEXT",
  initialProject,
  initialDue,
}: {
  members: string[];
  multiAssign: boolean;
  send: Send;
  onClose: () => void;
  initialStatus?: Status;
  initialProject?: string;
  initialDue?: string;
}) {
  const { t, lang } = useT();
  const { me } = useMe();
  const toast = useToast();
  const { projects, available: projectsOn } = useProjects();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState<Priority>("P2");
  const [status, setStatus] = useState<Status>(initialStatus);
  const [due, setDue] = useState<string | undefined>(initialDue);
  const [owners, setOwners] = useState<string[]>(() => (me && members.includes(me) ? [me] : [UNASSIGNED]));
  const [projectId, setProjectId] = useState<string | undefined>(initialProject);
  const [picker, setPicker] = useState<Picker>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const project = projectId ? projects.find((p) => p.id === projectId) : undefined;

  useEffect(() => {
    // Focus after the sheet's rise, so the keyboard does not fight it.
    const id = setTimeout(() => input.current?.focus(), 280);
    return () => clearTimeout(id);
  }, []);

  const create = (close: boolean) => {
    const v = title.trim();
    if (!v) return;
    const now = Date.now();
    const task: Task = {
      id: genId(),
      title: v,
      desc: desc.trim(),
      ...ownersPatch(owners),
      priority,
      status,
      notes: "",
      subtasks: [],
      dueDate: due,
      projectId,
      updatedAt: now,
      createdAt: now,
    };
    send({ type: "addTask", task }, (m) => toast(`${t("m.notSaved")} ${m}`));
    toast(t("m.toast.added").replace("{title}", v));
    setTitle("");
    setDesc("");
    if (close) onClose();
    else input.current?.focus();
  };

  const today = toISODate(new Date());
  const dueLabel = !due
    ? t("m.f.due")
    : due === today
      ? t("m.when.today")
      : shortDay(due, lang);
  const named = owners.filter((o) => o !== UNASSIGNED);

  return (
    <Sheet
      title={t("m.newTask")}
      onClose={onClose}
      tint={project ? projectColor(project) : undefined}
      headEnd={
        <button className="m-btn m-btn--primary m-btn--sm" disabled={!title.trim()} onClick={() => create(true)}>
          {t("m.add")}
        </button>
      }
    >
      <div className="m-panel" style={{ padding: "14px 14px 12px" }}>
        <textarea
          ref={input}
          rows={2}
          className="m-title-input"
          style={{ fontSize: 21, position: "relative" }}
          placeholder={t("m.titlePh")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              create(false);
            }
          }}
          enterKeyHint="send"
        />
        <textarea
          rows={1}
          className="m-bare"
          style={{ width: "100%", resize: "none", fontSize: 15, padding: "0 4px", outline: "none", position: "relative", color: "var(--m-text-2)" }}
          placeholder={t("m.descPh")}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
      </div>

      <div className="m-tokens">
        <button className="m-token" data-set={priority !== "P2"} onClick={() => setPicker("priority")}>
          <IconFlag size={15} />
          <span className="m-chip__dot" style={{ background: PRIO_VAR[priority] }} />
          <span>{priority}</span>
        </button>
        <button className="m-token" data-set={!!due} onClick={() => setPicker("due")}>
          <IconCalendar size={15} />
          <span>{dueLabel}</span>
        </button>
        <button className="m-token" data-set={named.length > 0} onClick={() => setPicker("people")}>
          {named.length ? (
            <span className="m-avatars">
              {named.slice(0, 3).map((o) => (
                <Avatar key={o} name={o} />
              ))}
            </span>
          ) : (
            <IconUser size={15} />
          )}
          <span>{named.length ? named.join(", ") : t("members.unassigned")}</span>
        </button>
        <button className="m-token" data-set={status !== "NEXT"} onClick={() => setPicker("status")}>
          <IconStatus size={15} />
          <span className="m-chip__dot" style={{ background: STATUS_VAR[status] }} />
          <span>{t(`m.status.${status}`)}</span>
        </button>
        {projectsOn && projects.length > 0 && (
          <button className="m-token" data-set={!!project} onClick={() => setPicker("project")}>
            <IconFolder size={15} />
            {project && <span className="m-chip__dot" style={{ background: projectColor(project) }} />}
            <span>{project ? project.name : t("m.f.project")}</span>
          </button>
        )}
      </div>

      <button
        className="m-btn m-btn--block"
        style={{ marginTop: 22 }}
        disabled={!title.trim()}
        onClick={() => create(false)}
      >
        {t("m.addAnother")}
      </button>

      {picker === "status" && <StatusPicker value={status} onPick={setStatus} onClose={() => setPicker(null)} />}
      {picker === "priority" && <PriorityPicker value={priority} onPick={setPriority} onClose={() => setPicker(null)} />}
      {picker === "due" && <DuePicker value={due} onPick={setDue} onClose={() => setPicker(null)} />}
      {picker === "people" && (
        <PeoplePicker members={members} value={owners} multi={multiAssign} onChange={setOwners} onClose={() => setPicker(null)} />
      )}
      {picker === "project" && <ProjectPicker value={projectId} onPick={setProjectId} onClose={() => setPicker(null)} />}
    </Sheet>
  );
}
