// -----------------------------------------------------------------------------
// Supabase project connection.
//
// Neither value is a real secret: the anon (publishable) key is designed to
// ship in the browser. Access is controlled by Row Level Security policies in
// the database, not by hiding this key.
//
// HOW TO FILL THIS IN (browser only):
//   1. Create a project at https://supabase.com (free).
//   2. Project Settings → API (or "Data API").
//   3. Copy the "Project URL" and the "anon public" key below — or provide them
//      as VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY build variables (Netlify).
//
// Environment variables, when present at build time, take precedence.
// -----------------------------------------------------------------------------

const env = import.meta.env;

export const SUPABASE_URL: string =
  env.VITE_SUPABASE_URL ?? "PASTE_PROJECT_URL_HERE";

export const SUPABASE_ANON_KEY: string =
  env.VITE_SUPABASE_ANON_KEY ?? "PASTE_ANON_PUBLIC_KEY_HERE";

export const isConfigured =
  !SUPABASE_URL.startsWith("PASTE_") && !SUPABASE_ANON_KEY.startsWith("PASTE_");
