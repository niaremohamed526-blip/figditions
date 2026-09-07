import { cn } from "@/lib/utils";

/** Accent bleu-gris réservé aux livres étrangers (distincts de l'or maison). */
export const ETRANGER_ACCENT = "#6B9BD1";

export const DISTRIBUTION_OPTIONS = [
  { value: "disponible", label: "Disponible à la vente" },
  { value: "rupture", label: "Rupture de stock" },
  { value: "retire", label: "Retiré de la distribution" },
] as const;

const MAP: Record<string, { label: string; cls: string }> = {
  disponible: { label: "Disponible à la vente", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  rupture: { label: "Rupture de stock", cls: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  retire: { label: "Retiré de la distribution", cls: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
};

export function DistributionBadge({ statut, className }: { statut: string | null | undefined; className?: string }) {
  const s = MAP[statut ?? "disponible"] ?? MAP.disponible;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        s.cls,
        className,
      )}
    >
      {s.label}
    </span>
  );
}

export function distributionLabel(statut: string | null | undefined): string {
  return (MAP[statut ?? "disponible"] ?? MAP.disponible).label;
}
