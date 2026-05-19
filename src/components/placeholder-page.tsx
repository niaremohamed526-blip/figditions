import type { LucideIcon } from "lucide-react";

export function PlaceholderPage({
  icon: Icon, title, description,
}: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-1">{description}</p>
      </header>
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="h-8 w-8" />
        </div>
        <h3 className="mt-4 font-semibold">Bientôt disponible</h3>
        <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
          Ce module est en cours de préparation. Revenez prochainement pour découvrir cette fonctionnalité.
        </p>
      </div>
    </div>
  );
}
