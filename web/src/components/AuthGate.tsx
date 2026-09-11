import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { DEFAULT_ACCESS_PASSWORD, DEFAULT_LOGIN_DAYS } from "../lib/constants";
import { readAuthExp, writeAuth } from "../lib/prefs";
import { useT } from "../lib/i18n";

// Soft, universal access gate. The shared password and login duration live in
// board_meta (editable in Settings) with hardcoded fallbacks, so the gate works
// even before the settings migration is applied. On success the login is cached
// in localStorage for the configured number of days.
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const [authed, setAuthed] = useState(() => {
    const exp = readAuthExp();
    return exp !== null && exp > Date.now();
  });
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState(false);

  // Fetched access settings (with fallbacks).
  const cfg = useRef({ password: DEFAULT_ACCESS_PASSWORD, days: DEFAULT_LOGIN_DAYS });

  useEffect(() => {
    if (authed) return;
    let cancelled = false;
    supabase
      .from("board_meta")
      .select("*")
      .eq("id", "main")
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        const row = data as Record<string, unknown>;
        cfg.current = {
          password: (row.access_password as string) || DEFAULT_ACCESS_PASSWORD,
          days: (row.login_days as number) || DEFAULT_LOGIN_DAYS,
        };
      });
    return () => {
      cancelled = true;
    };
  }, [authed]);

  if (authed) return <>{children}</>;

  const submit = () => {
    if (pwd === cfg.current.password) {
      writeAuth(Date.now() + cfg.current.days * 86400000);
      setAuthed(true);
    } else {
      setErr(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A1931] px-4">
      <div className="w-full max-w-[380px] bg-white rounded-[18px] p-7 text-center shadow-xl">
        <div className="w-14 h-14 rounded-full border-2 border-[#C9A96E] flex items-center justify-center mx-auto">
          <span className="font-trajan text-[#C9A96E] text-[20px]">G</span>
        </div>
        <h1 className="font-trajan text-[16px] uppercase tracking-widest text-[#0A1931] mt-4">
          {t("auth.title")}
        </h1>
        <p className="text-[12px] text-[#8A8A8A] mt-2 mb-5">{t("auth.prompt")}</p>
        <input
          type="password"
          autoFocus
          value={pwd}
          onChange={(e) => {
            setPwd(e.target.value);
            setErr(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={t("auth.password")}
          className={`w-full h-11 rounded-full bg-[#F5F3EF] border px-4 text-[14px] text-center outline-none ${
            err ? "border-[#DC2626]" : "border-[#E8E6E1] focus:border-[#C9A96E]"
          }`}
        />
        {err && <p className="text-[11px] text-[#DC2626] mt-2">{t("auth.wrong")}</p>}
        <button
          onClick={submit}
          className="mt-4 w-full h-11 rounded-full bg-[#0A1931] text-[#C9A96E] text-[13px] font-semibold tracking-wide hover:bg-[#112040]"
        >
          {t("auth.enter")}
        </button>
      </div>
    </div>
  );
}
