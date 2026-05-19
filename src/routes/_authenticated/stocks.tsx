import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";
import { Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/stocks")({
  component: () => (
    <PlaceholderPage icon={Package} title="Stocks"
      description="Suivez vos exemplaires en entrepôt et en distribution." />
  ),
});
