import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabaseConfig";

// persistSession:false + autoRefreshToken:false → the client keeps nothing in
// localStorage. We use only the anonymous key (no login), so there is no
// session to persist. Everything lives in memory for the session only, which
// satisfies the "nothing saved or cached locally" requirement.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
