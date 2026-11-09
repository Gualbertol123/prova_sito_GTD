import { useEffect, useMemo, useState } from "react";
import type { Board, Op, Project, ProjectStatus } from "../lib/types";
import { useT } from "../lib/i18n";
import { useMe } from "../lib/identity";
import { readPref, writePref } from "../lib/prefs";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_COLOR,
  newProject,
  projectColor,
  projectPriority,
  projectStats,
  projectStatus,
  sortProjects,
  type ProjectSort,
  type ProjectStats,
} from "../lib/projects";
import { PRIORITY_DOT } from "../lib/constants";
import { Avatars, Bar, HealthBadge, ProgressRing, StatusPill, fmtDay } from "./projects/ProjectBits";
import { ProjectDetail } from "./projects/ProjectDetail";
import { ProjectTimeline } from "./projects/ProjectTimeline";

interface Props {
  board: Board;
  send: (op: Op, onError?: (message: string) => void) => void;
}

type StatusFilter = "open" | "all" | ProjectStatus;
type ViewMode = "cards" | "timeline";

// The Projects tab: an overview of every project (cards or a timeline) and,
// when one is opened, its full page (ProjectDetail).
export function ProjectsView({ board, send }: Props) {
  const { t } = useT();
  const v2 = !!board.projectsV2Available;
  const projects = board.projects;

  const [openId, setOpenId] = useState<string | null>(() => readPref("projOpen") || null);
  const [view, setView] = useState<ViewMode>(() => (readPref("projView") === "timeline" ? "timeline" : "cards"));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [owner, setOwner] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ProjectSort>("target");
  const [creating, setCreating] = useState("");
  const { me } = useMe();

  const open = (id: string | null) => {
    setOpenId(id);
    writePref("projOpen", id ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const setViewMode = (m: ViewMode) => {
    setView(m);
    writePref("projView", m);
  };

  // A project deleted (here or elsewhere) closes its page.
  useEffect(() => {
    if (openId && !projects.some((p) => p.id === openId)) open(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, openId]);

  const stats = useMemo(() => {
    const m = new Map<string, ProjectStats>();
    for (const p of projects) m.set(p.id, projectStats(p, board.tasks));
    return m;
  }, [projects, board.tasks]);

  const counts = useMemo(() => {
    const c = { active: 0, planned: 0, onhold: 0, done: 0, overdue: 0, atRisk: 0 };
    for (const p of projects) {
      c[projectStatus(p)] += 1;
      const h = stats.get(p.id)?.health;
      if (h === "overdue") c.overdue += 1;
      if (h === "atRisk") c.atRisk += 1;
    }
    return c;
  }, [projects, stats]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = projects.filter((p) => {
      const st = projectStatus(p);
      if (statusFilter === "open" && st === "done") return false;
      if (statusFilter !== "open" && statusFilter !== "all" && st !== statusFilter) return false;
      if (owner !== "all" && !(p.owners ?? []).includes(owner)) return false;
      if (q) {
        const hay = `${p.name} ${p.description ?? ""} ${p.items.map((i) => i.text).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return sortProjects(list, sort, stats);
  }, [projects, statusFilter, owner, query, sort, stats]);

  const create = () => {
    const name = creating.trim();
    if (!name) return;
    const p = newProject(name, me && board.members.includes(me) ? [me] : []);
    send({ type: "projectAdd", project: p });
    setCreating("");
    open(p.id);
  };

  const selected = openId ? projects.find((p) => p.id === openId) ?? null : null;
  if (selected) {
    const idx = visible.findIndex((p) => p.id === selected.id);
    return (
      <ProjectDetail
        key={selected.id}
        board={board}
        project={selected}
        stats={stats.get(selected.id)!}
        send={send}
        v2={v2}
        onBack={() => open(null)}
        prevId={idx > 0 ? visible[idx - 1].id : null}
        nextId={idx >= 0 && idx < visible.length - 1 ? visible[idx + 1].id : null}
        onOpen={open}
      />
    );
  }

  const owners = Array.from(new Set(projects.flatMap((p) => p.owners ?? []))).sort();
  const chip = (active: boolean) =>
    `h-8 px-3 rounded-full text-[12px] font-semibold border transition-colors whitespace-nowrap ${
      active
        ? "bg-[#0A1931] text-[#C9A96E] border-[#0A1931]"
        : "bg-white text-[#0A1931] border-[#E8E6E1] hover:border-[#C9A96E]"
    }`;

  return (
    <div className="space-y-4">
      {!v2 && <MigrationNote />}

      {/* Heading + figures */}
      <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-trajan text-[20px] tracking-wide text-[#0A1931]">{t("projects.title")}</h2>
            <p className="text-[12px] text-[#8A8A8A] mt-0.5">{t("projects.subtitle")}</p>
          </div>
          <div className="flex gap-1.5 w-full sm:w-auto">
            <input
              value={creating}
              onChange={(e) => setCreating(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder={t("projects.newName")}
              className="flex-1 sm:w-[260px] min-w-0 h-9 rounded-full bg-[#F5F3EF] border border-[#E8E6E1] px-4 text-[13px] outline-none focus:border-[#C9A96E]"
            />
            <button
              onClick={create}
              disabled={!creating.trim()}
              className="h-9 px-4 shrink-0 rounded-full bg-[#0A1931] text-[#C9A96E] text-[12px] font-semibold disabled:opacity-40"
            >
              + {t("projects.new")}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4">
          <Figure label={t("projects.stat.active")} value={counts.active} color={PROJECT_STATUS_COLOR.active} onClick={() => setStatusFilter("active")} />
          <Figure label={t("projects.stat.planned")} value={counts.planned} color={PROJECT_STATUS_COLOR.planned} onClick={() => setStatusFilter("planned")} />
          <Figure label={t("projects.stat.onhold")} value={counts.onhold} color={PROJECT_STATUS_COLOR.onhold} onClick={() => setStatusFilter("onhold")} />
          <Figure label={t("projects.stat.done")} value={counts.done} color={PROJECT_STATUS_COLOR.done} onClick={() => setStatusFilter("done")} />
          <Figure
            label={t("projects.stat.attention")}
            value={counts.overdue + counts.atRisk}
            color={counts.overdue ? "#FF3B30" : "#FF9500"}
            hint={counts.overdue ? t("projects.stat.overdueN", { n: counts.overdue }) : undefined}
            onClick={() => {
              setStatusFilter("open");
              setSort("target");
            }}
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 flex-wrap">
          {(["open", "all", ...PROJECT_STATUSES] as StatusFilter[]).map((f) => (
            <button key={f} onClick={() => setStatusFilter(f)} className={chip(statusFilter === f)}>
              {f === "open" || f === "all" ? t(`projects.filter.${f}`) : t(`projects.status.${f}`)}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("projects.search")}
          className="h-8 w-full sm:w-[200px] rounded-full bg-white border border-[#E8E6E1] px-3 text-[12px] outline-none focus:border-[#C9A96E]"
        />
        {owners.length > 0 && (
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="h-8 rounded-full bg-white border border-[#E8E6E1] px-2 text-[12px] text-[#0A1931] outline-none"
          >
            <option value="all">{t("projects.owner.all")}</option>
            {owners.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        )}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as ProjectSort)}
          title={t("projects.sort.label")}
          className="h-8 rounded-full bg-white border border-[#E8E6E1] px-2 text-[12px] text-[#0A1931] outline-none"
        >
          {(["target", "progress", "priority", "name", "updated"] as ProjectSort[]).map((s) => (
            <option key={s} value={s}>
              {t("projects.sort.label")}: {t(`projects.sort.${s}`)}
            </option>
          ))}
        </select>
        <div className="flex rounded-full border border-[#E8E6E1] bg-white p-0.5">
          {(["cards", "timeline"] as ViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={`h-7 px-3 rounded-full text-[12px] font-semibold ${
                view === m ? "bg-[#0A1931] text-[#C9A96E]" : "text-[#6B6B6B]"
              }`}
            >
              {t(`projects.view.${m}`)}
            </button>
          ))}
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-10 text-center">
          <div className="text-[28px]">◎</div>
          <div className="text-[14px] text-[#0A1931] font-semibold mt-1">{t("projects.none")}</div>
          <div className="text-[12px] text-[#8A8A8A] mt-1">{t("projects.noneHint")}</div>
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-8 text-center text-[13px] text-[#A8A29E]">
          {t("projects.noMatch")}
        </div>
      ) : view === "timeline" ? (
        <ProjectTimeline projects={visible} stats={stats} onOpen={open} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {visible.map((p) => (
            <ProjectCard key={p.id} project={p} stats={stats.get(p.id)!} onOpen={() => open(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Figure({
  label,
  value,
  color,
  hint,
  onClick,
}: {
  label: string;
  value: number;
  color: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-[12px] bg-[#F5F3EF] border border-[#E8E6E1] px-3 py-2.5 hover:border-[#C9A96E] transition-colors"
    >
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8A8A8A]">
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        {label}
      </div>
      <div className="text-[24px] font-semibold tabular-nums text-[#0A1931] leading-tight mt-0.5">{value}</div>
      {hint && <div className="text-[10px] font-semibold" style={{ color }}>{hint}</div>}
    </button>
  );
}

export function MigrationNote() {
  const { t } = useT();
  return (
    <div className="rounded-[12px] border border-[#FDE68A] bg-[#FEF3C7] px-4 py-2.5 text-[12px] text-[#92400E]">
      {t("projects.migration")}
    </div>
  );
}

function ProjectCard({ project: p, stats: s, onOpen }: { project: Project; stats: ProjectStats; onOpen: () => void }) {
  const { t, lang } = useT();
  const color = projectColor(p);
  const status = projectStatus(p);
  return (
    <button
      onClick={onOpen}
      className="group relative text-left bg-white rounded-[14px] border border-[#E8E6E1] hover:border-[#C9A96E] transition-colors overflow-hidden flex flex-col"
    >
      <span className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: color }} />
      <div className="p-4 pl-5 flex-1 flex flex-col gap-3 w-full">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <StatusPill status={status} />
              <span className={`w-2.5 h-2.5 rounded-full ${PRIORITY_DOT[projectPriority(p)]}`} title={projectPriority(p)} />
              <span className="text-[10px] font-semibold text-[#A8A29E]">{projectPriority(p)}</span>
            </div>
            <div className="mt-1.5 font-semibold text-[15px] leading-snug text-[#0A1931] break-words [overflow-wrap:anywhere]">
              {p.name || "—"}
            </div>
            {p.description ? (
              <div className="mt-1 text-[12px] leading-relaxed text-[#6B6B6B] line-clamp-2">{p.description}</div>
            ) : null}
          </div>
          <ProgressRing value={s.share} color={color} />
        </div>

        {s.phases.length > 0 && (
          <div>
            <div className="flex gap-1">
              {s.phases.map((ph) => (
                <div
                  key={ph.phase.id}
                  className="flex-1 h-1.5 rounded-full overflow-hidden"
                  style={{ background: "rgba(120,120,128,0.16)" }}
                  title={`${ph.phase.name} · ${ph.done}/${ph.total}`}
                >
                  <div className="h-full" style={{ width: `${Math.round(ph.share * 100)}%`, background: ph.overdue ? "#FF3B30" : color }} />
                </div>
              ))}
            </div>
            {s.nextPhase && (
              <div className="mt-1.5 text-[11px] text-[#8A8A8A] truncate">
                {t("projects.nextPhase")}: <span className="text-[#0A1931] font-medium">{s.nextPhase.phase.name || "—"}</span>
                {s.nextPhase.phase.dueDate && ` · ${fmtDay(s.nextPhase.phase.dueDate, lang)}`}
              </div>
            )}
          </div>
        )}
        {s.phases.length === 0 && s.total > 0 && (
          <div className="flex items-center gap-2">
            <Bar value={s.share} color={color} />
          </div>
        )}

        <div className="mt-auto flex items-center gap-2 flex-wrap text-[11px] text-[#6B6B6B]">
          <Avatars names={p.owners ?? []} />
          <span className="tabular-nums">☑ {s.itemsDone}/{s.itemsTotal}</span>
          {s.tasks.length > 0 && (
            <span className="tabular-nums">▤ {t("projects.tasksCount", { n: `${s.tasksDone}/${s.tasks.length}` })}</span>
          )}
          <span className="flex-1" />
          {p.targetDate && <span className="tabular-nums">⏱ {fmtDay(p.targetDate, lang)}</span>}
          <HealthBadge health={s.health} daysLeft={s.daysLeft} />
        </div>
        {p.reportHidden && (
          <div className="text-[10px] font-semibold text-[#A8A29E] uppercase tracking-wide">{t("projects.notInReport")}</div>
        )}
      </div>
    </button>
  );
}
