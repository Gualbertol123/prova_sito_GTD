import { useState } from "react";
import type { Board } from "../lib/types";
import { TRACKING_PASSWORD } from "../lib/constants";
import { ownerLabel, useT } from "../lib/i18n";

export function TrackingView({ board }: { board: Board }) {
  const { t } = useT();
  const [authed, setAuthed] = useState(false);
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState(false);

  if (!authed) {
    const submit = () => (pwd === TRACKING_PASSWORD ? setAuthed(true) : setErr(true));
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
              setErr(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={t("track.password")}
            className={`flex-1 h-10 rounded-full bg-[#F5F3EF] border px-4 text-[13px] outline-none ${
              err ? "border-[#DC2626]" : "border-[#E8E6E1] focus:border-[#C9A96E]"
            }`}
          />
          <button
            onClick={submit}
            className="h-10 px-5 rounded-full bg-[#0A1931] text-[#C9A96E] text-[12px] font-semibold"
          >
            {t("track.enter")}
          </button>
        </div>
        {err && <p className="text-[11px] text-[#DC2626] mt-2">{t("track.wrong")}</p>}
      </div>
    );
  }

  const owners = [...board.members, "Unassigned"];

  return (
    <div className="space-y-4">
      <div className="text-[12px] text-[#6B6B6B]">{t("track.help")}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {owners.map((m) => {
          const active = board.tasks.filter((tk) => tk.owner === m && tk.status !== "DONE");
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
