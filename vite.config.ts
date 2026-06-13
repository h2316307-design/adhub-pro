import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: false, // using public/manifest.json
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,otf}"],
        navigateFallbackDenylist: [/^\/~oauth/],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ].filter(Boolean),
  optimizeDeps: {
    exclude: ["pdf-lib", "@supabase/supabase-js"],
    include: ["react", "react-dom"],
    force: true
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: /^pako$/, replacement: path.resolve(__dirname, './src/libs/pako-shim.ts') },
    ],
  },
}));
