import { Link } from "@tanstack/react-router";
import { ShieldCheck, Check, ArrowRight } from "lucide-react";

export function SecurityCard() {
  const items = [
    "Sauvegarde automatique quotidienne",
    "Chiffrement AES-256 de vos fichiers",
    "Serveurs AWS Europe (Irlande)",
    "Récupération possible jusqu'à 7 jours",
  ];
  return (
    <div className="rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/5 to-[color:var(--gold)]/5 p-6 md:p-7">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            🔒 Vos données sont en sécurité
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Nous prenons la sécurité de vos données très au sérieux.
          </p>
          <ul className="mt-4 grid sm:grid-cols-2 gap-2.5">
            {items.map((t) => (
              <li key={t} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <Link
            to="/politique-de-confidentialite"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Voir notre politique de confidentialité <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
