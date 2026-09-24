import { useState } from "react";
import type { Board, Op } from "../lib/types";
import { genId } from "../lib/constants";
import { localeCode, useT } from "../lib/i18n";
import { addMySuggestion, readMySuggestions, removeMySuggestion } from "../lib/prefs";

interface Props {
  board: Board;
  send: (op: Op, onError?: (message: string) => void) => void;
}

// Anonymous suggestions for improving the site.
//
// Nothing identifying is written: the row is just { id, body, created_at }, and
// the composer deliberately ignores the "You" identity the rest of the app uses.
// The only per-person state is the list of ids this browser posted, kept in
// localStorage so you can delete your own without the server knowing who you are.
export function SuggestionsView({ board, send }: Props) {
  const { t, lang } = useT();
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [mine, setMine] = useState<string[]>(() => readMySuggestions());
  const [failed, setFailed] = useState<string | null>(null);

  const suggestions = board.suggestions ?? [];
  // Set when the server could not be read. Without this the tab showed "no
  // ideas yet" whether nobody had posted or the table was unreachable, so
  // ideas could be typed in and quietly lost.
  const unavailable = board.suggestionsError;

  const submit = () => {
    const body = draft.trim();
    if (!body || unavailable) return;
    const id = genId();
    setFailed(null);
    // Clear first, then send: the rejection path restores the text, and it has
    // to run after the clear whether the write fails synchronously or later.
    addMySuggestion(id);
    setMine(readMySuggestions());
    setDraft("");
    setSent(true);
    setTimeout(() => setSent(false), 2000);
    send({ type: "suggestionAdd", suggestion: { id, body, createdAt: Date.now() } }, (message) => {
      // The write was rejected and rolled back: say so and hand the text back
      // rather than leaving a "sent ✓" on an idea nobody will ever read.
      setSent(false);
      setFailed(message);
      removeMySuggestion(id);
      setMine(readMySuggestions());
      setDraft((d) => (d.trim() ? d : body));
    });
  };

  const remove = (id: string) => {
    send({ type: "suggestionDelete", id });
    removeMySuggestion(id);
    setMine(readMySuggestions());
    setConfirmId(null);
  };

  return (
    <div className="max-w-[760px] mx-auto space-y-4">
      <div>
        <h2 className="font-trajan text-[16px] uppercase tracking-widest text-[#0A1931]">
          💡 {t("sugg.title")}
        </h2>
        <p className="text-[12px] text-[#6B6B6B] mt-2">{t("sugg.intro")}</p>
      </div>

      {unavailable && (
        <div className="rounded-[14px] border border-[#FECACA] bg-[#FEF2F2] p-4 space-y-1.5">
          <p className="text-[12px] font-semibold text-[#DC2626]">{t("sugg.unavailable")}</p>
          <p className="text-[11px] text-[#6B6B6B]">{t("sugg.migrationNote")}</p>
          <p className="text-[10px] text-[#A8A29E] break-words">{unavailable}</p>
        </div>
      )}

      {/* Composer */}
      <div className="rounded-[14px] border border-[#C9A96E]/40 bg-[#FBF6EC] p-4 space-y-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          rows={4}
          disabled={!!unavailable}
          placeholder={t(unavailable ? "sugg.placeholderOff" : "sugg.placeholder")}
          className="w-full rounded-lg bg-white border border-[#E8E6E1] p-3 text-[13px] outline-none focus:border-[#C9A96E] resize-y"
        />
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={submit}
            disabled={!draft.trim() || !!unavailable}
            className="h-10 px-5 rounded-full bg-[#0A1931] text-[#C9A96E] text-[12px] font-semibold disabled:opacity-30"
          >
            {t("sugg.send")}
          </button>
          {sent && !failed && (
            <span className="text-[12px] text-[#065F46]">{t("sugg.sent")}</span>
          )}
          {failed && <span className="text-[12px] text-[#DC2626]">{t("sugg.failed")}</span>}
          <span className="text-[11px] text-[#8A8A8A] ml-auto">🔒 {t("sugg.privacy")}</span>
        </div>
      </div>

      {/* The list */}
      <div className="flex items-center gap-2">
        <span className="font-trajan text-[11px] uppercase tracking-widest text-[#8A8A8A]">
          {suggestions.length === 1 ? t("sugg.count1") : t("sugg.count", { n: suggestions.length })}
        </span>
        <div className="flex-1 h-px bg-[#E8E6E1]" />
      </div>

      {suggestions.length === 0 ? (
        <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-8 text-center text-[13px] text-[#A8A29E]">
          {t(unavailable ? "sugg.noneUnavailable" : "sugg.none")}
        </div>
      ) : (
        <div className="space-y-2">
          {suggestions.map((s) => {
            const isMine = mine.includes(s.id);
            return (
              <div key={s.id} className="rounded-[12px] border border-[#E8E6E1] bg-white p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-5 h-5 rounded-full bg-[#EFECE6] text-[#8A8A8A] text-[10px] flex items-center justify-center">
                    ?
                  </span>
                  <span className="text-[11px] text-[#8A8A8A]">{t("sugg.anon")}</span>
                  {isMine && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#FBF6EC] text-[#8B6F3E] border border-[#C9A96E]/40">
                      {t("sugg.mine")}
                    </span>
                  )}
                  <span className="text-[11px] text-[#A8A29E] ml-auto">
                    {new Date(s.createdAt).toLocaleDateString(localeCode(lang))}
                  </span>
                </div>
                <div className="text-[13px] text-[#0A1931] whitespace-pre-wrap break-words">
                  {s.body}
                </div>
                {isMine && (
                  <div className="mt-2 flex justify-end">
                    {confirmId === s.id ? (
                      <span className="flex items-center gap-2 text-[12px]">
                        <span className="text-[#DC2626]">{t("sugg.confirmDelete")}</span>
                        <button onClick={() => remove(s.id)} className="font-semibold text-[#DC2626]">
                          {t("task.yes")}
                        </button>
                        <button onClick={() => setConfirmId(null)} className="text-[#8A8A8A]">
                          {t("task.no")}
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmId(s.id)}
                        className="text-[11px] text-[#8A8A8A] hover:text-[#DC2626]"
                      >
                        {t("sugg.delete")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
