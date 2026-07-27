import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del } from "idb-keyval";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { RouteProgress } from "@/components/route-progress";
import { OfflineBanner } from "@/components/offline-banner";
import { registerPwa } from "@/lib/pwa-register";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center gradient-bg px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-[color:var(--gold)]">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La page que vous recherchez n'existe pas.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center gradient-bg px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Une erreur est survenue</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Réessayer
          </button>
          <a href="/" className="rounded-md border border-border px-4 py-2 text-sm">Accueil</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "FIGDITIONS Plateforme éditoriale" },
      { name: "description", content: "FIGDITIONS, La plateforme éditoriale de l'Afrique de l'Ouest. Gérez vos manuscrits, stocks et finances." },
      { property: "og:title", content: "FIGDITIONS Plateforme éditoriale" },
      { name: "twitter:title", content: "FIGDITIONS Plateforme éditoriale" },
      { property: "og:description", content: "FIGDITIONS, La plateforme éditoriale de l'Afrique de l'Ouest. Gérez vos manuscrits, stocks et finances." },
      { name: "twitter:description", content: "FIGDITIONS, La plateforme éditoriale de l'Afrique de l'Ouest. Gérez vos manuscrits, stocks et finances." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/JSHBUzgLmibojOxOY6mX0ak2Kpz1/social-images/social-1781365968538-Figditions_logo.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/JSHBUzgLmibojOxOY6mX0ak2Kpz1/social-images/social-1781365968538-Figditions_logo.webp" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/pwa-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/pwa-512.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Plus+Jakarta+Sans:wght@600;700&family=JetBrains+Mono:wght@500&display=swap" },
      { rel: "dns-prefetch", href: "https://yqufxcfllbyoadhedypc.supabase.co" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "FIGDITIONS",
              url: "https://figditions.xyz",
              logo: "https://figditions.xyz/favicon.ico",
              description: "Plateforme éditoriale tout-en-un pour les maisons d'édition d'Afrique de l'Ouest.",
            },
            {
              "@type": "WebSite",
              name: "FIGDITIONS",
              url: "https://figditions.xyz",
              inLanguage: "fr",
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  // Persist React Query cache to IndexedDB so all fetched data (manuscrits,
  // stocks, ventes, contrats…) survives reloads and works offline.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const persister = createAsyncStoragePersister({
      storage: {
        getItem: (k) => get(k).then((v) => v ?? null),
        setItem: (k, v) => set(k, v),
        removeItem: (k) => del(k),
      },
      key: "figditions-query-cache-v1",
      throttleTime: 1000,
    });
    const [unsubscribe] = persistQueryClient({
      queryClient,
      persister,
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      buster: "v1",
    });
    // Register the service worker (guarded — no-op in preview/dev/iframe).
    registerPwa();
    return () => unsubscribe();
  }, [queryClient]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <RouteProgress />
      <OfflineBanner />
      <Outlet />
      <Toaster richColors theme="dark" position="top-right" />
    </QueryClientProvider>
  );
}
