import { useMemo, useState } from "react";
import type { Board } from "../lib/types";

export function MailModal({ board, onClose }: { board: Board; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const text = useMemo(() => {
    const done = board.tasks.filter((t) => t.status === "DONE");
    const focus = board.weekly.focus;
    let e = "Lavori completati:\n";
    if (done.length === 0) e += "- (nessuno)\n";
    else done.forEach((w) => (e += `- ${w.title}\n`));
    e += "\nProssimi step:\n";
    if (focus.length === 0) e += "- (nessuno)\n";
    else focus.forEach((w) => (e += `- ${w.text}\n`));
    return e;
  }, [board]);

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
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[16px] w-full max-w-[480px] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[#E8E6E1] flex items-center justify-between">
          <h3 className="font-trajan text-[14px] uppercase tracking-widest text-[#0A1931]">
            Mail update
          </h3>
          <button
            onClick={onClose}
            className="text-[#8A8A8A] hover:text-[#0A1931] text-[20px] leading-none"
          >
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
              board.boardName + " — update"
            )}&body=${encodeURIComponent(text)}`}
            className="h-9 px-4 rounded-full text-[12px] font-semibold bg-white text-[#0A1931] border border-[#E8E6E1] hover:border-[#C9A96E] flex items-center"
          >
            Apri client mail
          </a>
          <button
            onClick={copy}
            className="h-9 px-5 rounded-full text-[12px] font-semibold bg-[#C9A96E] text-[#0A1931] hover:bg-[#D8BC8A]"
          >
            {copied ? "Copiato ✓" : "Copia testo"}
          </button>
        </div>
      </div>
    </div>
  );
}
