import type { ConnState } from "../lib/useBoard";
import { useT } from "../lib/i18n";

const STYLE: Record<ConnState, { key: string; dot: string; text: string }> = {
  connecting: { key: "conn.connecting", dot: "bg-[#C9A96E]", text: "text-[#8BA1C2]" },
  online: { key: "conn.live", dot: "bg-[#4ADE80]", text: "text-[#4ADE80]" },
  reconnecting: { key: "conn.reconnecting", dot: "bg-[#C9A96E]", text: "text-[#C9A96E]" },
  offline: { key: "conn.offline", dot: "bg-[#DC2626]", text: "text-[#F87171]" },
};

export function ConnBadge({ conn }: { conn: ConnState }) {
  const { t } = useT();
  const s = STYLE[conn];
  return (
    <div
      title={t("conn.title")}
      className="inline-flex items-center gap-2 h-8 px-3 rounded-full bg-[#0A1931] border border-[#1E335E]"
    >
      <span className={`w-2 h-2 rounded-full ${s.dot} ${conn === "online" ? "animate-pulse" : ""}`} />
      <span className={`text-[11px] font-semibold ${s.text}`}>{t(s.key)}</span>
    </div>
  );
}
