import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";
import { LockedPage } from "@/components/locked-page";
import { FileText } from "lucide-react";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { planFor } from "@/lib/plans";

export const Route = createFileRoute("/_authenticated/contrats")({
  component: ContratsPage,
});

function ContratsPage() {
  const { user } = useAuth();
  const { entreprise, loading } = useProfile(user?.id);
  if (loading) return null;
  const plan = planFor(entreprise?.plan);
  if (!plan.contrats) return <LockedPage feature="le générateur de contrats OHADA" requiredPlan="pro" />;
  return (
    <PlaceholderPage icon={FileText} title="Contrats"
      description="Centralisez vos contrats d'édition et avenants." />
  );
}
