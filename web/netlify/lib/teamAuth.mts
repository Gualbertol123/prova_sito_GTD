// Shared by the server functions: is this request from a logged-in team
// account? The caller's Supabase access token is checked with the database's
// own is_team_member() — the same rule every table uses.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";

/** False when the server lacks the Supabase settings (a deploy problem). */
export function supabaseConfigured(): boolean {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
}

export async function isTeamMember(authorization: string): Promise<boolean> {
  if (!/^Bearer\s+\S+$/.test(authorization)) return false;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  const res = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/is_team_member`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!res.ok) return false;
  return (await res.json()) === true;
}
