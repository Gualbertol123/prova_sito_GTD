import { useRef, useState } from "react";
import type { Board, Op } from "../lib/types";
import { DEFAULT_LOGIN_DAYS } from "../lib/constants";
import { changeTeamPassword, signOutDevice, outcomeKey } from "../lib/auth";
import { useT } from "../lib/i18n";
import {
  processImage,
  ImageError,
  LOGO_ACCEPT,
  FAVICON_ACCEPT,
  INPUT_MAX_MB,
} from "../lib/image";

interface Props {
  board: Board;
  send: (op: Op) => void;
}

export function SettingsView({ board, send }: Props) {
  const { t } = useT();
  const [days, setDays] = useState(String(board.loginDays ?? DEFAULT_LOGIN_DAYS));
  const [saved, setSaved] = useState(false);
  const [imgErr, setImgErr] = useState<string | null>(null);

  const logoInput = useRef<HTMLInputElement>(null);
  const faviconInput = useRef<HTMLInputElement>(null);

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const upload = async (file: File | undefined, kind: "logo" | "favicon") => {
    if (!file) return;
    setImgErr(null);
    try {
      const dataUrl = await processImage(file, kind);
      send(kind === "logo" ? { type: "setBranding", logoUrl: dataUrl } : { type: "setBranding", faviconUrl: dataUrl });
      flashSaved();
    } catch (e) {
      setImgErr(e instanceof ImageError && e.code === "big" ? t("settings.imageTooBig") : t("settings.imageBad"));
    }
  };

  const input =
    "w-full h-10 rounded-lg bg-[#F5F3EF] border border-[#E8E6E1] px-3 text-[13px] outline-none focus:border-[#C9A96E]";
  const saveBtn = "h-10 px-5 rounded-full bg-[#0A1931] text-[#C9A96E] text-[12px] font-semibold shrink-0";
  const smallBtn = "h-9 px-4 rounded-full text-[12px] font-semibold border";

  return (
    <div className="max-w-[640px] mx-auto space-y-4">
      <h2 className="font-trajan text-[16px] uppercase tracking-widest text-[#0A1931]">{t("settings.title")}</h2>

      {saved && (
        <div className="text-[12px] text-[#065F46] bg-[#ECFDF5] border border-[#A7F3D0] rounded-lg px-3 py-2">
          {t("settings.saved")}
        </div>
      )}

      {/* Branding */}
      <section className="bg-white rounded-[14px] border border-[#E8E6E1] p-5 space-y-4">
        <h3 className="font-trajan text-[11px] uppercase tracking-widest text-[#C9A96E]">
          {t("settings.branding")}
        </h3>

        {/* Logo */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full border-2 border-[#C9A96E] flex items-center justify-center overflow-hidden bg-[#0A1931] shrink-0">
            {board.logoUrl ? (
              <img src={board.logoUrl} alt="logo" className="w-full h-full object-contain" />
            ) : (
              <span className="font-trajan text-[#C9A96E] text-[18px]">G</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-[#0A1931]">{t("settings.logo")}</div>
            <div className="text-[11px] text-[#8A8A8A]">{t("settings.logoHint", { mb: INPUT_MAX_MB })}</div>
            <div className="flex gap-2 mt-2">
              <input ref={logoInput} type="file" accept={LOGO_ACCEPT} hidden onChange={(e) => upload(e.target.files?.[0], "logo")} />
              <button onClick={() => logoInput.current?.click()} className={`${smallBtn} bg-[#0A1931] text-[#C9A96E] border-[#0A1931]`}>
                {t("settings.upload")}
              </button>
              {board.logoUrl && (
                <button onClick={() => send({ type: "setBranding", logoUrl: null })} className={`${smallBtn} bg-white text-[#DC2626] border-[#FECACA]`}>
                  {t("settings.remove")}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Favicon */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-lg border border-[#E8E6E1] flex items-center justify-center overflow-hidden bg-[#F5F3EF] shrink-0">
            {board.faviconUrl ? (
              <img src={board.faviconUrl} alt="favicon" className="w-8 h-8 object-contain" />
            ) : (
              <span className="text-[#A8A29E] text-[10px]">—</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-[#0A1931]">{t("settings.favicon")}</div>
            <div className="text-[11px] text-[#8A8A8A]">{t("settings.faviconHint", { mb: INPUT_MAX_MB })}</div>
            <div className="flex gap-2 mt-2">
              <input ref={faviconInput} type="file" accept={FAVICON_ACCEPT} hidden onChange={(e) => upload(e.target.files?.[0], "favicon")} />
              <button onClick={() => faviconInput.current?.click()} className={`${smallBtn} bg-[#0A1931] text-[#C9A96E] border-[#0A1931]`}>
                {t("settings.upload")}
              </button>
              {board.faviconUrl && (
                <button onClick={() => send({ type: "setBranding", faviconUrl: null })} className={`${smallBtn} bg-white text-[#DC2626] border-[#FECACA]`}>
                  {t("settings.remove")}
                </button>
              )}
            </div>
          </div>
        </div>

        {imgErr && <div className="text-[11px] text-[#DC2626]">{imgErr}</div>}
      </section>

      {/* Access */}
      <section className="bg-white rounded-[14px] border border-[#E8E6E1] p-5 space-y-3">
        <h3 className="font-trajan text-[11px] uppercase tracking-widest text-[#C9A96E]">{t("settings.access")}</h3>
        <TeamPasswordForm input={input} saveBtn={saveBtn} />
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-[#8A8A8A]">{t("settings.loginDuration")}</span>
          <div className="flex gap-2 mt-1">
            <input type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} className={input} />
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
          onClick={async () => {
            await signOutDevice();
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

// Change the shared team password (Supabase Auth). Needs the current one; on
// success every other device is logged out and must use the new password.
// Forgotten? An admin resets it from Supabase (README → Security → Admin).
function TeamPasswordForm({ input, saveBtn }: { input: string; saveBtn: string }) {
  const { t } = useT();
  const [cur, setCur] = useState("");
  const [np, setNp] = useState("");
  const [np2, setNp2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; key: string; detail?: string } | null>(null);

  const submit = async () => {
    if (busy || !cur || !np || !np2) return;
    if (np.length < 12) return setMsg({ ok: false, key: "settings.pwdTooShort" });
    if (np !== np2) return setMsg({ ok: false, key: "settings.pwdMismatch" });
    setBusy(true);
    setMsg(null);
    const out = await changeTeamPassword(cur, np);
    setBusy(false);
    if (out.result === "ok") {
      setCur("");
      setNp("");
      setNp2("");
      setMsg({ ok: true, key: "settings.pwdChanged" });
    } else {
      const key =
        out.result === "wrong" ? "settings.pwdWrongCurrent"
        : out.result === "invalid" ? "settings.pwdRejected" // Supabase's own rule, e.g. its minimum length
        : outcomeKey(out.result);
      setMsg({ ok: false, key, detail: out.detail });
    }
  };

  const onChange = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    set(e.target.value);
    setMsg(null);
  };

  return (
    <div className="block">
      <span className="text-[11px] uppercase tracking-wide text-[#8A8A8A]">{t("settings.teamPassword")}</span>
      <div className="space-y-2 mt-1">
        <input type="password" autoComplete="current-password" value={cur} onChange={onChange(setCur)}
          placeholder={t("settings.pwdCurrent")} className={input} />
        <input type="password" autoComplete="new-password" value={np} onChange={onChange(setNp)}
          placeholder={t("settings.pwdNew")} className={input} />
        <div className="flex gap-2">
          <input type="password" autoComplete="new-password" value={np2} onChange={onChange(setNp2)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={t("settings.pwdConfirm")} className={input} />
          <button onClick={submit} disabled={busy || !cur || !np || !np2} className={`${saveBtn} disabled:opacity-60`}>
            {busy ? "…" : t("settings.save")}
          </button>
        </div>
      </div>
      <p className="text-[11px] text-[#A8A29E] mt-1">{t("settings.pwdHint")}</p>
      {msg && (
        <p className={`text-[12px] mt-1 ${msg.ok ? "text-[#065F46]" : "text-[#DC2626]"}`}>
          {t(msg.key)}
          {msg.detail && <span className="block opacity-70 mt-0.5 text-[11px]">{msg.detail}</span>}
        </p>
      )}
    </div>
  );
}
