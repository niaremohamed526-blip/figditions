import { useMemo, useState } from "react";
import { differenceInCalendarDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckCircle2, Loader2, MessageCircle, Store } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { pl } from "@/lib/plural";
import { fmtFCFA, type VenteRow } from "@/lib/finance-types";
import { resteAEncaisser } from "@/lib/finance-calc";
import { withSessionRecovery } from "@/lib/session-recovery";

export interface Creance {
  nom: string;
  du: number;
  depuis: string;
  jours: number;
  /** Ventes non soldées, la plus ancienne d'abord : ordre d'affectation des paiements. */
  ventes: VenteRow[];
}

/** Regroupe ce qui reste à encaisser par librairie (chaque succursale garde son propre nom). */
export function calculerCreances(ventes: VenteRow[], now = new Date()): Creance[] {
  const map = new Map<string, Creance>();
  for (const v of ventes) {
    const reste = resteAEncaisser(v);
    if (reste <= 0) continue;
    const nom = v.librairie_nom?.trim() || v.client_nom?.trim() || "Ventes directes";
    const c = map.get(nom) ?? { nom, du: 0, depuis: v.date_vente, jours: 0, ventes: [] };
    c.du += reste;
    if (v.date_vente < c.depuis) c.depuis = v.date_vente;
    c.ventes.push(v);
    map.set(nom, c);
  }
  return [...map.values()]
    .map((c) => ({
      ...c,
      jours: Math.max(0, differenceInCalendarDays(now, new Date(c.depuis))),
      ventes: [...c.ventes].sort((a, b) => a.date_vente.localeCompare(b.date_vente)),
    }))
    .sort((a, b) => b.jours - a.jours || b.du - a.du);
}

