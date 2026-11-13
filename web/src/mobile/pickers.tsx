import { useMemo } from "react";
import type { Priority, Status } from "../lib/types";
import { STATUS_ORDER, UNASSIGNED } from "../lib/constants";
import { useT } from "../lib/i18n";
import { useProjects } from "../lib/projectsContext";
import { projectColor, projectStats } from "../lib/projects";
import { toISODate } from "../lib/dates";
import { Avatar, PRIO_VAR, Ring, STATUS_VAR, Sheet, shortDay } from "./ui";
import { IconCheck } from "./icons";

// Choosers for one property of a task, each a sheet of glass rows with a
// tick on the current value. Shared by the task sheet and the add sheet.

function Row({
  left,
  title,
  hint,
  end,
  selected,
  onClick,
}: {
  left?: React.ReactNode;
  title: React.ReactNode;
  hint?: React.ReactNode;
  end?: React.ReactNode;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button className="m-row" role="option" aria-selected={!!selected} onClick={onClick}>
      {left}
      <span className="m-row__main">
        <span className="m-row__title">{title}</span>
        {hint && <span className="m-row__hint">{hint}</span>}
      </span>
      {end && <span className="m-row__end">{end}</span>}
      <span style={{ width: 22, color: "var(--m-accent)", flexShrink: 0 }}>{selected && <IconCheck size={20} />}</span>
    </button>
  );
}

export function StatusPicker({ value, onPick, onClose }: { value: Status; onPick: (s: Status) => void; onClose: () => void }) {
  const { t } = useT();
  return (
    <Sheet title={t("m.f.status")} onClose={onClose}>
      <div className="m-panel m-list" role="listbox">
        {STATUS_ORDER.map((s) => (
          <Row
            key={s}
            left={<span className="m-row__icon" style={{ ["--tile" as string]: STATUS_VAR[s] }}><span className="m-dot" style={{ background: "#fff" }} /></span>}
            title={t(`m.status.${s}`)}
            hint={t(`m.statusHint.${s}`)}
            selected={value === s}
            onClick={() => {
              onPick(s);
              onClose();
            }}
          />
        ))}
      </div>
    </Sheet>
  );
}

export function PriorityPicker({ value, onPick, onClose }: { value: Priority; onPick: (p: Priority) => void; onClose: () => void }) {
  const { t } = useT();
  return (
    <Sheet title={t("m.f.priority")} onClose={onClose}>
      <div className="m-panel m-list" role="listbox">
        {(["P1", "P2", "P3", "P4"] as Priority[]).map((p) => (
          <Row
            key={p}
            left={<span className="m-check" style={{ ["--ring" as string]: PRIO_VAR[p], margin: "0 4px" }} />}
            title={`${p} · ${t(`prio.${p}short`)}`}
            hint={t(`prio.${p}desc`)}
            selected={value === p}
            onClick={() => {
              onPick(p);
              onClose();
            }}
          />
        ))}
      </div>
    </Sheet>
  );
}

function inDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toISODate(d);
}
function nextMonday(): string {
  const d = new Date();
  d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7));
  return toISODate(d);
}

export function DuePicker({
  value,
  onPick,
  onClose,
}: {
  value?: string;
  onPick: (iso: string | undefined) => void;
  onClose: () => void;
}) {
  const { t, lang } = useT();
  const options: { k: string; v?: string }[] = [
    { k: "m.when.today", v: inDays(0) },
    { k: "m.when.tomorrow", v: inDays(1) },
    { k: "m.when.monday", v: nextMonday() },
    { k: "m.when.week", v: inDays(7) },
  ];
  const custom = value && !options.some((o) => o.v === value);
  const pick = (v?: string) => {
    onPick(v);
    onClose();
  };
  return (
    <Sheet title={t("m.f.due")} onClose={onClose}>
      <div className="m-panel m-list m-list--flat" role="listbox">
        {options.map((o) => (
          <Row key={o.k} title={t(o.k)} end={o.v && shortDay(o.v, lang)} selected={value === o.v} onClick={() => pick(o.v)} />
        ))}
        <Row title={t("m.when.none")} selected={!value} onClick={() => pick(undefined)} />
      </div>
      <label className="m-label" style={{ marginTop: 18 }}>
        {t("m.pickDate")}
      </label>
      <input
        type="date"
        className="m-input"
        value={custom ? value : ""}
        onChange={(e) => e.target.value && pick(e.target.value)}
        aria-label={t("m.pickDate")}
      />
    </Sheet>
  );
}

