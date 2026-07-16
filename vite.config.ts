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
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: { enabled: false },
      includeAssets: ["favicon.svg", "lumen-orrery.png", "apple-touch-icon.png"],
      manifest: {
        name: "Lumen Planner",
        short_name: "Lumen",
        description: "Hábitos, agenda, metas e projetos em um só lugar.",
        theme_color: "#0d0d0d",
        background_color: "#0d0d0d",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/lumen-orrery.png", sizes: "192x192", type: "image/png" },
          { src: "/lumen-orrery.png", sizes: "512x512", type: "image/png" },
          { src: "/lumen-orrery.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api/],
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webp,woff2}"],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "lumen-html",
              networkTimeoutSeconds: 3,
              // Only pin actual 200s into the cache — otherwise a transient
              // 404/500 (e.g. mid-deploy CDN propagation) gets cached and
              // served forever on that route, even after the site recovers.
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ request }) =>
              ["style", "script", "worker", "image", "font"].includes(request.destination),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "lumen-assets" },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: "CacheFirst",
            options: {
              cacheName: "lumen-fonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
}));
