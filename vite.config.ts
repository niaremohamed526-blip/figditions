// @lovable.dev/vite-tanstack-config already includes: tanstackStart, viteReact,
// tailwindcss, tsConfigPaths, cloudflare, componentTagger, env injection, etc.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      nitro({ preset: "vercel" }),
    ],
  },
});
