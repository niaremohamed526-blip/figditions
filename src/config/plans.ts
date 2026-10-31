import { PLANS as PLAN_LIMITS, PLAN_ORDER } from "@/lib/plans";

// Public view of the plans (homepage, signup, terms). Derived from
// src/lib/plans.ts so the offer always matches what the app enforces.
export interface PlanConfig {
  id: "starter" | "pro" | "business";
  name: string;
  tagline: string;
  priceMonthly: number;
  priceYearly: number;
  seats: number | null;
  seatsLabel: string;
  badge?: string;
  included: string[];
  excluded: string[];
  comingSoon?: string[];
}

export const PLANS: readonly PlanConfig[] = PLAN_ORDER.map((id) => {
  const p = PLAN_LIMITS[id];
  const seats = p.maxUsers === Infinity ? null : p.maxUsers;
  return {
    id,
    name: p.label,
    tagline: p.tagline,
    priceMonthly: p.monthlyFcfa,
    priceYearly: p.yearlyFcfa,
    seats,
    seatsLabel: seats === null ? "Utilisateurs illimités" : seats === 1 ? "1 utilisateur" : `Jusqu'à ${seats} utilisateurs`,
    badge: p.badge,
    included: p.included,
    excluded: p.excluded,
    comingSoon: p.comingSoon,
  };
});
