import { cn } from "@/lib/utils";

const MAP: Record<string, { label: string; cls: string }> = {
  recu:       { label: "Reçu",       cls: "bg-muted/60 text-muted-foreground border-border" },
  lecture:    { label: "Lecture",    cls: "bg-blue-500/15 text-blue-400 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.25)]" },
  correction: { label: "Correction", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30 shadow-[0_0_10px_rgba(234,179,8,0.25)]" },
  maquette:   { label: "Maquette",   cls: "bg-orange-500/15 text-orange-400 border-orange-500/30 shadow-[0_0_10px_rgba(249,115,22,0.25)]" },
  impression: { label: "Impression", cls: "bg-purple-500/15 text-purple-400 border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.25)]" },
  publie:     { label: "Publié",     cls: "bg-primary/15 text-primary border-primary/40 shadow-[0_0_10px_var(--color-primary)]" },
};

export function StatusBadge({ statut }: { statut: string }) {
  const s = MAP[statut] ?? { label: statut, cls: "bg-muted text-muted-foreground border-border" };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", s.cls)}>
      {s.label}
    </span>
  );
}

export const STATUT_OPTIONS = [
  { value: "recu", label: "Reçu" },
  { value: "lecture", label: "Lecture" },
  { value: "correction", label: "Correction" },
  { value: "maquette", label: "Maquette" },
  { value: "impression", label: "Impression" },
  { value: "publie", label: "Publié" },
];
