import { useState } from "react";
import type { Board, Op } from "../lib/types";
import type { ConnState } from "../lib/useBoard";
import { useT } from "../lib/i18n";

interface Props {
  board: Board;
  conn: ConnState;
  onRename: (name: string) => void;
  onOpenMail: () => void;
  send: (op: Op) => void;
  rightSlot?: React.ReactNode;
}

export function TopBar({ board, onRename, onOpenMail, send, rightSlot }: Props) {
  const { t, lang } = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(board.boardName);
  const subtitle = (lang === "it" ? board.subtitleIt : board.subtitleEn)?.trim() || t("app.subtitle");
  const [editingSub, setEditingSub] = useState(false);
  const [subDraft, setSubDraft] = useState(subtitle);

  const commit = () => {
    const v = draft.trim();
    if (v && v !== board.boardName) onRename(v);
    setEditing(false);
  };
  const commitSub = () => {
    const v = subDraft.trim();
    if (v !== subtitle) send({ type: "setSubtitle", lang, text: v });
    setEditingSub(false);
  };

  return (
    <header className="bg-[#0A1931] text-white">
      <div className="max-w-[1500px] mx-auto px-4 py-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-10 h-10 rounded-full border-2 border-[#C9A96E] flex items-center justify-center shrink-0 overflow-hidden bg-[#0A1931]">
            {board.logoUrl ? (
              <img src={board.logoUrl} alt="logo" className="w-full h-full object-contain" />
            ) : (
              <span className="font-trajan text-[#C9A96E] text-[15px]">G</span>
            )}
          </div>
          <div className="min-w-0">
            {editing ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") {
                    setDraft(board.boardName);
                    setEditing(false);
                  }
                }}
                className="bg-transparent border-b border-[#C9A96E] text-[#C9A96E] font-trajan text-[20px] tracking-[0.15em] uppercase outline-none"
              />
            ) : (
              <h1
                onDoubleClick={() => {
                  setDraft(board.boardName);
                  setEditing(true);
                }}
                title={t("app.renameHint")}
                className="font-trajan text-[20px] sm:text-[22px] tracking-[0.15em] uppercase text-[#C9A96E] cursor-text truncate"
              >
                {board.boardName}
              </h1>
            )}
            {editingSub ? (
              <input
                autoFocus
                value={subDraft}
                onChange={(e) => setSubDraft(e.target.value)}
                onBlur={commitSub}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitSub();
                  if (e.key === "Escape") {
                    setSubDraft(subtitle);
                    setEditingSub(false);
                  }
                }}
                className="mt-0.5 bg-transparent border-b border-[#8BA1C2] text-[#8BA1C2] text-[10px] tracking-[0.25em] uppercase outline-none w-full"
              />
            ) : (
              <p
                onDoubleClick={() => {
                  setSubDraft(subtitle);
                  setEditingSub(true);
                }}
                title={t("app.renameHint")}
                className="text-[10px] tracking-[0.25em] uppercase text-[#8BA1C2] mt-0.5 cursor-text truncate"
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {rightSlot}
          <button
            onClick={onOpenMail}
            className="h-9 px-4 rounded-full bg-[#C9A96E] text-[#0A1931] text-[12px] font-semibold hover:bg-[#D8BC8A] transition-colors"
          >
            ✉ {t("app.mail")}
          </button>
        </div>
      </div>
    </header>
  );
}
