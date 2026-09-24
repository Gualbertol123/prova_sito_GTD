import { useState } from "react";
import type { Board, Op, PersonalNote } from "../lib/types";
import { genId } from "../lib/constants";
import { localeCode, useT } from "../lib/i18n";
import { AutoTextarea } from "./AutoTextarea";

interface Props {
  board: Board;
  me: string;
  send: (op: Op, onError?: (message: string) => void) => void;
}

// Your own notes, sitting under the daily reflections and behind the same
// per-member password. Only the notes written under the login you are in are
// ever shown — a note carries the member who wrote it and nothing else.
//
// This is privacy in the interface, not in the database: like every other table
// here, the row-level policy is open to the anon key that ships in the browser.
export function PersonalNotes({ board, me, send }: Props) {
  const { t, lang } = useT();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const unavailable = board.personalNotesError;
  const mine = (board.personalNotes ?? [])
    .filter((n) => n.member === me)
    .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));

  const add = () => {
    const body = draft.trim();
    if (!body || unavailable) return;
    const now = Date.now();
    const note: PersonalNote = { id: genId(), member: me, body, createdAt: now, updatedAt: now };
    setFailed(null);
    setDraft("");
    send({ type: "noteAdd", note }, (message) => {
      setFailed(message);
      setDraft((d) => (d.trim() ? d : body));
    });
  };

  const saveEdit = (note: PersonalNote) => {
    const body = editBody.trim();
    setEditing(null);
    if (!body || body === note.body) return;
    setFailed(null);
    send({ type: "noteUpdate", id: note.id, body }, setFailed);
  };

  const remove = (id: string) => {
    setConfirmId(null);
    setFailed(null);
    send({ type: "noteDelete", id }, setFailed);
  };

  const stamp = (n: PersonalNote) =>
    new Date(n.updatedAt || n.createdAt).toLocaleDateString(localeCode(lang));

  return (
    <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h4 className="font-trajan text-[12px] uppercase tracking-widest text-[#0A1931]">
          📝 {t("notes.title")}
        </h4>
        <span className="text-[11px] text-[#8A8A8A]">{t("notes.privacy")}</span>
      </div>

      {unavailable && (
        <div className="rounded-[12px] border border-[#FECACA] bg-[#FEF2F2] p-3 space-y-1">
          <p className="text-[12px] font-semibold text-[#DC2626]">{t("notes.unavailable")}</p>
          <p className="text-[11px] text-[#6B6B6B]">{t("notes.migrationNote")}</p>
          <p className="text-[10px] text-[#A8A29E] break-words">{unavailable}</p>
        </div>
      )}

      <div className="space-y-2">
        <AutoTextarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={!!unavailable}
          placeholder={t(unavailable ? "notes.placeholderOff" : "notes.placeholder")}
          className="w-full min-h-[64px] rounded-lg bg-[#F5F3EF] border border-[#E8E6E1] p-2.5 text-[12px] text-[#0A1931] outline-none focus:border-[#C9A96E]"
        />
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={add}
            disabled={!draft.trim() || !!unavailable}
            className="h-9 px-4 rounded-full bg-[#0A1931] text-[#C9A96E] text-[12px] font-semibold disabled:opacity-30"
          >
            {t("notes.add")}
          </button>
          {failed && <span className="text-[12px] text-[#DC2626]">{t("notes.failed")}</span>}
          <span className="text-[11px] text-[#A8A29E] ml-auto">
            {mine.length === 1 ? t("notes.count1") : t("notes.count", { n: mine.length })}
          </span>
        </div>
      </div>

      {mine.length === 0 ? (
        !unavailable && (
          <p className="text-[12px] text-[#A8A29E] text-center py-4">{t("notes.none")}</p>
        )
      ) : (
        <div className="space-y-2">
          {mine.map((note) => (
            <div key={note.id} className="rounded-[12px] border border-[#E8E6E1] bg-[#FAF9F6] p-3">
              {editing === note.id ? (
                <div className="space-y-2">
                  <AutoTextarea
                    value={editBody}
                    autoFocus
                    onChange={(e) => setEditBody(e.target.value)}
                    onBlur={() => saveEdit(note)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setEditing(null);
                    }}
                    className="w-full min-h-[56px] rounded-lg bg-white border border-[#C9A96E] p-2.5 text-[12px] text-[#0A1931] outline-none"
                  />
                  <div className="flex gap-3">
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => saveEdit(note)}
                      className="text-[11px] font-semibold text-[#0A1931]"
                    >
                      {t("notes.save")}
                    </button>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setEditing(null)}
                      className="text-[11px] text-[#8A8A8A]"
                    >
                      {t("notes.cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-[12px] text-[#0A1931] whitespace-pre-wrap break-words">
                    {note.body}
                  </div>
                  <div className="mt-2 flex items-center gap-3 flex-wrap">
                    <span className="text-[10px] text-[#A8A29E]">{stamp(note)}</span>
                    <button
                      onClick={() => {
                        setEditing(note.id);
                        setEditBody(note.body);
                      }}
                      className="text-[11px] text-[#8A8A8A] hover:text-[#0A1931] ml-auto"
                    >
                      {t("notes.edit")}
                    </button>
                    {confirmId === note.id ? (
                      <span className="flex items-center gap-2 text-[11px]">
                        <span className="text-[#DC2626]">{t("notes.confirmDelete")}</span>
                        <button
                          onClick={() => remove(note.id)}
                          className="font-semibold text-[#DC2626]"
                        >
                          {t("task.yes")}
                        </button>
                        <button onClick={() => setConfirmId(null)} className="text-[#8A8A8A]">
                          {t("task.no")}
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmId(note.id)}
                        className="text-[11px] text-[#8A8A8A] hover:text-[#DC2626]"
                      >
                        {t("notes.delete")}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
