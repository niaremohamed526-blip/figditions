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
import {
  Search, ShoppingCart, Banknote, Loader2, Store, AlertTriangle, RotateCcw, XCircle,
  ChevronDown, ChevronUp, ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ENCAISSEMENT_META, fmtFCFA, ANNULATION_META, type VenteRow } from "@/lib/finance-types";

interface ManuscritLite { id: string; titre: string; auteur: string; auteur_id: string | null; }
interface AuteurLite { id: string; nom_complet: string; }

interface VenteGroupe {
  key: string;
  librairie_nom: string;
  date_vente: string;
  lignes: VenteRow[];
  total_qte: number;
  total_montant: number;
  total_commission: number;
  total_droits: number;
  total_reste: number;
  nb_actives: number;
}

export function VentesTab({
  ventes,
  manuscrits,
  auteurs,
  onChanged,
  hideDroits = false,
}: {
  ventes: VenteRow[];
  manuscrits: ManuscritLite[];
  auteurs: AuteurLite[];
  onChanged: () => void;
  /** Livres étrangers : la colonne « Droits d'auteur » ne s'applique pas. */
  hideDroits?: boolean;
}) {

  const [search, setSearch] = useState("");
  const [canalFilter, setCanalFilter] = useState("all");
  const [royFilter, setRoyFilter] = useState("all");
  const [encFilter, setEncFilter] = useState("all");
  const [annulationFilter, setAnnulationFilter] = useState<"actives" | "annulees" | "toutes">("actives");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Encaissement individuel (ventes libres)
  const [encVente, setEncVente] = useState<VenteRow | null>(null);
  const [encMontant, setEncMontant] = useState("");
  const [encDate, setEncDate] = useState(new Date().toISOString().slice(0, 10));
  const [encBusy, setEncBusy] = useState(false);

  // Annulation individuelle
  const [cancelVente, setCancelVente] = useState<VenteRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);

  // Actions de groupe
  const [encGroupe, setEncGroupe] = useState<VenteGroupe | null>(null);
  const [encGroupeDate, setEncGroupeDate] = useState(new Date().toISOString().slice(0, 10));
  const [encGroupeBusy, setEncGroupeBusy] = useState(false);
  const [choixGroupe, setChoixGroupe] = useState<VenteGroupe | null>(null);
  const [cancelGroupe, setCancelGroupe] = useState<VenteGroupe | null>(null);
  const [cancelGroupeReason, setCancelGroupeReason] = useState("");
  const [cancelGroupeBusy, setCancelGroupeBusy] = useState(false);

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

  const isCancelled = (v: VenteRow) => v.statut_annulation === "annulee";
  const resteDe = (v: VenteRow) =>
    isCancelled(v) ? 0 : Math.max(0, Number(v.montant_total_fcfa || 0) - Number(v.montant_encaisse_fcfa || 0));

  /** Regroupement librairie + date ; les ventes libres restent individuelles. */
  const { groupes, individuelles } = useMemo(() => {
    const map = new Map<string, VenteGroupe>();
    const individual: VenteRow[] = [];

    for (const v of filtered) {
      if ((v.canal_vente ?? "interne") !== "externe") {
        individual.push(v);
        continue;
      }
      const librairie = v.librairie_nom?.trim() || "Librairie non précisée";
      const key = `${librairie}__${v.date_vente}`;
      let g = map.get(key);
      if (!g) {
        g = {
          key,
          librairie_nom: librairie,
          date_vente: v.date_vente,
          lignes: [],
          total_qte: 0,
          total_montant: 0,
          total_commission: 0,
          total_droits: 0,
          total_reste: 0,
          nb_actives: 0,
        };
        map.set(key, g);
      }
      g.lignes.push(v);
      if (!isCancelled(v)) {
        g.nb_actives += 1;
        g.total_qte += Number(v.quantite_vendue || 0);
        g.total_montant += Number(v.montant_total_fcfa || 0);
        g.total_commission += Number(v.commission_librairie_fcfa || 0);
        g.total_droits += Number(v.droits_auteur_fcfa || 0);
        g.total_reste += resteDe(v);
      }
    }

    const list = [...map.values()]
      .filter((g) => g.lignes.length > 0)
      .sort((a, b) => (a.date_vente < b.date_vente ? 1 : a.date_vente > b.date_vente ? -1 : a.librairie_nom.localeCompare(b.librairie_nom)));

    individual.sort((a, b) => (a.date_vente < b.date_vente ? 1 : -1));
    return { groupes: list, individuelles: individual };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  const activeTotals = useMemo(() => {
    const active = ventes.filter((v) => v.statut_annulation === "active");
    return {
      count: active.length,
      ca: active.reduce((a, v) => a + Number(v.montant_total_fcfa || 0), 0),
      annulees: ventes.filter((v) => v.statut_annulation === "annulee").length,
    };
  }, [ventes]);

  const totaux = useMemo(() => ({
    ca: filtered.reduce((a, v) => a + (isCancelled(v) ? 0 : Number(v.montant_total_fcfa || 0)), 0),
    encaisse: filtered.reduce((a, v) => a + (isCancelled(v) ? 0 : Number(v.montant_encaisse_fcfa || 0)), 0),
    droits: filtered.reduce((a, v) => a + (isCancelled(v) ? 0 : Number(v.droits_auteur_fcfa || 0)), 0),
  }), [filtered]);

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

  /** Encaisse toutes les lignes restantes du groupe, une par une (même logique traçable). */
  const submitEncaissementGroupe = async () => {
    if (!encGroupe) return;
    const cibles = encGroupe.lignes.filter((v) => !isCancelled(v) && resteDe(v) > 0);
    if (cibles.length === 0) { toast.error("Rien à encaisser dans ce groupe"); return; }
    setEncGroupeBusy(true);
    let ok = 0;
    let montant = 0;
    let echecs = 0;
    try {
      for (const v of cibles) {
        const reste = resteDe(v);
        const { data, error } = await (supabase as any).rpc("enregistrer_encaissement", {
          p_vente_id: v.id,
          p_montant: reste,
          p_date: encGroupeDate,
        });
        if (error || data?.ok === false) { echecs += 1; continue; }
        ok += 1;
        montant += reste;
      }
      if (ok > 0) toast.success(`✅ ${ok} vente(s) encaissée(s) — ${fmtFCFA(montant)}`);
      if (echecs > 0) toast.error(`${echecs} vente(s) n'ont pas pu être encaissées`);
      setEncGroupe(null);
      onChanged();
    } finally {
      setEncGroupeBusy(false);
    }
  };

  /** Annule toutes les lignes actives du groupe avec le même motif. */
  const submitCancelGroupe = async () => {
    if (!cancelGroupe) return;
    const raison = cancelGroupeReason.trim();
    if (raison.length < 10) { toast.error("Merci d'indiquer un motif (10 caractères minimum)"); return; }
    const cibles = cancelGroupe.lignes.filter((v) => !isCancelled(v));
    setCancelGroupeBusy(true);
    let ok = 0;
    let ex = 0;
    let echecs = 0;
    try {
      for (const v of cibles) {
        const { data, error } = await (supabase as any).rpc("annuler_vente", {
          p_vente_id: v.id,
          p_raison: raison,
        });
        if (error || data?.ok === false) { echecs += 1; continue; }
        ok += 1;
        ex += Number(data?.quantite_reversee ?? 0);
      }
      if (ok > 0) toast.success(`✅ ${ok} vente(s) annulée(s) — ${ex} exemplaire(s) restauré(s) en stock`);
      if (echecs > 0) toast.error(`${echecs} vente(s) n'ont pas pu être annulées (droits déjà payés ?)`);
      setCancelGroupe(null);
      setCancelGroupeReason("");
      onChanged();
    } finally {
      setCancelGroupeBusy(false);
    }
  };

  const LigneActions = ({ v }: { v: VenteRow }) =>
    isCancelled(v) ? null : (
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs border-red-500/40 text-red-400 hover:bg-red-500/10"
        onClick={(e) => { e.stopPropagation(); openCancel(v); }}
      >
        <RotateCcw className="h-3.5 w-3.5 mr-1" />
        Annuler
      </Button>
    );

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
            {!hideDroits && (
            <Select value={royFilter} onValueChange={setRoyFilter}>
              <SelectTrigger><SelectValue placeholder="Royalties" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Royalties : toutes</SelectItem>
                <SelectItem value="en_attente">Droits en attente</SelectItem>
                <SelectItem value="paye">Droits payés</SelectItem>
              </SelectContent>
            </Select>
            )}
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
            {filtered.length} vente(s) affichée(s) · {groupes.length} dépôt(s) groupé(s) · {activeTotals.count} active(s) · {activeTotals.annulees} annulée(s) · CA filtré {fmtFCFA(totaux.ca)} · Encaissé {fmtFCFA(totaux.encaisse)}{!hideDroits && <> · Droits {fmtFCFA(totaux.droits)}</>}
          </p>
        </CardContent>
      </Card>

      {/* Ventes en librairie — groupées */}
      <Card className="bg-card/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Store className="h-5 w-5 text-[color:var(--gold)]" />
            🏪 Ventes en librairie <span className="text-xs font-normal text-muted-foreground">(groupées par dépôt)</span>
          </CardTitle>
          <CardDescription>
            Un groupe = une librairie et une date. Encaissez tout le dépôt d'un clic, ou dépliez pour voir chaque titre.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {groupes.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground text-sm">Aucune vente en librairie ne correspond aux filtres.</p>
          ) : (
            <div className="space-y-2">
              {groupes.map((g) => {
                const isOpen = !!expanded[g.key];
                const aEncaisser = g.total_reste > 0;
                const toutAnnule = g.nb_actives === 0;
                return (
                  <div
                    key={g.key}
                    className="rounded-xl border border-[rgba(200,146,42,0.15)] bg-[rgba(26,18,8,0.85)] transition-colors hover:border-[rgba(200,146,42,0.3)]"
                  >
                    {/* En-tête du groupe */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpanded((s) => ({ ...s, [g.key]: !s[g.key] }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setExpanded((s) => ({ ...s, [g.key]: !s[g.key] }));
                        }
                      }}
                      className="cursor-pointer px-4 py-4 sm:px-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4"
                    >
                      <div className="flex items-start gap-3 min-w-0 lg:flex-1">
                        <span className="mt-0.5 text-[color:var(--gold)]">
                          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold">
                              {new Date(g.date_vente).toLocaleDateString("fr-FR")}
                            </span>
                            <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/30">
                              Librairie
                            </Badge>
                            <span className="text-sm font-medium truncate">{g.librairie_nom}</span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {g.nb_actives} titre(s) · {g.total_qte} exemplaire(s)
                            {toutAnnule && <span className="text-red-400"> · groupe entièrement annulé</span>}
                          </p>
                        </div>
                      </div>

                      <div className={cn("grid gap-3 text-xs", hideDroits ? "grid-cols-2 lg:w-[260px]" : "grid-cols-3 lg:w-[360px]")}>
                        <div>
                          <p className="text-muted-foreground">Total</p>
                          <p className="font-semibold text-[color:var(--gold)]">{fmtFCFA(g.total_montant)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Commission</p>
                          <p className="font-medium">{fmtFCFA(g.total_commission)}</p>
                        </div>
                        {!hideDroits && (
                        <div>
                          <p className="text-muted-foreground">Droits</p>
                          <p className="font-medium">{fmtFCFA(g.total_droits)}</p>
                        </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        {toutAnnule ? (
                          <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-400 border-red-500/30">
                            <XCircle className="h-3 w-3 mr-1" /> Annulé
                          </Badge>
                        ) : aEncaisser ? (
                          <Badge variant="outline" className="text-[10px] bg-red-500/15 text-red-400 border-red-500/30">
                            À encaisser · {fmtFCFA(g.total_reste)}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                            Payé
                          </Badge>
                        )}
                        {aEncaisser && (
                          <Button
                            size="sm"
                            className="h-8 text-xs bg-[linear-gradient(135deg,#C8922A,#A67420)] text-white border-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEncGroupeDate(new Date().toISOString().slice(0, 10));
                              setEncGroupe(g);
                            }}
                          >
                            <Banknote className="h-3.5 w-3.5 mr-1" />
                            Encaisser tout
                          </Button>
                        )}
                        {!toutAnnule && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs border-red-500/40 text-red-400 hover:bg-red-500/10"
                            onClick={(e) => { e.stopPropagation(); setChoixGroupe(g); }}
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />
                            Annuler
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Détail des titres */}
                    <div
                      className="overflow-hidden transition-all duration-[250ms] ease-in-out"
                      style={{ maxHeight: isOpen ? `${g.lignes.length * 120 + 160}px` : "0px" }}
                    >
                      <div className="border-t border-[rgba(200,146,42,0.08)] px-3 pb-4 pt-3 sm:pl-6">
                        <div className="overflow-x-auto">
                          <table className="w-full text-[13px] min-w-[720px]">
                            <thead>
                              <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                                <th className="py-1.5 pr-3">Livre</th>
                                <th className="py-1.5 pr-3">Auteur</th>
                                <th className="py-1.5 pr-3 text-right">Qté</th>
                                <th className="py-1.5 pr-3 text-right">P.U.</th>
                                <th className="py-1.5 pr-3 text-right">Total</th>
                                {!hideDroits && <th className="py-1.5 pr-3 text-right">Droits</th>}
                                <th className="py-1.5 pr-3">Encaissement</th>
                                <th className="py-1.5 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.lignes.map((v) => {
                                const m = manuscritMap.get(v.manuscrit_id);
                                const enc = ENCAISSEMENT_META[v.statut_encaissement ?? "en_attente"] ?? ENCAISSEMENT_META.en_attente;
                                const cancelled = isCancelled(v);
                                return (
                                  <tr
                                    key={v.id}
                                    className={cn("border-t border-[rgba(200,146,42,0.08)]", cancelled && "opacity-60 bg-red-500/5")}
                                  >
                                    <td className={cn("py-2 pr-3 font-medium", cancelled && "line-through")}>
                                      {m?.titre ?? "Livre supprimé"}
                                      {cancelled && v.raison_annulation && (
                                        <span className="block text-[10px] text-red-400 font-normal no-underline">{v.raison_annulation}</span>
                                      )}
                                    </td>
                                    <td className={cn("py-2 pr-3", cancelled && "line-through")}>{auteurDe(v)}</td>
                                    <td className={cn("py-2 pr-3 text-right", cancelled && "line-through")}>{v.quantite_vendue}</td>
                                    <td className={cn("py-2 pr-3 text-right", cancelled && "line-through")}>{fmtFCFA(v.prix_unitaire_fcfa)}</td>
                                    <td className={cn("py-2 pr-3 text-right font-semibold text-[color:var(--gold)]", cancelled && "line-through")}>
                                      {fmtFCFA(v.montant_total_fcfa)}
                                    </td>
                                    {!hideDroits && <td className={cn("py-2 pr-3 text-right", cancelled && "line-through")}>{fmtFCFA(v.droits_auteur_fcfa)}</td>}
                                    <td className="py-2 pr-3">
                                      {cancelled ? (
                                        <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-400 border-red-500/30">Annulée</Badge>
                                      ) : (
                                        <Badge variant="outline" className={cn("text-[10px]", enc.className)}>{enc.label}</Badge>
                                      )}
                                    </td>
                                    <td className="py-2 text-right">
                                      <LigneActions v={v} />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        {g.total_reste > 0 && (
                          <div className="mt-3 flex justify-end">
                            <Button
                              size="sm"
                              className="h-8 text-xs bg-[linear-gradient(135deg,#C8922A,#A67420)] text-white border-0"
                              onClick={() => {
                                setEncGroupeDate(new Date().toISOString().slice(0, 10));
                                setEncGroupe(g);
                              }}
                            >
                              <Banknote className="h-3.5 w-3.5 mr-1" />
                              Encaisser tout le groupe
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ventes libres — individuelles */}
      <Card className="bg-card/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShoppingBag className="h-5 w-5 text-[color:var(--gold)]" />
            🛍️ Ventes libres
          </CardTitle>
          <CardDescription>
            Ventes directes hors librairie : chaque vente garde son propre encaissement et son annulation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {individuelles.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground text-sm">Aucune vente libre ne correspond aux filtres.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[980px]">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Livre</th>
                    <th className="py-2 pr-3">Auteur</th>
                    <th className="py-2 pr-3 text-right">Qté</th>
                    <th className="py-2 pr-3 text-right">P.U.</th>
                    <th className="py-2 pr-3 text-right">Total</th>
                    {!hideDroits && <th className="py-2 pr-3 text-right">Droits</th>}
                    {!hideDroits && <th className="py-2 pr-3 text-center">Royalties</th>}
                    <th className="py-2 pr-3">Encaissement</th>
                    <th className="py-2 pr-3 text-center">Statut</th>
                    <th className="py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {individuelles.map((v) => {
                    const m = manuscritMap.get(v.manuscrit_id);
                    const enc = ENCAISSEMENT_META[v.statut_encaissement ?? "en_attente"] ?? ENCAISSEMENT_META.en_attente;
                    const ann = ANNULATION_META[v.statut_annulation ?? "active"];
                    const reste = resteDe(v);
                    const cancelled = isCancelled(v);
                    return (
                      <tr
                        key={v.id}
                        className={cn("border-b border-border/50 hover:bg-muted/20", cancelled && "opacity-60 bg-red-500/5")}
                      >
                        <td className={cn("py-2.5 pr-3 whitespace-nowrap", cancelled && "line-through")}>
                          {new Date(v.date_vente).toLocaleDateString("fr-FR")}
                        </td>
                        <td className={cn("py-2.5 pr-3 font-medium", cancelled && "line-through")}>
                          {m?.titre ?? "Livre supprimé"}
                          {cancelled && v.raison_annulation && (
                            <span className="block text-[10px] text-red-400 font-normal no-underline">{v.raison_annulation}</span>
                          )}
                        </td>
                        <td className={cn("py-2.5 pr-3", cancelled && "line-through")}>{auteurDe(v)}</td>
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
                        {!hideDroits && <td className={cn("py-2.5 pr-3 text-right", cancelled && "line-through")}>{fmtFCFA(v.droits_auteur_fcfa)}</td>}
                        {!hideDroits && <td className="py-2.5 pr-3 text-center">
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
                        </td>}
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
                              {(hideDroits || v.statut_paiement !== "paye") && <LigneActions v={v} />}
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

      {/* Dialog encaissement individuel */}
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

      {/* Dialog encaissement de groupe */}
      <Dialog open={!!encGroupe} onOpenChange={(o) => !o && setEncGroupe(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>💵 Encaisser tout le dépôt</DialogTitle>
            <DialogDescription>
              {encGroupe && (
                <>
                  Marquer comme encaissé : {encGroupe.lignes.filter((v) => !isCancelled(v) && resteDe(v) > 0).length} vente(s) pour{" "}
                  <strong>{encGroupe.librairie_nom}</strong> du {new Date(encGroupe.date_vente).toLocaleDateString("fr-FR")} ?
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {encGroupe && (
            <div className="space-y-3">
              <div className="rounded-lg border border-[rgba(200,146,42,0.25)] bg-[rgba(200,146,42,0.08)] p-3 text-sm space-y-1">
                <p>Montant total : <strong className="text-[color:var(--gold)]">{fmtFCFA(encGroupe.total_montant)}</strong></p>
                <p>Reste à encaisser : <strong className="text-[color:var(--gold)]">{fmtFCFA(encGroupe.total_reste)}</strong></p>
                <p>Commission librairie : {fmtFCFA(encGroupe.total_commission)}</p>
                {!hideDroits && <p>Droits d'auteur : {fmtFCFA(encGroupe.total_droits)}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Date d'encaissement</Label>
                <Input type="date" value={encGroupeDate} onChange={(e) => setEncGroupeDate(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEncGroupe(null)} disabled={encGroupeBusy}>Annuler</Button>
            <Button
              onClick={submitEncaissementGroupe}
              disabled={encGroupeBusy}
              className="bg-[linear-gradient(135deg,#C8922A,#A67420)] text-white border-0"
            >
              {encGroupeBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Banknote className="h-4 w-4 mr-2" />}
              Confirmer l'encaissement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Choix d'annulation de groupe */}
      <Dialog open={!!choixGroupe} onOpenChange={(o) => !o && setChoixGroupe(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Que souhaitez-vous annuler ?</DialogTitle>
            <DialogDescription>
              {choixGroupe && (
                <>
                  {choixGroupe.librairie_nom} — {new Date(choixGroupe.date_vente).toLocaleDateString("fr-FR")} · {choixGroupe.nb_actives} titre(s) actif(s)
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                if (choixGroupe) setExpanded((s) => ({ ...s, [choixGroupe.key]: true }));
                setChoixGroupe(null);
              }}
            >
              Annuler une vente spécifique
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-red-500/40 text-red-400 hover:bg-red-500/10"
              onClick={() => {
                setCancelGroupe(choixGroupe);
                setCancelGroupeReason("");
                setChoixGroupe(null);
              }}
            >
              Annuler tout le groupe
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog annulation individuelle */}
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

      {/* Dialog annulation de groupe */}
      <AlertDialog open={!!cancelGroupe} onOpenChange={(o) => !o && setCancelGroupe(null)}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Annuler tout le groupe ?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {cancelGroupe && (
                <>
                  <p>
                    <strong>{cancelGroupe.librairie_nom}</strong> — {new Date(cancelGroupe.date_vente).toLocaleDateString("fr-FR")} ·{" "}
                    {cancelGroupe.nb_actives} vente(s) · {cancelGroupe.total_qte} exemplaire(s) · {fmtFCFA(cancelGroupe.total_montant)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Chaque ligne est annulée séparément : les exemplaires sont remis en stock titre par titre. Les ventes dont les droits d'auteur sont déjà payés seront ignorées.
                  </p>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Motif d'annulation (obligatoire, 10 caractères min.)</Label>
                    <Textarea
                      value={cancelGroupeReason}
                      onChange={(e) => setCancelGroupeReason(e.target.value)}
                      placeholder="Ex : dépôt saisi deux fois, bordereau erroné…"
                      rows={2}
                    />
                  </div>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelGroupeBusy}>Retour</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); submitCancelGroupe(); }}
              disabled={cancelGroupeBusy || cancelGroupeReason.trim().length < 10}
              className="bg-red-600 text-white hover:bg-red-500"
            >
              {cancelGroupeBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
              Annuler les {cancelGroupe?.nb_actives ?? 0} vente(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
