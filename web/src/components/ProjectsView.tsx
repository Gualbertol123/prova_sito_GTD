import { useEffect, useMemo, useState } from "react";
import { goBackTo, useRouteSub } from "../lib/history";
import type { Board, Op, Project } from "../lib/types";
import { useT } from "../lib/i18n";
import { useMe } from "../lib/identity";
import { readPref, writePref } from "../lib/prefs";
import {
  HEALTH_COLOR,
  boardMode,
  PROJECT_STATUS_COLOR,
  newProject,
  projectColor,
  projectPriority,
  projectStats,
  sortProjects,
  type ProjectSort,
  type ProjectStats,
} from "../lib/projects";
import { PRIORITY_DOT } from "../lib/constants";
import { Avatars, HealthBadge, Pill, ProgressRing, StatusStack, fmtDay, fmtMs } from "./projects/ProjectBits";
import { ProjectDetail } from "./projects/ProjectDetail";
import { ProjectTimeline } from "./projects/ProjectTimeline";

interface Props {
  board: Board;
  send: (op: Op, onError?: (message: string) => void) => void;
}

type Filter = "ongoing" | "done";
type ViewMode = "cards" | "timeline";

// The Projects tab: Ongoing and Completed projects (cards or a timeline) and,
// when one is opened, its page (ProjectDetail). A project's status is never
// set by hand — see lib/projects.ts.
export function ProjectsView({ board, send }: Props) {
  const { t } = useT();
  const v2 = !!board.projectsV2Available;
  const projects = board.projects;

  // The open project is part of the URL (#/projects/<id>), so Back returns
  // from a project page to the list.
  const [openSub, setOpenSub] = useRouteSub("projects");
  const openId = openSub ?? null;
  const [view, setView] = useState<ViewMode>(() => (readPref("projView") === "timeline" ? "timeline" : "cards"));
  const [filter, setFilter] = useState<Filter>("ongoing");
  const [owner, setOwner] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ProjectSort>("target");
  const [olderOpen, setOlderOpen] = useState(false);
  const [creating, setCreating] = useState("");
  const { me } = useMe();

  const open = (id: string | null, replace = false) => {
    setOpenSub(id ?? undefined, { replace });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const setViewMode = (m: ViewMode) => {
    setView(m);
    writePref("projView", m);
  };

  // A project deleted (here or elsewhere) closes its page.
  useEffect(() => {
    if (openId && !projects.some((p) => p.id === openId)) open(null, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, openId]);

  const stats = useMemo(() => {
    const m = new Map<string, ProjectStats>();
    for (const p of projects) m.set(p.id, projectStats(p, board.tasks));
    return m;
  }, [projects, board.tasks]);

  const counts = useMemo(() => {
    const c = { ongoing: 0, done: 0, recent: 0, overdue: 0, attention: 0, openTasks: 0 };
    for (const p of projects) {
      const s = stats.get(p.id)!;
      if (s.status === "done") {
        c.done += 1;
        if (s.recent) c.recent += 1;
        continue;
      }
      c.ongoing += 1;
      c.openTasks += s.total - s.done;
      if (s.health === "overdue") c.overdue += 1;
      if (s.health === "overdue" || s.health === "atRisk") c.attention += 1;
    }
    return c;
  }, [projects, stats]);

  const matches = (p: Project) => {
    const q = query.trim().toLowerCase();
    if (owner !== "all" && !(p.owners ?? []).includes(owner)) return false;
    if (!q) return true;
    const hay = `${p.name} ${p.description ?? ""} ${p.notes ?? ""} ${stats
      .get(p.id)!
      .tasks.map((x) => x.title)
      .join(" ")}`.toLowerCase();
    return hay.includes(q);
  };

  const ongoing = useMemo(
    () => sortProjects(projects.filter((p) => stats.get(p.id)!.status === "ongoing" && matches(p)), sort, stats),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, stats, sort, owner, query]
  );
  // Completed: newest completion first.
  const done = useMemo(
    () =>
      projects
        .filter((p) => stats.get(p.id)!.status === "done" && matches(p))
        .sort((a, b) => (stats.get(b.id)!.completedAt ?? 0) - (stats.get(a.id)!.completedAt ?? 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, stats, owner, query]
  );
  const recent = done.filter((p) => stats.get(p.id)!.recent);
  const older = done.filter((p) => !stats.get(p.id)!.recent);
  const visible = filter === "ongoing" ? ongoing : done;

  const create = () => {
    const name = creating.trim();
    if (!name) return;
    const p = newProject(name, me && board.members.includes(me) ? [me] : []);
    send({ type: "projectAdd", project: p });
    setCreating("");
    setFilter("ongoing");
    open(p.id);
  };

  const selected = openId ? projects.find((p) => p.id === openId) ?? null : null;
  if (selected) {
    const list = stats.get(selected.id)!.status === "done" ? done : ongoing;
    const idx = list.findIndex((p) => p.id === selected.id);
    return (
      <ProjectDetail
        key={selected.id}
        board={board}
        project={selected}
        stats={stats.get(selected.id)!}
        send={send}
        v2={v2}
        onBack={() => {
          goBackTo({ tab: "projects" });
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        prevId={idx > 0 ? list[idx - 1].id : null}
        nextId={idx >= 0 && idx < list.length - 1 ? list[idx + 1].id : null}
        onOpen={open}
      />
    );
  }

  const owners = Array.from(new Set(projects.flatMap((p) => p.owners ?? []))).sort();
  const tab = (active: boolean) =>
    `h-9 px-4 rounded-full text-[13px] font-semibold border transition-colors whitespace-nowrap inline-flex items-center gap-2 ${
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
          <div className="min-w-0 max-w-[640px]">
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          <Figure label={t("projects.stat.ongoing")} value={counts.ongoing} color={PROJECT_STATUS_COLOR.ongoing} onClick={() => setFilter("ongoing")} />
          <Figure label={t("projects.stat.recent")} value={counts.recent} color={PROJECT_STATUS_COLOR.done} onClick={() => setFilter("done")} />
          <Figure
            label={t("projects.stat.attention")}
            value={counts.attention}
            color={counts.overdue ? HEALTH_COLOR.overdue : HEALTH_COLOR.atRisk}
            hint={counts.overdue ? t("projects.stat.overdueN", { n: counts.overdue }) : undefined}
            onClick={() => {
              setFilter("ongoing");
              setSort("target");
            }}
          />
          <Figure label={t("projects.stat.openTasks")} value={counts.openTasks} color="#AF52DE" onClick={() => setFilter("ongoing")} />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5">
          <button onClick={() => setFilter("ongoing")} className={tab(filter === "ongoing")}>
            {t("projects.filter.ongoing")}
            <Count n={counts.ongoing} />
          </button>
          <button onClick={() => setFilter("done")} className={tab(filter === "done")}>
            {t("projects.filter.done")}
            <Count n={counts.done} />
          </button>
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
        {filter === "ongoing" && (
          <>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as ProjectSort)}
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
          </>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-10 text-center">
          <div className="text-[28px]">◎</div>
          <div className="text-[14px] text-[#0A1931] font-semibold mt-1">{t("projects.none")}</div>
          <div className="text-[12px] text-[#8A8A8A] mt-1">{t("projects.noneHint")}</div>
        </div>
      ) : filter === "ongoing" ? (
        visible.length === 0 ? (
          <Empty text={t("projects.noMatch")} />
        ) : view === "timeline" ? (
          <ProjectTimeline projects={visible} stats={stats} onOpen={open} />
        ) : (
          <CardGrid list={visible} stats={stats} onOpen={open} />
        )
      ) : (
        <div className="space-y-4">
          <section className="space-y-2">
            <SectionTitle title={t("projects.recent")} hint={t("projects.recentHint")} n={recent.length} color={PROJECT_STATUS_COLOR.done} />
            {recent.length ? <CardGrid list={recent} stats={stats} onOpen={open} /> : <Empty text={t("projects.recentNone")} />}
          </section>

          {/* Older: a collapsible bar, like the board's Archived one. */}
          <section className="bg-white rounded-[14px] border border-[#E8E6E1]">
            <button onClick={() => setOlderOpen((v) => !v)} className="w-full flex items-center gap-3 px-4 h-12 text-left">
              <span className="text-[11px] text-[#8A8A8A]">{olderOpen ? "▼" : "▶"}</span>
              <span className="font-trajan text-[12px] uppercase tracking-widest text-[#0A1931]">{t("projects.older")}</span>
              <Count n={older.length} />
              <span className="text-[11px] text-[#8A8A8A] truncate">{t("projects.olderHint")}</span>
            </button>
            {olderOpen && (
              <div className="px-3 pb-3">
                {older.length === 0 ? (
                  <div className="text-[12px] text-[#A8A29E] px-1 py-2">—</div>
                ) : (
                  <div className="divide-y divide-[#F0EDE8]">
                    {older.map((p) => (
                      <OlderRow key={p.id} project={p} stats={stats.get(p.id)!} onOpen={() => open(p.id)} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#EFECE6] text-[#6B6B6B] text-[11px] font-bold inline-flex items-center justify-center tabular-nums">
      {n}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-8 text-center text-[13px] text-[#A8A29E]">{text}</div>
  );
}

function SectionTitle({ title, hint, n, color }: { title: string; hint: string; n: number; color: string }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      <h3 className="font-trajan text-[12px] uppercase tracking-widest text-[#0A1931]">{title}</h3>
      <Count n={n} />
      <span className="text-[11px] text-[#8A8A8A]">{hint}</span>
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
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
        <span className="truncate">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-[24px] font-semibold tabular-nums text-[#0A1931] leading-tight mt-0.5">{value}</span>
        {hint && (
          <span className="text-[10px] font-semibold" style={{ color }}>
            {hint}
          </span>
        )}
      </div>
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

function CardGrid({ list, stats, onOpen }: { list: Project[]; stats: Map<string, ProjectStats>; onOpen: (id: string) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {list.map((p) => (
        <ProjectCard key={p.id} project={p} stats={stats.get(p.id)!} onOpen={() => onOpen(p.id)} />
      ))}
    </div>
  );
}

function ProjectCard({ project: p, stats: s, onOpen }: { project: Project; stats: ProjectStats; onOpen: () => void }) {
  const { t, lang } = useT();
  const color = projectColor(p);
  const done = s.status === "done";
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
              {done ? (
                <Pill color={PROJECT_STATUS_COLOR.done}>
                  ✓ {t("projects.completedOn", { d: fmtMs(s.completedAt!, lang) })}
                </Pill>
              ) : (
                <>
                  <span className={`w-2.5 h-2.5 rounded-full ${PRIORITY_DOT[projectPriority(p)]}`} />
                  <span className="text-[10px] font-semibold text-[#A8A29E]">{projectPriority(p)}</span>
                </>
              )}
            </div>
            <div className="mt-1.5 font-semibold text-[15px] leading-snug text-[#0A1931] break-words [overflow-wrap:anywhere]">
              {p.name || "—"}
            </div>
            {p.description ? (
              <div className="mt-1 text-[12px] leading-relaxed text-[#6B6B6B] line-clamp-2">{p.description}</div>
            ) : null}
          </div>
          <ProgressRing value={s.share} color={done ? PROJECT_STATUS_COLOR.done : color} />
        </div>

        <div className="space-y-1.5">
          <StatusStack byStatus={s.byStatus} total={s.total} height={6} />
          <div className="flex items-center gap-2 text-[11px] text-[#6B6B6B]">
            <span className="tabular-nums">
              {s.total ? t("projects.tasksCount", { n: `${s.done}/${s.total}` }) : t("projects.noTasksYet")}
            </span>
            {s.overdueTasks > 0 && !done && (
              <span className="font-semibold" style={{ color: HEALTH_COLOR.overdue }}>
                · {t("projects.overdueTasks", { n: s.overdueTasks })}
              </span>
            )}
          </div>
          {!done && boardMode(p) !== "all" && (
            <div className="text-[11px] text-[#8A8A8A] truncate">
              {boardMode(p) === "sequential" ? "⇢ " : "⊘ "}
              {t(`projects.mode.${boardMode(p)}`)}
              {boardMode(p) === "sequential" && s.current && (
                <>
                  {" · "}
                  {t("projects.step.of", { n: s.tasks.indexOf(s.current) + 1, total: s.total })}:{" "}
                  <span className="text-[#0A1931] font-medium">{s.current.title}</span>
                </>
              )}
            </div>
          )}
          {!done && s.nextDue && (
            <div className="text-[11px] text-[#8A8A8A] truncate">
              {t("projects.nextDue")}: <span className="text-[#0A1931] font-medium">{s.nextDue.title}</span> · {fmtDay(s.nextDue.dueDate, lang)}
            </div>
          )}
        </div>

        <div className="mt-auto flex items-center gap-2 flex-wrap text-[11px] text-[#6B6B6B]">
          <Avatars names={p.owners ?? []} />
          <span className="flex-1" />
          {p.targetDate && !done && <span className="tabular-nums">⏱ {fmtDay(p.targetDate, lang)}</span>}
          {!done && <HealthBadge health={s.health} daysLeft={s.daysLeft} />}
        </div>
        {p.reportHidden && (
          <div className="text-[10px] font-semibold text-[#A8A29E] uppercase tracking-wide">{t("projects.notInReport")}</div>
        )}
      </div>
    </button>
  );
}

function OlderRow({ project: p, stats: s, onOpen }: { project: Project; stats: ProjectStats; onOpen: () => void }) {
  const { t, lang } = useT();
  return (
    <button onClick={onOpen} className="w-full flex items-center gap-3 px-1 py-2.5 text-left hover:bg-[#F5F3EF] rounded-lg">
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: projectColor(p) }} />
      <span className="flex-1 min-w-0 truncate text-[13px] font-medium text-[#0A1931]">{p.name || "—"}</span>
      <span className="hidden sm:inline text-[11px] text-[#8A8A8A] tabular-nums">{t("projects.tasksCount", { n: s.total })}</span>
      <Avatars names={p.owners ?? []} size={18} />
      <span className="text-[11px] text-[#065F46] font-semibold whitespace-nowrap">
        ✓ {fmtMs(s.completedAt!, lang, true)}
      </span>
    </button>
  );
}
