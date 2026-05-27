import type { AppPlan } from "@/hooks/use-auth";

export interface PlanLimits {
  key: AppPlan;
  label: string;
  maxManuscrits: number;
  maxBookstores: number;
  maxUsers: number;
  contrats: boolean;
  finances: boolean;
  conversions: boolean;
  exportPdf: boolean;
  exportEpub: boolean;
  prioritySupport: boolean;
  branding: boolean;
  subventions: boolean;
  badgeClass: string;
  monthlyFcfa: number;
  yearlyFcfa: number;
}

export const PLANS: Record<AppPlan, PlanLimits> = {
  starter: {
    key: "starter",
    label: "Starter",
    maxManuscrits: 5,
    maxBookstores: 2,
    maxUsers: 1,
    contrats: false,
    finances: false,
    exportPdf: false,
    exportEpub: false,
    prioritySupport: false,
    branding: false,
    subventions: false,
    badgeClass: "bg-muted text-muted-foreground border-border",
    monthlyFcfa: 0,
    yearlyFcfa: 0,
  },
  pro: {
    key: "pro",
    label: "Pro",
    maxManuscrits: Infinity,
    maxBookstores: Infinity,
    maxUsers: 3,
    contrats: true,
    finances: true,
    exportPdf: true,
    exportEpub: false,
    prioritySupport: false,
    branding: false,
    subventions: false,
    badgeClass: "bg-primary/15 text-primary border-primary/30",
    monthlyFcfa: 20000,
    yearlyFcfa: 200000,
  },
  business: {
    key: "business",
    label: "Business",
    maxManuscrits: Infinity,
    maxBookstores: Infinity,
    maxUsers: Infinity,
    contrats: true,
    finances: true,
    exportPdf: true,
    exportEpub: true,
    prioritySupport: true,
    branding: true,
    subventions: true,
    badgeClass: "bg-[color:var(--gold)]/15 text-[color:var(--gold)] border-[color:var(--gold)]/30",
    monthlyFcfa: 50000,
    yearlyFcfa: 500000,
  },
};

export const planFor = (p: AppPlan | undefined | null): PlanLimits => PLANS[(p ?? "starter") as AppPlan] ?? PLANS.starter;