export function PeoplePicker({
  members,
  value,
  multi,
  onChange,
  onClose,
}: {
  members: string[];
  value: string[];
  multi: boolean;
  onChange: (next: string[]) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const toggle = (name: string) => {
    if (!multi) {
      onChange([name]);
      onClose();
      return;
    }
    const next = value.includes(name) ? value.filter((o) => o !== name) : [...value.filter((o) => o !== UNASSIGNED), name];
    onChange(next.length ? next : [UNASSIGNED]);
  };
  return (
    <Sheet
      title={multi ? t("m.f.people") : t("m.f.person")}
      onClose={onClose}
      headEnd={
        multi && (
          <button className="m-btn m-btn--primary m-btn--sm" onClick={onClose}>
            {t("m.done")}
          </button>
        )
      }
    >
      <div className="m-panel m-list" role="listbox" aria-multiselectable={multi}>
        {members.map((m) => (
          <Row key={m} left={<Avatar name={m} large />} title={m} selected={value.includes(m)} onClick={() => toggle(m)} />
        ))}
        <Row
          left={<Avatar name={UNASSIGNED} large />}
          title={t("members.unassigned")}
          selected={value.length === 0 || (value.length === 1 && value[0] === UNASSIGNED)}
          onClick={() => {
            onChange([UNASSIGNED]);
            if (!multi) onClose();
          }}
        />
      </div>
      {multi && <p className="m-sub" style={{ marginTop: 10, textAlign: "center" }}>{t("m.peopleHint")}</p>}
    </Sheet>
  );
}

export function ProjectPicker({
  value,
  onPick,
  onClose,
}: {
  value?: string;
  onPick: (id: string | undefined) => void;
  onClose: () => void;
}) {
  const { t, lang } = useT();
  const { projects, tasks } = useProjects();
  const rows = useMemo(() => {
    const withStats = projects.map((p) => ({ p, s: projectStats(p, tasks) }));
    return {
      ongoing: withStats.filter((x) => x.s.status !== "done"),
      done: withStats.filter((x) => x.s.status === "done"),
    };
  }, [projects, tasks]);

  const pick = (id?: string) => {
    onPick(id);
    onClose();
  };

  const row = ({ p, s }: (typeof rows.ongoing)[number]) => {
    const color = projectColor(p);
    const bits = [
      t("m.openTasks").replace("{n}", String(s.total - s.done)),
      p.targetDate ? `→ ${shortDay(p.targetDate, lang)}` : null,
      s.health !== "noDate" && s.health !== "done" ? t(`projects.health.${s.health}`) : null,
    ].filter(Boolean);
    return (
      <Row
        key={p.id}
        left={<Ring share={s.share} color={color} size={36} />}
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <span className="m-chip__dot" style={{ background: color }} />
            {p.name}
          </span>
        }
        hint={bits.join(" · ")}
        selected={value === p.id}
        onClick={() => pick(p.id)}
      />
    );
  };

  return (
    <Sheet title={t("m.f.project")} onClose={onClose}>
      <div className="m-panel m-list" role="listbox">
        <Row
          left={<span className="m-row__icon" style={{ ["--tile" as string]: "var(--m-grey)" }}>—</span>}
          title={t("m.noProject")}
          hint={t("m.noProjectHint")}
          selected={!value}
          onClick={() => pick(undefined)}
        />
        {rows.ongoing.map(row)}
      </div>
      {rows.done.length > 0 && (
        <>
          <div className="m-label" style={{ marginTop: 18 }}>
            {t("projects.status.done")}
          </div>
          <div className="m-panel m-list" role="listbox">
            {rows.done.map(row)}
          </div>
        </>
      )}
    </Sheet>
  );
}
