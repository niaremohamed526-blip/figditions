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

export const PLANS: readonly PlanConfig[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "Pour démarrer votre maison d'édition",
    priceMonthly: 0,
    priceYearly: 0,
    seats: 1,
    seatsLabel: "1 utilisateur",
    included: [
      "Tableau de bord",
      "Jusqu'à 5 manuscrits (10 étapes éditoriales)",
      "Gestion des auteurs",
      "Stock interne basique",
      "Suivi des dépôts (2 librairies max)",
      "Estimateur de coûts FCFA",
      "Mode hors-ligne (PWA)",
    ],
    excluded: [
      "Contrats & Droits",
      "Finances & Royalties",
      "Partage PDF sécurisé",
      "Conversion ePub & MOBI",
      "Analytiques avancées",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Pour les maisons d'édition en croissance",
    priceMonthly: 20000,
    priceYearly: 200000,
    seats: 3,
    seatsLabel: "Jusqu'à 3 utilisateurs",
    badge: "Le plus populaire",
    included: [
      "Tout ce qui est dans Starter",
      "Manuscrits illimités",
      "Stock interne complet",
      "Dépôts illimités (librairies)",
      "Contrats & Droits + génération PDF",
      "Finances & Royalties complètes",
      "Bordereaux de vente",
      "Partage PDF sécurisé (10 liens/mois)",
      "Conversion ePub & MOBI",
      "Répertoire des imprimeries",
      "Analytiques avancées",
      "Support prioritaire",
    ],
    excluded: [],
  },
  {
    id: "business",
    name: "Business",
    tagline: "Pour les grandes maisons d'édition",
    priceMonthly: 50000,
    priceYearly: 500000,
    seats: null,
    seatsLabel: "Utilisateurs illimités",
    badge: "Complet",
    included: [
      "Tout ce qui est dans Pro",
      "Utilisateurs illimités",
      "Partage PDF sécurisé illimité",
      "Conversion ePub & MOBI illimitée",
      "Bordereaux avancés",
      "Branding personnalisé",
      "Support prioritaire 24/7",
    ],
    excluded: [],
    comingSoon: ["Assistant subventions", "Accès API"],
  },
];
