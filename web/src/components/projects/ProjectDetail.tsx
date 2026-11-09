import { useState } from "react";
import type { Board, Op, Priority, Project, Task } from "../../lib/types";
import { PRIORITY_DOT, STATUS_ORDER, UNASSIGNED, genId } from "../../lib/constants";
import { statusLabel, useT } from "../../lib/i18n";
import { useSyncedField } from "../../lib/useSyncedField";
import { ownersPatch } from "../../lib/owners";
import { toISODate } from "../../lib/dates";
import {
  PROJECT_COLORS,
  PROJECT_STATUS_COLOR,
  TASK_STATUS_COLOR,
  projectColor,
  projectPriority,
  type ProjectStats,
} from "../../lib/projects";
import { AutoTextarea } from "../AutoTextarea";
import { Avatars, HealthBadge, Pill, ProgressRing, fmtDay, fmtMs } from "./ProjectBits";
import { ProjectTasks } from "./ProjectTasks";

const PRIOS: Priority[] = ["P1", "P2", "P3", "P4"];

interface Props {
  board: Board;
  project: Project;
  stats: ProjectStats;
  send: (op: Op, onError?: (message: string) => void) => void;
  v2: boolean;
  onBack: () => void;
  prevId: string | null;
  nextId: string | null;
  onOpen: (id: string) => void;
}

const label = "font-trajan text-[10px] uppercase tracking-widest text-[#8A8A8A]";
const card = "bg-white rounded-[14px] border border-[#E8E6E1]";

