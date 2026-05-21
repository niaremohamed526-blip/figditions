import { Link } from "@tanstack/react-router";
import { Lock, Check, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/plans";
import type { AppPlan } from "@/hooks/use-auth";

export function LockedPage({ feature, requiredPlan = "pro" }: { feature: string; requiredPlan?: AppPlan }) {
  const plans: AppPlan[] = ["starter", "pro", "business"];
  return (
    <div className="max-w-3xl mx-auto py-12">
      <div className="rounded-2xl border border-border bg-card p-10 text-center">
        <div className="mx-auto h-20 w-20 rounded-2xl bg-[color:var(--gold)]/15 text-[color:var(--gold)] flex items-center justify-center">
          <Lock className="h-10 w-10" />
        </div>
        <h1 className="mt-6 text-2xl md:text-3xl font-bold">
          Cette fonctionnalité est disponible à partir du plan {PLANS[requiredPlan].label}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Débloquez <span className="text-foreground font-medium">{feature}</span> en passant à un plan supérieur.
        </p>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left py-2 px-3 font-medium">Plan</th>
                <th className="py-2 px-3 font-medium">Manuscrits</th>
                <th className="py-2 px-3 font-medium">{feature}</th>
                <th className="py-2 px-3 font-medium">Utilisateurs</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => {
                const pl = PLANS[p];
                const hasFeature = feature.toLowerCase().includes("contrat") ? pl.contrats : pl.finances;
                return (
                  <tr key={p} className="border-t border-border">
                    <td className="py-3 px-3 text-left font-medium">{pl.label}</td>
                    <td className="py-3 px-3">{pl.maxManuscrits === Infinity ? "∞" : pl.maxManuscrits}</td>
                    <td className="py-3 px-3">
                      {hasFeature
                        ? <Check className="h-4 w-4 text-primary inline" />
                        : <X className="h-4 w-4 text-muted-foreground inline" />}
                    </td>
                    <td className="py-3 px-3">{pl.maxUsers === Infinity ? "∞" : pl.maxUsers}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Link to="/parametres" hash="plan" className="inline-block mt-8">
          <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow">
            <Sparkles className="h-4 w-4" /> Upgrader maintenant
          </Button>
        </Link>
      </div>
    </div>
  );
}
