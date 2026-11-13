import { useMemo, useState } from "react";
import type { Board, Project, Task } from "../lib/types";
import { STATUS_ORDER } from "../lib/constants";
import { useT } from "../lib/i18n";
import { useMe } from "../lib/identity";
import { useSyncedField } from "../lib/useSyncedField";
import { newProject, projectColor, projectStats, type Health, type ProjectStats } from "../lib/projects";
import { AutoTextarea } from "../components/AutoTextarea";
import { Avatar, Ring, Sheet, STATUS_VAR, shortDay } from "./ui";
import { TaskList } from "./TaskList";
import { useNav } from "./nav";
import { IconPlus } from "./icons";
import type { Send } from "./actions";

const HEALTH_CHIP: Record<Health, string> = {
  done: "m-chip m-chip--green",
  overdue: "m-chip m-chip--red",
  atRisk: "m-chip m-chip--amber",
  onTrack: "m-chip m-chip--green",
  noDate: "m-chip",
};

/** Projects as cards with their progress; completed ones under their own tab. */
export function ProjectsScreen({ board, send }: { board: Board; send: Send }) {
  const { t } = useT();
  const { me } = useMe();
  const nav = useNav();
  const [view, setView] = useState<"ongoing" | "done">("ongoing");
  const [naming, setNaming] = useState(false);

  const stats = useMemo(() => {
    const m = new Map<string, ProjectStats>();
    for (const p of board.projects) m.set(p.id, projectStats(p, board.tasks));
    return m;
  }, [board.projects, board.tasks]);

  const list = board.projects
    .filter((p) => stats.get(p.id)!.status === view)
    .sort((a, b) =>
      view === "done"
        ? (stats.get(b.id)!.completedAt ?? 0) - (stats.get(a.id)!.completedAt ?? 0)
        : (a.targetDate ?? "9999").localeCompare(b.targetDate ?? "9999")
    );
  const doneCount = board.projects.filter((p) => stats.get(p.id)!.status === "done").length;

  return (
    <div className="m-page">
      <div className="m-seg" style={{ marginBottom: 14 }}>
        <button aria-pressed={view === "ongoing"} onClick={() => setView("ongoing")}>
          {t("projects.status.ongoing")} · {board.projects.length - doneCount}
        </button>
        <button aria-pressed={view === "done"} onClick={() => setView("done")}>
          {t("projects.status.done")} · {doneCount}
        </button>
      </div>

      {list.length === 0 ? (
        <div className="m-empty">{view === "ongoing" ? t("m.noProjects") : t("m.noDoneProjects")}</div>
      ) : (
        <div className="m-stack">
          {list.map((p) => (
            <ProjectCard key={p.id} project={p} stats={stats.get(p.id)!} onOpen={() => nav.openProject(p.id)} />
          ))}
        </div>
      )}

      <button className="m-btn m-btn--block m-btn--ghost" style={{ marginTop: 14 }} onClick={() => setNaming(true)}>
        <IconPlus size={18} /> {t("m.newProject")}
      </button>

      {naming && (
        <NameSheet
          onClose={() => setNaming(false)}
          onCreate={(name) => {
            const p = newProject(name, me && board.members.includes(me) ? [me] : []);
            send({ type: "projectAdd", project: p });
            setNaming(false);
            nav.openProject(p.id);
          }}
        />
      )}
    </div>
  );
}

function ProjectCard({ project: p, stats: s, onOpen }: { project: Project; stats: ProjectStats; onOpen: () => void }) {
  const { t, lang } = useT();
  const color = projectColor(p);
  const open = s.total - s.done;
  return (
    <button className="m-project" onClick={onOpen}>
      <span className="m-project__glow" style={{ ["--tint" as string]: color }} />
      <div className="m-project__top">
        <Ring share={s.share} color={color} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="m-card__title" style={{ fontSize: 16 }}>
            {p.name}
          </div>
          {p.description && <div className="m-card__desc">{p.description}</div>}
        </div>
      </div>
      <div className="m-statusbar" aria-hidden="true">
        {STATUS_ORDER.filter((st) => s.byStatus[st] > 0).map((st) => (
          <span key={st} style={{ flex: s.byStatus[st], background: STATUS_VAR[st] }} />
        ))}
      </div>
      <div className="m-card__meta">
        <span className={HEALTH_CHIP[s.health]}>{t(`projects.health.${s.health}`)}</span>
        {p.targetDate && <span className="m-chip">→ {shortDay(p.targetDate, lang)}</span>}
        <span className="m-chip">{t("m.openTasks").replace("{n}", String(open))}</span>
        {s.overdueTasks > 0 && (
          <span className="m-chip m-chip--red">{t("m.lateTasks").replace("{n}", String(s.overdueTasks))}</span>
        )}
        <span className="m-avatars">
          {(p.owners ?? []).slice(0, 3).map((o) => (
            <Avatar key={o} name={o} />
          ))}
        </span>
      </div>
    </button>
  );
}

