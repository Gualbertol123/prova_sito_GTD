// -----------------------------------------------------------------------------
// Supabase project connection.
//
// None of these values is a secret: the anon (publishable) key is designed to
// ship in the browser, and the team e-mail is only the login name of the
// shared account. Access is controlled by the team password (Supabase Auth)
// and Row Level Security policies in the database, not by hiding these.
//
// HOW TO FILL THIS IN (browser only):
//   1. Create a project at https://supabase.com (free).
//   2. Project Settings → API (or "Data API").
//   3. Copy the "Project URL" and the "anon public" key below — or provide them
//      as VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY build variables (Netlify).
//   4. The e-mail of the shared team user (Authentication → Users) goes in
//      VITE_TEAM_EMAIL.
//
// Environment variables, when present at build time, take precedence.
// -----------------------------------------------------------------------------

const env = import.meta.env;

export const SUPABASE_URL: string =
  env.VITE_SUPABASE_URL ?? "PASTE_PROJECT_URL_HERE";

export const SUPABASE_ANON_KEY: string =
  env.VITE_SUPABASE_ANON_KEY ?? "PASTE_ANON_PUBLIC_KEY_HERE";

export const TEAM_EMAIL: string =
  (env.VITE_TEAM_EMAIL ?? "PASTE_TEAM_EMAIL_HERE").trim();

export const isConfigured =
  !SUPABASE_URL.startsWith("PASTE_") && !SUPABASE_ANON_KEY.startsWith("PASTE_");

export const isTeamEmailConfigured = TEAM_EMAIL.includes("@") && !TEAM_EMAIL.startsWith("PASTE_");
