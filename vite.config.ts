// @lovable.dev/vite-tanstack-config already includes: tanstackStart, viteReact,
// tailwindcss, tsConfigPaths, cloudflare, componentTagger, env injection, etc.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      nitro({ preset: "vercel" }),
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null, // we register manually via src/lib/pwa-register.ts
        filename: "sw.js",
        strategies: "generateSW",
        devOptions: { enabled: false }, // no SW in dev/preview
        manifest: false, // we ship our own public/manifest.webmanifest
        workbox: {
          navigateFallback: "/",
          navigateFallbackDenylist: [
            /^\/api\//,
            /^\/~oauth/,
            /^\/lecture\//, // secure reader — always fresh
          ],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          importScripts: ["/push-sw.js"],
          globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff,woff2}"],
          runtimeCaching: [
            {
              // App HTML: network first so new deploys ship immediately
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "figditions-pages",
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              // Supabase REST (data reads) — network first with fallback to cache
              urlPattern: /^https:\/\/[a-z0-9]+\.supabase\.co\/rest\/v1\//,
              handler: "NetworkFirst",
              options: {
                cacheName: "figditions-supabase-rest",
                networkTimeoutSeconds: 6,
                expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 7 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // Supabase Storage public files (logos, covers)
              urlPattern: /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\//,
              handler: "CacheFirst",
              options: {
                cacheName: "figditions-supabase-storage",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // Google Fonts stylesheets
              urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
              handler: "StaleWhileRevalidate",
              options: { cacheName: "google-fonts-css" },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts-webfonts",
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
  },
});