function NameSheet({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => void }) {
  const { t } = useT();
  const [name, setName] = useState("");
  return (
    <Sheet title={t("m.newProject")} onClose={onClose}>
      <input
        autoFocus
        className="m-input"
        placeholder={t("m.projectNamePh")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && name.trim() && onCreate(name.trim())}
        enterKeyHint="done"
      />
      <button
        className="m-btn m-btn--primary m-btn--block"
        style={{ marginTop: 14 }}
        disabled={!name.trim()}
        onClick={() => onCreate(name.trim())}
      >
        {t("m.create")}
      </button>
    </Sheet>
  );
}

/** One project: its numbers, notes and every linked task by column. */
export function ProjectSheet({
  board,
  project: p,
  send,
  onClose,
}: {
  board: Board;
  project: Project;
  send: Send;
  onClose: () => void;
}) {
  const { t, lang } = useT();
  const nav = useNav();
  const s = projectStats(p, board.tasks);
  const color = projectColor(p);
  const notes = useSyncedField(p.notes ?? "");
  const [showDone, setShowDone] = useState(false);
  const v2 = !!board.projectsV2Available;

  const byStatus = new Map<string, Task[]>();
  for (const tk of s.tasks) byStatus.set(tk.status, [...(byStatus.get(tk.status) ?? []), tk]);

  return (
    <Sheet full title={t("m.project")} onClose={onClose} tint={color}>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <Ring share={s.share} color={color} size={62} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 21, fontWeight: 700, lineHeight: 1.2 }}>{p.name}</div>
          <div className="m-card__meta" style={{ marginTop: 6 }}>
            <span className={HEALTH_CHIP[s.health]}>{t(`projects.health.${s.health}`)}</span>
            <span className="m-chip">
              {s.done}/{s.total} {t("m.doneShort")}
            </span>
            {p.boardMode && p.boardMode !== "all" && <span className="m-chip m-chip--gold">{t(`projects.mode.${p.boardMode}`)}</span>}
          </div>
        </div>
      </div>

      {p.description && <p style={{ marginTop: 14, color: "var(--m-text-2)", lineHeight: 1.45 }}>{p.description}</p>}

      {v2 && (p.startDate || p.targetDate || (p.owners ?? []).length > 0) && (
        <div className="m-panel m-list m-list--flat" style={{ marginTop: 14 }}>
          {(p.startDate || p.targetDate) && (
            <div className="m-row">
              <span className="m-row__main m-row__hint" style={{ marginTop: 0 }}>
                {t("m.dates")}
              </span>
              <span className="m-row__end" style={{ color: "var(--m-text)" }}>
                {p.startDate ? shortDay(p.startDate, lang) : "—"} → {p.targetDate ? shortDay(p.targetDate, lang) : "—"}
              </span>
            </div>
          )}
          {(p.owners ?? []).length > 0 && (
            <div className="m-row">
              <span className="m-row__main m-row__hint" style={{ marginTop: 0 }}>
                {t("m.leads")}
              </span>
              <span className="m-row__end" style={{ color: "var(--m-text)" }}>
                {(p.owners ?? []).join(", ")}
              </span>
            </div>
          )}
        </div>
      )}

      <h2 className="m-h2">
        {t("m.f.tasks")} <span className="m-count">{s.total}</span>
        <button className="m-link" onClick={() => nav.add({ projectId: p.id })}>
          + {t("m.add")}
        </button>
      </h2>
      {s.total === 0 && <div className="m-empty">{t("m.noProjectTasks")}</div>}
      {STATUS_ORDER.filter((st) => st !== "DONE").map((st) => {
        const list = byStatus.get(st);
        if (!list?.length) return null;
        return (
          <div key={st} style={{ marginBottom: 14 }}>
            <div className="m-label" style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span className="m-dot" style={{ background: STATUS_VAR[st] }} /> {t(`m.status.${st}`)} · {list.length}
            </div>
            <TaskList tasks={list} send={send} />
          </div>
        );
      })}
      {(byStatus.get("DONE")?.length ?? 0) > 0 && (
        <>
          <button className="m-btn m-btn--block" onClick={() => setShowDone((v) => !v)}>
            {showDone ? t("m.hideDone") : t("m.showDone").replace("{n}", String(byStatus.get("DONE")!.length))}
          </button>
          {showDone && (
            <div style={{ marginTop: 10 }}>
              <TaskList tasks={byStatus.get("DONE")!} send={send} />
            </div>
          )}
        </>
      )}

      {v2 && (
        <div className="m-field" style={{ marginTop: 22 }}>
          <label htmlFor="m-pnotes">{t("m.f.notes")}</label>
          <AutoTextarea
            id="m-pnotes"
            className="m-textarea"
            value={notes.value}
            placeholder={t("m.notesPh")}
            onChange={(e) => notes.setValue(e.target.value)}
            onFocus={notes.onFocus}
            onBlur={() => {
              notes.onBlur();
              if (notes.value !== (p.notes ?? "")) send({ type: "projectUpdate", id: p.id, patch: { notes: notes.value } });
            }}
          />
        </div>
      )}
      <p className="m-sub" style={{ marginTop: 18, textAlign: "center" }}>
        {t("m.projectDesktopHint")}
      </p>
    </Sheet>
  );
}
