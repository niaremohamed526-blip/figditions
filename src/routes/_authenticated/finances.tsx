import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";
import { LockedPage } from "@/components/locked-page";
import { Wallet } from "lucide-react";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { planFor } from "@/lib/plans";

export const Route = createFileRoute("/_authenticated/finances")({
  component: FinancesPage,
});

function FinancesPage() {
  const { user } = useAuth();
  const { entreprise, loading } = useProfile(user?.id);
  if (loading) return null;
  const plan = planFor(entreprise?.plan);
  if (!plan.finances) return <LockedPage feature="le module finances & royalties" requiredPlan="pro" />;
  return (
    <PlaceholderPage icon={Wallet} title="Finances"
      description="Ventes, royalties et paiements en un coup d'œil." />
  );
}
