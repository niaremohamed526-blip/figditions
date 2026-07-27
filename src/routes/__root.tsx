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
import { FIGDITIONS_APP_ICON_VERSION, FIGDITIONS_SITE_LOGO_ABSOLUTE_URL, FIGDITIONS_SITE_LOGO_URL } from "@/lib/brand-assets";

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
      { rel: "manifest", href: `/manifest.webmanifest?v=${FIGDITIONS_APP_ICON_VERSION}` },
      { rel: "icon", type: "image/png", sizes: "192x192", href: `/pwa-192.png?v=${FIGDITIONS_APP_ICON_VERSION}` },
      { rel: "icon", type: "image/png", sizes: "512x512", href: `/pwa-512.png?v=${FIGDITIONS_APP_ICON_VERSION}` },
      { rel: "apple-touch-icon", sizes: "180x180", href: `/apple-touch-icon.png?v=${FIGDITIONS_APP_ICON_VERSION}` },
      { rel: "shortcut icon", href: `/favicon.ico?v=${FIGDITIONS_APP_ICON_VERSION}` },
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
              logo: FIGDITIONS_SITE_LOGO_ABSOLUTE_URL,
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

const SPLASH_CSS = `
#figditions-splash{position:fixed;inset:0;z-index:2147483647;background:#0D0A06;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:1;transition:opacity .5s ease-out}
#figditions-splash.splash-hidden{opacity:0;pointer-events:none}
#figditions-splash .splash-logo{width:140px;height:140px;object-fit:contain;animation:splashLogoIn .9s cubic-bezier(.34,1.56,.64,1) both;filter:drop-shadow(0 0 30px rgba(200,146,42,.8)) drop-shadow(0 0 60px rgba(200,146,42,.4)) brightness(1.2);mix-blend-mode:screen}
#figditions-splash .splash-name{margin-top:24px;font-family:Georgia,serif;font-size:28px;font-weight:700;color:#C8922A;letter-spacing:6px;text-transform:uppercase;animation:splashTextIn .8s .3s ease-out both;text-shadow:0 0 10px rgba(200,146,42,.5)}
#figditions-splash .splash-tagline{margin-top:10px;font-family:Georgia,serif;font-size:11px;color:rgba(200,146,42,.7);letter-spacing:2px;text-transform:uppercase;animation:splashTextIn .8s .5s ease-out both;text-align:center;padding:0 24px}
#figditions-splash .splash-dots{margin-top:48px;display:flex;gap:8px;animation:splashTextIn .5s .8s ease-out both}
#figditions-splash .splash-dot{width:6px;height:6px;border-radius:50%;background:#C8922A;animation:dotPulse 1.2s ease-in-out infinite}
#figditions-splash .splash-dot:nth-child(2){animation-delay:.2s}
#figditions-splash .splash-dot:nth-child(3){animation-delay:.4s}
@keyframes splashLogoIn{0%{opacity:0;transform:scale(.6)}60%{transform:scale(1.05)}100%{opacity:1;transform:scale(1)}}
@keyframes splashTextIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes dotPulse{0%,80%,100%{transform:scale(.6);opacity:.4}40%{transform:scale(1);opacity:1}}
`;

const SPLASH_JS = `(function(){try{var s=document.getElementById('figditions-splash');if(!s)return;var standalone=(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||window.navigator.standalone===true;var hold=standalone?10000:0;var fade=standalone?9500:0;if(!standalone){s.parentNode&&s.parentNode.removeChild(s);return;}setTimeout(function(){s.classList.add('splash-hidden');},fade);setTimeout(function(){s.parentNode&&s.parentNode.removeChild(s);},hold);}catch(e){var s2=document.getElementById('figditions-splash');s2&&s2.parentNode&&s2.parentNode.removeChild(s2);}})();`;

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
        <style dangerouslySetInnerHTML={{ __html: SPLASH_CSS }} />
      </head>
      <body>
        <div id="figditions-splash" aria-hidden="true">
          <img className="splash-logo" src={FIGDITIONS_SITE_LOGO_URL} alt="" />
          <div className="splash-name">FIGDITIONS</div>
          <div className="splash-tagline">Plateforme éditoriale · Afrique de l'Ouest</div>
          <div className="splash-dots">
            <span className="splash-dot" />
            <span className="splash-dot" />
            <span className="splash-dot" />
          </div>
        </div>
        <script dangerouslySetInnerHTML={{ __html: SPLASH_JS }} />
        {children}
        <Scripts />
      </body>
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
