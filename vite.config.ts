// @lovable.dev/vite-tanstack-config already includes: tanstackStart, viteReact,
// tailwindcss, tsConfigPaths, cloudflare, componentTagger, env injection, etc.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  // Nitro is already installed by the shared configuration. Keeping a second
  // plugin here made every deployment build the server twice and exhausted
  // the build worker's memory. The deployment target is detected automatically.
});
