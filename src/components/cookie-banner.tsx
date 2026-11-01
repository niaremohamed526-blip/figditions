import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Cookie, X } from "lucide-react";

const KEY = "figditions.cookies.accepted";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(KEY)) {
      const id = setTimeout(() => setVisible(true), 400);
      return () => clearTimeout(id);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 px-4 pb-4 print:hidden" style={{ zIndex: 9999, animation: "cookie-slide-up 0.4s ease-out" }}>
      <style>{`@keyframes cookie-slide-up { from { transform: translateY(120%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>

      <div className="max-w-3xl mx-auto rounded-xl bg-card/95 backdrop-blur border border-border shadow-xl px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="hidden sm:flex h-8 w-8 rounded-lg bg-[color:var(--gold)]/15 text-[color:var(--gold)] items-center justify-center shrink-0">
          <Cookie className="h-4 w-4" />
        </div>
        <p className="text-xs text-muted-foreground flex-1 leading-relaxed">
          FIGDITIONS utilise uniquement des cookies essentiels au fonctionnement du site.
          Aucun cookie publicitaire.
        </p>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Link to="/politique-de-confidentialite" className="flex-1 md:flex-initial">
            <Button variant="outline" size="sm" className="w-full">En savoir plus</Button>
          </Link>
          <Button
            size="sm"
            onClick={accept}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1 md:flex-initial"
          >
            Accepter
          </Button>
          <button
            onClick={accept}
            aria-label="Fermer"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-background/50 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
