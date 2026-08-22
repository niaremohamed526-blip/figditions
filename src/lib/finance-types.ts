// Types et helpers partagés du module Finances v2

export interface VenteRow {
  id: string;
  manuscrit_id: string;
  auteur_id: string | null;
  quantite_vendue: number;
  prix_unitaire_fcfa: number;
  montant_total_fcfa: number;
  droits_auteur_fcfa: number;
  commission_librairie_fcfa: number;
  remise_fcfa: number | null;
  prix_catalogue_fcfa: number | null;
  canal_vente: string;
  statut_paiement: "en_attente" | "paye" | "annule";
  date_vente: string;
  statut_encaissement: "en_attente" | "partiel" | "encaisse";
  montant_encaisse_fcfa: number;
  date_encaissement: string | null;
  librairie_nom: string | null;
}

export interface DepenseRow {
  id: string;
  entreprise_id: string;
  categorie: string;
  libelle: string;
  montant_fcfa: number;
  date_depense: string;
  manuscrit_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PaiementRoyaltiesRow {
  id: string;
  entreprise_id: string;
  numero: string;
  annee: number;
  auteur_id: string | null;
  auteur_nom: string;
  vente_ids: string[];
  montant_fcfa: number;
  methode: string;
  reference: string | null;
  notes: string | null;
  paye_par: string | null;
  paye_par_nom: string | null;
  paye_le: string;
}

export interface AuditRow {
  id: string;
  entreprise_id: string;
  user_id: string | null;
  user_nom: string | null;
  action: "insert" | "update" | "delete";
  entite: "ventes" | "depenses" | "paiements_royalties" | string;
  entite_id: string | null;
  details: { avant?: Record<string, unknown> | null; apres?: Record<string, unknown> | null } | null;
  created_at: string;
}

export const DEPENSE_CATEGORIES = [
  { value: "impression", label: "Impression" },
  { value: "mise_en_page", label: "Mise en page" },
  { value: "couverture", label: "Conception couverture" },
  { value: "livraison", label: "Livraison / Transport" },
  { value: "salon_evenement", label: "Salon / Événement" },
  { value: "marketing", label: "Marketing / Communication" },
  { value: "loyer", label: "Loyer / Charges" },
  { value: "salaires", label: "Salaires / Honoraires" },
  { value: "materiel", label: "Matériel / Équipement" },
  { value: "frais_administratifs", label: "Frais administratifs" },
  { value: "autre", label: "Autre" },
] as const;

export const PAIEMENT_METHODES = [
  { value: "especes", label: "Espèces" },
  { value: "orange_money", label: "Orange Money" },
  { value: "wave", label: "Wave" },
  { value: "moov_money", label: "Moov Money" },
  { value: "virement", label: "Virement bancaire" },
  { value: "cheque", label: "Chèque" },
] as const;

export function categorieLabel(v: string | null | undefined): string {
  return DEPENSE_CATEGORIES.find((c) => c.value === v)?.label ?? "Autre";
}

export function methodeLabel(v: string | null | undefined): string {
  return PAIEMENT_METHODES.find((m) => m.value === v)?.label ?? v ?? "—";
}

export const ENCAISSEMENT_META: Record<string, { label: string; className: string }> = {
  encaisse: { label: "Encaissé", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  partiel: { label: "Partiel", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  en_attente: { label: "À encaisser", className: "bg-red-500/10 text-red-400 border-red-500/30" },
};

export function fmtFCFA(n: number | null | undefined): string {
  return `${Math.round(Number(n || 0)).toLocaleString("fr-FR")} FCFA`;
}
