import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { isTeamEmailConfigured } from "../lib/supabaseConfig";
import { signInTeam, signOutDevice, outcomeKey } from "../lib/auth";
import { readAuthExp, clearAuth } from "../lib/prefs";
import { useT } from "../lib/i18n";

// The team login. The password is checked by Supabase Auth — the browser
// never downloads it — and the database refuses everything to a visitor who is
// not logged in. On success the session is kept on this device for the login
// duration set in Settings; after that it is ended and the password is asked
// again.
type GateState = "checking" | "out" | "in";

// setTimeout cannot wait longer than ~24.8 days; re-check at least that often.
const MAX_TIMER_MS = 2_000_000_000;

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const [state, setState] = useState<GateState>("checking");
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ key: string; detail?: string } | null>(null);

  // Restore a saved session, if it is still within its login duration.
  useEffect(() => {
    let alive = true;
    (async () => {
      let hasSession = false;
      try {
        const { data } = await supabase.auth.getSession();
        hasSession = !!data.session;
      } catch {
        hasSession = false;
      }
      if (!alive) return;
      const exp = readAuthExp();
      if (hasSession && exp !== null && exp > Date.now()) {
        setState("in");
      } else {
        if (hasSession) await signOutDevice();
        else clearAuth();
        if (alive) setState("out");
      }
    })();

    // Logged out elsewhere (Settings, an expired or revoked session, an admin
    // password reset): show the login again.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && alive) {
        clearAuth();
        setState("out");
      }
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // End the session when the login duration runs out, even in a tab that
  // stays open.
  useEffect(() => {
    if (state !== "in") return;
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      const exp = readAuthExp();
      const left = exp === null ? 0 : exp - Date.now();
      if (left <= 0) {
        signOutDevice().then(() => setState("out"));
        return;
      }
      timer = setTimeout(arm, Math.min(left, MAX_TIMER_MS));
    };
    arm();
    return () => clearTimeout(timer);
  }, [state]);

  if (state === "in") return <>{children}</>;

  if (state === "checking") {
    return <div className="min-h-screen bg-[#0A1931]" />;
  }

  const submit = async () => {
    if (busy || !pwd) return;
    setBusy(true);
    setErr(null);
    const out = await signInTeam(pwd);
    setBusy(false);
    if (out.result === "ok") {
      setPwd("");
      setState("in");
    } else {
      setErr({ key: outcomeKey(out.result), detail: out.detail });
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
        {!isTeamEmailConfigured ? (
          <p className="text-[12px] text-[#DC2626]">{t("auth.noEmail")}</p>
        ) : (
          <>
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              value={pwd}
              onChange={(e) => {
                setPwd(e.target.value);
                setErr(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={t("auth.password")}
              className={`w-full h-11 rounded-full bg-[#F5F3EF] border px-4 text-[14px] text-center outline-none ${
                err ? "border-[#DC2626]" : "border-[#E8E6E1] focus:border-[#C9A96E]"
              }`}
            />
            {err && (
              <p className="text-[11px] text-[#DC2626] mt-2">
                {t(err.key)}
                {err.detail && <span className="block opacity-70 mt-0.5">{err.detail}</span>}
              </p>
            )}
            <button
              onClick={submit}
              disabled={busy || !pwd}
              className="mt-4 w-full h-11 rounded-full bg-[#0A1931] text-[#C9A96E] text-[13px] font-semibold tracking-wide hover:bg-[#112040] disabled:opacity-60"
            >
              {busy ? t("auth.checking") : t("auth.enter")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
