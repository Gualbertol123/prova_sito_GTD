import { useMemo, useState } from "react";
import type { Board } from "../lib/types";
import { isArchived } from "../lib/constants";
import { useT } from "../lib/i18n";

export function MailModal({ board, onClose }: { board: Board; onClose: () => void }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);

  const text = useMemo(() => {
    const done = board.tasks.filter((tk) => tk.status === "DONE" && !isArchived(tk));
    const focus = board.weekly.focus;
    const next = board.tasks.filter((tk) => tk.status === "NEXT");

    let e = `${t("mail.completed")}\n`;
    if (done.length === 0) e += `- ${t("mail.none")}\n`;
    else done.forEach((w) => (e += `- ${w.title}${w.owner && w.owner !== "Unassigned" ? ` (${w.owner})` : ""}\n`));

    e += `\n${t("mail.nextSteps")}\n`;
    const nextLines: string[] = [
      ...focus.map((w) => w.text),
      ...next.map((w) => `${w.title}${w.owner && w.owner !== "Unassigned" ? ` (${w.owner})` : ""}`),
    ];
    if (nextLines.length === 0) e += `- ${t("mail.none")}\n`;
    else nextLines.forEach((l) => (e += `- ${l}\n`));
    return e;
  }, [board, t]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-[16px] w-full max-w-[480px] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-[#E8E6E1] flex items-center justify-between">
          <h3 className="font-trajan text-[14px] uppercase tracking-widest text-[#0A1931]">
            {t("mail.title")}
          </h3>
          <button onClick={onClose} className="text-[#8A8A8A] hover:text-[#0A1931] text-[20px] leading-none">
            ×
          </button>
        </div>
        <div className="p-4">
          <textarea
            readOnly
            value={text}
            rows={12}
            className="w-full rounded-lg bg-[#F5F3EF] border border-[#E8E6E1] p-3 text-[13px] font-mono text-[#0A1931] outline-none resize-none"
          />
        </div>
        <div className="p-4 border-t border-[#E8E6E1] flex justify-end gap-2">
          <a
            href={`mailto:?subject=${encodeURIComponent(
              `${board.boardName} — ${t("mail.subject")}`
            )}&body=${encodeURIComponent(text)}`}
            className="h-9 px-4 rounded-full text-[12px] font-semibold bg-white text-[#0A1931] border border-[#E8E6E1] hover:border-[#C9A96E] flex items-center"
          >
            {t("mail.openClient")}
          </a>
          <button
            onClick={copy}
            className="h-9 px-5 rounded-full text-[12px] font-semibold bg-[#C9A96E] text-[#0A1931] hover:bg-[#D8BC8A]"
          >
            {copied ? t("mail.copied") : t("mail.copy")}
          </button>
        </div>
      </div>
    </div>
  );
}
