import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Static SPA. No backend server — the app talks straight to Supabase from the
// browser. Served at a domain root on Netlify.
export default defineConfig(({ command, mode }) => {
  // A production build without the team e-mail would publish a site nobody
  // can log in to. Fail the build instead: Netlify then keeps the previous
  // deploy live.
  if (command === "build") {
    const env = { ...process.env, ...loadEnv(mode, process.cwd(), "VITE_") };
    const email = (env.VITE_TEAM_EMAIL ?? "").trim();
    if (!email.includes("@")) {
      throw new Error("VITE_TEAM_EMAIL is not set (the shared team account's e-mail). Add it in Netlify → Environment variables.");
    }
  }
  return {
    plugins: [react()],
    base: "/",
    server: { port: 5173 },
    build: {
      outDir: "dist",
      sourcemap: false,
      rollupOptions: {
        output: {
          // Keep the rarely-changing Supabase client in its own chunk so an
          // ordinary app deploy does not invalidate the browser's cached copy.
          // Filenames stay content-hashed, so this is safe to cache forever
          // (see the immutable Cache-Control on /assets/* in netlify.toml).
          manualChunks: {
            supabase: ["@supabase/supabase-js"],
          },
        },
      },
      // jsPDF (loaded only when a PDF is made) is a large chunk by itself.
      chunkSizeWarningLimit: 1200,
    },
  };
});
