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
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{js,css,html,ico,svg}"],
        globIgnores: ["**/*.{png,jpg,jpeg,otf,ttf,sql,csv,bat,ps1}"],
        navigateFallbackDenylist: [/^\/~oauth/],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|otf|ttf|woff2)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-and-fonts-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
              },
            },
          },
        ],
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
