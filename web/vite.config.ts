import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Static SPA. No backend server — the app talks straight to Supabase from the
// browser. Served at a domain root on Netlify.
export default defineConfig({
  plugins: [react()],
  base: "/",
  server: { port: 5173 },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        // Keep the heavy, rarely-changing libraries in their own chunks so an
        // ordinary app deploy does not invalidate the browser's cached copy of
        // them — and a SuperDoc upgrade invalidates only SuperDoc's chunk.
        // Filenames stay content-hashed, so these are safe to cache forever
        // (see the immutable Cache-Control on /assets/* in netlify.toml).
        manualChunks: {
          superdoc: ["superdoc"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
    // SuperDoc alone is well over the default warning size; it is deliberately
    // split out and lazy-loaded, so the warning is noise here.
    chunkSizeWarningLimit: 1200,
  },
});
