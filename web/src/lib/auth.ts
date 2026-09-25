import { supabase, SESSION_STORAGE_KEY } from "./supabaseClient";
import { TEAM_EMAIL } from "./supabaseConfig";
import { DEFAULT_LOGIN_DAYS } from "./constants";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { clearLoginState, writeAuth } from "./prefs";

// Everything that touches a password goes through here. The browser never
// holds a password it did not just receive from the person typing it:
//   - the team login is a real Supabase Auth account (one shared e-mail, set
//     at build time), so the database only answers to a logged-in session;
//   - the Reflection and Tracking passwords are bcrypt hashes checked by
//     database functions (supabase/migration-011-auth-step1.sql).

/** Machine-readable outcome, turned into a sentence by the caller (i18n). */
export type AuthResult =
  | "ok"
  | "wrong"
  | "locked"
  | "unknown"
  | "invalid"
  | "forbidden"
  | "rateLimited"
  | "notTeam"
  | "notUpgraded"
  | "unsupported"
  | "failed";

export interface AuthOutcome {
  result: AuthResult;
  /** Server text for unexpected failures, shown under the friendly message. */
  detail?: string;
}

function errText(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

// A missing database function means migration 011 has not been run yet.
function isMissingFunction(e: { code?: string; message?: string } | null): boolean {
  return !!e && (e.code === "PGRST202" || e.code === "42883" || /could not find the function/i.test(e.message ?? ""));
}

function authFailure(e: { status?: number; code?: string; message?: string }): AuthOutcome {
  if (e.status === 429 || e.code === "over_request_rate_limit") return { result: "rateLimited" };
  // Dashboard options the app does not support (README §11 lists them).
  if (e.code === "captcha_failed" || e.code === "insufficient_aal" || e.code === "email_not_confirmed") {
    return { result: "unsupported", detail: e.message };
  }
  if (e.code === "invalid_credentials" || (!e.code && /invalid login credentials/i.test(e.message ?? ""))) {
    return { result: "wrong" };
  }
  return { result: "failed", detail: e.message };
}

/** Log this device in with the shared team password. */
export async function signInTeam(password: string): Promise<AuthOutcome> {
  try {
    const { error } = await supabase.auth.signInWithPassword({ email: TEAM_EMAIL, password });
    if (error) return authFailure(error);

    // The account must also be on the database's team list. An account that
    // is not (or a database not upgraded yet) is logged straight back out.
    const team = await supabase.rpc("is_team_member");
    if (team.error || team.data !== true) {
      await supabase.auth.signOut({ scope: "local" });
      if (team.error) {
        return isMissingFunction(team.error)
          ? { result: "notUpgraded" }
          : { result: "failed", detail: team.error.message };
      }
      return { result: "notTeam" };
    }

    // How long this device stays logged in (Settings → Login duration).
    let days = DEFAULT_LOGIN_DAYS;
    const meta = await supabase.from("board_meta").select("login_days").eq("id", "main").maybeSingle();
    const n = (meta.data as { login_days?: number } | null)?.login_days;
    if (typeof n === "number" && n > 0) days = n;
    writeAuth(Date.now() + days * 86400000);
    return { result: "ok" };
  } catch (e) {
    return { result: "failed", detail: errText(e) };
  }
}

/** Forget the login on this device only (and its Reflection logins). */
export async function signOutDevice(): Promise<void> {
  clearLoginState();
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    /* offline — cleared below anyway */
  }
  // supabase-js keeps a session whose refresh was refused (it returns early
  // from signOut); remove it outright so no dead token stays on the device.
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(`${SESSION_STORAGE_KEY}-user`);
  } catch {
    /* storage disabled */
  }
}

/**
 * Change the shared team password. Needs the current one, and logs every
 * other device out (they will need the new password).
 */
export async function changeTeamPassword(current: string, next: string): Promise<AuthOutcome> {
  try {
    const check = await supabase.auth.signInWithPassword({ email: TEAM_EMAIL, password: current });
    if (check.error) return authFailure(check.error);

    // current_password satisfies Supabase's optional "Require current
    // password when updating" setting; it is ignored when that is off.
    const upd = await supabase.auth.updateUser({ password: next, current_password: current });
    if (upd.error) {
      if (upd.error.status === 429) return { result: "rateLimited" };
      if (upd.error.code === "current_password_mismatch") return { result: "wrong" };
      if (upd.error.status === 422 || /password/i.test(upd.error.message)) {
        return { result: "invalid", detail: upd.error.message };
      }
      return { result: "failed", detail: upd.error.message };
    }

    await supabase.auth.signOut({ scope: "others" });
    return { result: "ok" };
  } catch (e) {
    return { result: "failed", detail: errText(e) };
  }
}

async function rpcResult(fn: string, args: Record<string, string>): Promise<AuthOutcome> {
  try {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) {
      return isMissingFunction(error) ? { result: "notUpgraded" } : { result: "failed", detail: error.message };
    }
    const known: AuthResult[] = ["ok", "wrong", "locked", "unknown", "invalid", "forbidden"];
    return known.includes(data as AuthResult) ? { result: data as AuthResult } : { result: "failed", detail: String(data) };
  } catch (e) {
    return { result: "failed", detail: errText(e) };
  }
}

/** Check a member's personal Reflection password on the server. */
export function reflectionLogin(member: string, password: string): Promise<AuthOutcome> {
  return rpcResult("reflection_login", { p_member: member, p_password: password });
}

/** Change a member's Reflection password (needs the current one). */
export function reflectionChangePassword(member: string, current: string, next: string): Promise<AuthOutcome> {
  return rpcResult("reflection_change_password", { p_member: member, p_current: current, p_new: next });
}

/** Check the Tracking tab password on the server. */
export function trackingLogin(password: string): Promise<AuthOutcome> {
  return rpcResult("tracking_login", { p_password: password });
}

// Ask the login gate to re-check the session now (e.g. after a request was
// refused), instead of waiting for its next periodic check.
export const AUTH_CHECK_EVENT = "gtd-auth-check";
export function requestAuthCheck(): void {
  window.dispatchEvent(new Event(AUTH_CHECK_EVENT));
}

export type SessionState = "valid" | "gone" | "unknown";

/**
 * Is this device's session still alive? "gone" when Supabase has no usable
 * session any more (revoked by a password reset, refresh token rejected, or
 * the account removed from the team list); "unknown" when it could not tell
 * (offline, server error) — never log someone out for a network blip.
 */
export async function checkSession(opts: { team?: boolean } = {}): Promise<SessionState> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (!data.session) return error && isAuthRetryableFetchError(error) ? "unknown" : "gone";
    if (opts.team) {
      const team = await supabase.rpc("is_team_member");
      if (team.error) return "unknown";
      if (team.data === false) return "gone";
    }
    return "valid";
  } catch {
    return "unknown";
  }
}

/** i18n key for an outcome, for the message shown to the person. */
export function outcomeKey(r: AuthResult): string {
  return `authr.${r}`;
}