function ageMeta(jours: number) {
  if (jours >= 60) return { label: `${jours} jours`, className: "bg-red-500/15 text-red-500 border-red-500/30" };
  if (jours >= 30) return { label: `${jours} jours`, className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" };
  return { label: jours === 0 ? "Aujourd'hui" : pl(jours, "jour", "jours"), className: "bg-muted text-muted-foreground border-border" };
}

const dateFr = (d: string) => format(new Date(d), "do MMMM yyyy", { locale: fr });

function messageRelance(c: Creance, entrepriseNom: string) {
  return [
    "Bonjour,",
    "",
    `Ici ${entrepriseNom}. Selon nos comptes, il reste ${fmtFCFA(c.du)} à régler pour les livres vendus depuis le ${dateFr(c.depuis)}.`,
    "Pouvez-vous nous dire quand le paiement est prévu ?",
    "",
    "Merci et bonne journée.",
  ].join("\n");
}

export function CreancesLibrairies({
  ventes,
  entrepriseNom,
  onChanged,
}: {
  ventes: VenteRow[];
  entrepriseNom: string;
  onChanged: () => void;
}) {
  const creances = useMemo(() => calculerCreances(ventes), [ventes]);
  const total = creances.reduce((a, c) => a + c.du, 0);
  const [paiement, setPaiement] = useState<Creance | null>(null);
  const [montant, setMontant] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  const ouvrir = (c: Creance) => {
    setPaiement(c);
    setMontant(String(c.du));
    setDate(new Date().toISOString().slice(0, 10));
  };

  /** Répartit le montant reçu sur les ventes les plus anciennes d'abord. */
  const repartition = useMemo(() => {
    if (!paiement) return [];
    let reste = Math.max(0, Math.round(Number(montant) || 0));
    const out: { vente: VenteRow; montant: number }[] = [];
    for (const v of paiement.ventes) {
      if (reste <= 0) break;
      const part = Math.min(reste, resteAEncaisser(v));
      if (part > 0) out.push({ vente: v, montant: part });
      reste -= part;
    }
    return out;
  }, [paiement, montant]);

  const enregistrer = async () => {
    if (!paiement) return;
    const recu = Math.round(Number(montant) || 0);
    if (recu <= 0) { toast.error("Indiquez le montant reçu"); return; }
    if (recu > paiement.du) { toast.error(`${paiement.nom} ne doit que ${fmtFCFA(paiement.du)}`); return; }
    setBusy(true);
    let fait = 0;
    try {
      // Une vente après l'autre ; on s'arrête au premier échec pour ne jamais compter deux fois.
      for (const { vente, montant: part } of repartition) {
        const { data, error } = await withSessionRecovery(supabase.auth, () =>
          (supabase as any).rpc("enregistrer_encaissement", { p_vente_id: vente.id, p_montant: part, p_date: date }),
        );
        if (error || (data as any)?.ok === false) {
          const msg = error?.message ?? (data as any)?.error ?? "Erreur";
          toast.error(fait > 0
            ? `${fmtFCFA(fait)} enregistrés, puis arrêt : ${msg}. Vérifiez avant de réessayer.`
            : msg);
          return;
        }
        fait += part;
      }
      toast.success(`${fmtFCFA(fait)} reçus de ${paiement.nom}`);
      setPaiement(null);
    } finally {
      setBusy(false);
      if (fait > 0) onChanged();
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-end justify-between gap-2 p-5 pb-3">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <Store className="h-4 w-4 text-[color:var(--gold)]" /> Qui vous doit de l'argent
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Les plus anciennes dettes en premier. Quand une librairie paie, enregistrez-le ici en une fois.
          </p>
        </div>
        {total > 0 && <p className="text-lg font-semibold tabular-nums">{fmtFCFA(total)}</p>}
      </header>

      {creances.length === 0 ? (
        <p className="px-5 pb-6 text-sm text-muted-foreground flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Personne ne vous doit d'argent : tout est encaissé.
        </p>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {creances.map((c) => {
            const age = ageMeta(c.jours);
            return (
              <li key={c.nom} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                <div className="min-w-0 flex-1 basis-48">
                  <p className="font-medium truncate">{c.nom}</p>
                  <p className="text-xs text-muted-foreground">
                    {pl(c.ventes.length, "vente non payée", "ventes non payées")} · depuis le {dateFr(c.depuis)}
                  </p>
                </div>
                <span className={cn("text-[11px] rounded-md border px-2 py-0.5 whitespace-nowrap", age.className)}>{age.label}</span>
                <p className="font-semibold tabular-nums w-32 text-right">{fmtFCFA(c.du)}</p>
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="outline" className="rounded-md">
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(messageRelance(c, entrepriseNom))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> Relancer
                    </a>
                  </Button>
                  <Button size="sm" className="rounded-md bg-[#C8922A] text-white hover:bg-[#B5821F]" onClick={() => ouvrir(c)}>
                    Paiement reçu
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={!!paiement} onOpenChange={(o) => !o && !busy && setPaiement(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Paiement reçu de {paiement?.nom}</DialogTitle>
            <DialogDescription>
              Doit au total {fmtFCFA(paiement?.du ?? 0)}. Le montant est affecté aux ventes les plus anciennes d'abord.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Montant reçu (FCFA)</Label>
              <Input type="number" min={1} inputMode="numeric" value={montant} onChange={(e) => setMontant(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          {repartition.length > 0 && (
            <div className="rounded-md border border-border text-xs">
              {repartition.map(({ vente, montant: part }) => {
                const solde = part >= resteAEncaisser(vente);
                return (
                  <div key={vente.id} className="flex justify-between gap-3 px-3 py-1.5 border-b border-border last:border-0">
                    <span className="text-muted-foreground">Vente du {format(new Date(vente.date_vente), "dd/MM/yyyy")}</span>
                    <span className="tabular-nums">{fmtFCFA(part)} {solde ? "· soldée" : "· en partie"}</span>
                  </div>
                );
              })}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="rounded-md" onClick={() => setPaiement(null)} disabled={busy}>Annuler</Button>
            <Button className="rounded-md bg-[#C8922A] text-white hover:bg-[#B5821F]" onClick={enregistrer} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer le paiement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
