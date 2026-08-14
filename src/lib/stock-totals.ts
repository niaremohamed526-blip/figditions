/**
 * Source unique de vérité pour tous les totaux de stock.
 * Stock total = stock interne (entrepôt) + stock externe (librairies).
 */

export interface StockInterneRow {
  quantite_disponible?: number | null;
  quantite_imprimee?: number | null;
  quantite_transferee_librairies?: number | null;
  quantite_vendue_directement?: number | null;
  quantite_exposee_evenements?: number | null;
  seuil_alerte?: number | null;
}

export interface StockExterneRow {
  exemplaires_deposes?: number | null;
  exemplaires_vendus?: number | null;
  exemplaires_restants?: number | null;
  prix_unitaire_fcfa?: number | null;
  librairie_nom?: string | null;
}

export interface StockTotals {
  stockTotal: number;
  interneDisponible: number;
  interneImprime: number;
  interneTransfere: number;
  interneVendu: number;
  interneExpose: number;
  interneLowStock: number;
  externeDepose: number;
  externeVendu: number;
  externeRestant: number;
  externeLibrairies: number;
  externeCA: number;
}

const sum = <T,>(rows: T[], pick: (r: T) => number | null | undefined) =>
  rows.reduce((s, r) => s + Number(pick(r) || 0), 0);

export function computeStockTotals(
  interne: StockInterneRow[] = [],
  externe: StockExterneRow[] = [],
): StockTotals {
  const interneDisponible = sum(interne, (i) => i.quantite_disponible);
  const externeRestant = sum(externe, (i) => i.exemplaires_restants);
  return {
    stockTotal: interneDisponible + externeRestant,
    interneDisponible,
    interneImprime: sum(interne, (i) => i.quantite_imprimee),
    interneTransfere: sum(interne, (i) => i.quantite_transferee_librairies),
    interneVendu: sum(interne, (i) => i.quantite_vendue_directement),
    interneExpose: sum(interne, (i) => i.quantite_exposee_evenements),
    interneLowStock: interne.filter(
      (i) => Number(i.quantite_disponible || 0) <= Number(i.seuil_alerte || 0),
    ).length,
    externeDepose: sum(externe, (i) => i.exemplaires_deposes),
    externeVendu: sum(externe, (i) => i.exemplaires_vendus),
    externeRestant,
    externeLibrairies: new Set(
      externe.map((i) => (i.librairie_nom ?? "").trim()).filter(Boolean),
    ).size,
    externeCA: externe.reduce(
      (s, i) => s + Number(i.exemplaires_vendus || 0) * Number(i.prix_unitaire_fcfa || 0),
      0,
    ),
  };
}

/** Récupère les deux tables et renvoie tous les totaux. */
export async function getStockTotals(
  supabase: { from: (t: string) => any },
  entrepriseId: string,
): Promise<StockTotals> {
  const [interneRes, externeRes] = await Promise.all([
    supabase
      .from("stock_interne")
      .select(
        "quantite_disponible, quantite_imprimee, quantite_transferee_librairies, quantite_vendue_directement, quantite_exposee_evenements, seuil_alerte",
      )
      .eq("entreprise_id", entrepriseId),
    supabase
      .from("stocks")
      .select(
        "exemplaires_deposes, exemplaires_vendus, exemplaires_restants, prix_unitaire_fcfa, librairie_nom",
      )
      .eq("entreprise_id", entrepriseId),
  ]);
  return computeStockTotals(
    (interneRes.data ?? []) as StockInterneRow[],
    (externeRes.data ?? []) as StockExterneRow[],
  );
}

export const nf = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
