import { useMemo, useState } from "react";
import type { Board, Op, Phase, Priority, Project, ProjectStatus, Status, Subtask, Task } from "../../lib/types";
import { STATUS_ORDER, UNASSIGNED, PRIORITY_DOT, genId, isArchived } from "../../lib/constants";
import { statusLabel, useT } from "../../lib/i18n";
import { useMe } from "../../lib/identity";
import { useSyncedField } from "../../lib/useSyncedField";
import { ownersPatch, taskOwners } from "../../lib/owners";
import { daysUntil, toISODate } from "../../lib/dates";
import {
  HEALTH_COLOR,
  PROJECT_COLORS,
  PROJECT_STATUSES,
  PROJECT_STATUS_COLOR,
  mergeReordered,
  projectColor,
  projectPriority,
  projectStatus,
  type PhaseStats,
  type ProjectStats,
} from "../../lib/projects";
import { AutoTextarea } from "../AutoTextarea";
import { SortableSubtasks } from "../SortableSubtasks";
import { TaskDetails } from "../TaskDetails";
import { Avatars, Bar, HealthBadge, ProgressRing, fmtDay } from "./ProjectBits";

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
  const { t } = useT();
  const [err, setErr] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const color = projectColor(p);
  const status = projectStatus(p);
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
          <div className="min-w-0 space-y-4">
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
              {/* Status */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-center gap-2">
                  <span className={label}>{t("projects.statusLabel")}</span>
                  <div className="flex rounded-full border border-[#E8E6E1] bg-[#F5F3EF] p-0.5 flex-wrap">
                    {PROJECT_STATUSES.map((st: ProjectStatus) => (
                      <button
                        key={st}
                        onClick={() => patch({ status: st })}
                        className="h-7 px-2.5 rounded-full text-[11px] font-semibold transition-colors"
                        style={
                          status === st
                            ? { background: PROJECT_STATUS_COLOR[st], color: "#fff" }
                            : { color: PROJECT_STATUS_COLOR[st] }
                        }
                      >
                        {t(`projects.status.${st}`)}
                      </button>
                    ))}
                  </div>
                </div>
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
              </div>

              {/* Dates + colour */}
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
                <span className="flex items-center gap-1 ml-1" role="radiogroup" aria-label={t("projects.color")}>
                  {PROJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      role="radio"
                      aria-checked={color === c}
                      onClick={() => patch({ color: c })}
                      className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                      style={{
                        background: c,
                        boxShadow: color === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : undefined,
                      }}
                      title={c}
                    />
                  ))}
                </span>
              </div>

              {/* Leads */}
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

              {/* Description */}
              <div>
                <div className={`${label} mb-1`}>{t("projects.description")}</div>
                <AutoTextarea
                  value={desc.value}
                  onFocus={desc.onFocus}
                  onChange={(e) => desc.setValue(e.target.value)}
                  onBlur={() => {
                    desc.onBlur();
                    if (desc.value !== (p.description ?? "")) patch({ description: desc.value });
                  }}
                  placeholder={t("projects.descriptionPlaceholder")}
                  className="w-full min-h-[3.5rem] rounded-lg bg-[#F5F3EF] border border-[#E8E6E1] p-2.5 text-[13px] leading-relaxed text-[#0A1931] outline-none focus:border-[#C9A96E]"
                />
              </div>
            </fieldset>
          </div>

          {/* Progress */}
          <div className="flex lg:flex-col items-center lg:items-stretch gap-4 lg:w-[220px]">
            <div className="flex flex-col items-center gap-2">
              <ProgressRing value={s.share} color={color} size={112} stroke={10} />
              <HealthBadge health={s.health} daysLeft={s.daysLeft} />
            </div>
            <div className="flex-1 space-y-1.5 text-[12px] text-[#6B6B6B]">
              <Row k={t("projects.checklist")} v={`${s.itemsDone}/${s.itemsTotal}`} />
              <Row k={t("projects.linked")} v={`${s.tasksDone}/${s.tasks.length}`} />
              {s.phases.length > 0 && (
                <Row k={t("projects.phases")} v={`${s.phases.filter((ph) => ph.total > 0 && ph.done === ph.total).length}/${s.phases.length}`} />
              )}
              {(p.owners ?? []).length > 0 && (
                <div className="flex items-center justify-between gap-2">
                  <span>{t("projects.leads")}</span>
                  <Avatars names={p.owners ?? []} max={4} />
                </div>
              )}
              <div className="text-[10px] text-[#A8A29E] pt-1">{t("projects.progressHint")}</div>
            </div>
          </div>
        </div>

        <Schedule project={p} stats={s} color={color} />
      </div>

      {/* Work */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-4 items-start">
        <PhasesCard project={p} stats={s} color={color} v2={v2} patch={patch} />
        <LinkedTasks board={board} project={p} tasks={s.tasks} v2={v2} save={save} />
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span>{k}</span>
      <span className="font-semibold tabular-nums text-[#0A1931]">{v}</span>
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
  if (!p.startDate || !p.targetDate) return null;
  const a = msOf(p.startDate);
  const b = msOf(p.targetDate) + 86400000;
  if (b <= a) return null;
  const now = msOf(toISODate(new Date()));
  const pos = (ms: number) => Math.max(0, Math.min(100, ((ms - a) / (b - a)) * 100));
  const elapsed = pos(now);
  return (
    <div className="px-4 sm:px-5 pb-4">
      <div className="flex items-center justify-between text-[10px] font-semibold text-[#8A8A8A] mb-1">
        <span>{fmtDay(p.startDate, lang, true)}</span>
        <span>
          {t("projects.timeUsed", { n: Math.round(elapsed) })} · {t("projects.workDone", { n: Math.round(s.share * 100) })}
        </span>
        <span>{fmtDay(p.targetDate, lang, true)}</span>
      </div>
      <div className="relative h-3 rounded-full" style={{ background: "rgba(120,120,128,0.14)" }}>
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${s.share * 100}%`, background: color }} />
        {s.phases
          .filter((ph) => ph.phase.dueDate)
          .map((ph) => (
            <span
              key={ph.phase.id}
              className="absolute -top-1 -bottom-1 w-[3px] rounded-full"
              style={{
                left: `${pos(msOf(ph.phase.dueDate!) + 43200000)}%`,
                background: ph.overdue ? "#FF3B30" : ph.total && ph.done === ph.total ? "#34C759" : "#0A1931",
              }}
              title={`${ph.phase.name} · ${fmtDay(ph.phase.dueDate, lang)}`}
            />
          ))}
        {now >= a && now <= b && (
          <span className="absolute -top-1.5 -bottom-1.5 w-0.5 bg-[#FF3B30]" style={{ left: `${elapsed}%` }} title={t("projects.timeline.today")} />
        )}
      </div>
    </div>
  );
}

// ---- Phases + checklist -----------------------------------------------------------

function PhasesCard({
  project: p,
  stats: s,
  color,
  v2,
  patch,
}: {
  project: Project;
  stats: ProjectStats;
  color: string;
  v2: boolean;
  patch: (patch: Partial<Project>) => void;
}) {
  const { t } = useT();
  const [newPhase, setNewPhase] = useState("");
  const phases = p.phases ?? [];

  const setItems = (items: Subtask[]) => patch({ items });
  const addPhase = () => {
    const v = newPhase.trim();
    if (!v) return;
    patch({ phases: [...phases, { id: genId(), name: v }] });
    setNewPhase("");
  };
  const updatePhase = (id: string, change: Partial<Phase>) =>
    patch({ phases: phases.map((ph) => (ph.id === id ? { ...ph, ...change } : ph)) });
  const movePhase = (id: string, dir: -1 | 1) => {
    const i = phases.findIndex((ph) => ph.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= phases.length) return;
    const next = [...phases];
    [next[i], next[j]] = [next[j], next[i]];
    patch({ phases: next });
  };
  // Deleting a phase keeps its items, with no phase.
  const deletePhase = (id: string) =>
    patch({
      phases: phases.filter((ph) => ph.id !== id),
      items: p.items.map((it) => (it.phaseId === id ? { ...it, phaseId: undefined } : it)),
    });

  const phaseSelect = (it: Subtask) =>
    phases.length > 0 && v2 ? (
      <select
        value={it.phaseId && phases.some((ph) => ph.id === it.phaseId) ? it.phaseId : ""}
        onChange={(e) => setItems(p.items.map((x) => (x.id === it.id ? { ...x, phaseId: e.target.value || undefined } : x)))}
        title={t("projects.movePhase")}
        className="h-5 max-w-[96px] shrink-0 rounded bg-transparent text-[10px] text-[#8A8A8A] outline-none opacity-60 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
      >
        <option value="">{t("projects.phaseLoose")}</option>
        {phases.map((ph) => (
          <option key={ph.id} value={ph.id}>
            {ph.name || "—"}
          </option>
        ))}
      </select>
    ) : null;

  return (
    <div className={`${card} p-4 space-y-3`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-trajan text-[13px] uppercase tracking-widest text-[#0A1931]">
          {phases.length ? t("projects.phases") : t("projects.checklist")}
        </h3>
        <span className="text-[11px] text-[#8A8A8A] tabular-nums">
          {s.itemsDone}/{s.itemsTotal}
        </span>
      </div>

      {(phases.length === 0 || s.loose.length > 0) && (
        <ItemGroup
          title={phases.length ? t("projects.phaseLoose") : null}
          items={s.loose}
          all={p.items}
          color={color}
          phaseId={undefined}
          setItems={setItems}
          renderExtra={phaseSelect}
        />
      )}

      {s.phases.map((ph, i) => (
        <PhaseBlock
          key={ph.phase.id}
          ph={ph}
          index={i}
          count={phases.length}
          all={p.items}
          color={color}
          setItems={setItems}
          renderExtra={phaseSelect}
          onUpdate={(c) => updatePhase(ph.phase.id, c)}
          onMove={(d) => movePhase(ph.phase.id, d)}
          onDelete={() => deletePhase(ph.phase.id)}
        />
      ))}

      {v2 ? (
        <div className="flex gap-1.5 pt-1">
          <input
            value={newPhase}
            onChange={(e) => setNewPhase(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addPhase()}
            placeholder={t("projects.addPhase")}
            className="flex-1 min-w-0 h-8 rounded-full bg-[#F5F3EF] border border-dashed border-[#E3DFD7] px-3 text-[12px] outline-none focus:border-[#C9A96E]"
          />
          <button
            onClick={addPhase}
            disabled={!newPhase.trim()}
            className="h-8 px-3 shrink-0 rounded-full border border-[#E8E6E1] text-[12px] font-semibold text-[#0A1931] disabled:opacity-40 hover:border-[#C9A96E]"
          >
            + {t("projects.phase")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function PhaseBlock({
  ph,
  index,
  count,
  all,
  color,
  setItems,
  renderExtra,
  onUpdate,
  onMove,
  onDelete,
}: {
  ph: PhaseStats;
  index: number;
  count: number;
  all: Subtask[];
  color: string;
  setItems: (items: Subtask[]) => void;
  renderExtra: (it: Subtask) => React.ReactNode;
  onUpdate: (c: Partial<Phase>) => void;
  onMove: (d: -1 | 1) => void;
  onDelete: () => void;
}) {
  const { t } = useT();
  const name = useSyncedField(ph.phase.name);
  const [confirm, setConfirm] = useState(false);
  const left = daysUntil(ph.phase.dueDate);
  const complete = ph.total > 0 && ph.done === ph.total;
  return (
    <div className="rounded-[12px] border border-[#E3DFD7] bg-[#FAF9F6] p-2.5 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold"
          style={{ background: complete ? "#34C759" : color, color: "#fff" }}
        >
          {complete ? "✓" : index + 1}
        </span>
        <input
          value={name.value}
          onFocus={name.onFocus}
          onChange={(e) => name.setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
          onBlur={() => {
            name.onBlur();
            if (name.value.trim() !== ph.phase.name) onUpdate({ name: name.value.trim() });
          }}
          className="flex-1 min-w-[120px] bg-transparent font-semibold text-[13px] text-[#0A1931] outline-none border-b border-transparent focus:border-[#C9A96E]"
        />
        <label
          className={`inline-flex items-center gap-1 rounded-full px-2 h-7 border text-[11px] ${
            ph.overdue ? "bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]" : left !== null && left <= 3 && !complete ? "bg-[#FEF3C7] border-[#FDE68A] text-[#92400E]" : "bg-white border-[#E8E6E1] text-[#6B6B6B]"
          }`}
          title={t("projects.phaseDue")}
        >
          ⏱
          <input
            type="date"
            value={ph.phase.dueDate ?? ""}
            onChange={(e) => onUpdate({ dueDate: e.target.value || undefined })}
            className="bg-transparent outline-none text-[11px] w-[112px]"
          />
        </label>
        <span className="flex items-center">
          <button onClick={() => onMove(-1)} disabled={index === 0} title={t("projects.phaseUp")} className="w-6 h-6 text-[12px] text-[#8A8A8A] disabled:opacity-25">
            ↑
          </button>
          <button onClick={() => onMove(1)} disabled={index === count - 1} title={t("projects.phaseDown")} className="w-6 h-6 text-[12px] text-[#8A8A8A] disabled:opacity-25">
            ↓
          </button>
          {confirm ? (
            <span className="flex items-center gap-1 text-[11px] ml-1">
              <button onClick={onDelete} className="font-semibold text-[#DC2626]">
                {t("projects.deletePhase")}
              </button>
              <button onClick={() => setConfirm(false)} className="text-[#8A8A8A]">
                {t("task.no")}
              </button>
            </span>
          ) : (
            <button onClick={() => setConfirm(true)} title={t("projects.deletePhase")} className="w-6 h-6 text-[12px] text-[#A8A29E] hover:text-[#DC2626]">
              ✕
            </button>
          )}
        </span>
      </div>
      {confirm && <div className="text-[11px] text-[#8A8A8A]">{t("projects.confirmDeletePhase")}</div>}
      <div className="flex items-center gap-2">
        <Bar value={ph.share} color={ph.overdue ? "#FF3B30" : color} height={5} />
        <span className="text-[10px] font-semibold tabular-nums text-[#8A8A8A]">
          {ph.done}/{ph.total}
        </span>
      </div>
      <ItemGroup title={null} items={ph.items} all={all} color={color} phaseId={ph.phase.id} setItems={setItems} renderExtra={renderExtra} bare />
    </div>
  );
}

// One list of checklist items (a phase's, or the ones without a phase), with
// drag-reorder inside the list and an "add item" field.
function ItemGroup({
  title,
  items,
  all,
  phaseId,
  setItems,
  renderExtra,
  bare = false,
}: {
  title: string | null;
  items: Subtask[];
  all: Subtask[];
  color: string;
  phaseId: string | undefined;
  setItems: (items: Subtask[]) => void;
  renderExtra: (it: Subtask) => React.ReactNode;
  bare?: boolean;
}) {
  const { t } = useT();
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    setItems([...all, { id: genId(), text: v, done: false, ...(phaseId ? { phaseId } : {}) }]);
    setDraft("");
  };
  const body = (
    <>
      {title && <div className="font-trajan text-[10px] uppercase tracking-widest text-[#8A8A8A] px-0.5">{title}</div>}
      <SortableSubtasks
        items={items}
        onReorder={(sub) => setItems(mergeReordered(all, sub))}
        onToggle={(id, doneNow) =>
          setItems(all.map((i) => (i.id === id ? { ...i, done: doneNow, doneAt: doneNow ? Date.now() : undefined } : i)))
        }
        onText={(id, text) => setItems(all.map((i) => (i.id === id ? { ...i, text } : i)))}
        onDelete={(id) => setItems(all.filter((i) => i.id !== id))}
        renderExtra={renderExtra}
      />
      <div className="flex items-center gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={t("projects.addItem")}
          className="flex-1 min-w-0 h-8 rounded-full bg-white border border-[#E8E6E1] px-3 text-[12px] outline-none focus:border-[#C9A96E]"
        />
        <button
          onClick={add}
          disabled={!draft.trim()}
          className="h-8 w-8 shrink-0 flex items-center justify-center rounded-full bg-[#0A1931] text-[#C9A96E] text-[14px] font-semibold disabled:opacity-40"
        >
          +
        </button>
      </div>
    </>
  );
  if (bare) return <div className="space-y-2">{body}</div>;
  return <div className="bg-[#EFECE6] rounded-[12px] border border-[#E3DFD7] p-2.5 space-y-2">{body}</div>;
}

// ---- Linked board tasks -------------------------------------------------------------

function LinkedTasks({
  board,
  project: p,
  tasks,
  v2,
  save,
}: {
  board: Board;
  project: Project;
  tasks: Task[];
  v2: boolean;
  save: (op: Op) => void;
}) {
  const { t, lang } = useT();
  const { me } = useMe();
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<Status>("NEXT");
  const [openId, setOpenId] = useState<string | null>(null);

  const linkable = useMemo(
    () => board.tasks.filter((x) => !x.projectId && !isArchived(x)),
    [board.tasks]
  );

  const create = () => {
    const v = title.trim();
    if (!v) return;
    const owners = (p.owners ?? []).length ? (p.owners ?? []).slice(0, 1) : me && board.members.includes(me) ? [me] : [UNASSIGNED];
    const task: Task = {
      id: genId(),
      title: v,
      desc: "",
      ...ownersPatch(owners),
      priority: projectPriority(p),
      status,
      notes: "",
      subtasks: [],
      projectId: p.id,
      updatedAt: Date.now(),
      createdAt: Date.now(),
      ...(status === "WAITING" ? { waitingSince: toISODate(new Date()) } : {}),
    };
    save({ type: "addTask", task });
    setTitle("");
  };

  const ordered = STATUS_ORDER.flatMap((st) => tasks.filter((x) => x.status === st));

  return (
    <div className={`${card} p-4 space-y-3`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-trajan text-[13px] uppercase tracking-widest text-[#0A1931]">{t("projects.linked")}</h3>
        <span className="text-[11px] text-[#8A8A8A] tabular-nums">
          {tasks.filter((x) => x.status === "DONE").length}/{tasks.length}
        </span>
      </div>

      {!v2 ? (
        <div className="text-[12px] text-[#A8A29E]">{t("projects.needsMigration")}</div>
      ) : (
        <>
          <div className="flex gap-1.5">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder={t("projects.newTask")}
              className="flex-1 min-w-0 h-8 rounded-full bg-[#F5F3EF] border border-[#E8E6E1] px-3 text-[12px] outline-none focus:border-[#C9A96E]"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
              className="h-8 rounded-full bg-[#F5F3EF] border border-[#E8E6E1] px-2 text-[11px] text-[#0A1931] outline-none"
            >
              {STATUS_ORDER.map((st) => (
                <option key={st} value={st}>
                  {statusLabel(lang, st)}
                </option>
              ))}
            </select>
            <button
              onClick={create}
              disabled={!title.trim()}
              className="h-8 w-8 shrink-0 flex items-center justify-center rounded-full bg-[#0A1931] text-[#C9A96E] text-[14px] font-semibold disabled:opacity-40"
            >
              +
            </button>
          </div>
          {linkable.length > 0 && (
            <select
              value=""
              onChange={(e) => e.target.value && save({ type: "updateTask", id: e.target.value, patch: { projectId: p.id } })}
              className="w-full h-8 rounded-full bg-white border border-dashed border-[#E3DFD7] px-3 text-[12px] text-[#6B6B6B] outline-none cursor-pointer"
            >
              <option value="">{t("projects.linkExisting")}</option>
              {STATUS_ORDER.map((st) => {
                const group = linkable.filter((x) => x.status === st);
                return group.length ? (
                  <optgroup key={st} label={statusLabel(lang, st)}>
                    {group.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.title}
                      </option>
                    ))}
                  </optgroup>
                ) : null;
              })}
            </select>
          )}
        </>
      )}

      {ordered.length === 0 ? (
        v2 && <div className="text-[12px] text-[#A8A29E] py-2">{t("projects.linkedNone")}</div>
      ) : (
        <div className="space-y-1.5">
          {ordered.map((task) => (
            <LinkedTaskRow
              key={task.id}
              task={task}
              board={board}
              open={openId === task.id}
              onToggle={() => setOpenId(openId === task.id ? null : task.id)}
              onUnlink={() => save({ type: "updateTask", id: task.id, patch: { projectId: undefined } })}
              save={save}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LinkedTaskRow({
  task,
  board,
  open,
  onToggle,
  onUnlink,
  save,
}: {
  task: Task;
  board: Board;
  open: boolean;
  onToggle: () => void;
  onUnlink: () => void;
  save: (op: Op) => void;
}) {
  const { t, lang } = useT();
  const done = task.status === "DONE";
  const left = daysUntil(task.dueDate);
  const subs = task.subtasks.length;
  const subsDone = task.subtasks.filter((x) => x.done).length;
  return (
    <div className={`rounded-[10px] border bg-white ${open ? "border-[#C9A96E]" : "border-[#E8E6E1]"}`}>
      <div className="group flex items-center gap-2 px-2.5 py-2">
        <button
          onClick={() => save({ type: "moveTask", id: task.id, status: done ? "NEXT" : "DONE" })}
          title={done ? statusLabel(lang, "NEXT") : statusLabel(lang, "DONE")}
          className="w-4 h-4 shrink-0 rounded-full border flex items-center justify-center text-[9px] text-white"
          style={done ? { background: "#34C759", borderColor: "#34C759" } : { borderColor: "#C9C5BE" }}
        >
          {done ? "✓" : ""}
        </button>
        <span className={`w-2 h-2 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`} />
        <button onClick={onToggle} className="flex-1 min-w-0 text-left">
          <span className={`block text-[12px] leading-snug break-words ${done ? "line-through text-[#A8A29E]" : "text-[#0A1931] font-medium"}`}>
            {task.title}
          </span>
          <span className="flex items-center gap-1.5 mt-0.5 text-[10px] text-[#8A8A8A] flex-wrap">
            <span className="font-semibold uppercase tracking-wide">{statusLabel(lang, task.status)}</span>
            {task.dueDate && (
              <span style={{ color: !done && left !== null && left < 0 ? HEALTH_COLOR.overdue : undefined }}>· {fmtDay(task.dueDate, lang)}</span>
            )}
            {subs > 0 && <span>· ☑ {subsDone}/{subs}</span>}
            <span>· {taskOwners(task).join(", ")}</span>
          </span>
        </button>
        <button
          onClick={onUnlink}
          title={t("projects.unlink")}
          className="shrink-0 w-6 h-6 rounded-full text-[11px] text-[#A8A29E] hover:text-[#DC2626] opacity-60 group-hover:opacity-100"
        >
          ⨯
        </button>
      </div>
      {open && (
        <div className="px-2.5 pb-2.5 border-t border-[#F0EDE8] pt-2.5">
          <TaskDetails
            task={task}
            members={board.members}
            send={save}
            multiAssign={board.assigneesAvailable !== false}
            onDeleted={onToggle}
          />
        </div>
      )}
    </div>
  );
}
