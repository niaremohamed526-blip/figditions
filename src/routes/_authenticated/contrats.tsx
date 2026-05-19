import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/contrats")({
  component: () => (
    <PlaceholderPage icon={FileText} title="Contrats"
      description="Centralisez vos contrats d'édition et avenants." />
  ),
});
