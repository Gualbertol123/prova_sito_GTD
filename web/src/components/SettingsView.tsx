import { useState } from "react";
import type { Board, Op } from "../lib/types";
import { DEFAULT_ACCESS_PASSWORD, DEFAULT_LOGIN_DAYS } from "../lib/constants";
import { clearAuth } from "../lib/prefs";
import { useT } from "../lib/i18n";

interface Props {
  board: Board;
  send: (op: Op) => void;
}

export function SettingsView({ board, send }: Props) {
  const { t } = useT();
  const [subIt, setSubIt] = useState(board.subtitleIt ?? "");
  const [subEn, setSubEn] = useState(board.subtitleEn ?? "");
  const [pwd, setPwd] = useState(board.accessPassword ?? DEFAULT_ACCESS_PASSWORD);
  const [days, setDays] = useState(String(board.loginDays ?? DEFAULT_LOGIN_DAYS));
  const [saved, setSaved] = useState(false);

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const input =
    "w-full h-10 rounded-lg bg-[#F5F3EF] border border-[#E8E6E1] px-3 text-[13px] outline-none focus:border-[#C9A96E]";
  const saveBtn =
    "h-10 px-5 rounded-full bg-[#0A1931] text-[#C9A96E] text-[12px] font-semibold shrink-0";

  return (
    <div className="max-w-[640px] mx-auto space-y-4">
      <h2 className="font-trajan text-[16px] uppercase tracking-widest text-[#0A1931]">
        {t("settings.title")}
      </h2>

      {saved && (
        <div className="text-[12px] text-[#065F46] bg-[#ECFDF5] border border-[#A7F3D0] rounded-lg px-3 py-2">
          {t("settings.saved")}
        </div>
      )}

      {/* Subtitle */}
      <section className="bg-white rounded-[14px] border border-[#E8E6E1] p-5 space-y-3">
        <h3 className="font-trajan text-[11px] uppercase tracking-widest text-[#C9A96E]">
          {t("settings.subtitleSection")}
        </h3>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-[#8A8A8A]">
            {t("settings.subtitleIt")}
          </span>
          <div className="flex gap-2 mt-1">
            <input
              value={subIt}
              onChange={(e) => setSubIt(e.target.value)}
              placeholder="Getting Things Done · Kanban"
              className={input}
            />
            <button
              onClick={() => {
                send({ type: "setSubtitle", lang: "it", text: subIt });
                flashSaved();
              }}
              className={saveBtn}
            >
              {t("settings.save")}
            </button>
          </div>
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-[#8A8A8A]">
            {t("settings.subtitleEn")}
          </span>
          <div className="flex gap-2 mt-1">
            <input
              value={subEn}
              onChange={(e) => setSubEn(e.target.value)}
              placeholder="Getting Things Done · Kanban"
              className={input}
            />
            <button
              onClick={() => {
                send({ type: "setSubtitle", lang: "en", text: subEn });
                flashSaved();
              }}
              className={saveBtn}
            >
              {t("settings.save")}
            </button>
          </div>
        </label>
      </section>

      {/* Access */}
      <section className="bg-white rounded-[14px] border border-[#E8E6E1] p-5 space-y-3">
        <h3 className="font-trajan text-[11px] uppercase tracking-widest text-[#C9A96E]">
          {t("settings.access")}
        </h3>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-[#8A8A8A]">
            {t("settings.accessPassword")}
          </span>
          <div className="flex gap-2 mt-1">
            <input value={pwd} onChange={(e) => setPwd(e.target.value)} className={input} />
            <button
              onClick={() => {
                if (pwd.trim()) {
                  send({ type: "setAccess", password: pwd.trim() });
                  flashSaved();
                }
              }}
              className={saveBtn}
            >
              {t("settings.save")}
            </button>
          </div>
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-[#8A8A8A]">
            {t("settings.loginDuration")}
          </span>
          <div className="flex gap-2 mt-1">
            <input
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className={input}
            />
            <button
              onClick={() => {
                const n = Math.max(1, Math.min(365, parseInt(days, 10) || DEFAULT_LOGIN_DAYS));
                setDays(String(n));
                send({ type: "setAccess", loginDays: n });
                flashSaved();
              }}
              className={saveBtn}
            >
              {t("settings.save")}
            </button>
          </div>
        </label>

        <button
          onClick={() => {
            clearAuth();
            window.location.reload();
          }}
          className="h-10 px-4 rounded-full text-[12px] font-semibold text-[#DC2626] border border-[#FECACA] hover:bg-[#FEF2F2]"
        >
          {t("settings.logoutNow")}
        </button>
      </section>

      <p className="text-[11px] text-[#8A8A8A]">{t("settings.migrationNote")}</p>
    </div>
  );
}
