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
    <div className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-4 animate-fade-in print:hidden">
      <div className="max-w-4xl mx-auto rounded-2xl bg-[#0D2137] border-t-2 border-[color:var(--gold)] shadow-2xl p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="h-10 w-10 rounded-xl bg-[color:var(--gold)]/15 text-[color:var(--gold)] flex items-center justify-center shrink-0">
          <Cookie className="h-5 w-5" />
        </div>
        <p className="text-sm text-muted-foreground flex-1 leading-relaxed">
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
