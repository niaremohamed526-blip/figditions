import type { DepenseRow, VenteRow } from "@/lib/finance-types";

export interface TirageLite {
  manuscrit_id: string;
  quantite_imprimee: number;
  cout_unitaire_impression_fcfa: number;
}

const n = (v: unknown) => Number(v ?? 0) || 0;

/**
 * Coût d'impression moyen d'un exemplaire, par livre (moyenne pondérée des tirages).
 * Les livres sans coût renseigné n'apparaissent pas : leur coût compte pour 0.
 */
export function coutUnitaireParLivre(tirages: TirageLite[]): Map<string, number> {
  const acc = new Map<string, { qte: number; cout: number }>();
  for (const t of tirages) {
    const qte = n(t.quantite_imprimee);
    const a = acc.get(t.manuscrit_id) ?? { qte: 0, cout: 0 };
    a.qte += qte;
    a.cout += n(t.cout_unitaire_impression_fcfa) * qte;
    acc.set(t.manuscrit_id, a);
  }
  const out = new Map<string, number>();
  acc.forEach((a, id) => { if (a.qte > 0 && a.cout > 0) out.set(id, a.cout / a.qte); });
  return out;
}

export interface Resultat {
  ventes: number;
  commissions: number;
  droits: number;
  coutVendus: number;
  depenses: number;
  benefice: number;
}

/**
 * LA définition unique du bénéfice, utilisée partout dans Finances :
 * ventes − commissions librairies − droits d'auteur − coût d'impression des
 * exemplaires vendus − dépenses. Les exemplaires invendus restent du stock,
 * pas une perte. Passer uniquement des ventes actives de nos propres livres.
 */
export function calculerResultat(ventes: VenteRow[], depenses: DepenseRow[], coutUnitaire: Map<string, number>): Resultat {
  const r = { ventes: 0, commissions: 0, droits: 0, coutVendus: 0, depenses: 0, benefice: 0 };
  for (const v of ventes) {
    r.ventes += n(v.montant_total_fcfa);
    r.commissions += n(v.commission_librairie_fcfa);
    r.droits += n(v.droits_auteur_fcfa);
    r.coutVendus += (coutUnitaire.get(v.manuscrit_id) ?? 0) * n(v.quantite_vendue);
  }
  r.depenses = depenses.reduce((a, d) => a + n(d.montant_fcfa), 0);
  r.coutVendus = Math.round(r.coutVendus);
  r.benefice = r.ventes - r.commissions - r.droits - r.coutVendus - r.depenses;
  return r;
}

export type Periode = "mois" | "annee" | "tout";

export const PERIODES: { value: Periode; label: string }[] = [
  { value: "mois", label: "Ce mois" },
  { value: "annee", label: "Cette année" },
  { value: "tout", label: "Depuis le début" },
];

/** Préfixe de date (AAAA-MM ou AAAA) couvrant la période, ou null pour tout. */
export function prefixePeriode(p: Periode, now = new Date()): string | null {
  const y = String(now.getFullYear());
  if (p === "annee") return y;
  if (p === "mois") return `${y}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return null;
}

export const dansPeriode = (date: string | null | undefined, prefixe: string | null) =>
  prefixe === null || (date ?? "").startsWith(prefixe);

/** Reste à encaisser d'une vente active. */
export const resteAEncaisser = (v: VenteRow) =>
  v.statut_annulation === "annulee" ? 0 : Math.max(0, n(v.montant_total_fcfa) - n(v.montant_encaisse_fcfa));
