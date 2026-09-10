import { PRIORITY_LABEL, UNASSIGNED } from "../lib/constants";
import type { Priority } from "../lib/types";

export interface FilterState {
  search: string;
  owner: string; // "all" | member | Unassigned
  priority: string; // "all" | Priority
  focusP1: boolean;
}

interface Props {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  members: string[];
}

const PRIOS: Priority[] = ["P1", "P2", "P3", "P4"];

export function Filters({ filters, setFilters, members }: Props) {
  const owners = [UNASSIGNED, ...members];
  const reset = () =>
    setFilters({ search: "", owner: "all", priority: "all", focusP1: false });

  return (
    <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-3 flex flex-wrap items-center gap-2">
      <span className="font-trajan text-[10px] uppercase tracking-widest text-[#8A8A8A] mr-1">
        Filtri
      </span>

      <input
        value={filters.search}
        onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
        placeholder="Cerca..."
        className="h-9 rounded-full bg-[#F5F3EF] border border-[#E8E6E1] px-4 text-[13px] outline-none focus:border-[#C9A96E] min-w-[160px] flex-1"
      />

      <select
        value={filters.owner}
        onChange={(e) => setFilters((f) => ({ ...f, owner: e.target.value }))}
        className="h-9 rounded-full bg-[#F5F3EF] border border-[#E8E6E1] px-3 text-[13px] outline-none focus:border-[#C9A96E]"
      >
        <option value="all">Tutti i membri</option>
        {owners.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>

      <select
        value={filters.priority}
        onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
        className="h-9 rounded-full bg-[#F5F3EF] border border-[#E8E6E1] px-3 text-[13px] outline-none focus:border-[#C9A96E]"
      >
        <option value="all">Tutte le priorità</option>
        {PRIOS.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABEL[p]}
          </option>
        ))}
      </select>

      <button
        onClick={() => setFilters((f) => ({ ...f, focusP1: !f.focusP1 }))}
        className={`h-9 px-4 rounded-full text-[12px] font-semibold border transition-colors ${
          filters.focusP1
            ? "bg-[#DC2626] text-white border-[#DC2626]"
            : "bg-white text-[#DC2626] border-[#FECACA] hover:border-[#DC2626]"
        }`}
      >
        Focus P1
      </button>

      <button
        onClick={reset}
        className="h-9 px-4 rounded-full text-[12px] font-semibold bg-white text-[#8A8A8A] border border-[#E8E6E1] hover:border-[#C9A96E]"
      >
        Reset filtri
      </button>
    </div>
  );
}