export function ProjectDetail({ board, project: p, stats: s, send, v2, onBack, prevId, nextId, onOpen }: Props) {
  const { t, lang } = useT();
  const [err, setErr] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const color = projectColor(p);
  const done = s.status === "done";
  const name = useSyncedField(p.name);
  const desc = useSyncedField(p.description ?? "");

  const save = (op: Op) => {
    setErr(null);
    send(op, (m) => setErr(m));
  };
  const patch = (patch: Partial<Project>) => save({ type: "projectUpdate", id: p.id, patch });

  const toggleOwner = (m: string) => {
    const cur = p.owners ?? [];
    patch({ owners: cur.includes(m) ? cur.filter((o) => o !== m) : [...cur, m] });
  };

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onBack}
          className="h-9 px-4 rounded-full bg-white border border-[#E8E6E1] text-[12px] font-semibold text-[#0A1931] hover:border-[#C9A96E]"
        >
          ← {t("projects.back")}
        </button>
        <button
          onClick={() => prevId && onOpen(prevId)}
          disabled={!prevId}
          title={t("projects.prev")}
          className="w-9 h-9 rounded-full bg-white border border-[#E8E6E1] text-[#0A1931] disabled:opacity-30 hover:border-[#C9A96E]"
        >
          ‹
        </button>
        <button
          onClick={() => nextId && onOpen(nextId)}
          disabled={!nextId}
          title={t("projects.next")}
          className="w-9 h-9 rounded-full bg-white border border-[#E8E6E1] text-[#0A1931] disabled:opacity-30 hover:border-[#C9A96E]"
        >
          ›
        </button>
        <span className="flex-1" />
        <button
          onClick={() => save({ type: "projectReportHidden", id: p.id, hidden: !p.reportHidden })}
          title={t("projects.reportHint")}
          className={`h-9 px-3 rounded-full border text-[12px] font-semibold ${
            p.reportHidden ? "bg-white text-[#8A8A8A] border-[#E8E6E1]" : "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]"
          }`}
        >
          {p.reportHidden ? `○ ${t("projects.notInReport")}` : `● ${t("projects.inReport")}`}
        </button>
        {confirmDel ? (
          <span className="flex items-center gap-2 text-[12px] bg-[#FEF2F2] border border-[#FECACA] rounded-full pl-3 pr-1 h-9">
            <span className="text-[#DC2626] font-semibold">{t("projects.confirmDelete")}</span>
            <button
              onClick={() => {
                save({ type: "projectDelete", id: p.id });
                onBack();
              }}
              className="h-7 px-3 rounded-full bg-[#DC2626] text-white font-semibold"
            >
              {t("task.yes")}
            </button>
            <button onClick={() => setConfirmDel(false)} className="h-7 px-3 rounded-full bg-white text-[#6B6B6B] border border-[#E8E6E1]">
              {t("task.no")}
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmDel(true)}
            className="h-9 px-3 rounded-full text-[12px] font-semibold text-[#8A8A8A] border border-[#E8E6E1] hover:text-[#DC2626] hover:border-[#FECACA]"
          >
            {t("projects.delete")}
          </button>
        )}
      </div>

      {!v2 && (
        <div className="rounded-[12px] border border-[#FDE68A] bg-[#FEF3C7] px-4 py-2.5 text-[12px] text-[#92400E]">
          {t("projects.migration")}
        </div>
      )}
      {err && (
        <div className="rounded-[12px] border border-[#FECACA] bg-[#FEF2F2] px-4 py-2.5 text-[12px] text-[#DC2626]">
          {t("projects.saveFailed")} {err}
        </div>
      )}

      {/* Hero */}
      <div className={`${card} relative overflow-hidden`}>
        <span className="absolute left-0 right-0 top-0 h-1.5" style={{ background: color }} />
        <div className="p-4 sm:p-5 pt-6 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5">
          <div className="min-w-0 space-y-3.5">
            <div className="flex items-center gap-2 flex-wrap" title={t("projects.autoStatus")}>
              {done ? (
                <Pill color={PROJECT_STATUS_COLOR.done} solid>✓ {t("projects.completedOn", { d: fmtMs(s.completedAt!, lang, true) })}</Pill>
              ) : (
                <Pill color={PROJECT_STATUS_COLOR.ongoing} solid>
                  {t("projects.status.ongoing")}
                </Pill>
              )}
              <span className="text-[11px] text-[#A8A29E]">{t("projects.autoStatus")}</span>
            </div>

            <input
              value={name.value}
              onFocus={name.onFocus}
              onChange={(e) => name.setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
              onBlur={() => {
                name.onBlur();
                const v = name.value.trim();
                if (v && v !== p.name) patch({ name: v });
                else if (!v) name.setValue(p.name);
              }}
              className="w-full font-trajan text-[22px] sm:text-[26px] leading-tight text-[#0A1931] bg-transparent outline-none border-b border-transparent focus:border-[#C9A96E]"
            />

            <fieldset disabled={!v2} className="space-y-3 disabled:opacity-50">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-center gap-2">
                  <span className={label}>{t("projects.priority")}</span>
                  <div className="flex gap-1">
                    {PRIOS.map((pr) => (
                      <button
                        key={pr}
                        onClick={() => patch({ priority: pr })}
                        className={`h-7 px-2.5 rounded-full text-[11px] font-semibold border inline-flex items-center gap-1 ${
                          projectPriority(p) === pr
                            ? "bg-[#0A1931] text-[#C9A96E] border-[#0A1931]"
                            : "bg-white text-[#6B6B6B] border-[#E8E6E1]"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[pr]}`} />
                        {pr}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 bg-[#F5F3EF] rounded-full px-3 h-8 border border-[#E8E6E1] text-[12px] text-[#6B6B6B]">
                    {t("projects.start")}
                    <input
                      type="date"
                      value={p.startDate ?? ""}
                      max={p.targetDate}
                      onChange={(e) => patch({ startDate: e.target.value || undefined })}
                      className="bg-transparent outline-none text-[12px] text-[#0A1931]"
                    />
                  </label>
                  <span className="text-[#A8A29E]">→</span>
                  <label className="inline-flex items-center gap-1.5 bg-[#F5F3EF] rounded-full px-3 h-8 border border-[#E8E6E1] text-[12px] text-[#6B6B6B]">
                    {t("projects.target")}
                    <input
                      type="date"
                      value={p.targetDate ?? ""}
                      min={p.startDate}
                      onChange={(e) => patch({ targetDate: e.target.value || undefined })}
                      className="bg-transparent outline-none text-[12px] text-[#0A1931]"
                    />
                  </label>
                </div>
                <span className="flex items-center gap-1" role="radiogroup" aria-label={t("projects.color")}>
                  {PROJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      role="radio"
                      aria-checked={color === c}
                      onClick={() => patch({ color: c })}
                      className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                      style={{ background: c, boxShadow: color === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : undefined }}
                      title={c}
                    />
                  ))}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`${label} mr-1`}>{t("projects.leads")}</span>
                {board.members.map((m) => {
                  const on = (p.owners ?? []).includes(m);
                  return (
                    <button
                      key={m}
                      onClick={() => toggleOwner(m)}
                      className={`h-7 px-2.5 rounded-full text-[12px] border ${
                        on
                          ? "bg-[#0A1931] text-[#C9A96E] border-[#0A1931] font-semibold"
                          : "bg-white text-[#6B6B6B] border-[#E8E6E1] hover:border-[#C9A96E]"
                      }`}
                    >
                      {on ? "✓ " : ""}
                      {m}
                    </button>
                  );
                })}
              </div>

              <AutoTextarea
                value={desc.value}
                onFocus={desc.onFocus}
                onChange={(e) => desc.setValue(e.target.value)}
                onBlur={() => {
                  desc.onBlur();
                  if (desc.value !== (p.description ?? "")) patch({ description: desc.value });
                }}
                placeholder={t("projects.descriptionPlaceholder")}
                aria-label={t("projects.description")}
                className="w-full rounded-lg bg-[#F5F3EF] border border-[#E8E6E1] px-2.5 py-2 text-[13px] leading-relaxed text-[#0A1931] outline-none focus:border-[#C9A96E]"
              />
            </fieldset>
          </div>

          {/* Progress */}
          <div className="flex lg:flex-col items-center lg:items-stretch gap-4 lg:w-[220px]">
            <div className="flex flex-col items-center gap-2">
              <ProgressRing value={s.share} color={done ? PROJECT_STATUS_COLOR.done : color} size={112} stroke={10} label={s.total ? undefined : "—"} />
              {!done && <HealthBadge health={s.health} daysLeft={s.daysLeft} />}
            </div>
            <div className="flex-1 space-y-1 text-[12px] text-[#6B6B6B]">
              {STATUS_ORDER.filter((st) => s.byStatus[st]).map((st) => (
                <div key={st} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: TASK_STATUS_COLOR[st] }} />
                    {statusLabel(lang, st)}
                  </span>
                  <span className="font-semibold tabular-nums text-[#0A1931]">{s.byStatus[st]}</span>
                </div>
              ))}
              {s.total === 0 && <div className="text-[#A8A29E]">{t("projects.noTasksYet")}</div>}
              {(p.owners ?? []).length > 0 && (
                <div className="flex items-center justify-between gap-2 pt-1.5">
                  <span>{t("projects.leads")}</span>
                  <Avatars names={p.owners ?? []} max={4} />
                </div>
              )}
            </div>
          </div>
        </div>

        <Schedule project={p} stats={s} color={color} />
      </div>

      {/* Tasks + notes */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start">
        <ProjectTasks board={board} project={p} stats={s} v2={v2} save={save} />
        <div className="space-y-4">
          <Notes project={p} v2={v2} patch={patch} />
          {p.items.length > 0 && <LegacyChecklist project={p} v2={v2} save={save} patch={patch} />}
        </div>
      </div>
    </div>
  );
}

