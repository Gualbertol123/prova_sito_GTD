import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Static SPA. No backend server — the app talks straight to Supabase from the
// browser. Served at a domain root on Netlify.
export default defineConfig({
  plugins: [react()],
  base: "/",
  server: { port: 5173 },
  build: { outDir: "dist", sourcemap: false },
});
