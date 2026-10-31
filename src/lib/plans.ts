import type { AppPlan } from "@/hooks/use-auth";

// Single source of truth for plans: the limits the app enforces AND the
// wording shown on the homepage, signup, terms and upgrade screens. Change a
// plan here and every page follows, so the offer can never contradict the app.

export interface PlanLimits {
  key: AppPlan;
  label: string;
  tagline: string;
  badge?: string;
  maxManuscrits: number;
  maxBookstores: number;
  maxUsers: number;
  contrats: boolean;
  /** Own contract templates, themes and import of an existing contract. */
  modelesContrat: boolean;
  finances: boolean;
  conversions: boolean;
  /** ePub/MOBI conversions per calendar month (CloudConvert costs per job). */
  conversionsParMois: number;
  /** Secure PDF reading links created per calendar month. */
  partagesParMois: number;
  /** Pr. MEDMO questions per calendar month (each answer costs AI requests). */
  medmoParMois: number;
  exportPdf: boolean;
  exportEpub: boolean;
  prioritySupport: boolean;
  branding: boolean;
  subventions: boolean;
  badgeClass: string;
  monthlyFcfa: number;
  yearlyFcfa: number;
  included: string[];
  excluded: string[];
  comingSoon?: string[];
}

export const PLANS: Record<AppPlan, PlanLimits> = {
  starter: {
    key: "starter",
    label: "Starter",
    tagline: "Pour démarrer votre maison d'édition",
    maxManuscrits: 5,
    maxBookstores: 2,
    maxUsers: 1,
    contrats: false,
    modelesContrat: false,
    finances: false,
    conversions: false,
    conversionsParMois: 0,
    partagesParMois: 0,
    medmoParMois: 20,
    exportPdf: false,
    exportEpub: false,
    prioritySupport: false,
    branding: false,
    subventions: false,
    badgeClass: "bg-muted text-muted-foreground border-border",
    monthlyFcfa: 0,
    yearlyFcfa: 0,
    included: [
      "1 utilisateur",
      "Jusqu'à 5 manuscrits (10 étapes éditoriales)",
      "Gestion des auteurs",
      "Stock interne",
      "Dépôts dans 2 librairies",
      "Estimateur de coûts d'impression",
      "Répertoire des imprimeries",
      "Pr. MEDMO : 20 questions par mois",
      "Installable sur téléphone (PWA)",
      "Support par email",
    ],
    excluded: [
      "Contrats & Droits",
      "Finances & Royalties",
      "Partage PDF sécurisé",
      "Conversion ePub & MOBI",
    ],
  },
  pro: {
    key: "pro",
    label: "Pro",
    tagline: "Pour les maisons d'édition en croissance",
    badge: "Le plus populaire",
    maxManuscrits: Infinity,
    maxBookstores: Infinity,
    maxUsers: 3,
    contrats: true,
    modelesContrat: false,
    finances: true,
    conversions: true,
    conversionsParMois: 5,
    partagesParMois: 10,
    medmoParMois: 300,
    exportPdf: true,
    exportEpub: true,
    prioritySupport: false,
    branding: false,
    subventions: false,
    badgeClass: "bg-primary/15 text-primary border-primary/30",
    monthlyFcfa: 20000,
    yearlyFcfa: 200000,
    included: [
      "Tout ce qui est dans Starter",
      "Jusqu'à 3 utilisateurs",
      "Manuscrits illimités",
      "Dépôts dans un nombre illimité de librairies",
      "Contrats & Droits en PDF (modèle standard)",
      "Finances & Royalties complètes",
      "Bordereaux de vente",
      "Partage PDF sécurisé : 10 liens par mois",
      "Conversion ePub & MOBI : 5 par mois",
      "Pr. MEDMO : 300 questions par mois",
      "Support par email",
    ],
    excluded: [],
  },
  business: {
    key: "business",
    label: "Business",
    tagline: "Pour les grandes maisons d'édition",
    badge: "Complet",
    maxManuscrits: Infinity,
    maxBookstores: Infinity,
    maxUsers: Infinity,
    contrats: true,
    modelesContrat: true,
    finances: true,
    conversions: true,
    conversionsParMois: 30,
    partagesParMois: Infinity,
    medmoParMois: Infinity,
    exportPdf: true,
    exportEpub: true,
    prioritySupport: true,
    branding: true,
    subventions: false,
    badgeClass: "bg-[color:var(--gold)]/15 text-[color:var(--gold)] border-[color:var(--gold)]/30",
    monthlyFcfa: 50000,
    yearlyFcfa: 500000,
    included: [
      "Tout ce qui est dans Pro",
      "Utilisateurs illimités",
      "Vos propres modèles de contrat, couleurs et styles",
      "Import de votre contrat existant par Pr. MEDMO",
      "Partage PDF sécurisé illimité",
      "Conversion ePub & MOBI : 30 par mois",
      "Pr. MEDMO illimité (usage raisonnable)",
      "Support prioritaire sur WhatsApp",
    ],
    excluded: [],
    comingSoon: ["Assistant subventions", "Accès API"],
  },
};

export const PLAN_ORDER: AppPlan[] = ["starter", "pro", "business"];

export const planFor = (p: AppPlan | undefined | null): PlanLimits => PLANS[(p ?? "starter") as AppPlan] ?? PLANS.starter;

/** First day of the current calendar month (UTC), for monthly quotas. */
export const debutDuMois = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();

export const illimite = (n: number) => n === Infinity;
