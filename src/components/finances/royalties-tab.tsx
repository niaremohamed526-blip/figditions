import { useMemo, useState } from "react";
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
      const ids = payGroup.ventes.map((v) => v.id);
      const { data, error } = await (supabase as any).rpc("payer_royalties_auteur", {
        p_vente_ids: ids,
        p_methode: methode,
        p_reference: reference.trim() || null,
        p_notes: notes.trim() || null,
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data.error ?? "Erreur");

      toast.success(`✅ Quittance ${data.numero} générée : ${fmtFCFA(data.montant)} payés à ${data.auteur_nom}`);

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
            {pendingGroups.length} auteur(s) en attente de paiement. Chaque paiement génère une quittance numérotée
            téléchargeable (preuve pour les deux parties).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingGroups.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground text-sm flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Aucune royalty en attente : tout est réglé. 🎉
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingGroups.map((g) => (
                <div key={g.key} className="rounded-xl border border-border/60 bg-background/40 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{g.nom}</p>
                      <p className="text-xs text-muted-foreground">{g.ventes.length} vente(s) en attente</p>
                    </div>
                    <p className="text-lg font-bold text-[color:var(--gold)]">{fmtFCFA(g.montant)}</p>
                  </div>
                  <div className="text-[11px] text-muted-foreground space-y-0.5 max-h-20 overflow-y-auto">
                    {g.ventes.slice(0, 5).map((v) => (
                      <p key={v.id}>
                        • {manuscritMap.get(v.manuscrit_id)?.titre ?? "Livre"} : {v.quantite_vendue} ex. : {fmtFCFA(v.droits_auteur_fcfa)}
                      </p>
                    ))}
                    {g.ventes.length > 5 && <p>… et {g.ventes.length - 5} autre(s)</p>}
                  </div>
                  <Button
                    onClick={() => { setPayGroup(g); setMethode("especes"); setReference(""); setNotes(""); }}
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
            <DialogTitle>💰 Payer les royalties : {payGroup?.nom}</DialogTitle>
            <DialogDescription>
              {payGroup && (
                <>
                  {payGroup.ventes.length} vente(s) seront marquées comme payées · Total :{" "}
                  <strong className="text-[color:var(--gold)]">{fmtFCFA(payGroup.montant)}</strong>
                  <br />Une quittance numérotée sera générée et téléchargée automatiquement.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
              disabled={busy}
              className={cn("bg-[linear-gradient(135deg,#C8922A,#A67420)] text-white border-0")}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ReceiptText className="h-4 w-4 mr-2" />}
              Confirmer le paiement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
