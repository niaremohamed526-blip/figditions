import { useMemo } from "react";
import { Globe, Coins, Store, Wallet } from "lucide-react";
import { VentesTab } from "@/components/finances/ventes-tab";
import { fmtFCFA, type VenteRow } from "@/lib/finance-types";
import { ETRANGER_ACCENT } from "@/components/manuscrits/distribution-badge";

interface ManuscritLite { id: string; titre: string; auteur: string; auteur_id: string | null }

/**
 * Finances → Livres Étrangers : uniquement les ventes de livres distribués
 * pour d'autres maisons d'édition. Aucun droit d'auteur ne s'applique.
 */
export function EtrangersFinancesTab({
  ventes,
  manuscrits,
  onChanged,
}: {
  ventes: VenteRow[];
  manuscrits: ManuscritLite[];
  onChanged: () => void;
}) {
  const totaux = useMemo(() => {
    const actives = ventes.filter((v) => (v.statut_annulation ?? "active") !== "annulee");
    const ca = actives.reduce((a, v) => a + Number(v.montant_total_fcfa || 0), 0);
    const commission = actives.reduce((a, v) => a + Number(v.commission_librairie_fcfa || 0), 0);
    return { ca, commission, net: ca - commission, count: actives.length };
  }, [ventes]);

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl border p-4"
        style={{ borderColor: `${ETRANGER_ACCENT}40`, background: `${ETRANGER_ACCENT}0D` }}
      >
        <h2 className="font-semibold flex items-center gap-2">
          <Globe className="h-5 w-5" style={{ color: ETRANGER_ACCENT }} />
          Ventes de livres étrangers
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Ces ventes ne génèrent aucun droit d'auteur : seule la commission librairie s'applique.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card icon={Coins} label="CA total" value={fmtFCFA(totaux.ca)} sub={`${totaux.count} vente(s)`} />
        <Card icon={Store} label="Commission librairie" value={fmtFCFA(totaux.commission)} />
        <Card icon={Wallet} label="Net à reverser" value={fmtFCFA(totaux.net)} sub="CA − commission" />
      </div>

      {ventes.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-14 text-center">
          <p className="text-sm text-muted-foreground">
            Aucune vente de livre étranger enregistrée pour le moment.
          </p>
        </div>
      ) : (
        <VentesTab
          ventes={ventes}
          manuscrits={manuscrits}
          auteurs={[]}
          onChanged={onChanged}
          hideDroits
        />
      )}
    </div>
  );
}

function Card({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <div
      className="rounded-xl border bg-card p-4 flex items-center gap-3"
      style={{ borderColor: `${ETRANGER_ACCENT}33` }}
    >
      <div
        className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${ETRANGER_ACCENT}26`, color: ETRANGER_ACCENT }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-lg font-bold mt-0.5 truncate">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}
