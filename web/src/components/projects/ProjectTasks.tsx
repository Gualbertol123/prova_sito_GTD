import { useMemo, useState } from "react";
import type { Board, BoardMode, Op, Priority, Project, Status, Task } from "../../lib/types";
import { PRIORITY_DOT, STATUS_ORDER, UNASSIGNED, genId, isArchived } from "../../lib/constants";
import { priorityLabel, statusLabel, useT } from "../../lib/i18n";
import { useMe } from "../../lib/identity";
import { isOwnedBy, ownersPatch, taskOwners } from "../../lib/owners";
import { daysSince, daysUntil, toISODate } from "../../lib/dates";
import { readPref, writePref } from "../../lib/prefs";
import { HEALTH_COLOR, TASK_STATUS_COLOR, boardMode, projectPriority, type ProjectStats } from "../../lib/projects";
import { TaskDetails } from "../TaskDetails";
import { Avatars, StatusStack, fmtDay } from "./ProjectBits";

const PRIOS: Priority[] = ["P1", "P2", "P3", "P4"];
type View = "list" | "board";

const field =
  "h-8 rounded-full bg-[#F5F3EF] border border-[#E8E6E1] px-2.5 text-[12px] text-[#0A1931] outline-none focus:border-[#C9A96E]";

// The project's work: every board task linked to it, as a grouped list or a
// small kanban. Tasks are created here straight into the project, or linked
// from the board; each opens the same full editor the board uses.
export function ProjectTasks({
  board,
  project: p,
  stats: s,
  v2,
  save,
}: {
  board: Board;
  project: Project;
  stats: ProjectStats;
  v2: boolean;
  save: (op: Op) => void;
}) {
  const { t, lang } = useT();
  const { me } = useMe();
  const [view, setViewState] = useState<View>(() => (readPref("projTasksView") === "board" ? "board" : "list"));
  const setView = (v: View) => {
    setViewState(v);
    writePref("projTasksView", v);
  };
  const [query, setQuery] = useState("");
  const [person, setPerson] = useState("all");
  const [showDone, setShowDone] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  // New-task form. The default holder is the project's first lead, or you.
  const defaultOwner = (p.owners ?? [])[0] ?? (me && board.members.includes(me) ? me : UNASSIGNED);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<Status>("NEXT");
  const [prio, setPrio] = useState<Priority>(projectPriority(p));
  const [owner, setOwner] = useState(defaultOwner);
  const [due, setDue] = useState("");

  const create = () => {
    const v = title.trim();
    if (!v) return;
    const now = Date.now();
    const task: Task = {
      id: genId(),
      title: v,
      desc: "",
      ...ownersPatch([owner]),
      priority: prio,
      status,
      notes: "",
      subtasks: [],
      projectId: p.id,
      updatedAt: now,
      createdAt: now,
      ...(due ? { dueDate: due } : {}),
      ...(status === "WAITING" ? { waitingSince: toISODate(new Date()) } : {}),
      ...(status === "DONE" ? { doneAt: now } : {}),
    };
    save({ type: "addTask", task });
    setTitle("");
    setDue("");
  };

  const linkable = useMemo(() => board.tasks.filter((x) => !x.projectId && !isArchived(x)), [board.tasks]);
  const people = Array.from(new Set(s.tasks.flatMap((x) => taskOwners(x)))).sort();

  const filtered = s.tasks.filter((x) => {
    if (person !== "all" && !isOwnedBy(x, person)) return false;
    const q = query.trim().toLowerCase();
    if (q && !`${x.title} ${x.desc} ${x.notes}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const doneCount = filtered.filter((x) => x.status === "DONE").length;

  const mode = boardMode(p);
  const sequential = mode === "sequential";
  // Swap a step with its neighbour in the full order (filters don't matter).
  const shiftStep = (id: string, dir: -1 | 1) => {
    const ids = s.tasks.map((x) => x.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    save({ type: "projectUpdate", id: p.id, patch: { taskOrder: ids } });
  };

  const move = (id: string, st: Status) => save({ type: "moveTask", id, status: st });
  const unlink = (id: string) => save({ type: "updateTask", id, patch: { projectId: undefined } });
  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));

  return (
    <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-4 space-y-3 min-w-0">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h3 className="font-trajan text-[13px] uppercase tracking-widest text-[#0A1931]">{t("projects.tasks")}</h3>
        <span className="text-[12px] text-[#8A8A8A] tabular-nums">
          {s.done}/{s.total}
        </span>
        <span className="flex-1" />
        <div className="flex rounded-full border border-[#E8E6E1] bg-white p-0.5">
          {(["list", "board"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`h-7 px-3 rounded-full text-[12px] font-semibold ${view === v ? "bg-[#0A1931] text-[#C9A96E]" : "text-[#6B6B6B]"}`}
            >
              {t(`projects.tasks.${v}`)}
            </button>
          ))}
        </div>
      </div>

      <BoardModePicker project={p} available={v2 && !!board.boardModeAvailable} save={save} />

      {s.total > 0 && (
        <div className="space-y-1.5">
          <StatusStack byStatus={s.byStatus} total={s.total} height={8} />
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#6B6B6B]">
            {STATUS_ORDER.filter((st) => s.byStatus[st]).map((st) => (
              <span key={st} className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: TASK_STATUS_COLOR[st] }} />
                {statusLabel(lang, st)} <b className="tabular-nums text-[#0A1931]">{s.byStatus[st]}</b>
              </span>
            ))}
            {s.overdueTasks > 0 && (
              <span className="font-semibold" style={{ color: HEALTH_COLOR.overdue }}>
                ⚠ {t("projects.overdueTasks", { n: s.overdueTasks })}
              </span>
            )}
          </div>
        </div>
      )}

      {!v2 ? (
        <div className="text-[12px] text-[#A8A29E]">{t("projects.tasks.needsMigration")}</div>
      ) : (
        <>
          {/* New task */}
          <div className="rounded-[12px] bg-[#FAF9F6] border border-[#E3DFD7] p-2.5 space-y-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder={t("projects.tasks.new")}
              className="w-full h-9 rounded-full bg-white border border-[#E8E6E1] px-3.5 text-[13px] outline-none focus:border-[#C9A96E]"
            />
            <div className="flex flex-wrap gap-1.5 items-center">
              <select value={status} onChange={(e) => setStatus(e.target.value as Status)} className={field} aria-label={t("quick.status")}>
                {STATUS_ORDER.map((st) => (
                  <option key={st} value={st}>
                    {statusLabel(lang, st)}
                  </option>
                ))}
              </select>
              <select value={prio} onChange={(e) => setPrio(e.target.value as Priority)} className={field} aria-label={t("projects.priority")}>
                {PRIOS.map((pr) => (
                  <option key={pr} value={pr}>
                    {priorityLabel(t, pr)}
                  </option>
                ))}
              </select>
              <select value={owner} onChange={(e) => setOwner(e.target.value)} className={field}>
                {[...board.members, UNASSIGNED].map((m) => (
                  <option key={m} value={m}>
                    {m === UNASSIGNED ? t("members.unassigned") : m}
                  </option>
                ))}
              </select>
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={field} aria-label={t("task.due")} />
              <span className="flex-1" />
              <button
                onClick={create}
                disabled={!title.trim()}
                className="h-8 px-4 rounded-full bg-[#0A1931] text-[#C9A96E] text-[12px] font-semibold disabled:opacity-40"
              >
                + {t("projects.tasks.add")}
              </button>
            </div>
          </div>

          {linkable.length > 0 && (
            <select
              value=""
              onChange={(e) => e.target.value && save({ type: "updateTask", id: e.target.value, patch: { projectId: p.id } })}
              className="w-full h-8 rounded-full bg-white border border-dashed border-[#E3DFD7] px-3 text-[12px] text-[#6B6B6B] outline-none cursor-pointer"
            >
              <option value="">{t("projects.tasks.link")}</option>
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

      {/* Filters */}
      {s.total > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("projects.tasks.search")}
            className="h-8 flex-1 min-w-[140px] rounded-full bg-white border border-[#E8E6E1] px-3 text-[12px] outline-none focus:border-[#C9A96E]"
          />
          {people.length > 1 && (
            <select value={person} onChange={(e) => setPerson(e.target.value)} className={field}>
              <option value="all">{t("projects.tasks.allPeople")}</option>
              {people.map((m) => (
                <option key={m} value={m}>
                  {m === UNASSIGNED ? t("members.unassigned") : m}
                </option>
              ))}
            </select>
          )}
          {view === "list" && !sequential && doneCount > 0 && (
            <button
              onClick={() => setShowDone((v) => !v)}
              className="h-8 px-3 rounded-full border border-[#E8E6E1] bg-white text-[12px] text-[#6B6B6B] hover:border-[#C9A96E]"
            >
              {showDone ? t("projects.tasks.hideDone") : t("projects.tasks.showDone", { n: doneCount })}
            </button>
          )}
        </div>
      )}

      {s.total === 0 ? (
        v2 && <div className="text-[12px] text-[#A8A29E] py-3 text-center">{t("projects.tasks.none")}</div>
      ) : filtered.length === 0 ? (
        <div className="text-[12px] text-[#A8A29E] py-3 text-center">{t("projects.tasks.noneFiltered")}</div>
      ) : view === "list" && sequential ? (
        <div className="space-y-1.5">
          {filtered.map((task) => {
            const n = s.tasks.findIndex((x) => x.id === task.id);
            const isNow = s.current?.id === task.id;
            const done = task.status === "DONE";
            return (
              <div key={task.id} className="flex items-stretch gap-2">
                <div className="flex flex-col items-center w-7 shrink-0 pt-2">
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                    style={
                      done
                        ? { background: "#34C759", color: "#fff" }
                        : isNow
                          ? { background: "#007AFF", color: "#fff" }
                          : { background: "rgba(120,120,128,0.18)", color: "#8E8E93" }
                    }
                  >
                    {done ? "✓" : n + 1}
                  </span>
                  {n < s.tasks.length - 1 && <span className="flex-1 w-px mt-1" style={{ background: "rgba(120,120,128,0.3)" }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <TaskRow
                    task={task}
                    board={board}
                    open={openId === task.id}
                    onToggle={() => toggle(task.id)}
                    onMove={(st2) => move(task.id, st2)}
                    onUnlink={() => unlink(task.id)}
                    save={save}
                    badge={
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wide ${
                          isNow ? "text-[#007AFF]" : done ? "text-[#34C759]" : "text-[#A8A29E]"
                        }`}
                      >
                        {isNow ? t("projects.step.now") : done ? t("projects.step.done") : t("projects.step.waiting")}
                      </span>
                    }
                    extra={
                      <span className="flex flex-col shrink-0">
                        <button
                          onClick={() => shiftStep(task.id, -1)}
                          disabled={n === 0}
                          title={t("projects.step.up")}
                          className="w-6 h-[14px] leading-none text-[11px] text-[#8A8A8A] disabled:opacity-25"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => shiftStep(task.id, 1)}
                          disabled={n === s.tasks.length - 1}
                          title={t("projects.step.down")}
                          className="w-6 h-[14px] leading-none text-[11px] text-[#8A8A8A] disabled:opacity-25"
                        >
                          ▼
                        </button>
                      </span>
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : view === "list" ? (
        <div className="space-y-3">
          {STATUS_ORDER.filter((st) => st !== "DONE" || showDone).map((st) => {
            const group = filtered.filter((x) => x.status === st);
            if (!group.length) return null;
            return (
              <div key={st} className="space-y-1.5">
                <div className="flex items-center gap-1.5 px-0.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: TASK_STATUS_COLOR[st] }} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#8A8A8A]">{statusLabel(lang, st)}</span>
                  <span className="text-[10px] font-bold text-[#A8A29E]">{group.length}</span>
                </div>
                {group.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    board={board}
                    open={openId === task.id}
                    onToggle={() => toggle(task.id)}
                    onMove={(st2) => move(task.id, st2)}
                    onUnlink={() => unlink(task.id)}
                    save={save}
                  />
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <MiniBoard tasks={filtered} board={board} openId={openId} onToggle={toggle} onMove={move} onUnlink={unlink} save={save} />
      )}
    </div>
  );
}

function DueChip({ task }: { task: Task }) {
  const { lang } = useT();
  if (!task.dueDate) return null;
  const left = daysUntil(task.dueDate);
  const open = task.status !== "DONE";
  const cls =
    open && left !== null && left < 0
      ? "bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]"
      : open && left !== null && left <= 2
        ? "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]"
        : "bg-[#F5F3EF] text-[#6B6B6B] border-[#E8E6E1]";
  return <span className={`text-[10px] px-1.5 py-px rounded-full border whitespace-nowrap ${cls}`}>⏱ {fmtDay(task.dueDate, lang)}</span>;
}

function TaskMeta({ task }: { task: Task }) {
  const { t } = useT();
  const subs = task.subtasks.length;
  const subsDone = task.subtasks.filter((x) => x.done).length;
  return (
    <span className="flex items-center gap-1.5 flex-wrap text-[10px] text-[#8A8A8A]">
      <Avatars names={taskOwners(task).filter((n) => n !== UNASSIGNED)} size={16} />
      <DueChip task={task} />
      {subs > 0 && (
        <span className="tabular-nums">
          ☑ {subsDone}/{subs}
        </span>
      )}
      {task.status === "WAITING" && task.waitingSince && <span>{t("projects.tasks.waiting", { n: daysSince(task.waitingSince) })}</span>}
    </span>
  );
}

function DoneToggle({ task, onMove }: { task: Task; onMove: (s: Status) => void }) {
  const { lang } = useT();
  const done = task.status === "DONE";
  return (
    <button
      onClick={() => onMove(done ? "NEXT" : "DONE")}
      title={done ? statusLabel(lang, "NEXT") : statusLabel(lang, "DONE")}
      className="w-[18px] h-[18px] shrink-0 rounded-full border-[1.5px] flex items-center justify-center text-[10px] text-white"
      style={done ? { background: "#34C759", borderColor: "#34C759" } : { borderColor: "#C9C5BE" }}
    >
      {done ? "✓" : ""}
    </button>
  );
}

function TaskRow({
  task,
  board,
  open,
  onToggle,
  onMove,
  onUnlink,
  save,
  badge,
  extra,
}: {
  task: Task;
  board: Board;
  open: boolean;
  onToggle: () => void;
  onMove: (s: Status) => void;
  onUnlink: () => void;
  save: (op: Op) => void;
  /** Shown above the title (sequence state). */
  badge?: React.ReactNode;
  /** Shown before the status menu (sequence arrows). */
  extra?: React.ReactNode;
}) {
  const { t, lang } = useT();
  const done = task.status === "DONE";
  return (
    <div className={`rounded-[10px] border bg-white ${open ? "border-[#C9A96E]" : "border-[#E8E6E1]"}`}>
      <div className="group flex items-start gap-2 px-2.5 py-2">
        <span className="pt-0.5">
          <DoneToggle task={task} onMove={onMove} />
        </span>
        <span className={`w-2 h-2 mt-1.5 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`} title={task.priority} />
        <button onClick={onToggle} className="flex-1 min-w-0 text-left space-y-1">
          {badge && <span className="block">{badge}</span>}
          <span
            className={`block text-[13px] leading-snug break-words [overflow-wrap:anywhere] ${
              done ? "line-through text-[#A8A29E]" : "text-[#0A1931] font-medium"
            }`}
          >
            {task.title}
          </span>
          <TaskMeta task={task} />
        </button>
        {extra}
        <select
          value={task.status}
          onChange={(e) => onMove(e.target.value as Status)}
          className="h-7 max-w-[118px] shrink-0 rounded-full border border-[#E8E6E1] bg-[#F5F3EF] px-2 text-[10px] font-semibold uppercase tracking-wide text-[#0A1931] outline-none cursor-pointer"
          style={{ boxShadow: `inset 3px 0 0 ${TASK_STATUS_COLOR[task.status]}` }}
          aria-label={t("quick.status")}
        >
          {STATUS_ORDER.map((st) => (
            <option key={st} value={st}>
              {statusLabel(lang, st)}
            </option>
          ))}
        </select>
        <button
          onClick={onUnlink}
          title={t("projects.tasks.unlink")}
          className="shrink-0 w-7 h-7 rounded-full text-[12px] text-[#A8A29E] hover:text-[#DC2626] sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
        >
          ⨯
        </button>
      </div>
      {open && <Editor task={task} board={board} save={save} onDeleted={onToggle} />}
    </div>
  );
}

function Editor({ task, board, save, onDeleted }: { task: Task; board: Board; save: (op: Op) => void; onDeleted: () => void }) {
  return (
    <div className="px-2.5 pb-2.5 border-t border-[#F0EDE8] pt-2.5">
      <TaskDetails task={task} members={board.members} send={save} multiAssign={board.assigneesAvailable !== false} onDeleted={onDeleted} />
    </div>
  );
}

// A small kanban of the project's tasks: drag a card to another column to
// move it on the board too. Clicking a card opens its editor under the board.
function MiniBoard({
  tasks,
  board,
  openId,
  onToggle,
  onMove,
  onUnlink,
  save,
}: {
  tasks: Task[];
  board: Board;
  openId: string | null;
  onToggle: (id: string) => void;
  onMove: (id: string, s: Status) => void;
  onUnlink: (id: string) => void;
  save: (op: Op) => void;
}) {
  const { t, lang } = useT();
  const [over, setOver] = useState<Status | null>(null);
  const opened = openId ? tasks.find((x) => x.id === openId) : undefined;
  return (
    <div className="space-y-3">
      <div className="text-[11px] text-[#A8A29E]">{t("projects.tasks.dragHint")}</div>
      <div className="overflow-x-auto -mx-1 px-1 pb-1">
        <div className="grid grid-flow-col auto-cols-[minmax(170px,1fr)] gap-2">
          {STATUS_ORDER.map((st) => {
            const col = tasks.filter((x) => x.status === st);
            return (
              <div
                key={st}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(st);
                }}
                onDragLeave={() => setOver((o) => (o === st ? null : o))}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(null);
                  const id = e.dataTransfer.getData("text/plain");
                  if (id) onMove(id, st);
                }}
                className={`rounded-[12px] border p-2 space-y-1.5 min-h-[120px] transition-colors ${
                  over === st ? "border-[#C9A96E] bg-[#FBF6EC]" : "border-[#E3DFD7] bg-[#EFECE6]"
                }`}
              >
                <div className="flex items-center gap-1.5 px-0.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: TASK_STATUS_COLOR[st] }} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#6B6B6B] truncate">{statusLabel(lang, st)}</span>
                  <span className="text-[10px] font-bold text-[#A8A29E]">{col.length}</span>
                </div>
                {col.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", task.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => onToggle(task.id)}
                    className={`group rounded-[10px] bg-white border p-2 cursor-grab active:cursor-grabbing space-y-1 ${
                      openId === task.id ? "border-[#C9A96E]" : "border-[#E8E6E1] hover:border-[#C9A96E]"
                    }`}
                  >
                    <div className="flex items-start gap-1.5">
                      <span className={`w-2 h-2 mt-1 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`} />
                      <span
                        className={`flex-1 min-w-0 text-[12px] leading-snug break-words [overflow-wrap:anywhere] ${
                          task.status === "DONE" ? "line-through text-[#A8A29E]" : "text-[#0A1931] font-medium"
                        }`}
                      >
                        {task.title}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUnlink(task.id);
                        }}
                        title={t("projects.tasks.unlink")}
                        className="shrink-0 text-[11px] text-[#A8A29E] hover:text-[#DC2626] opacity-0 group-hover:opacity-100"
                      >
                        ⨯
                      </button>
                    </div>
                    <TaskMeta task={task} />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      {opened && (
        <div className="rounded-[12px] border border-[#C9A96E] bg-white">
          <div className="flex items-center gap-2 px-2.5 pt-2.5">
            <span className="flex-1 text-[11px] font-bold uppercase tracking-widest text-[#8A8A8A]">{statusLabel(lang, opened.status)}</span>
            <button onClick={() => onToggle(opened.id)} className="text-[12px] text-[#8A8A8A]">
              ✕
            </button>
          </div>
          <Editor task={opened} board={board} save={save} onDeleted={() => onToggle(opened.id)} />
        </div>
      )}
    </div>
  );
}

const MODES: BoardMode[] = ["all", "sequential", "none"];

// How this project's tasks reach the main BOARD.
function BoardModePicker({ project: p, available, save }: { project: Project; available: boolean; save: (op: Op) => void }) {
  const { t } = useT();
  const mode = boardMode(p);
  return (
    <div className="rounded-[12px] border border-[#E8E6E1] bg-[#F5F3EF] px-3 py-2 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-trajan text-[10px] uppercase tracking-widest text-[#8A8A8A]">{t("projects.board.label")}</span>
        <div className="flex rounded-full border border-[#E8E6E1] bg-white p-0.5">
          {MODES.map((m) => (
            <button
              key={m}
              disabled={!available}
              onClick={() => m !== mode && save({ type: "projectUpdate", id: p.id, patch: { boardMode: m } })}
              className={`h-7 px-3 rounded-full text-[12px] font-semibold disabled:opacity-50 ${
                mode === m ? "bg-[#0A1931] text-[#C9A96E]" : "text-[#6B6B6B]"
              }`}
            >
              {t(`projects.board.${m}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="text-[11px] text-[#8A8A8A]">{available ? t(`projects.board.hint.${mode}`) : t("projects.board.needsMigration")}</div>
    </div>
  );
}
