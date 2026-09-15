import type { Task, Priority } from "../lib/types";
import { useT } from "../lib/i18n";

const PRIOS: { p: Priority; bar: string; dot: string }[] = [
  { p: "P1", bar: "bg-[#DC2626]", dot: "bg-[#DC2626]" },
  { p: "P2", bar: "bg-[#C9A96E]", dot: "bg-[#C9A96E]" },
  { p: "P3", bar: "bg-[#C9C5BE]", dot: "bg-[#C9C5BE]" },
  { p: "P4", bar: "bg-[#8BA1C2]", dot: "bg-[#8BA1C2]" },
];

export function PriorityDistribution({ tasks }: { tasks: Task[] }) {
  const { t } = useT();
  const active = tasks.filter((tk) => tk.status !== "DONE");
  const counts = PRIOS.map(({ p }) => active.filter((tk) => tk.priority === p).length);
  const max = Math.max(1, ...counts);
  const total = active.length;

  return (
    <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-trajan text-[11px] uppercase tracking-widest text-[#8A8A8A]">
          {t("prio.distribution")}
        </h4>
        <span className="text-[11px] text-[#8A8A8A]">{total}</span>
      </div>
      <div className="space-y-2.5">
        {PRIOS.map(({ p, bar, dot }, i) => (
          <div key={p} className="flex items-center gap-3">
            <span className="w-16 shrink-0 flex items-center gap-1.5 text-[11px] font-semibold text-[#0A1931]">
              <span className={`w-2 h-2 rounded-full ${dot}`} />
              {p}
            </span>
            <span className="w-20 shrink-0 text-[10px] uppercase tracking-wide text-[#8A8A8A]">
              {t(`prio.${p}short`)}
            </span>
            <div className="flex-1 h-3 rounded-full bg-[#F0EDE8] overflow-hidden">
              <div
                className={`h-full rounded-full ${bar} transition-all`}
                style={{ width: `${(counts[i] / max) * 100}%`, minWidth: counts[i] ? 6 : 0 }}
              />
            </div>
            <span className="w-6 shrink-0 text-right text-[13px] font-semibold text-[#0A1931]">
              {counts[i]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
