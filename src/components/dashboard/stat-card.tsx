import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/** Petit point coloré devant une ligne de détail. */
export function Dot({ tone = "gold" }: { tone?: "gold" | "blue" | "grey" | "green" }) {
  const bg =
    tone === "gold"
      ? "var(--gold)"
      : tone === "blue"
        ? "oklch(0.68 0.13 240)"
        : tone === "green"
          ? "oklch(0.72 0.15 150)"
          : "oklch(0.6 0.01 80)";
  return <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: bg }} />;
}

/** Ligne de détail : point + texte. */
export function BreakdownLine({ tone, children }: { tone?: "gold" | "blue" | "grey" | "green"; children: ReactNode }) {
  return (
    <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
      <Dot tone={tone} />
      <span className="min-w-0 truncate">{children}</span>
    </p>
  );
}

/** Barre de progression fine (or) ou barre scindée (deux segments). */
export function MiniBar({
  segments,
  className,
}: {
  segments: { value: number; tone?: "gold" | "blue" | "grey" | "green" }[];
  className?: string;
}) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0) || 1;
  const fill = (tone?: string) =>
    tone === "blue"
      ? "oklch(0.68 0.13 240)"
      : tone === "grey"
        ? "color-mix(in oklab, var(--gold) 22%, transparent)"
        : tone === "green"
          ? "oklch(0.72 0.15 150)"
          : "linear-gradient(90deg, #E7B958, #C8922A)";
  return (
    <div
      className={cn("mt-3 flex h-1 w-full overflow-hidden rounded-full", className)}
      style={{ background: "color-mix(in oklab, var(--gold) 10%, transparent)" }}
    >
      {segments.map((s, i) => (
        <span key={i} style={{ width: `${(Math.max(0, s.value) / total) * 100}%`, background: fill(s.tone) }} />
      ))}
    </div>
  );
}

/** Anneau de progression (carte « En cours »). */
export function ProgressRing({ value, total, label }: { value: number; total: number; label?: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="mt-1 flex items-center gap-3">
      <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" stroke="color-mix(in oklab, var(--gold) 12%, transparent)" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          stroke="var(--gold)"
          strokeDasharray={c}
          strokeDashoffset={c - (c * pct) / 100}
          style={{ transition: "stroke-dashoffset 1.2s ease-out" }}
        />
      </svg>
      <div className="min-w-0">
        <p className="dash-num">{value.toLocaleString("fr-FR")}</p>
        {label && <p className="text-[12px] text-muted-foreground">{label}</p>}
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  icon: ReactNode;
  to?: string;
  search?: Record<string, unknown>;
  delay?: number;
  alert?: boolean;
  pulseIcon?: boolean;
  trend?: string | null;
  children: ReactNode;
}

/** Carte métrique du tableau de bord (style SaaS premium, thème or). */
export function StatCard({
  label,
  icon,
  to,
  search,
  delay = 0,
  alert,
  pulseIcon,
  trend,
  children,
}: StatCardProps) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          {trend && <p className="text-[11px] font-semibold text-[color:oklch(0.75_0.15_150)]">{trend}</p>}
        </div>
        <div className={cn("dash-icon", pulseIcon && "dash-icon-pulse")}>{icon}</div>
      </div>
      <div className="mt-3">{children}</div>
    </>
  );

  const cls = cn(
    "dash-card block animate-[fade-up_0.5s_ease-out_both]",
    alert && "dash-card-alert",
    to && "cursor-pointer",
  );

  if (to) {
    return (
      <Link to={to} search={search as never} className={cls} style={{ animationDelay: `${delay}ms` }}>
        {inner}
      </Link>
    );
  }
  return (
    <div className={cls} style={{ animationDelay: `${delay}ms` }}>
      {inner}
    </div>
  );
}

/** Squelette au format des nouvelles cartes. */
export function StatCardSkeletonV2() {
  return (
    <div className="dash-card">
      <div className="flex items-start justify-between">
        <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        <div className="h-9 w-9 animate-pulse rounded-[10px] bg-muted" />
      </div>
      <div className="mt-4 h-8 w-24 animate-pulse rounded bg-muted" />
      <div className="mt-3 h-3 w-32 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-3 w-24 animate-pulse rounded bg-muted" />
      <div className="mt-3 h-1 w-full animate-pulse rounded-full bg-muted" />
    </div>
  );
}

/** Mini sparkline (aperçu replié des analytiques). */
export function Sparkline({
  data,
  label,
  tone = "gold",
}: {
  data: number[];
  label: string;
  tone?: "gold" | "blue" | "green";
}) {
  const w = 56;
  const h = 18;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / Math.max(1, data.length - 1)) * w},${h - ((v - min) / span) * h}`)
    .join(" ");
  const stroke = tone === "blue" ? "oklch(0.68 0.13 240)" : tone === "green" ? "oklch(0.72 0.15 150)" : "var(--gold)";
  return (
    <span className="flex items-center gap-1.5">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
        <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
    </span>
  );
}
