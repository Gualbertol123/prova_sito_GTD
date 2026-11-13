import { useEffect, useRef, useState } from "react";
import type { Priority, Status, Task } from "../lib/types";
import { STATUS_ORDER, UNASSIGNED, genId } from "../lib/constants";
import { useT } from "../lib/i18n";
import { useMe } from "../lib/identity";
import { ownersPatch } from "../lib/owners";
import { useProjects } from "../lib/projectsContext";
import { projectColor } from "../lib/projects";
import { toISODate } from "../lib/dates";
import { Avatar, Sheet, STATUS_VAR, useToast } from "./ui";
import type { Send } from "./actions";

const PRIOS: Priority[] = ["P1", "P2", "P3", "P4"];

function inDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/**
 * New task. Only the title is needed; everything else starts from sensible
 * defaults (you, P2, the column or project you came from) and is one tap to
 * change. "Add" keeps the sheet open for the next one.
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
  const { t } = useT();
  const { me } = useMe();
  const toast = useToast();
  const { projects, available: projectsOn } = useProjects();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("P2");
  const [status, setStatus] = useState<Status>(initialStatus);
  const [due, setDue] = useState<string | undefined>(initialDue);
  const [owners, setOwners] = useState<string[]>(() => (me && members.includes(me) ? [me] : [UNASSIGNED]));
  const [projectId, setProjectId] = useState<string | undefined>(initialProject);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Focus after the sheet's rise, so the keyboard does not fight it.
    const id = setTimeout(() => input.current?.focus(), 250);
    return () => clearTimeout(id);
  }, []);

  const toggleOwner = (name: string) =>
    setOwners((prev) => {
      if (!multiAssign) return [name];
      const next = prev.includes(name) ? prev.filter((o) => o !== name) : [...prev.filter((o) => o !== UNASSIGNED), name];
      return next.length ? next : [UNASSIGNED];
    });

  const create = (close: boolean) => {
    const v = title.trim();
    if (!v) return;
    const now = Date.now();
    const task: Task = {
      id: genId(),
      title: v,
      desc: "",
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
    if (close) onClose();
    else input.current?.focus();
  };

  const dues: { k: string; v?: string }[] = [
    { k: "m.when.none", v: undefined },
    { k: "m.when.today", v: inDays(0) },
    { k: "m.when.tomorrow", v: inDays(1) },
    { k: "m.when.week", v: inDays(7) },
  ];

  return (
    <Sheet title={t("m.newTask")} onClose={onClose}>
      <textarea
        ref={input}
        rows={2}
        className="m-title-input"
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

      <div className="m-field">
        <span className="m-label">{t("m.f.priority")}</span>
        <div className="m-seg">
          {PRIOS.map((p) => (
            <button key={p} aria-pressed={priority === p} onClick={() => setPriority(p)}>
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="m-field">
        <span className="m-label">{t("m.f.due")}</span>
        <div className="m-choices">
          {dues.map((d) => (
            <button key={d.k} className="m-choice" aria-pressed={due === d.v} onClick={() => setDue(d.v)}>
              {t(d.k)}
            </button>
          ))}
          <input
            type="date"
            className="m-choice"
            aria-label={t("m.f.due")}
            value={due ?? ""}
            onChange={(e) => setDue(e.target.value || undefined)}
            style={{ color: "var(--m-text-2)" }}
          />
        </div>
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

      <div className="m-field">
        <span className="m-label">{t("m.f.status")}</span>
        <div className="m-pills">
          {STATUS_ORDER.filter((s) => s !== "DONE").map((s) => (
            <button key={s} className="m-pill" aria-pressed={status === s} onClick={() => setStatus(s)}>
              <span className="m-dot" style={{ background: STATUS_VAR[s] }} />
              {t(`m.status.${s}`)}
            </button>
          ))}
        </div>
      </div>

      {projectsOn && projects.length > 0 && (
        <div className="m-field">
          <span className="m-label">{t("m.f.project")}</span>
          <div className="m-pills">
            <button className="m-pill" aria-pressed={!projectId} onClick={() => setProjectId(undefined)}>
              {t("m.noProject")}
            </button>
            {projects.map((p) => (
              <button key={p.id} className="m-pill" aria-pressed={projectId === p.id} onClick={() => setProjectId(p.id)}>
                <span className="m-chip__dot" style={{ background: projectColor(p) }} />
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
        <button className="m-btn" style={{ flex: 1 }} disabled={!title.trim()} onClick={() => create(false)}>
          {t("m.addAnother")}
        </button>
        <button className="m-btn m-btn--primary" style={{ flex: 1.3 }} disabled={!title.trim()} onClick={() => create(true)}>
          {t("m.add")}
        </button>
      </div>
    </Sheet>
  );
}
