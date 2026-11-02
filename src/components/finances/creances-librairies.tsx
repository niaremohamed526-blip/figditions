import { useMemo, useState } from "react";
import { differenceInCalendarDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { Check, CheckCircle2, Download, Loader2, MessageCircle } from "lucide-react";
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
import { generateRecuLibrairiePdf, numeroRecu, type RecuLibrairieInput } from "@/lib/pdf-recu-librairie";

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
  const label = jours === 0 ? "Depuis aujourd'hui" : `Attend depuis ${pl(jours, "jour", "jours")}`;
  if (jours >= 60) return { label, text: "text-red-500", avatar: "bg-red-500/15 text-red-500" };
  if (jours >= 30) return { label, text: "text-amber-600 dark:text-amber-400", avatar: "bg-amber-500/15 text-amber-600 dark:text-amber-400" };
  return { label, text: "text-muted-foreground", avatar: "bg-muted text-muted-foreground" };
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
  entrepriseVille,
  titres,
  onChanged,
}: {
  ventes: VenteRow[];
  entrepriseNom: string;
  entrepriseVille?: string | null;
  /** Titre de chaque livre, pour le reçu. */
  titres: Record<string, string>;
  onChanged: () => void;
}) {
  const creances = useMemo(() => calculerCreances(ventes), [ventes]);
  const [paiement, setPaiement] = useState<Creance | null>(null);
  const [montant, setMontant] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [recu, setRecu] = useState<RecuLibrairieInput | null>(null);

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
    const reglees: RecuLibrairieInput["lignes"] = [];
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
        reglees.push({
          titre: titres[vente.manuscrit_id] ?? "Livre",
          dateVente: format(new Date(vente.date_vente), "dd/MM/yyyy"),
          quantite: Number(vente.quantite_vendue || 0),
          montant: part,
        });
      }
      const jour = new Date(`${date}T12:00:00`);
      setRecu({
        entrepriseNom,
        entrepriseVille,
        numero: numeroRecu(jour, repartition[0]?.vente.id ?? "0000"),
        date: jour,
        librairieNom: paiement.nom,
        montant: fait,
        resteDu: paiement.du - fait,
        lignes: reglees,
      });
      setPaiement(null);
    } finally {
      setBusy(false);
      if (fait > 0) onChanged();
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card">
      <header className="flex items-end justify-between gap-3 px-5 pt-5 pb-4">
        <div>
          <p className="text-[12px] uppercase tracking-[0.2em] text-muted-foreground">Qui vous doit</p>
          <h2 className="font-wordmark-serif mt-1 text-2xl font-normal leading-tight tracking-normal">
            {creances.length === 0 ? "Personne" : pl(creances.length, "client", "clients")}
          </h2>
        </div>
      </header>

      {creances.length === 0 ? (
        <p className="px-5 pb-6 text-sm text-muted-foreground flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Tout est encaissé.
        </p>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {creances.map((c) => {
            const age = ageMeta(c.jours);
            return (
              <li key={c.nom} className="flex items-center gap-3 px-5 py-3.5">
                <span
                  className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold", age.avatar)}
                  aria-hidden
                >
                  {c.nom.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.nom}</p>
                  <p className={cn("text-xs", age.text)}>{age.label}</p>
                </div>
                <p className="shrink-0 text-right font-semibold tabular-nums">
                  {Math.round(c.du).toLocaleString("fr-FR")}
                  <span className="block text-[11px] font-normal text-muted-foreground">FCFA</span>
                </p>
                <div className="flex shrink-0 gap-1.5">
                  <Button asChild size="icon" variant="outline" className="h-9 w-9 rounded-full border-[#25D366]/40 text-[#1EBE5B] hover:bg-[#25D366]/10">
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(messageRelance(c, entrepriseNom))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Relancer ${c.nom} sur WhatsApp`}
                      title="Relancer sur WhatsApp"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    size="icon"
                    className="h-9 w-9 rounded-full bg-[#C8922A] text-white hover:bg-[#B5821F]"
                    onClick={() => ouvrir(c)}
                    aria-label={`Paiement reçu de ${c.nom}`}
                    title="Paiement reçu"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {creances.length > 0 && (
        <p className="flex items-center gap-4 border-t border-border px-5 py-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><MessageCircle className="h-3 w-3" /> Relancer</span>
          <span className="inline-flex items-center gap-1.5"><Check className="h-3 w-3" /> Paiement reçu</span>
        </p>
      )}

      <Dialog open={!!recu} onOpenChange={(o) => !o && setRecu(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader className="items-center sm:text-center">
            <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
              <Check className="h-6 w-6" />
            </span>
            <DialogTitle>Paiement enregistré</DialogTitle>
            <DialogDescription>
              {recu && <>{fmtFCFA(recu.montant)} reçus de {recu.librairieNom}.{recu.resteDu > 0 && <> Reste {fmtFCFA(recu.resteDu)}.</>}</>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-2">
            <Button variant="outline" className="rounded-md" onClick={() => setRecu(null)}>Fermer</Button>
            <Button
              className="rounded-md bg-[#C8922A] text-white hover:bg-[#B5821F]"
              onClick={() => {
                if (!recu) return;
                const clean = recu.librairieNom.replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 30);
                generateRecuLibrairiePdf(recu).save(`${recu.numero}_${clean}.pdf`);
              }}
            >
              <Download className="h-4 w-4" /> Reçu PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
