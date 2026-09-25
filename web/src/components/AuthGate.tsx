import { useEffect, useRef, useState } from "react";
import { supabase, SESSION_STORAGE_KEY } from "../lib/supabaseClient";
import { isTeamEmailConfigured } from "../lib/supabaseConfig";
import { signInTeam, signOutDevice, outcomeKey, checkSession, AUTH_CHECK_EVENT } from "../lib/auth";
import { readAuthExp, clearLoginState } from "../lib/prefs";
import { useT } from "../lib/i18n";

// The team login. The password is checked by Supabase Auth — the browser
// never downloads it — and the database refuses everything to a visitor who is
// not logged in. On success the session is kept on this device for the login
// duration set in Settings; after that it is ended and the password is asked
// again.
type GateState = "checking" | "out" | "in";

// setTimeout cannot wait longer than ~24.8 days; re-check at least that often.
const MAX_TIMER_MS = 2_000_000_000;
// How often an open tab re-checks that its session is still alive (a password
// reset by an admin revokes it; supabase-js does not always announce that).
const SESSION_CHECK_MS = 30_000;
// Give up waiting for Supabase at startup after this long (then decide from
// what is stored on the device) rather than showing a blank screen.
const STARTUP_TIMEOUT_MS = 8_000;

function hasStoredSession(): boolean {
  try {
    return !!localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return false;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const [state, setState] = useState<GateState>("checking");
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ key: string; detail?: string } | null>(null);
  // Guards against a double submit (Enter + click) before `busy` re-renders.
  const submitting = useRef(false);

  // Restore a saved session, if it is still within its login duration and the
  // account is still on the team list.
  useEffect(() => {
    let alive = true;
    (async () => {
      let exp = readAuthExp();
      if (exp === null && hasStoredSession()) {
        // Another tab may be half-way through logging in (session saved,
        // login time not yet): give it a moment instead of ending its session.
        await new Promise((r) => setTimeout(r, 3000));
        exp = readAuthExp();
      }
      const within = exp !== null && exp > Date.now();
      const session = await withTimeout(checkSession({ team: within }), STARTUP_TIMEOUT_MS, "unknown" as const);
      if (!alive) return;
      if (within && session !== "gone") {
        // "unknown" (offline): let the board show its own connection state;
        // the periodic check below logs out once the server says "gone".
        setState("in");
      } else {
        await signOutDevice();
        if (alive) setState("out");
      }
    })();

    // Logged out elsewhere (Settings, another tab, a revoked session): show
    // the login again.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && alive) {
        clearLoginState();
        setState("out");
      }
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // While logged in: end the session when the login duration runs out, and
  // re-check it periodically, when the tab comes back, and whenever a request
  // is refused — so a revoked login returns to this screen, not a broken board.
  useEffect(() => {
    if (state !== "in") return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const end = async () => {
      if (stopped) return;
      stopped = true;
      await signOutDevice();
      setState("out");
    };
    const arm = () => {
      const exp = readAuthExp();
      const left = exp === null ? 0 : exp - Date.now();
      if (left <= 0) return void end();
      timer = setTimeout(arm, Math.min(left, MAX_TIMER_MS));
    };
    const check = async () => {
      if (stopped) return;
      // A laptop that slept past the login duration: its timer did not fire.
      const exp = readAuthExp();
      if (exp === null || exp <= Date.now()) return void end();
      if ((await checkSession({ team: true })) === "gone") await end();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    arm();
    const poll = setInterval(check, SESSION_CHECK_MS);
    window.addEventListener(AUTH_CHECK_EVENT, check);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(poll);
      window.removeEventListener(AUTH_CHECK_EVENT, check);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [state]);

  if (state === "in") return <>{children}</>;

  if (state === "checking") {
    return <div className="min-h-screen bg-[#0A1931]" />;
  }

  const submit = async () => {
    if (submitting.current || !pwd) return;
    submitting.current = true;
    setBusy(true);
    setErr(null);
    const out = await signInTeam(pwd);
    submitting.current = false;
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
