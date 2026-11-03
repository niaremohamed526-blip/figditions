import { useMemo } from "react";
import { Info, AlertTriangle } from "lucide-react";
import { type DepenseRow, type VenteRow } from "@/lib/finance-types";
import { fcfa } from "@/lib/format";
import { cn } from "@/lib/utils";
import { pl } from "@/lib/plural";
import { Eyebrow, Montant, Panel, Vide, fmtMontant } from "@/components/finances/finance-ui";
import { coutUnitaireParLivre } from "@/lib/finance-calc";

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
  /** Tout le tirage imprimé : sert au seuil de remboursement, pas au bénéfice. */
  coutProd: number;
  /** Impression des seuls exemplaires vendus : entre dans le bénéfice. */
  coutVendus: number;
  imprimes: number;
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
          vendus: 0, ca: 0, coutProd: 0, coutVendus: 0, imprimes: 0, depenses: 0, royalties: 0, commissions: 0,
          net: 0, marge: null, seuil: null,
        };
        agg.set(mid, r);
      }
      return r;
    };

    // Tirage total = coût unitaire d'impression × quantité imprimée
    stockInterne.forEach((s) => {
      const r = ensure(s.manuscrit_id);
      r.coutProd += Number(s.cout_unitaire_impression_fcfa || 0) * Number(s.quantite_imprimee || 0);
      r.imprimes += Number(s.quantite_imprimee || 0);
    });
    const coutUnitaire = coutUnitaireParLivre(stockInterne);

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

    // Même définition que la Vue d'ensemble (lib/finance-calc) : les invendus restent du stock.
    agg.forEach((r) => {
      r.coutVendus = Math.round((coutUnitaire.get(r.manuscritId) ?? 0) * r.vendus);
      r.net = r.ca - r.commissions - r.royalties - r.coutVendus - r.depenses;
      r.marge = r.ca > 0 ? (r.net / r.ca) * 100 : null;
      const investi = r.coutProd + r.depenses;
      const netUnit = r.vendus > 0 ? (r.ca - r.commissions - r.royalties) / r.vendus : 0;
      r.seuil = investi > 0 && netUnit > 0 ? Math.ceil(investi / netUnit) : null;
    });

    return [...agg.values()].sort((a, b) => b.ca - a.ca);
  }, [ventes, depenses, stockInterne, manuscrits]);

  const totaux = useMemo(() => {
    const depensesGlobales = depenses
      .filter((d) => !d.manuscrit_id)
      .reduce((a, d) => a + Number(d.montant_fcfa || 0), 0);
    const base = rows.reduce(
      (acc, r) => ({
        ca: acc.ca + r.ca,
        investi: acc.investi + r.coutProd + r.depenses,
        stock: acc.stock + Math.max(0, r.coutProd - r.coutVendus),
        net: acc.net + r.net,
      }),
      { ca: 0, investi: 0, net: 0, stock: 0 },
    );
    return { ...base, depensesGlobales };
  }, [rows, depenses]);

  const netGlobal = totaux.net - totaux.depensesGlobales;

  const rentables = rows.filter((r) => r.net > 0).length;

  return (
    <div className="space-y-4">
      <Panel accent className="p-6">
        <Eyebrow>Bénéfice depuis le début</Eyebrow>
        <Montant value={netGlobal} size="xl" tone={netGlobal < 0 ? "bad" : undefined} className="mt-2" />
        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          <Stat label="Ventes" value={fmtMontant(totaux.ca)} />
          <Stat label="Investi" value={fmtMontant(totaux.investi + totaux.depensesGlobales)} />
          <Stat label="Encore en stock" value={fmtMontant(totaux.stock)} />
          <Stat label="Livres rentables" value={`${rentables} / ${rows.length}`} />
        </div>
        <p className="mt-4 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Seule l'impression des livres vendus est comptée : les livres non vendus restent du stock.
        </p>
      </Panel>

      {rows.length === 0 ? (
        <Panel><Vide>Aucune vente pour l'instant.</Vide></Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((r) => {
            const pct = r.seuil ? Math.min(100, Math.round((r.vendus / r.seuil) * 100)) : 100;
            const suspect = r.imprimes > 10000 || r.coutProd > 20_000_000;
            return (
              <Panel key={r.manuscritId} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-wordmark-serif truncate text-xl font-normal leading-tight tracking-normal">{r.titre}</h3>
                    <p className="truncate text-xs text-muted-foreground">{r.auteur} · {pl(r.vendus, "exemplaire vendu", "exemplaires vendus")}</p>
                  </div>
                  <span className={cn(
                    "shrink-0 rounded-full px-2.5 py-0.5 text-[11px]",
                    r.net > 0 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : r.net < 0 ? "bg-red-500/15 text-red-500" : "bg-muted text-muted-foreground",
                  )}>
                    {r.marge === null ? "Pas de vente" : `Marge ${r.marge.toFixed(0)} %`}
                  </span>
                </div>

                <Montant value={r.net} size="md" tone={r.net < 0 ? "bad" : r.net > 0 ? "good" : undefined} className="mt-4" />

                <div className="mt-4 space-y-1.5 text-sm">
                  <Ligne label="Ventes" value={r.ca} />
                  <Ligne label="Commissions" value={-r.commissions} />
                  <Ligne label="Droits d'auteur" value={-r.royalties} />
                  <Ligne label="Impression des vendus" value={-r.coutVendus} />
                  {r.depenses > 0 && <Ligne label="Dépenses du livre" value={-r.depenses} />}
                </div>

                {r.seuil !== null && (
                  <div className="mt-4">
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <div className={cn("h-full rounded-full", pct >= 100 ? "bg-emerald-500" : "bg-[#C8922A]")} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {pct >= 100
                        ? "Impression déjà remboursée"
                        : `Impression remboursée à ${pct} % (${r.vendus.toLocaleString("fr-FR")} / ${r.seuil.toLocaleString("fr-FR")} ex.)`}
                    </p>
                  </div>
                )}
                {suspect && (
                  <p className="mt-3 flex items-center gap-1.5 rounded-md bg-red-500/10 px-2.5 py-1.5 text-xs text-red-500">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    À vérifier : {r.imprimes.toLocaleString("fr-FR")} ex. imprimés pour {fcfa(r.coutProd)}
                  </p>
                )}
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium tabular-nums">{value}</p>
    </div>
  );
}

function Ligne({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-border/60 pb-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value < 0 ? "−" : ""}{fmtMontant(Math.abs(value))}</span>
    </div>
  );
}
