import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";
import { Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/finances")({
  component: () => (
    <PlaceholderPage icon={Wallet} title="Finances"
      description="Ventes, royalties et paiements en un coup d'œil." />
  ),
});
