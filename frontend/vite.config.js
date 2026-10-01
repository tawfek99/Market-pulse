import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves project sites from a subpath (e.g. "/market-pulse/"),
// so the asset base has to be configurable at build time. `VITE_BASE` comes
// from the deploy workflow (it uses the value reported by `configure-pages`);
// it defaults to "/" for local dev and root-hosted deploys.
function normalizeBase(value) {
  if (!value || value === "/") return "/";
  return `/${value.replace(/^\/+|\/+$/g, "")}/`;
}

// https://vitejs.dev/config/
export default defineConfig({
  base: normalizeBase(process.env.VITE_BASE),
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API calls to the FastAPI backend during development,
    // so the frontend can use relative `/api` paths without CORS issues.
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
