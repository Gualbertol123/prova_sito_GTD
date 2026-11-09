import type { ProjectStatus } from "../../lib/types";
import { useT } from "../../lib/i18n";
import { HEALTH_COLOR, PROJECT_STATUS_COLOR, type Health } from "../../lib/projects";
import { ownerInitial } from "../../lib/owners";

// Small presentational pieces shared by the overview, the detail page and the
// timeline. Colours come in as inline styles so both skins (classic and
// Liquid Glass) show the same accents.

export function ProgressRing({
  value,
  color,
  size = 56,
  stroke = 6,
  label,
}: {
  value: number;
  color: string;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(120,120,128,0.18)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: "stroke-dashoffset 400ms cubic-bezier(0.2,0.7,0.2,1)" }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-semibold tabular-nums text-[#0A1931]"
        style={{ fontSize: Math.max(10, size * 0.24) }}
      >
        {label ?? `${Math.round(v * 100)}%`}
      </span>
    </div>
  );
}

export function Bar({ value, color, height = 6 }: { value: number; color: string; height?: number }) {
  return (
    <div className="flex-1 rounded-full overflow-hidden" style={{ height, background: "rgba(120,120,128,0.16)" }}>
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`,
          background: color,
          transition: "width 400ms cubic-bezier(0.2,0.7,0.2,1)",
        }}
      />
    </div>
  );
}

export function Pill({ color, children, solid = false }: { color: string; children: React.ReactNode; solid?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={solid ? { background: color, color: "#fff" } : { color, background: `${color}1F` }}
    >
      {children}
    </span>
  );
}

export function StatusPill({ status }: { status: ProjectStatus }) {
  const { t } = useT();
  const color = PROJECT_STATUS_COLOR[status];
  return (
    <Pill color={color}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {t(`projects.status.${status}`)}
    </Pill>
  );
}

export function HealthBadge({ health, daysLeft }: { health: Health; daysLeft: number | null }) {
  const { t } = useT();
  const color = HEALTH_COLOR[health];
  let detail = "";
  if (daysLeft !== null && health !== "done" && health !== "paused") {
    if (daysLeft < 0) detail = t("projects.daysLate", { n: -daysLeft });
    else if (daysLeft === 0) detail = t("projects.dueToday");
    else detail = t("projects.daysLeft", { n: daysLeft });
  }
  return (
    <Pill color={color}>
      {t(`projects.health.${health}`)}
      {detail && <span className="font-medium opacity-80">· {detail}</span>}
    </Pill>
  );
}

export function Avatars({ names, max = 3, size = 22 }: { names: string[]; max?: number; size?: number }) {
  if (!names.length) return null;
  const shown = names.slice(0, max);
  return (
    <span className="flex -space-x-1.5" title={names.join(", ")}>
      {shown.map((n, i) => (
        <span
          key={`${n}-${i}`}
          className="rounded-full bg-[#0A1931] text-white font-bold flex items-center justify-center ring-2 ring-white"
          style={{ width: size, height: size, fontSize: size * 0.45 }}
        >
          {ownerInitial(n)}
        </span>
      ))}
      {names.length > max && (
        <span
          className="rounded-full bg-[#EFECE6] text-[#6B6B6B] font-bold flex items-center justify-center ring-2 ring-white"
          style={{ width: size, height: size, fontSize: size * 0.4 }}
        >
          +{names.length - max}
        </span>
      )}
    </span>
  );
}

/** "12 dic" style, in the UI language. */
export function fmtDay(iso: string | undefined, lang: "it" | "en", withYear = false): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(lang === "it" ? "it-IT" : "en-GB", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  });
}
