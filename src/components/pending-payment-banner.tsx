import { useEffect, useState } from "react";
import { Clock, Copy } from "lucide-react";
import { toast } from "sonner";
import { fcfa } from "@/lib/format";
import { fetchMyPendingQrPayment, type PendingQrPayment } from "@/lib/manual-payment";

export function PendingPaymentBanner({ entrepriseId }: { entrepriseId: string | null | undefined }) {
  const [pending, setPending] = useState<PendingQrPayment | null>(null);

  useEffect(() => {
    if (!entrepriseId) return;
    let alive = true;
    fetchMyPendingQrPayment().then((p) => { if (alive) setPending(p); });
    return () => { alive = false; };
  }, [entrepriseId]);

  if (!pending) return null;

  return (
    <div className="rounded-xl border border-orange-500/40 bg-orange-500/10 p-4 flex flex-wrap items-center gap-3">
      <Clock className="h-5 w-5 text-orange-400 shrink-0" />
      <div className="flex-1 min-w-[200px]">
        <div className="font-semibold text-sm text-orange-300">Paiement en cours de vérification</div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Plan <span className="capitalize">{pending.plan_demande}</span> ({pending.periode}) ·{" "}
          {fcfa(pending.montant_fcfa)} · Votre plan sera activé après vérification (sous 24h).
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(pending.reference_paiement);
          toast.success("Référence copiée");
        }}
        className="flex items-center gap-1.5 rounded-lg border border-orange-500/40 px-3 py-2 text-xs font-semibold text-[color:var(--gold)] hover:bg-orange-500/10 min-h-10"
      >
        <Copy className="h-3.5 w-3.5" /> {pending.reference_paiement}
      </button>
    </div>
  );
}
