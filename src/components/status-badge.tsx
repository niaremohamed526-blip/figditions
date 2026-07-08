import { cn } from "@/lib/utils";

const MAP: Record<string, { label: string; cls: string }> = {
  recu:        { label: "Reçu",        cls: "bg-slate-400/15 text-slate-300 border-slate-400/30" },
  relecture:   { label: "Relecture",   cls: "bg-blue-400/15 text-blue-300 border-blue-400/30 shadow-[0_0_10px_rgba(96,165,250,0.25)]" },
  epreuve_1:   { label: "Épreuve 1",   cls: "bg-blue-500/15 text-blue-400 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.25)]" },
  epreuve_2:   { label: "Épreuve 2",   cls: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.25)]" },
  epreuve_3:   { label: "Épreuve 3",   cls: "bg-violet-500/15 text-violet-400 border-violet-500/30 shadow-[0_0_10px_rgba(139,92,246,0.25)]" },
  epreuve_4:   { label: "Épreuve 4",   cls: "bg-purple-500/15 text-purple-400 border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.25)]" },
  maquette:    { label: "Maquette",    cls: "bg-orange-500/15 text-orange-400 border-orange-500/30 shadow-[0_0_10px_rgba(249,115,22,0.25)]" },
  echantillon: { label: "Échantillon", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.25)]" },
  impression:  { label: "Impression",  cls: "bg-pink-500/15 text-pink-400 border-pink-500/30 shadow-[0_0_10px_rgba(236,72,153,0.25)]" },
  publie:      { label: "Publié",      cls: "bg-green-500/15 text-green-400 border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.25)]" },
};

export function StatusBadge({ statut }: { statut: string }) {
  const s = MAP[statut] ?? { label: statut, cls: "bg-muted text-muted-foreground border-border" };
  const isActive = statut === "impression";
  return (
    <span
      key={statut}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium animate-[fade-in_0.3s_ease-out_both]",
        s.cls,
        isActive && "badge-pulse",
      )}
    >
      {s.label}
    </span>
  );
}

export const STATUT_OPTIONS = [
  { value: "recu",        label: "Reçu" },
  { value: "relecture",   label: "Relecture" },
  { value: "epreuve_1",   label: "Épreuve 1" },
  { value: "epreuve_2",   label: "Épreuve 2" },
  { value: "epreuve_3",   label: "Épreuve 3" },
  { value: "epreuve_4",   label: "Épreuve 4" },
  { value: "maquette",    label: "Maquette" },
  { value: "echantillon", label: "Échantillon" },
  { value: "impression",  label: "Impression" },
  { value: "publie",      label: "Publié" },
];

/** Ordered progression used by the stepper, dashboards and analytics. */
export const STATUT_PROGRESSION = STATUT_OPTIONS.map((o) => o.value);

/** Hex color per status, used by charts (donuts, bars). */
export const STATUT_COLOR: Record<string, string> = {
  recu:        "#94A3B8",
  relecture:   "#60A5FA",
  epreuve_1:   "#3B82F6",
  epreuve_2:   "#6366F1",
  epreuve_3:   "#8B5CF6",
  epreuve_4:   "#A855F7",
  maquette:    "#F97316",
  echantillon: "#F59E0B",
  impression:  "#EC4899",
  publie:      "#22C55E",
};

export const STATUT_LABEL: Record<string, string> = Object.fromEntries(
  STATUT_OPTIONS.map((o) => [o.value, o.label]),
);
