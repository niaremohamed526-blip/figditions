import { useMemo, useState } from "react";
import { pl } from "@/lib/plural";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, Download, Loader2, ReceiptText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Eyebrow, Montant, Panel, PanelHeader, Pastille, Vide, GOLD_BUTTON, fmtMontant } from "@/components/finances/finance-ui";
import { fmtFCFA, methodeLabel, PAIEMENT_METHODES, type PaiementRoyaltiesRow, type VenteRow } from "@/lib/finance-types";
import { generateQuittancePdf, quittanceFilename, type QuittanceLigne } from "@/lib/pdf-quittance";
import { generateReleveAuteurPdf } from "@/lib/pdf-releve-auteur";

interface ManuscritLite { id: string; titre: string; auteur: string; auteur_id: string | null; }
interface AuteurLite { id: string; nom_complet: string; }

interface AuthorGroup {
  key: string;
  nom: string;
  ventes: VenteRow[];
  montant: number;
}

export function RoyaltiesTab({
  ventes,
  manuscrits,
  auteurs,
  paiements,
  entrepriseNom,
  entrepriseVille,
  onChanged,
}: {
  ventes: VenteRow[];
  manuscrits: ManuscritLite[];
  auteurs: AuteurLite[];
  paiements: PaiementRoyaltiesRow[];
  entrepriseNom: string;
  entrepriseVille?: string | null;
  onChanged: () => void;
}) {
  const [payGroup, setPayGroup] = useState<AuthorGroup | null>(null);
  const [methode, setMethode] = useState("especes");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  /** Ventes cochées pour ce paiement : toutes par défaut, l'éditeur peut en retirer. */
  const [choix, setChoix] = useState<Set<string>>(new Set());
  const choisies = payGroup ? payGroup.ventes.filter((v) => choix.has(v.id)) : [];
  const montantChoisi = choisies.reduce((a, v) => a + Number(v.droits_auteur_fcfa || 0), 0);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const manuscritMap = useMemo(() => new Map(manuscrits.map((m) => [m.id, m])), [manuscrits]);
  const auteurMap = useMemo(() => new Map(auteurs.map((a) => [a.id, a.nom_complet])), [auteurs]);

  const resolveNom = (v: VenteRow): { key: string; nom: string } => {
    const m = manuscritMap.get(v.manuscrit_id);
    const aid = v.auteur_id ?? m?.auteur_id;
    if (aid && auteurMap.get(aid)) return { key: aid, nom: auteurMap.get(aid)! };
    return { key: m?.auteur ?? "inconnu", nom: m?.auteur ?? "Auteur inconnu" };
  };

  // Royalties en attente groupées par auteur
  const pendingGroups = useMemo<AuthorGroup[]>(() => {
    const groups = new Map<string, AuthorGroup>();
    ventes
      .filter((v) => v.statut_paiement === "en_attente" && Number(v.droits_auteur_fcfa) > 0)
      .forEach((v) => {
        const { key, nom } = resolveNom(v);
        let g = groups.get(key);
        if (!g) {
          g = { key, nom, ventes: [], montant: 0 };
          groups.set(key, g);
        }
        g.ventes.push(v);
        g.montant += Number(v.droits_auteur_fcfa || 0);
      });
    return [...groups.values()].sort((a, b) => b.montant - a.montant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventes, manuscritMap, auteurMap]);

  // Relevé annuel : un auteur, une année, toutes ses ventes (payées ou non).
  const auteursAvecVentes = useMemo(() => {
    const m = new Map<string, string>();
    ventes.forEach((v) => { const { key, nom } = resolveNom(v); m.set(key, nom); });
    return [...m.entries()].map(([key, nom]) => ({ key, nom })).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventes, manuscritMap, auteurMap]);
  const annees = useMemo(
    () => [...new Set([new Date().getFullYear(), ...ventes.map((v) => Number(v.date_vente.slice(0, 4)))])].sort((a, b) => b - a),
    [ventes],
  );
  const [releveAuteur, setReleveAuteur] = useState("");
  const [releveAnnee, setReleveAnnee] = useState(String(new Date().getFullYear()));

  const telechargerReleve = () => {
    const a = auteursAvecVentes.find((x) => x.key === releveAuteur);
    if (!a) { toast.error("Choisissez un auteur"); return; }
    const lignes = ventes
      .filter((v) => resolveNom(v).key === a.key && v.date_vente.startsWith(releveAnnee) && Number(v.droits_auteur_fcfa) > 0)
      .sort((x, y) => x.date_vente.localeCompare(y.date_vente))
      .map((v) => ({
        titre: manuscritMap.get(v.manuscrit_id)?.titre ?? "Livre",
        date: new Date(v.date_vente).toLocaleDateString("fr-FR"),
        quantite: Number(v.quantite_vendue || 0),
        droits: Number(v.droits_auteur_fcfa || 0),
        paye: v.statut_paiement === "paye",
      }));
    const clean = a.nom.replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 30);
    generateReleveAuteurPdf({ entrepriseNom: entrepriseNom || "Maison d'édition", auteurNom: a.nom, annee: Number(releveAnnee), lignes })
      .then((pdf) => pdf.save(`Releve_${releveAnnee}_${clean}.pdf`))
      .catch(() => toast.error("Le relevé PDF n'a pas pu être créé. Réessayez."));
  };

  const buildLignes = (ids: string[]): QuittanceLigne[] =>
    ventes
      .filter((v) => ids.includes(v.id))
      .map((v) => ({
        titre: manuscritMap.get(v.manuscrit_id)?.titre ?? "Livre",
        date: new Date(v.date_vente).toLocaleDateString("fr-FR"),
        quantite: Number(v.quantite_vendue || 0),
        droits: Number(v.droits_auteur_fcfa || 0),
      }));

  const downloadQuittance = (p: {
    numero: string; auteurNom: string; montant: number; methode: string;
    reference?: string | null; notes?: string | null; payeParNom?: string | null;
    date: Date; venteIds: string[];
  }) => {
    generateQuittancePdf({
      entrepriseNom: entrepriseNom || "Maison d'édition",
      entrepriseVille,
      numero: p.numero,
      datePaiement: p.date,
      auteurNom: p.auteurNom,
      montant: p.montant,
      methode: p.methode,
      reference: p.reference,
      notes: p.notes,
      payeParNom: p.payeParNom,
      lignes: buildLignes(p.venteIds),
    })
      .then((pdf) => pdf.save(quittanceFilename(p.numero, p.auteurNom)))
      .catch(() => toast.error("La quittance PDF n'a pas pu être créée. Réessayez."));
  };

  const payer = async () => {
    if (!payGroup) return;
    setBusy(true);
    try {
      const ids = choisies.map((v) => v.id);
      if (ids.length === 0) throw new Error("Cochez au moins une vente");
      const { data, error } = await (supabase as any).rpc("payer_royalties_auteur", {
        p_vente_ids: ids,
        p_methode: methode,
        p_reference: reference.trim() || null,
        p_notes: notes.trim() || null,
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data.error ?? "Erreur");

      toast.success(`Quittance ${data.numero} générée : ${fmtFCFA(data.montant)} payés à ${data.auteur_nom}`);

      // Télécharge immédiatement le reçu PDF
      downloadQuittance({
        numero: data.numero,
        auteurNom: data.auteur_nom,
        montant: Number(data.montant),
        methode: data.methode,
        reference: data.reference,
        notes: notes.trim() || null,
        date: new Date(),
        venteIds: ids,
      });

      setPayGroup(null);
      setReference("");
      setNotes("");
      setMethode("especes");
      onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors du paiement");
    } finally {
      setBusy(false);
    }
  };

  const reprint = (p: PaiementRoyaltiesRow) => {
    setDownloadingId(p.id);
    try {
      downloadQuittance({
        numero: p.numero,
        auteurNom: p.auteur_nom,
        montant: Number(p.montant_fcfa),
        methode: p.methode,
        reference: p.reference,
        notes: p.notes,
        payeParNom: p.paye_par_nom,
        date: new Date(p.paye_le),
        venteIds: p.vente_ids ?? [],
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const totalAttente = pendingGroups.reduce((a, g) => a + g.montant, 0);
  const annee = String(new Date().getFullYear());
  const payeCetteAnnee = paiements
    .filter((p) => p.paye_le?.startsWith(annee))
    .reduce((a, p) => a + Number(p.montant_fcfa || 0), 0);

  return (
    <div className="space-y-4">
      <Panel accent className="p-6">
        <Eyebrow>À payer aux auteurs</Eyebrow>
        <Montant value={totalAttente} size="xl" className="mt-2" />
        <p className="mt-3 text-sm text-muted-foreground">
          {pendingGroups.length > 0 ? pl(pendingGroups.length, "auteur attend", "auteurs attendent") : "Tout est payé"}
          <span className="mx-2 text-border">|</span>
          Payé en {annee} <span className="tabular-nums text-foreground">{fmtMontant(payeCetteAnnee)}</span>
        </p>
      </Panel>

      {/* Royalties en attente */}
      <Panel>
        <PanelHeader eyebrow="En attente" title={pendingGroups.length === 0 ? "Personne" : pl(pendingGroups.length, "auteur", "auteurs")} />
        {pendingGroups.length === 0 ? (
          <Vide>
            <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Tous les droits d'auteur sont payés.</span>
          </Vide>
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {pendingGroups.map((g) => (
              <li key={g.key} className="flex items-center gap-3 px-5 py-3.5">
                <Pastille className="bg-[color:var(--gold)]/15 text-[color:var(--gold)]">{g.nom.charAt(0).toUpperCase()}</Pastille>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{g.nom}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {pl(g.ventes.length, "vente", "ventes")} · {[...new Set(g.ventes.map((v) => (manuscritMap.get(v.manuscrit_id)?.titre ?? "Livre").trim()))].join(", ")}
                  </p>
                </div>
                <p className="shrink-0 text-right font-semibold tabular-nums">
                  {fmtMontant(g.montant)}
                  <span className="block text-[11px] font-normal text-muted-foreground">FCFA</span>
                </p>
                <Button
                  size="sm"
                  onClick={() => { setPayGroup(g); setChoix(new Set(g.ventes.map((v) => v.id))); setMethode("especes"); setReference(""); setNotes(""); }}
                  className={GOLD_BUTTON}
                >
                  Payer
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Relevé annuel d'un auteur */}
      {auteursAvecVentes.length > 0 && (
        <Panel>
          <PanelHeader eyebrow="Relevé annuel" title="À envoyer à un auteur" />
          <div className="flex flex-col gap-3 border-t border-border p-5 sm:flex-row">
            <Select value={releveAuteur} onValueChange={setReleveAuteur}>
              <SelectTrigger className="sm:w-64"><SelectValue placeholder="Choisir un auteur" /></SelectTrigger>
              <SelectContent>
                {auteursAvecVentes.map((a) => <SelectItem key={a.key} value={a.key}>{a.nom}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={releveAnnee} onValueChange={setReleveAnnee}>
              <SelectTrigger className="sm:w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {annees.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={telechargerReleve} disabled={!releveAuteur} variant="outline" className="rounded-md">
              <Download className="h-4 w-4" /> Relevé PDF
            </Button>
          </div>
        </Panel>
      )}

      {/* Historique des paiements */}
      <Panel>
        <PanelHeader eyebrow="Déjà payé" title={paiements.length === 0 ? "Aucun paiement" : pl(paiements.length, "quittance", "quittances")} />
        {paiements.length === 0 ? (
          <Vide>Chaque paiement crée une quittance numérotée, à retrouver ici.</Vide>
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {paiements.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                <Pastille className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" /></Pastille>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.auteur_nom}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.numero} · {new Date(p.paye_le).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })} · {methodeLabel(p.methode)}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </p>
                </div>
                <p className="shrink-0 text-right font-semibold tabular-nums">
                  {fmtMontant(Number(p.montant_fcfa))}
                  <span className="block text-[11px] font-normal text-muted-foreground">FCFA</span>
                </p>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => reprint(p)}
                  disabled={downloadingId === p.id}
                  title="Télécharger la quittance"
                  aria-label={`Télécharger la quittance ${p.numero}`}
                >
                  {downloadingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Dialog paiement */}
      <Dialog open={!!payGroup} onOpenChange={(o) => !o && setPayGroup(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Payer les royalties : {payGroup?.nom}</DialogTitle>
            <DialogDescription>
              Décochez les ventes que vous ne payez pas maintenant. Une quittance est téléchargée automatiquement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {payGroup && (
              <div className="rounded-md border border-border">
                <div className="max-h-48 overflow-y-auto divide-y divide-border">
                  {payGroup.ventes.map((v) => (
                    <label key={v.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#C8922A]"
                        checked={choix.has(v.id)}
                        onChange={(e) => setChoix((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(v.id); else next.delete(v.id);
                          return next;
                        })}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {manuscritMap.get(v.manuscrit_id)?.titre ?? "Livre"}
                        <span className="text-muted-foreground"> · {new Date(v.date_vente).toLocaleDateString("fr-FR")}</span>
                      </span>
                      <span className="tabular-nums">{fmtFCFA(v.droits_auteur_fcfa)}</span>
                    </label>
                  ))}
                </div>
                <div className="flex justify-between border-t border-border px-3 py-2 text-sm font-medium">
                  <span>{pl(choisies.length, "vente", "ventes")}</span>
                  <span className="tabular-nums text-[color:var(--gold)]">{fmtFCFA(montantChoisi)}</span>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Méthode de paiement</Label>
              <Select value={methode} onValueChange={setMethode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAIEMENT_METHODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Référence (optionnel)</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="N° de transaction, reçu…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optionnel)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayGroup(null)} disabled={busy}>Annuler</Button>
            <Button
              onClick={payer}
              disabled={busy || choisies.length === 0}
              className={GOLD_BUTTON}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ReceiptText className="h-4 w-4 mr-2" />}
              Payer {fmtFCFA(montantChoisi)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
