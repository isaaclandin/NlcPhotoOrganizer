import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  // GitHub Pages serves project sites from https://USERNAME.github.io/REPO_NAME/,
  // so every asset URL needs that /REPO_NAME/ prefix baked in at build time.
  // The deploy workflow sets VITE_BASE_PATH; local dev and Tauri builds
  // default to "/" (root), which is also correct for a custom-domain Pages
  // deployment.
  // @ts-expect-error process is a nodejs global
  base: process.env.VITE_BASE_PATH || "/",

  // 1. prevent Vite from obscuring rust errors (only matters for the legacy Tauri build)
  clearScreen: false,
  // 2. Vite's own default port, pinned explicitly (rather than left implicit)
  // so it never silently shifts to another port if 5173 is busy — the
  // Dropbox OAuth redirect URI for local dev is registered against this
  // exact origin. The legacy Tauri shell's devUrl (src-tauri/tauri.conf.json)
  // is kept in sync with this port too.
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
