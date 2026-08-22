import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, ShoppingCart, Banknote, Loader2, Store } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ENCAISSEMENT_META, fmtFCFA, type VenteRow } from "@/lib/finance-types";

interface ManuscritLite { id: string; titre: string; auteur: string; auteur_id: string | null; }
interface AuteurLite { id: string; nom_complet: string; }

export function VentesTab({
  ventes,
  manuscrits,
  auteurs,
  onChanged,
}: {
  ventes: VenteRow[];
  manuscrits: ManuscritLite[];
  auteurs: AuteurLite[];
  onChanged: () => void;
}) {
  const [search, setSearch] = useState("");
  const [canalFilter, setCanalFilter] = useState("all");
  const [royFilter, setRoyFilter] = useState("all");
  const [encFilter, setEncFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Encaissement dialog
  const [encVente, setEncVente] = useState<VenteRow | null>(null);
  const [encMontant, setEncMontant] = useState("");
  const [encDate, setEncDate] = useState(new Date().toISOString().slice(0, 10));
  const [encBusy, setEncBusy] = useState(false);

  const manuscritMap = useMemo(() => new Map(manuscrits.map((m) => [m.id, m])), [manuscrits]);
  const auteurMap = useMemo(() => new Map(auteurs.map((a) => [a.id, a.nom_complet])), [auteurs]);

  const auteurDe = (v: VenteRow): string => {
    const aid = v.auteur_id ?? manuscritMap.get(v.manuscrit_id)?.auteur_id;
    return (aid && auteurMap.get(aid)) || manuscritMap.get(v.manuscrit_id)?.auteur || "—";
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ventes.filter((v) => {
      if (canalFilter !== "all" && (v.canal_vente ?? "interne") !== canalFilter) return false;
      if (royFilter !== "all" && v.statut_paiement !== royFilter) return false;
      if (encFilter !== "all" && (v.statut_encaissement ?? "en_attente") !== encFilter) return false;
      if (from && v.date_vente < from) return false;
      if (to && v.date_vente > to) return false;
      if (q) {
        const m = manuscritMap.get(v.manuscrit_id);
        const hay = `${m?.titre ?? ""} ${auteurDe(v)} ${v.librairie_nom ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventes, search, canalFilter, royFilter, encFilter, from, to, manuscritMap, auteurMap]);

  const resteDe = (v: VenteRow) =>
    Math.max(0, Number(v.montant_total_fcfa || 0) - Number(v.montant_encaisse_fcfa || 0));

  const openEncaissement = (v: VenteRow) => {
    setEncVente(v);
    setEncMontant(String(resteDe(v)));
    setEncDate(new Date().toISOString().slice(0, 10));
  };

  const submitEncaissement = async () => {
    if (!encVente) return;
    const montant = Number(encMontant);
    if (!montant || montant <= 0) { toast.error("Montant invalide"); return; }
    if (montant > resteDe(encVente)) {
      toast.error(`Le montant dépasse le reste à encaisser (${fmtFCFA(resteDe(encVente))})`);
      return;
    }
    setEncBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc("enregistrer_encaissement", {
        p_vente_id: encVente.id,
        p_montant: montant,
        p_date: encDate,
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data.error ?? "Erreur");
      toast.success(
        data.statut === "encaisse"
          ? "✅ Vente totalement encaissée"
          : `✅ Encaissement partiel enregistré — reste ${fmtFCFA(data.reste)}`,
      );
      setEncVente(null);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de l'encaissement");
    } finally {
      setEncBusy(false);
    }
  };

  const totaux = useMemo(() => ({
    ca: filtered.reduce((a, v) => a + Number(v.montant_total_fcfa || 0), 0),
    encaisse: filtered.reduce((a, v) => a + Number(v.montant_encaisse_fcfa || 0), 0),
    droits: filtered.reduce((a, v) => a + Number(v.droits_auteur_fcfa || 0), 0),
  }), [filtered]);

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <Card className="bg-card/70">
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Livre, auteur, librairie…"
                className="pl-9"
              />
            </div>
            <Select value={canalFilter} onValueChange={setCanalFilter}>
              <SelectTrigger><SelectValue placeholder="Canal" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les canaux</SelectItem>
                <SelectItem value="interne">Vente libre</SelectItem>
                <SelectItem value="externe">Librairie</SelectItem>
              </SelectContent>
            </Select>
            <Select value={encFilter} onValueChange={setEncFilter}>
              <SelectTrigger><SelectValue placeholder="Encaissement" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Encaissement : tous</SelectItem>
                <SelectItem value="encaisse">Encaissées</SelectItem>
                <SelectItem value="partiel">Partiellement encaissées</SelectItem>
                <SelectItem value="en_attente">À encaisser</SelectItem>
              </SelectContent>
            </Select>
            <Select value={royFilter} onValueChange={setRoyFilter}>
              <SelectTrigger><SelectValue placeholder="Royalties" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Royalties : toutes</SelectItem>
                <SelectItem value="en_attente">Droits en attente</SelectItem>
                <SelectItem value="paye">Droits payés</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Du" />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Au" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {filtered.length} vente(s) · CA {fmtFCFA(totaux.ca)} · Encaissé {fmtFCFA(totaux.encaisse)} · Droits {fmtFCFA(totaux.droits)}
          </p>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-card/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShoppingCart className="h-5 w-5 text-[color:var(--gold)]" />
            Historique des ventes
          </CardTitle>
          <CardDescription>Chaque vente est traçable : canal, librairie, encaissement et droits d'auteur.</CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground text-sm">Aucune vente ne correspond aux filtres.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1050px]">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Livre</th>
                    <th className="py-2 pr-3">Auteur</th>
                    <th className="py-2 pr-3">Canal</th>
                    <th className="py-2 pr-3 text-right">Qté</th>
                    <th className="py-2 pr-3 text-right">P.U.</th>
                    <th className="py-2 pr-3 text-right">Total</th>
                    <th className="py-2 pr-3 text-right">Droits</th>
                    <th className="py-2 pr-3 text-center">Royalties</th>
                    <th className="py-2 pr-3">Encaissement</th>
                    <th className="py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v) => {
                    const m = manuscritMap.get(v.manuscrit_id);
                    const enc = ENCAISSEMENT_META[v.statut_encaissement ?? "en_attente"] ?? ENCAISSEMENT_META.en_attente;
                    const reste = resteDe(v);
                    return (
                      <tr key={v.id} className="border-b border-border/50 hover:bg-muted/20">
                        <td className="py-2.5 pr-3 whitespace-nowrap">
                          {new Date(v.date_vente).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="py-2.5 pr-3 font-medium">{m?.titre ?? "Livre supprimé"}</td>
                        <td className="py-2.5 pr-3">{auteurDe(v)}</td>
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px]",
                                v.canal_vente === "externe"
                                  ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
                              )}
                            >
                              {v.canal_vente === "externe" ? "Librairie" : "Vente libre"}
                            </Badge>
                            {v.librairie_nom && (
                              <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                                <Store className="h-3 w-3" />{v.librairie_nom}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 pr-3 text-right">{v.quantite_vendue}</td>
                        <td className="py-2.5 pr-3 text-right">{fmtFCFA(v.prix_unitaire_fcfa)}</td>
                        <td className="py-2.5 pr-3 text-right font-semibold text-[color:var(--gold)]">
                          {fmtFCFA(v.montant_total_fcfa)}
                          {Number(v.remise_fcfa) > 0 && (
                            <span className="block text-[10px] font-normal text-muted-foreground">
                              remise −{fmtFCFA(v.remise_fcfa)}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 text-right">{fmtFCFA(v.droits_auteur_fcfa)}</td>
                        <td className="py-2.5 pr-3 text-center">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              v.statut_paiement === "paye"
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                : "bg-amber-500/15 text-amber-400 border-amber-500/30",
                            )}
                          >
                            {v.statut_paiement === "paye" ? "Payés" : "En attente"}
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-3">
                          <Badge variant="outline" className={cn("text-[10px]", enc.className)}>{enc.label}</Badge>
                          {reste > 0 && (
                            <span className="block text-[10px] text-muted-foreground mt-0.5">
                              reste {fmtFCFA(reste)}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-right">
                          {reste > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-[color:var(--gold)]/40 text-[color:var(--gold)] hover:bg-[color:var(--gold)]/10"
                              onClick={() => openEncaissement(v)}
                            >
                              <Banknote className="h-3.5 w-3.5 mr-1" />
                              Encaisser
                            </Button>
                          )}
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

      {/* Dialog encaissement */}
      <Dialog open={!!encVente} onOpenChange={(o) => !o && setEncVente(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>💵 Enregistrer un encaissement</DialogTitle>
            <DialogDescription>
              {encVente && (
                <>
                  {manuscritMap.get(encVente.manuscrit_id)?.titre ?? "Vente"} — reste à encaisser :{" "}
                  <strong className="text-[color:var(--gold)]">{fmtFCFA(encVente ? resteDe(encVente) : 0)}</strong>
                  {encVente.librairie_nom && <> · {encVente.librairie_nom}</>}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Montant reçu (FCFA)</Label>
              <Input
                type="number"
                min={1}
                value={encMontant}
                onChange={(e) => setEncMontant(e.target.value)}
                placeholder="Ex : 25000"
              />
              <p className="text-[11px] text-muted-foreground">
                Vous pouvez saisir un montant partiel — la vente passera en « Partiel » jusqu'au solde complet.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Date d'encaissement</Label>
              <Input type="date" value={encDate} onChange={(e) => setEncDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEncVente(null)} disabled={encBusy}>Annuler</Button>
            <Button
              onClick={submitEncaissement}
              disabled={encBusy}
              className="bg-[linear-gradient(135deg,#C8922A,#A67420)] text-white border-0"
            >
              {encBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Banknote className="h-4 w-4 mr-2" />}
              Valider l'encaissement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
