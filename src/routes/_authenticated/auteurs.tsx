import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";
import { PenLine } from "lucide-react";

export const Route = createFileRoute("/_authenticated/auteurs")({
  component: () => (
    <PlaceholderPage icon={PenLine} title="Auteurs"
      description="Gérez votre catalogue d'auteurs et leurs contrats." />
  ),
});
