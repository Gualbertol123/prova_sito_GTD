import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabaseConfig";

// The team logs in with a real Supabase Auth account (see lib/auth.ts), and
// the database only answers to that logged-in session. The session (an access
// token plus a refresh token — never the password) is kept in localStorage so
// the login survives a reload; AuthGate ends it after the configured number
// of days, and "Log out this device" removes it. Board content itself is
// still never cached locally.
export const SESSION_STORAGE_KEY = "gtd-session";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: SESSION_STORAGE_KEY,
  },
});
