import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/JSHBUzgLmibojOxOY6mX0ak2Kpz1/social-images/social-1779787348007-WhatsApp_Image_2026-05-26_at_09.17.03_(1).webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/JSHBUzgLmibojOxOY6mX0ak2Kpz1/social-images/social-1779787348007-WhatsApp_Image_2026-05-26_at_09.17.03_(1).webp" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" },
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
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);
  return (
    <QueryClientProvider client={queryClient}>
      <RouteProgress />
      <Outlet />
      <Toaster richColors theme="dark" position="top-right" />
    </QueryClientProvider>
  );
}
