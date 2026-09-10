import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// During local dev, proxy /api to the Azure Functions host (func start on :7071)
// so the frontend and API share an origin exactly like Azure Static Web Apps.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:7071",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
