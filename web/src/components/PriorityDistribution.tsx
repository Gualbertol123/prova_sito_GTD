import type { Task, Priority } from "../lib/types";
import { PRIORITY_DOT, PRIORITY_LABEL } from "../lib/constants";

const PRIOS: Priority[] = ["P1", "P2", "P3", "P4"];

export function PriorityDistribution({ tasks }: { tasks: Task[] }) {
  const active = tasks.filter((t) => t.status !== "DONE");
  const counts = PRIOS.map((p) => active.filter((t) => t.priority === p).length);
  const max = Math.max(1, ...counts);

  return (
    <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-4">
      <h4 className="font-trajan text-[11px] uppercase text-[#8A8A8A] mb-3">
        Distribuzione per Priorità
      </h4>
      <div className="grid grid-cols-4 gap-3">
        {PRIOS.map((p, i) => (
          <div key={p} className="text-center">
            <div className="h-16 flex items-end justify-center">
              <div
                className={`w-8 rounded-t ${PRIORITY_DOT[p]} ${
                  p === "P4" ? "bg-[#E8E6E1]" : ""
                }`}
                style={{ height: `${(counts[i] / max) * 100}%`, minHeight: 4 }}
              />
            </div>
            <div className="text-[15px] font-semibold text-[#0A1931] mt-1">
              {counts[i]}
            </div>
            <div className="text-[9px] uppercase tracking-wide text-[#8A8A8A]">
              {PRIORITY_LABEL[p].split(" • ")[1]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
