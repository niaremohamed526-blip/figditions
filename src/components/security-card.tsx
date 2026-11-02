import { Link } from "@tanstack/react-router";
import {
  ArrowRight, Building2, FileLock2, Gauge, KeyRound, Lock, LogOut, ScrollText,
  ServerCog, ShieldCheck, Smartphone, UsersRound, type LucideIcon,
} from "lucide-react";

type Protection = { icone: LucideIcon; titre: string; detail: string };

const GROUPES: { label: string; items: Protection[] }[] = [
  {
    label: "Vos données",
    items: [
      { icone: Lock, titre: "Connexion chiffrée", detail: "Tout passe en HTTPS entre votre appareil et nos serveurs." },
      { icone: ServerCog, titre: "Stockage chiffré", detail: "Vos données sont chiffrées sur nos serveurs (AES-256)." },
      { icone: Building2, titre: "Espace isolé", detail: "Chaque maison ne voit que ses propres données." },
      { icone: ScrollText, titre: "Journal financier", detail: "Chaque modification financière est tracée." },
    ],
  },
  {
    label: "Votre équipe et vos documents",
    items: [
      { icone: UsersRound, titre: "Accès sur mesure", detail: "Les droits de votre équipe se règlent page par page." },
      { icone: FileLock2, titre: "Manuscrits protégés", detail: "Partage avec filigrane et nombre de lectures limité." },
    ],
  },
  {
    label: "Votre compte",
    items: [
      { icone: KeyRound, titre: "Mots de passe protégés", detail: "Jamais enregistrés en clair." },
      { icone: LogOut, titre: "Appareil nettoyé", detail: "À la déconnexion, rien ne reste sur l'appareil." },
      { icone: Gauge, titre: "Anti-abus", detail: "L'usage de Pr. MEDMO et des imports est plafonné." },
      { icone: Smartphone, titre: "Paiement Mobile Money", detail: "Aucune carte bancaire enregistrée." },
    ],
  },
];

export function SecurityCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-6">
      <div className="flex items-start gap-2">
        <ShieldCheck className="h-5 w-5 shrink-0 text-primary mt-1" />
        <div>
          <h2 className="text-lg font-semibold">Vos données sont en sécurité</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Ce qui protège votre maison d'édition, à chaque instant.
          </p>
        </div>
      </div>

      {GROUPES.map((g) => (
        <section key={g.label} className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{g.label}</h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {g.items.map(({ icone: Icone, titre, detail }) => (
              <li key={titre} className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/40 p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icone className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-tight">{titre}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-snug">{detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <Link
        to="/politique-de-confidentialite"
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        Voir notre politique de confidentialité <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
