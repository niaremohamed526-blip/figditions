import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStockTotals, nf, type StockTotals } from "@/lib/stock-totals";
import { useRealtimeTable } from "@/hooks/use-realtime";

/** Indicateur de cohérence : Stock total = Entrepôt + Librairies */
export function StockRepartition({ entrepriseId }: { entrepriseId: string | null | undefined }) {
  const [t, setT] = useState<StockTotals | null>(null);

  const reload = useCallback(async () => {
    if (!entrepriseId) return;
    setT(await getStockTotals(supabase as never, entrepriseId));
  }, [entrepriseId]);

  useEffect(() => { reload(); }, [reload]);
  useRealtimeTable("stock_interne", entrepriseId, reload);
  useRealtimeTable("stocks", entrepriseId, reload);

  if (!t) return null;
  const total = t.stockTotal || 1;
  const pctInt = Math.round((t.interneDisponible / total) * 100);
  const pctExt = 100 - pctInt;

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">Répartition du stock total</h3>
        <p className="text-sm">
          <span className="text-[color:var(--gold)] font-bold tabular-nums">{nf(t.stockTotal)}</span>{" "}
          <span className="text-muted-foreground">exemplaires</span>
        </p>
      </div>

      <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-[#C8922A]" style={{ width: `${t.stockTotal ? pctInt : 0}%` }} />
        <div className="h-full bg-[#7A4A1E]" style={{ width: `${t.stockTotal ? pctExt : 0}%` }} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border border-border bg-background/40 p-3">
          <p className="text-muted-foreground text-xs">🏭 Entrepôt</p>
          <p className="font-bold tabular-nums">{nf(t.interneDisponible)} ex.</p>
          <p className="text-xs text-[color:var(--gold)]">{t.stockTotal ? pctInt : 0}%</p>
        </div>
        <div className="rounded-lg border border-border bg-background/40 p-3">
          <p className="text-muted-foreground text-xs">📦 Librairies</p>
          <p className="font-bold tabular-nums">{nf(t.externeRestant)} ex.</p>
          <p className="text-xs text-[#C08A55]">{t.stockTotal ? pctExt : 0}%</p>
        </div>
      </div>
    </section>
  );
}
