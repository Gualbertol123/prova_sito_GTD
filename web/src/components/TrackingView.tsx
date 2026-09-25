import { useState } from "react";
import type { Board } from "../lib/types";
import { trackingLogin, outcomeKey } from "../lib/auth";
import { localeCode, ownerLabel, useT } from "../lib/i18n";
import { isOwnedBy } from "../lib/owners";

export function TrackingView({ board }: { board: Board }) {
  const { t } = useT();
  const [authed, setAuthed] = useState(false);
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ key: string; detail?: string } | null>(null);

  if (!authed) {
    // Checked by the database (tracking_login); the password is not in the code.
    const submit = async () => {
      if (busy || !pwd) return;
      setBusy(true);
      setErr(null);
      const out = await trackingLogin(pwd);
      setBusy(false);
      if (out.result === "ok") {
        setPwd("");
        setAuthed(true);
      } else {
        setErr({ key: outcomeKey(out.result), detail: out.detail });
      }
    };
    return (
      <div className="max-w-[420px] mx-auto mt-10 bg-white rounded-[16px] border border-[#E8E6E1] p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-[#0A1931] text-[#C9A96E] flex items-center justify-center mx-auto text-[20px]">
          🔒
        </div>
        <h3 className="font-trajan text-[14px] uppercase tracking-widest text-[#0A1931] mt-4">
          {t("track.title")}
        </h3>
        <p className="text-[12px] text-[#8A8A8A] mt-2 mb-4">{t("track.prompt")}</p>
        <div className="flex gap-2 justify-center max-w-[320px] mx-auto">
          <input
            type="password"
            value={pwd}
            autoFocus
            onChange={(e) => {
              setPwd(e.target.value);
              setErr(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={t("track.password")}
            className={`flex-1 h-10 rounded-full bg-[#F5F3EF] border px-4 text-[13px] outline-none ${
              err ? "border-[#DC2626]" : "border-[#E8E6E1] focus:border-[#C9A96E]"
            }`}
          />
          <button
            onClick={submit}
            disabled={busy || !pwd}
            className="h-10 px-5 rounded-full bg-[#0A1931] text-[#C9A96E] text-[12px] font-semibold disabled:opacity-60"
          >
            {busy ? "…" : t("track.enter")}
          </button>
        </div>
        {err && (
          <p className="text-[11px] text-[#DC2626] mt-2">
            {t(err.key)}
            {err.detail && <span className="block opacity-70 mt-0.5">{err.detail}</span>}
          </p>
        )}
      </div>
    );
  }

  const owners = [...board.members, "Unassigned"];

  return (
    <div className="space-y-4">
      <div className="text-[12px] text-[#6B6B6B]">{t("track.help")}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {owners.map((m) => {
          const active = board.tasks.filter((tk) => isOwnedBy(tk, m) && tk.status !== "DONE");
          const p1 = active.filter((tk) => tk.priority === "P1").length;
          const total = active.length;
          const level = p1 > 2 ? "over" : total > 4 ? "high" : "ok";
          const badge =
            level === "over"
              ? "bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]"
              : level === "high"
              ? "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]"
              : "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]";
          const byStatus = (s: string) => active.filter((tk) => tk.status === s).length;

          return (
            <div key={m} className="bg-white rounded-[14px] border border-[#E8E6E1] p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-trajan text-[13px] uppercase tracking-wide text-[#0A1931]">
                  {ownerLabel(t, m)}
                </span>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full border ${badge}`}
                >
                  {t(`track.${level}`)}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-3">
                <Stat n={total} label={t("track.active")} />
                <Stat n={p1} label="P1" accent />
                <Stat n={byStatus("IN PROGRESS")} label={t("track.inProgress")} />
                <Stat n={byStatus("WAITING")} label={t("track.waiting")} />
              </div>
              <div className="h-1.5 rounded-full bg-[#E8E6E1] overflow-hidden">
                <div
                  className={`h-full ${
                    level === "over" ? "bg-[#DC2626]" : level === "high" ? "bg-[#C9A96E]" : "bg-[#065F46]"
                  }`}
                  style={{ width: `${Math.min(100, total * 20)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <ReflectionsReview board={board} />
    </div>
  );
}

function ReflectionsReview({ board }: { board: Board }) {
  const { t, lang } = useT();
  const [who, setWho] = useState("all");
  const entries = board.reflections
    .filter((r) => who === "all" || r.member === who)
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const line = (label: string, text: string, color: string) =>
    text.trim() ? (
      <div className="flex gap-2">
        <span className={`w-[104px] shrink-0 text-[9px] font-semibold uppercase tracking-wide pt-0.5 ${color}`}>
          {label}
        </span>
        <span className="flex-1 min-w-0 text-[12px] text-[#0A1931] whitespace-pre-wrap break-words">{text}</span>
      </div>
    ) : null;

  return (
    <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <h3 className="font-trajan text-[13px] uppercase tracking-widest text-[#0A1931]">
          🧠 {t("track.reflections")}
        </h3>
        <select
          value={who}
          onChange={(e) => setWho(e.target.value)}
          className="h-8 rounded-full bg-[#F5F3EF] border border-[#E8E6E1] px-3 text-[12px] text-[#0A1931] outline-none focus:border-[#C9A96E]"
        >
          <option value="all">{t("track.reflAll")}</option>
          {board.members.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {board.reflections.length === 0 ? (
        <div className="text-[12px] text-[#A8A29E]">{t("track.reflNone")}</div>
      ) : entries.length === 0 ? (
        <div className="text-[12px] text-[#A8A29E]">{t("track.reflEmptyMember")}</div>
      ) : (
        <div className="space-y-2">
          {entries.map((r) => (
            <div key={r.id} className="rounded-lg border border-[#E8E6E1] bg-[#FAF9F6] p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-5 h-5 rounded-full bg-[#0A1931] text-white text-[9px] font-bold flex items-center justify-center">
                  {r.member.charAt(0).toUpperCase()}
                </span>
                <span className="text-[12px] font-semibold text-[#0A1931]">{r.member}</span>
                <span className="text-[11px] text-[#8A8A8A] ml-auto">
                  {new Date(r.date).toLocaleDateString(localeCode(lang))}
                </span>
              </div>
              <div className="space-y-1.5 pl-1">
                {line(t("reflection.done"), r.done, "text-[#065F46]")}
                {line(t("reflection.well"), r.well, "text-[#8B6F3E]")}
                {line(t("reflection.improve"), r.improve, "text-[#92400E]")}
                {line(t("reflection.learning"), r.learning, "text-[#3A5A8A]")}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ n, label, accent }: { n: number; label: string; accent?: boolean }) {
  return (
    <div className="bg-[#F5F3EF] rounded-lg py-2 text-center">
      <div className={`text-[18px] font-semibold ${accent && n > 0 ? "text-[#DC2626]" : "text-[#0A1931]"}`}>
        {n}
      </div>
      <div className="text-[9px] uppercase tracking-wide text-[#8A8A8A]">{label}</div>
    </div>
  );
}