// ---- Schedule strip -------------------------------------------------------------

function msOf(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

function Schedule({ project: p, stats: s, color }: { project: Project; stats: ProjectStats; color: string }) {
  const { t, lang } = useT();
  if (!p.startDate || !p.targetDate || s.status === "done") return null;
  const a = msOf(p.startDate);
  const b = msOf(p.targetDate) + 86400000;
  if (b <= a) return null;
  const now = msOf(toISODate(new Date()));
  const pos = (ms: number) => Math.max(0, Math.min(100, ((ms - a) / (b - a)) * 100));
  const elapsed = pos(now);
  return (
    <div className="px-4 sm:px-5 pb-4">
      <div className="flex items-center justify-between text-[10px] font-semibold text-[#8A8A8A] mb-1 gap-2">
        <span>{fmtDay(p.startDate, lang, true)}</span>
        <span className="text-center">
          {t("projects.timeUsed", { n: Math.round(elapsed) })} · {t("projects.workDone", { n: Math.round(s.share * 100) })}
        </span>
        <span>{fmtDay(p.targetDate, lang, true)}</span>
      </div>
      <div className="relative h-3 rounded-full" style={{ background: "rgba(120,120,128,0.14)" }}>
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${s.share * 100}%`, background: color }} />
        {now >= a && now <= b && (
          <span className="absolute -top-1.5 -bottom-1.5 w-0.5 bg-[#FF3B30]" style={{ left: `${elapsed}%` }} title={t("projects.timeline.today")} />
        )}
      </div>
    </div>
  );
}

// ---- Notes ----------------------------------------------------------------------

function Notes({ project: p, v2, patch }: { project: Project; v2: boolean; patch: (p: Partial<Project>) => void }) {
  const { t } = useT();
  const notes = useSyncedField(p.notes ?? "");
  return (
    <div className={`${card} p-4 space-y-2`}>
      <h3 className="font-trajan text-[13px] uppercase tracking-widest text-[#0A1931]">{t("projects.notes")}</h3>
      <AutoTextarea
        value={notes.value}
        disabled={!v2}
        onFocus={notes.onFocus}
        onChange={(e) => notes.setValue(e.target.value)}
        onBlur={() => {
          notes.onBlur();
          if (notes.value !== (p.notes ?? "")) patch({ notes: notes.value });
        }}
        placeholder={t("projects.notesPlaceholder")}
        className="w-full min-h-[7rem] rounded-lg bg-[#FFFBF2] border border-[#E8E6E1] p-2.5 text-[12px] leading-relaxed text-[#0A1931] outline-none focus:border-[#C9A96E] disabled:opacity-50"
      />
    </div>
  );
}

// ---- The old checklist ------------------------------------------------------------
// Projects used to carry a checklist. It is no longer edited; whatever a project
// still holds is shown once, to be turned into board tasks or copied into notes.

function LegacyChecklist({
  project: p,
  v2,
  save,
  patch,
}: {
  project: Project;
  v2: boolean;
  save: (op: Op) => void;
  patch: (p: Partial<Project>) => void;
}) {
  const { t } = useT();
  const toTasks = () => {
    const now = Date.now();
    p.items.forEach((it, i) => {
      const task: Task = {
        id: genId(),
        title: it.text || "—",
        desc: "",
        ...ownersPatch((p.owners ?? []).length ? (p.owners ?? []).slice(0, 1) : [UNASSIGNED]),
        priority: projectPriority(p),
        status: it.done ? "DONE" : "BACKLOG",
        notes: "",
        subtasks: [],
        projectId: p.id,
        updatedAt: now,
        createdAt: now + i, // keep the checklist's order
        ...(it.done ? { doneAt: it.doneAt ?? now } : {}),
      };
      save({ type: "addTask", task });
    });
    patch({ items: [] });
  };
  const toNotes = () => {
    const lines = p.items.map((it) => `${it.done ? "☑" : "☐"} ${it.text}`).join("\n");
    const cur = (p.notes ?? "").trimEnd();
    patch({ notes: cur ? `${cur}\n\n${lines}` : lines, items: [] });
  };
  return (
    <div className="rounded-[14px] border border-dashed border-[#E3DFD7] bg-[#FAF9F6] p-4 space-y-2">
      <h3 className="font-trajan text-[11px] uppercase tracking-widest text-[#8A8A8A]">{t("projects.legacy.title")}</h3>
      <p className="text-[11px] text-[#8A8A8A]">{t("projects.legacy.hint")}</p>
      <ul className="space-y-1">
        {p.items.map((it) => (
          <li key={it.id} className={`text-[12px] flex gap-1.5 ${it.done ? "line-through text-[#A8A29E]" : "text-[#0A1931]"}`}>
            <span>{it.done ? "☑" : "☐"}</span>
            <span className="break-words min-w-0">{it.text}</span>
          </li>
        ))}
      </ul>
      <div className="flex gap-1.5 flex-wrap pt-1">
        <button
          onClick={toTasks}
          disabled={!v2}
          className="h-8 px-3 rounded-full bg-[#0A1931] text-[#C9A96E] text-[11px] font-semibold disabled:opacity-40"
        >
          {t("projects.legacy.toTasks")}
        </button>
        <button
          onClick={toNotes}
          disabled={!v2}
          className="h-8 px-3 rounded-full border border-[#E8E6E1] bg-white text-[#0A1931] text-[11px] font-semibold disabled:opacity-40"
        >
          {t("projects.legacy.toNotes")}
        </button>
      </div>
    </div>
  );
}
