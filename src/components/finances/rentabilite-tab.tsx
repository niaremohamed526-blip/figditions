import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, PiggyBank, Info } from "lucide-react";
import { fmtFCFA, type DepenseRow, type VenteRow } from "@/lib/finance-types";
import { cn } from "@/lib/utils";

interface StockInterneLite {
  manuscrit_id: string;
  quantite_imprimee: number;
  cout_unitaire_impression_fcfa: number;
}
interface ManuscritLite {
  id: string;
  titre: string;
  auteur: string;
}

interface RentabiliteRow {
  manuscritId: string;
  titre: string;
  auteur: string;
  vendus: number;
  ca: number;
  coutProd: number;
  depenses: number;
  royalties: number;
  commissions: number;
  net: number;
  marge: number | null;
  seuil: number | null;
}

export function RentabiliteTab({
  ventes,
  depenses,
  stockInterne,
  manuscrits,
}: {
  ventes: VenteRow[];
  depenses: DepenseRow[];
  stockInterne: StockInterneLite[];
  manuscrits: ManuscritLite[];
}) {
  const rows = useMemo<RentabiliteRow[]>(() => {
    const mMap = new Map(manuscrits.map((m) => [m.id, m]));
    const agg = new Map<string, RentabiliteRow>();

    const ensure = (mid: string): RentabiliteRow => {
      let r = agg.get(mid);
      if (!r) {
        const m = mMap.get(mid);
        r = {
          manuscritId: mid,
          titre: m?.titre ?? "Livre supprimé",
          auteur: m?.auteur ?? "—",
          vendus: 0, ca: 0, coutProd: 0, depenses: 0, royalties: 0, commissions: 0,
          net: 0, marge: null, seuil: null,
        };
        agg.set(mid, r);
      }
      return r;
    };

    // Coût de production = coût unitaire d'impression × quantité imprimée
    stockInterne.forEach((s) => {
      const r = ensure(s.manuscrit_id);
      r.coutProd += Number(s.cout_unitaire_impression_fcfa || 0) * Number(s.quantite_imprimee || 0);
    });

    // Dépenses rattachées à un livre
    depenses.forEach((d) => {
      if (!d.manuscrit_id) return;
      ensure(d.manuscrit_id).depenses += Number(d.montant_fcfa || 0);
    });

    // Ventes
    ventes.forEach((v) => {
      const r = ensure(v.manuscrit_id);
      r.vendus += Number(v.quantite_vendue || 0);
      r.ca += Number(v.montant_total_fcfa || 0);
      r.royalties += Number(v.droits_auteur_fcfa || 0);
      r.commissions += Number(v.commission_librairie_fcfa || 0);
    });

    agg.forEach((r) => {
      const investi = r.coutProd + r.depenses;
      r.net = r.ca - r.commissions - r.royalties - investi;
      r.marge = r.ca > 0 ? (r.net / r.ca) * 100 : null;
      const netUnit = r.vendus > 0 ? (r.ca - r.commissions - r.royalties) / r.vendus : 0;
      r.seuil = investi > 0 && netUnit > 0 ? Math.ceil(investi / netUnit) : null;
    });

    return [...agg.values()].sort((a, b) => b.ca - a.ca);
  }, [ventes, depenses, stockInterne, manuscrits]);

  const totaux = useMemo(() => {
    const depensesGlobales = depenses
      .filter((d) => !d.manuscrit_id)
      .reduce((a, d) => a + Number(d.montant_fcfa || 0), 0);
    return rows.reduce(
      (acc, r) => ({
        ca: acc.ca + r.ca,
        investi: acc.investi + r.coutProd + r.depenses,
        net: acc.net + r.net,
      }),
      { ca: 0, investi: 0, net: 0, depensesGlobales },
    );
  }, [rows, depenses]);

  const netGlobal = totaux.net - totaux.depensesGlobales;

  return (
    <div className="space-y-6">
      {/* Résumé global */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/70">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Investi (production + dépenses)</p>
            <p className="text-xl font-bold mt-1">{fmtFCFA(totaux.investi + totaux.depensesGlobales)}</p>
            {totaux.depensesGlobales > 0 && (
              <p className="text-[11px] text-muted-foreground mt-1">dont {fmtFCFA(totaux.depensesGlobales)} de charges globales</p>
            )}
          </CardContent>
        </Card>
        <Card className="bg-card/70">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Chiffre d'affaires</p>
            <p className="text-xl font-bold mt-1 text-[color:var(--gold)]">{fmtFCFA(totaux.ca)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/70">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Résultat net global</p>
            <p className={cn("text-xl font-bold mt-1 flex items-center gap-2", netGlobal >= 0 ? "text-emerald-400" : "text-red-400")}>
              {netGlobal >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {fmtFCFA(netGlobal)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">CA − commissions − royalties − coûts</p>
          </CardContent>
        </Card>
        <Card className="bg-card/70">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Livres rentables</p>
            <p className="text-xl font-bold mt-1">
              {rows.filter((r) => r.net > 0).length} / {rows.length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <PiggyBank className="h-5 w-5 text-[color:var(--gold)]" />
            Rentabilité par livre
          </CardTitle>
          <CardDescription className="flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Coût de production = coût unitaire d'impression × exemplaires imprimés (Stock interne). Renseignez le coût
            unitaire d'impression dans la fiche stock pour un calcul précis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground text-sm">Aucune donnée de rentabilité disponible.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Livre</th>
                    <th className="py-2 pr-3 text-right">Vendus</th>
                    <th className="py-2 pr-3 text-right">CA</th>
                    <th className="py-2 pr-3 text-right">Coût prod.</th>
                    <th className="py-2 pr-3 text-right">Dépenses</th>
                    <th className="py-2 pr-3 text-right">Royalties</th>
                    <th className="py-2 pr-3 text-right">Commissions</th>
                    <th className="py-2 pr-3 text-right">Résultat net</th>
                    <th className="py-2 pr-3 text-right">Marge</th>
                    <th className="py-2 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const statut = r.net > 0 ? "rentable" : r.net < 0 ? "deficit" : "neutre";
                    return (
                      <tr key={r.manuscritId} className="border-b border-border/50 hover:bg-muted/20">
                        <td className="py-2.5 pr-3">
                          <p className="font-medium">{r.titre}</p>
                          <p className="text-xs text-muted-foreground">{r.auteur}</p>
                          {r.seuil !== null && r.net <= 0 && (
                            <p className="text-[11px] text-amber-400/90 mt-0.5">
                              Seuil de rentabilité : {r.seuil} ex. ({r.vendus}/{r.seuil} vendus)
                            </p>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 text-right">{r.vendus}</td>
                        <td className="py-2.5 pr-3 text-right font-medium text-[color:var(--gold)]">{fmtFCFA(r.ca)}</td>
                        <td className="py-2.5 pr-3 text-right">{fmtFCFA(r.coutProd)}</td>
                        <td className="py-2.5 pr-3 text-right">{fmtFCFA(r.depenses)}</td>
                        <td className="py-2.5 pr-3 text-right">{fmtFCFA(r.royalties)}</td>
                        <td className="py-2.5 pr-3 text-right">{fmtFCFA(r.commissions)}</td>
                        <td className={cn("py-2.5 pr-3 text-right font-semibold", r.net >= 0 ? "text-emerald-400" : "text-red-400")}>
                          {fmtFCFA(r.net)}
                        </td>
                        <td className="py-2.5 pr-3 text-right">
                          {r.marge === null ? "—" : `${r.marge.toFixed(1)}%`}
                        </td>
                        <td className="py-2.5 text-center">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              statut === "rentable" && "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
                              statut === "deficit" && "bg-red-500/15 text-red-400 border-red-500/30",
                              statut === "neutre" && "bg-muted text-muted-foreground border-border",
                            )}
                          >
                            {statut === "rentable" ? "Rentable" : statut === "deficit" ? "Déficitaire" : <Minus className="h-3 w-3" />}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
