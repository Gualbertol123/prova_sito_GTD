import type { ConnState } from "../lib/useBoard";

const MAP: Record<ConnState, { label: string; dot: string; text: string }> = {
  connecting: { label: "Connessione…", dot: "bg-[#C9A96E]", text: "text-[#8A8A8A]" },
  online: { label: "Live", dot: "bg-[#065F46]", text: "text-[#065F46]" },
  reconnecting: { label: "Riconnessione…", dot: "bg-[#C9A96E]", text: "text-[#92400E]" },
  offline: { label: "Offline", dot: "bg-[#DC2626]", text: "text-[#DC2626]" },
};

export function ConnBadge({ conn }: { conn: ConnState }) {
  const m = MAP[conn];
  return (
    <div
      title="Stato sincronizzazione in tempo reale"
      className="inline-flex items-center gap-2 h-8 px-3 rounded-full bg-white border border-[#E8E6E1]"
    >
      <span
        className={`w-2 h-2 rounded-full ${m.dot} ${
          conn === "online" ? "animate-pulse" : ""
        }`}
      />
      <span className={`text-[11px] font-semibold ${m.text}`}>{m.label}</span>
    </div>
  );
}
