import type { Task, Priority } from "../lib/types";
import { PRIORITY_DOT } from "../lib/constants";
import { useT } from "../lib/i18n";

const PRIOS: Priority[] = ["P1", "P2", "P3", "P4"];

export function PriorityDistribution({ tasks }: { tasks: Task[] }) {
  const { t } = useT();
  const active = tasks.filter((tk) => tk.status !== "DONE");
  const counts = PRIOS.map((p) => active.filter((tk) => tk.priority === p).length);
  const max = Math.max(1, ...counts);

  return (
    <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-4">
      <h4 className="font-trajan text-[11px] uppercase text-[#8A8A8A] mb-3">
        {t("prio.distribution")}
      </h4>
      <div className="grid grid-cols-4 gap-3">
        {PRIOS.map((p, i) => (
          <div key={p} className="text-center">
            <div className="h-16 flex items-end justify-center">
              <div
                className={`w-8 rounded-t ${p === "P4" ? "bg-[#E8E6E1]" : PRIORITY_DOT[p]}`}
                style={{ height: `${(counts[i] / max) * 100}%`, minHeight: 4 }}
              />
            </div>
            <div className="text-[15px] font-semibold text-[#0A1931] mt-1">{counts[i]}</div>
            <div className="text-[9px] uppercase tracking-wide text-[#8A8A8A]">
              {t(`prio.${p}short`)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
