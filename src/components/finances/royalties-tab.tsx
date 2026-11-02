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
      .save(`Releve_${releveAnnee}_${clean}.pdf`);
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
    const pdf = generateQuittancePdf({
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
    });
    pdf.save(quittanceFilename(p.numero, p.auteurNom));
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

  return (
    <div className="space-y-6">
      {/* Royalties en attente */}
      <Card className="bg-card/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-[color:var(--gold)]" />
            Royalties à payer par auteur
          </CardTitle>
          <CardDescription>
            {pl(pendingGroups.length, "auteur", "auteurs")} en attente de paiement. Chaque paiement génère une quittance numérotée
            téléchargeable (preuve pour les deux parties).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingGroups.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground text-sm flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Aucune royalty en attente : tout est réglé.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingGroups.map((g) => (
                <div key={g.key} className="rounded-xl border border-border/60 bg-background/40 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{g.nom}</p>
                      <p className="text-xs text-muted-foreground">{pl(g.ventes.length, "vente", "ventes")} en attente</p>
                    </div>
                    <p className="text-lg font-bold text-[color:var(--gold)]">{fmtFCFA(g.montant)}</p>
                  </div>
                  <div className="text-[11px] text-muted-foreground space-y-0.5 max-h-20 overflow-y-auto">
                    {g.ventes.slice(0, 5).map((v) => (
                      <p key={v.id}>
                        • {manuscritMap.get(v.manuscrit_id)?.titre ?? "Livre"} : {v.quantite_vendue} ex. : {fmtFCFA(v.droits_auteur_fcfa)}
                      </p>
                    ))}
                    {g.ventes.length > 5 && <p>… et {pl(g.ventes.length - 5, "autre", "autres")}</p>}
                  </div>
                  <Button
                    onClick={() => { setPayGroup(g); setChoix(new Set(g.ventes.map((v) => v.id))); setMethode("especes"); setReference(""); setNotes(""); }}
                    className="w-full bg-[linear-gradient(135deg,#C8922A,#A67420)] text-white border-0 font-semibold"
                  >
                    <ReceiptText className="h-4 w-4 mr-2" />
                    Payer {fmtFCFA(g.montant)} et générer la quittance
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Relevé annuel d'un auteur */}
      {auteursAvecVentes.length > 0 && (
        <Card className="bg-card/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Download className="h-5 w-5 text-[color:var(--gold)]" />
              Relevé pour un auteur
            </CardTitle>
            <CardDescription>Toutes ses ventes de l'année, ce qui est payé et ce qui reste. À lui envoyer.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
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
            <Button onClick={telechargerReleve} disabled={!releveAuteur} className="rounded-md bg-[#C8922A] text-white hover:bg-[#B5821F]">
              <Download className="h-4 w-4 mr-2" /> Relevé PDF
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Historique des paiements */}
      <Card className="bg-card/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ReceiptText className="h-5 w-5 text-[color:var(--gold)]" />
            Historique des paiements de royalties
          </CardTitle>
          <CardDescription>
            Chaque quittance est numérotée, datée et vérifiable. Re-téléchargez le reçu à tout moment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paiements.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground text-sm">Aucun paiement de royalties enregistré.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[820px]">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">N° quittance</th>
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Auteur</th>
                    <th className="py-2 pr-3 text-right">Montant</th>
                    <th className="py-2 pr-3">Méthode</th>
                    <th className="py-2 pr-3">Référence</th>
                    <th className="py-2 pr-3">Payé par</th>
                    <th className="py-2 text-right">Reçu</th>
                  </tr>
                </thead>
                <tbody>
                  {paiements.map((p) => (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="py-2.5 pr-3">
                        <Badge variant="outline" className="font-mono text-[11px] border-[color:var(--gold)]/40 text-[color:var(--gold)]">
                          {p.numero}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        {new Date(p.paye_le).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="py-2.5 pr-3 font-medium">{p.auteur_nom}</td>
                      <td className="py-2.5 pr-3 text-right font-semibold text-emerald-400">{fmtFCFA(p.montant_fcfa)}</td>
                      <td className="py-2.5 pr-3">{methodeLabel(p.methode)}</td>
                      <td className="py-2.5 pr-3 text-muted-foreground">{p.reference ?? "—"}</td>
                      <td className="py-2.5 pr-3 text-muted-foreground">{p.paye_par_nom ?? "—"}</td>
                      <td className="py-2.5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-[color:var(--gold)]/40 text-[color:var(--gold)] hover:bg-[color:var(--gold)]/10"
                          onClick={() => reprint(p)}
                          disabled={downloadingId === p.id}
                        >
                          {downloadingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                          PDF
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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
              className={cn("bg-[linear-gradient(135deg,#C8922A,#A67420)] text-white border-0")}
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
