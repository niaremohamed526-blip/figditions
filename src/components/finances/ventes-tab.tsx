import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, ShoppingCart, Banknote, Loader2, Store, AlertTriangle, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ENCAISSEMENT_META, fmtFCFA, ANNULATION_META, type VenteRow } from "@/lib/finance-types";

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
  const [annulationFilter, setAnnulationFilter] = useState<"actives" | "annulees" | "toutes">("actives");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Encaissement dialog
  const [encVente, setEncVente] = useState<VenteRow | null>(null);
  const [encMontant, setEncMontant] = useState("");
  const [encDate, setEncDate] = useState(new Date().toISOString().slice(0, 10));
  const [encBusy, setEncBusy] = useState(false);

  // Annulation dialog
  const [cancelVente, setCancelVente] = useState<VenteRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);

  const manuscritMap = useMemo(() => new Map(manuscrits.map((m) => [m.id, m])), [manuscrits]);
  const auteurMap = useMemo(() => new Map(auteurs.map((a) => [a.id, a.nom_complet])), [auteurs]);

  const auteurDe = (v: VenteRow): string => {
    const aid = v.auteur_id ?? manuscritMap.get(v.manuscrit_id)?.auteur_id;
    return (aid && auteurMap.get(aid)) || manuscritMap.get(v.manuscrit_id)?.auteur || "—";
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ventes.filter((v) => {
      if (annulationFilter === "actives" && v.statut_annulation === "annulee") return false;
      if (annulationFilter === "annulees" && v.statut_annulation !== "annulee") return false;
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
  }, [ventes, search, canalFilter, royFilter, encFilter, annulationFilter, from, to, manuscritMap, auteurMap]);

  const activeTotals = useMemo(() => {
    const active = ventes.filter((v) => v.statut_annulation === "active");
    return {
      count: active.length,
      ca: active.reduce((a, v) => a + Number(v.montant_total_fcfa || 0), 0),
      annulees: ventes.filter((v) => v.statut_annulation === "annulee").length,
    };
  }, [ventes]);

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

  const openCancel = (v: VenteRow) => {
    setCancelVente(v);
    setCancelReason("");
  };

  const submitCancel = async () => {
    if (!cancelVente) return;
    setCancelBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc("annuler_vente", {
        p_vente_id: cancelVente.id,
        p_raison: cancelReason.trim() || null,
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data.error ?? "Erreur");
      toast.success(`✅ Vente annulée — ${data.quantite_reversee} exemplaire(s) restauré(s) en stock`);
      setCancelVente(null);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de l'annulation");
    } finally {
      setCancelBusy(false);
    }
  };

  const totaux = useMemo(() => ({
    ca: filtered.reduce((a, v) => a + Number(v.montant_total_fcfa || 0), 0),
    encaisse: filtered.reduce((a, v) => a + Number(v.montant_encaisse_fcfa || 0), 0),
    droits: filtered.reduce((a, v) => a + Number(v.droits_auteur_fcfa || 0), 0),
  }), [filtered]);

  const isCancelled = (v: VenteRow) => v.statut_annulation === "annulee";

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <Card className="bg-card/70">
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
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
            <Select value={annulationFilter} onValueChange={(v) => setAnnulationFilter(v as any)}>
              <SelectTrigger><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="actives">Actives</SelectItem>
                <SelectItem value="annulees">Annulées</SelectItem>
                <SelectItem value="toutes">Toutes</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Du" />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Au" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {filtered.length} vente(s) affichée(s) · {activeTotals.count} active(s) · {activeTotals.annulees} annulée(s) · CA filtré {fmtFCFA(totaux.ca)} · Encaissé {fmtFCFA(totaux.encaisse)} · Droits {fmtFCFA(totaux.droits)}
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
          <CardDescription>
            Chaque vente est traçable : canal, librairie, encaissement, droits d'auteur et annulation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground text-sm">Aucune vente ne correspond aux filtres.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1150px]">
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
                    <th className="py-2 pr-3 text-center">Statut</th>
                    <th className="py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v) => {
                    const m = manuscritMap.get(v.manuscrit_id);
                    const enc = ENCAISSEMENT_META[v.statut_encaissement ?? "en_attente"] ?? ENCAISSEMENT_META.en_attente;
                    const ann = ANNULATION_META[v.statut_annulation ?? "active"];
                    const reste = resteDe(v);
                    const cancelled = isCancelled(v);
                    return (
                      <tr
                        key={v.id}
                        className={cn(
                          "border-b border-border/50 hover:bg-muted/20",
                          cancelled && "opacity-60 bg-red-500/5",
                        )}
                      >
                        <td className={cn("py-2.5 pr-3 whitespace-nowrap", cancelled && "line-through")}>
                          {new Date(v.date_vente).toLocaleDateString("fr-FR")}
                        </td>
                        <td className={cn("py-2.5 pr-3 font-medium", cancelled && "line-through")}>
                          {m?.titre ?? "Livre supprimé"}
                          {cancelled && v.raison_annulation && (
                            <span className="block text-[10px] text-red-400 font-normal">{v.raison_annulation}</span>
                          )}
                        </td>
                        <td className={cn("py-2.5 pr-3", cancelled && "line-through")}>{auteurDe(v)}</td>
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
                        <td className={cn("py-2.5 pr-3 text-right", cancelled && "line-through")}>{v.quantite_vendue}</td>
                        <td className={cn("py-2.5 pr-3 text-right", cancelled && "line-through")}>{fmtFCFA(v.prix_unitaire_fcfa)}</td>
                        <td className={cn("py-2.5 pr-3 text-right font-semibold text-[color:var(--gold)]", cancelled && "line-through")}>
                          {fmtFCFA(v.montant_total_fcfa)}
                          {Number(v.remise_fcfa) > 0 && (
                            <span className="block text-[10px] font-normal text-muted-foreground">
                              remise −{fmtFCFA(v.remise_fcfa)}
                            </span>
                          )}
                        </td>
                        <td className={cn("py-2.5 pr-3 text-right", cancelled && "line-through")}>{fmtFCFA(v.droits_auteur_fcfa)}</td>
                        <td className="py-2.5 pr-3 text-center">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              v.statut_paiement === "paye"
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                : "bg-amber-500/15 text-amber-400 border-amber-500/30",
                              cancelled && "opacity-60",
                            )}
                          >
                            {v.statut_paiement === "paye" ? "Payés" : "En attente"}
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-3">
                          <Badge variant="outline" className={cn("text-[10px]", enc.className, cancelled && "opacity-60")}>{enc.label}</Badge>
                          {reste > 0 && !cancelled && (
                            <span className="block text-[10px] text-muted-foreground mt-0.5">
                              reste {fmtFCFA(reste)}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 text-center">
                          {cancelled ? (
                            <Badge variant="outline" className={cn("text-[10px]", ann.className)}>
                              <XCircle className="h-3 w-3 mr-1" /> {ann.label}
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2.5 text-right">
                          {!cancelled && (
                            <div className="flex justify-end gap-1">
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
                              {v.statut_paiement !== "paye" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs border-red-500/40 text-red-400 hover:bg-red-500/10"
                                  onClick={() => openCancel(v)}
                                >
                                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                  Annuler
                                </Button>
                              )}
                            </div>
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

      {/* Dialog annulation */}
      <AlertDialog open={!!cancelVente} onOpenChange={(o) => !o && setCancelVente(null)}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Annuler cette vente ?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {cancelVente && (
                <>
                  <p>
                    <strong>{manuscritMap.get(cancelVente.manuscrit_id)?.titre ?? "Vente"}</strong> — {fmtFCFA(cancelVente.montant_total_fcfa)} — {cancelVente.quantite_vendue} exemplaire(s)
                  </p>

                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                    <p className="font-medium text-amber-300 mb-2">📊 Aperçu avant / après</p>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">Avant annulation</p>
                        <p>Vente : <span className="text-red-300">{fmtFCFA(cancelVente.montant_total_fcfa)}</span></p>
                        <p>Stock vendu : <span className="text-red-300">{cancelVente.quantite_vendue} ex.</span></p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Après annulation</p>
                        <p>Vente : <span className="text-emerald-400">annulée</span></p>
                        <p>Stock : <span className="text-emerald-400">+{cancelVente.quantite_vendue} ex.</span></p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Motif d'annulation (optionnel)</Label>
                    <Textarea
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Ex : erreur de saisie, retour client, commande annulée…"
                      rows={2}
                    />
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    L'annulation est traçée dans le journal d'audit. Les ventes annulées restent visibles mais sont exclues des tableaux de bord et rapports financiers.
                  </p>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelBusy}>Retour</AlertDialogCancel>
            <AlertDialogAction
              onClick={submitCancel}
              disabled={cancelBusy}
              className="bg-red-600 text-white hover:bg-red-500"
            >
              {cancelBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
              Confirmer l'annulation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
