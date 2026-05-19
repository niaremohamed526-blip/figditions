import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";
import { Settings } from "lucide-react";

export const Route = createFileRoute("/_authenticated/parametres")({
  component: () => (
    <PlaceholderPage icon={Settings} title="Paramètres"
      description="Préférences de la maison d'édition et de votre compte." />
  ),
});
