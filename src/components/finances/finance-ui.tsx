import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Pièces visuelles communes aux pages Finances : même allure partout. */

export const fmtMontant = (n: number) => Math.round(n).toLocaleString("fr-FR");

export function Eyebrow({ children, line, className }: { children: ReactNode; line?: boolean; className?: string }) {
  return (
    <p className={cn("flex items-center gap-3 text-[12px] uppercase tracking-[0.2em] text-muted-foreground", className)}>
      {line && <span className="h-px w-8 bg-[color:var(--gold)]" />}
      {children}
    </p>
  );
}

/** Grand montant en serif, unité plus petite. */
export function Montant({
  value, size = "lg", tone, className,
}: {
  value: number;
  size?: "md" | "lg" | "xl";
  tone?: "good" | "bad" | "gold";
  className?: string;
}) {
  return (
    <p className={cn(
      "font-wordmark-serif leading-none tabular-nums",
      size === "xl" ? "text-5xl sm:text-6xl" : size === "lg" ? "text-4xl" : "text-2xl",
      tone === "good" && "text-emerald-600 dark:text-emerald-400",
      tone === "bad" && "text-red-500",
      tone === "gold" && "text-[color:var(--gold)]",
      className,
    )}>
      {value < 0 ? "−" : ""}{fmtMontant(Math.abs(value))}
      <span className={cn("ml-1.5 font-sans text-muted-foreground", size === "md" ? "text-xs" : "text-sm")}>FCFA</span>
    </p>
  );
}

export function Panel({ children, className, accent }: { children: ReactNode; className?: string; accent?: boolean }) {
  return (
    <section className={cn(
      "rounded-2xl border bg-card",
      accent
        ? "relative overflow-hidden border-[color:var(--gold)]/30 bg-gradient-to-br from-[color:var(--gold)]/10 via-card to-card"
        : "border-border",
      className,
    )}>
      {children}
    </section>
  );
}

export function PanelHeader({ eyebrow, title, action }: { eyebrow: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 px-5 pt-5 pb-4">
      <div className="min-w-0">
        <Eyebrow>{eyebrow}</Eyebrow>
        {title && <h2 className="font-wordmark-serif mt-1 text-2xl font-normal leading-tight tracking-normal">{title}</h2>}
      </div>
      {action}
    </header>
  );
}

/** Pastille ronde avec une initiale ou une icône. */
export function Pastille({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold", className ?? "bg-muted text-muted-foreground")} aria-hidden>
      {children}
    </span>
  );
}

export const GOLD_BUTTON = "rounded-md bg-[#C8922A] text-white hover:bg-[#B5821F]";

export function Vide({ children }: { children: ReactNode }) {
  return <p className="border-t border-border px-5 py-10 text-center text-sm text-muted-foreground">{children}</p>;
}
