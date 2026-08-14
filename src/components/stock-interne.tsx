import { useEffect, useMemo, useState } from "react";
import {
  Warehouse, Truck, ShoppingBag, BellRing, Plus, ArrowUpDown, History, Pencil,
  Loader2, AlertTriangle, ChevronDown, Calendar as CalendarIcon, BookOpen, Search,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, BarChart, Bar, Legend,
} from "recharts";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookCombobox } from "@/components/book-combobox";
import {
  StockSearchBar, StockBar, Highlight, norm, useDebounced,
  type StockLevelFilter, type StockSort,
} from "@/components/stock-search-bar";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fcfa } from "@/lib/format";

interface PubManuscrit {
  id: string; titre: string; auteur: string; auteur_id?: string | null; statut: string;
}
interface StockInterne {
  id: string;
  manuscrit_id: string;
  quantite_imprimee: number;
  quantite_disponible: number;
  quantite_reservee: number;
  quantite_transferee_librairies: number;
  quantite_vendue_directement: number;
  quantite_exposee_evenements: number;
  seuil_alerte: number;
  prix_vente_direct_fcfa: number;
  cout_unitaire_impression_fcfa: number;
  emplacement: string | null;
  date_impression: string | null;
  created_at?: string | null;
}
interface Mouvement {
  id: string;
  stock_interne_id: string | null;
  manuscrit_id: string;
  type_mouvement: string;
  quantite: number;
  destination: string | null;
  notes: string | null;
  effectue_par: string | null;
  date_mouvement: string;
  created_at: string;
}

const MOUVEMENT_LABEL: Record<string, { icon: string; label: string; sign: "+" | "-" | "~"; color: string }> = {
  impression:          { icon: "📥", label: "Nouveau stock reçu",       sign: "+", color: "text-[#C8922A]" },
  transfert_librairie: { icon: "📤", label: "Transfert vers librairie", sign: "-", color: "text-blue-400" },
  vente_directe:       { icon: "🛍️", label: "Vente libre",              sign: "-", color: "text-blue-400" },
  evenement:           { icon: "📚", label: "Événement / Exposition",   sign: "-", color: "text-blue-400" },
  retour_librairie:    { icon: "🔄", label: "Retour de dépôt",          sign: "+", color: "text-[#C8922A]" },
  perte:               { icon: "❌", label: "Perte / Dommage",          sign: "-", color: "text-red-400" },
  ajustement:          { icon: "🔧", label: "Ajustement manuel",        sign: "~", color: "text-yellow-400" },
};

export function StockInterneTab({ entrepriseId, userId }: { entrepriseId: string | null; userId: string | null }) {
  const [manuscrits, setManuscrits] = useState<PubManuscrit[]>([]);
  const [stocks, setStocks] = useState<StockInterne[] | null>(null);
  const [externalStocks, setExternalStocks] = useState<any[]>([]);
  const [mouvements, setMouvements] = useState<Mouvement[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [mvtOpen, setMvtOpen] = useState(false);
  const [mvtPrefillId, setMvtPrefillId] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<StockInterne | null>(null);
  const [editThresholdFor, setEditThresholdFor] = useState<StockInterne | null>(null);
  const [editStockFor, setEditStockFor] = useState<StockInterne | null>(null);
  const [alertsOpen, setAlertsOpen] = useState(true);
  const [alertsAll, setAlertsAll] = useState(false);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<StockLevelFilter>("tous");
  const [sort, setSort] = useState<StockSort>("titre_asc");
  const term = useDebounced(query, 200);


  const load = async () => {
    setStocks(null);
    const [{ data: m }, { data: s }, { data: mv }, { data: ext }] = await Promise.all([
      supabase.from("manuscrits").select("id, titre, auteur, auteur_id, statut"),
      (supabase as any).from("stock_interne").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("mouvements_stock").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("stocks").select("id, manuscrit_id, librairie_nom, exemplaires_deposes, exemplaires_restants"),
    ]);
    setManuscrits((m ?? []) as PubManuscrit[]);
    setStocks((s ?? []) as StockInterne[]);
    setMouvements((mv ?? []) as Mouvement[]);
    setExternalStocks((ext ?? []) as any[]);
  };

  useEffect(() => { if (entrepriseId) load(); }, [entrepriseId]);

  const mMap = useMemo(() => Object.fromEntries(manuscrits.map((x) => [x.id, x])), [manuscrits]);
  const publishedBooks = useMemo(() => manuscrits.filter((m) => m.statut === "publie"), [manuscrits]);

  // Rows: include published books even with no stock row yet (placeholder).
  const rows = useMemo(() => {
    const map = new Map<string, StockInterne & { titre: string; auteur: string }>();
    (stocks ?? []).forEach((s) => {
      const m = mMap[s.manuscrit_id];
      map.set(s.manuscrit_id, { ...s, titre: m?.titre ?? "—", auteur: m?.auteur ?? "—" });
    });
    publishedBooks.forEach((m) => {
      if (!map.has(m.id)) {
        map.set(m.id, {
          id: "",
          manuscrit_id: m.id,
          quantite_imprimee: 0, quantite_disponible: 0, quantite_reservee: 0,
          quantite_transferee_librairies: 0, quantite_vendue_directement: 0,
          quantite_exposee_evenements: 0, seuil_alerte: 10,
          prix_vente_direct_fcfa: 0, cout_unitaire_impression_fcfa: 0,
          emplacement: "Entrepôt principal", date_impression: null, created_at: null,
          titre: m.titre, auteur: m.auteur,
        });
      }
    });
    return [...map.values()];
  }, [stocks, publishedBooks, mMap]);

  const visibleRows = useMemo(() => {
    const t = norm(term).trim();
    let list = rows.filter((r) => {
      if (t && !norm(`${r.titre} ${r.auteur} ${r.emplacement ?? ""}`).includes(t)) return false;
      if (level === "epuise") return r.quantite_disponible === 0;
      if (level === "bas") return r.quantite_disponible > 0 && r.quantite_disponible <= r.seuil_alerte;
      if (level === "bon") return r.quantite_disponible > r.seuil_alerte;
      return true;
    });
    const byDate = (r: typeof rows[number]) => new Date(r.created_at ?? 0).getTime();
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "titre_desc": return b.titre.localeCompare(a.titre, "fr");
        case "dispo_asc": return a.quantite_disponible - b.quantite_disponible;
        case "dispo_desc": return b.quantite_disponible - a.quantite_disponible;
        case "date_desc": return byDate(b) - byDate(a);
        case "date_asc": return byDate(a) - byDate(b);
        default: return a.titre.localeCompare(b.titre, "fr");
      }
    });
    return list;
  }, [rows, term, level, sort]);


  const totals = useMemo(() => {
    const list = stocks ?? [];
    const disponible = list.reduce((s, x) => s + x.quantite_disponible, 0);
    const transferees = list.reduce((s, x) => s + x.quantite_transferee_librairies, 0);
    const vendusDirect = list.reduce((s, x) => s + x.quantite_vendue_directement, 0);
    const revenueDirect = list.reduce((s, x) => s + x.quantite_vendue_directement * Number(x.prix_vente_direct_fcfa || 0), 0);
    const low = list.filter((x) => x.quantite_disponible <= x.seuil_alerte && x.quantite_imprimee > 0);
    const valeurStock = list.reduce((s, x) => s + x.quantite_disponible * Number(x.cout_unitaire_impression_fcfa || 0), 0);
    return { disponible, transferees, vendusDirect, revenueDirect, lowCount: low.length, low, valeurStock };
  }, [stocks]);

  const openMouvement = (manuscritId?: string) => {
    setMvtPrefillId(manuscritId ?? null);
    setMvtOpen(true);
  };

  if (!entrepriseId || stocks === null) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SumCard icon={<Warehouse />} label="📦 Total en stock" value={String(totals.disponible)} accent="#C8922A" />
        <SumCard icon={<Truck />} label="🔄 Transférés librairies" value={String(totals.transferees)} accent="#3B82F6" />
        <SumCard
          icon={<ShoppingBag />}
          label="🛍️ Ventes libres"
          value={String(totals.vendusDirect)}
          sub={fcfa(totals.revenueDirect)}
          accent="#E8B84B"
        />
        <SumCard
          icon={<BellRing />}
          label="⚠️ Alertes stock bas"
          value={String(totals.lowCount)}
          accent="#EF4444"
          pulse={totals.lowCount > 0}
        />
      </div>

      {/* Low stock alert panel */}
      {totals.low.length > 0 && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 overflow-hidden">
          <button
            type="button"
            onClick={() => setAlertsOpen((o) => !o)}
            className="w-full flex items-center justify-between p-4"
          >
            <p className="font-semibold text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {totals.low.length} livre(s) en stock critique
            </p>
            <ChevronDown className={cn("h-4 w-4 text-red-400 transition-transform", alertsOpen && "rotate-180")} />
          </button>
          {alertsOpen && (
            <div className="px-3 pb-3 sm:px-4 sm:pb-4 space-y-2 max-h-[400px] overflow-y-auto overflow-x-hidden animate-fade-in">
              {(alertsAll ? totals.low : totals.low.slice(0, 3)).map((s) => {
                const q = s.quantite_disponible;
                const atSeuil = q > 0 && q === s.seuil_alerte;
                return (
                  <div
                    key={s.id}
                    className="w-full box-border overflow-hidden p-2.5 sm:p-3 rounded-xl border border-red-500/20 bg-card/80"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] sm:text-sm font-semibold leading-tight break-words">
                          {mMap[s.manuscrit_id]?.titre ?? "—"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground break-words">
                          {mMap[s.manuscrit_id]?.auteur ?? "—"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className={cn(
                            "text-sm sm:text-base font-bold tabular-nums whitespace-nowrap",
                            atSeuil ? "text-orange-400" : "text-red-400",
                          )}
                        >
                          {q === 0 ? "ÉPUISÉ" : atSeuil ? `${q} ex. ⚠️` : `${q} ex.`}
                        </p>
                        <p className="text-[11px] text-muted-foreground whitespace-nowrap">seuil: {s.seuil_alerte}</p>
                      </div>
                    </div>
                    <div className="flex flex-col min-[420px]:flex-row gap-2 w-full">
                      <Button asChild size="sm" variant="outline" className="flex-1 min-w-0 text-[10px] sm:text-xs px-2">
                        <Link to="/estimateur" search={{ manuscrit: s.manuscrit_id }} className="truncate">
                          <span className="truncate sm:hidden">🖨️ Réimprimer</span>
                          <span className="hidden sm:inline truncate">Commander une impression</span>
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openMouvement(s.manuscrit_id)}
                        className="flex-1 min-w-0 text-[10px] sm:text-xs px-2"
                      >
                        <span className="truncate sm:hidden">↩️ Transfert</span>
                        <span className="hidden sm:inline truncate">Transférer depuis librairie</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
              {totals.low.length > 3 && (
                <button
                  type="button"
                  onClick={() => setAlertsAll((v) => !v)}
                  className="w-full rounded-lg border border-red-500/30 bg-red-500/5 py-2 text-xs font-semibold text-red-400"
                >
                  {alertsAll ? "Voir moins" : `+ ${totals.low.length - 3} autres livres en stock critique`}
                </button>
              )}
            </div>
          )}

        </div>
      )}

      {/* Header actions */}
      <div className="flex items-center justify-end">
        <Button onClick={() => setAddOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" /> Nouveau stock reçu
        </Button>
      </div>

      {/* Search + filters */}
      {rows.length > 0 && (
        <StockSearchBar
          query={query}
          onQuery={setQuery}
          level={level}
          onLevel={setLevel}
          sort={sort}
          onSort={setSort}
          resultCount={visibleRows.length}
          totalCount={rows.length}
          activeTerm={term}
        />
      )}

      {/* Inventory table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {rows.length === 0 ? (
          <div className="py-14 text-center px-4">
            <Warehouse className="h-10 w-10 mx-auto text-muted-foreground/60" />
            <p className="mt-3 font-medium">Aucun livre publié</p>
            <p className="text-sm text-muted-foreground">Publiez un manuscrit pour commencer à gérer votre stock interne.</p>
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="py-14 text-center px-4 animate-[fade-up_0.3s_ease-out_both]">
            <Search className="h-10 w-10 mx-auto text-[#C8922A]" />
            <p className="mt-3 font-medium">
              {term.trim() ? `Aucun résultat pour « ${term.trim()} »` : "Aucun livre pour ce filtre"}
            </p>
            <p className="text-sm text-muted-foreground">Essayez avec un autre titre ou nom d'auteur.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Livre</th>
                  <th className="px-4 py-3 font-medium text-center">Imprimés</th>
                  <th className="px-4 py-3 font-medium text-center">Disponibles</th>
                  <th className="px-4 py-3 font-medium text-center hidden md:table-cell">Réservés</th>
                  <th className="px-4 py-3 font-medium text-center hidden md:table-cell">Librairies</th>
                  <th className="px-4 py-3 font-medium text-center hidden lg:table-cell">Ventes libres</th>
                  <th className="px-4 py-3 font-medium text-center hidden lg:table-cell">Événements</th>
                  <th className="px-4 py-3 font-medium text-right hidden xl:table-cell">Prix direct</th>
                  <th className="px-4 py-3 font-medium text-right hidden xl:table-cell">Coût unit.</th>
                  <th className="px-4 py-3 font-medium text-right">Valeur stock</th>
                  <th className="px-4 py-3 font-medium text-center hidden md:table-cell">Seuil</th>
                  <th className="px-4 py-3 font-medium w-44 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => {
                  const dispoCls =
                    r.quantite_disponible === 0
                      ? "text-red-400 bg-red-500/15 border-red-500/30"
                      : r.quantite_disponible <= r.seuil_alerte
                      ? "text-orange-400 bg-orange-500/15 border-orange-500/30"
                      : "text-[#C8922A] bg-primary/15 border-primary/30";
                  const valeur = r.quantite_disponible * Number(r.cout_unitaire_impression_fcfa || 0);
                  return (
                    <tr key={r.manuscrit_id} className="group border-t border-border hover:bg-primary/5 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <span className="text-lg">📚</span>
                          <div className="min-w-0">
                            <p className="font-medium"><Highlight text={r.titre} term={term} /></p>
                            <p className="text-xs text-[#C8922A]"><Highlight text={r.auteur} term={term} /></p>
                            {r.emplacement && (
                              <span className="mt-1 inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                                <Highlight text={r.emplacement} term={term} />
                              </span>
                            )}
                            <div className="mt-1.5">
                              <StockBar dispo={r.quantite_disponible} imprimes={r.quantite_imprimee} />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground tabular-nums">{r.quantite_imprimee}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn("inline-flex items-center justify-center min-w-9 px-2 h-6 rounded-full border text-xs font-semibold", dispoCls)}>
                          {r.quantite_disponible}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground tabular-nums hidden md:table-cell">{r.quantite_reservee}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground tabular-nums hidden md:table-cell">{r.quantite_transferee_librairies}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground tabular-nums hidden lg:table-cell">{r.quantite_vendue_directement}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground tabular-nums hidden lg:table-cell">{r.quantite_exposee_evenements}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground tabular-nums hidden xl:table-cell">{fcfa(r.prix_vente_direct_fcfa)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground tabular-nums hidden xl:table-cell">{fcfa(r.cout_unitaire_impression_fcfa)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[color:var(--gold)] tabular-nums">{fcfa(valeur)}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground hidden md:table-cell">
                        <button
                          onClick={() => setEditThresholdFor(r)}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                          title="Modifier le seuil"
                        >
                          {r.seuil_alerte} <Pencil className="h-3 w-3" />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" title="Nouveau stock"
                            onClick={() => { setMvtPrefillId(r.manuscrit_id); setAddOpen(true); }}>
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" title="Corriger / modifier le stock"
                            onClick={() => r.id && setEditStockFor(r)} disabled={!r.id}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" title="Mouvement"
                            onClick={() => openMouvement(r.manuscrit_id)}>
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" title="Historique"
                            onClick={() => r.id && setHistoryFor(r)} disabled={!r.id}>
                            <History className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Distribution analytics */}
      <DistributionAnalytics stocks={stocks ?? []} mMap={mMap} valeurStock={totals.valeurStock} mouvements={mouvements} />

      {/* Drawers / modals */}
      <Sheet open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setMvtPrefillId(null); }}>
        <SheetContent side="right" className="bg-card border-border w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>📥 Nouveau stock reçu</SheetTitle></SheetHeader>
          <AddStockForm
            key={String(addOpen) + (mvtPrefillId ?? "")}
            entrepriseId={entrepriseId}
            userId={userId}
            books={publishedBooks}
            existingStocks={stocks ?? []}
            prefillManuscritId={mvtPrefillId}
            onSaved={() => { setAddOpen(false); setMvtPrefillId(null); load(); }}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={mvtOpen} onOpenChange={(o) => { setMvtOpen(o); if (!o) setMvtPrefillId(null); }}>
        <SheetContent side="right" className="bg-card border-border w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>📤 Enregistrer un mouvement</SheetTitle></SheetHeader>
          <MouvementForm
            key={String(mvtOpen) + (mvtPrefillId ?? "")}
            entrepriseId={entrepriseId}
            userId={userId}
            stocks={stocks ?? []}
            externalStocks={externalStocks}
            books={publishedBooks}
            prefillManuscritId={mvtPrefillId}
            onSaved={() => { setMvtOpen(false); setMvtPrefillId(null); load(); }}
          />
        </SheetContent>
      </Sheet>

      <Dialog open={!!historyFor} onOpenChange={(o) => !o && setHistoryFor(null)}>
        <DialogContent className="bg-card border-border max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>📊 Historique des mouvements</DialogTitle></DialogHeader>
          {historyFor && (
            <HistoryView
              stock={historyFor}
              titre={mMap[historyFor.manuscrit_id]?.titre ?? "—"}
              auteur={mMap[historyFor.manuscrit_id]?.auteur ?? "—"}
              mouvements={mouvements.filter((m) => m.manuscrit_id === historyFor.manuscrit_id)}
            />
          )}
        </DialogContent>
      </Dialog>

      <ThresholdDialog
        open={!!editThresholdFor}
        stock={editThresholdFor}
        onClose={() => setEditThresholdFor(null)}
        onSaved={() => { setEditThresholdFor(null); load(); }}
      />

      <EditStockDialog
        open={!!editStockFor}
        stock={editStockFor}
        titre={editStockFor ? (mMap[editStockFor.manuscrit_id]?.titre ?? "—") : ""}
        entrepriseId={entrepriseId}
        userId={userId}
        onClose={() => setEditStockFor(null)}
        onSaved={() => { setEditStockFor(null); load(); }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Summary card                                                       */
/* ------------------------------------------------------------------ */

function SumCard({ icon, label, value, sub, accent, pulse }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent: string; pulse?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 transition-shadow",
        pulse && "animate-pulse",
      )}
      style={{ borderColor: pulse ? accent : undefined, boxShadow: pulse ? `0 0 14px ${accent}55` : undefined }}
    >
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <span style={{ color: accent }}>{icon}</span>
        {label}
      </div>
      <p className="mt-1.5 text-2xl font-bold tabular-nums" style={{ color: accent }}>{value}</p>
      {sub && <p className="text-xs text-[color:var(--gold)] mt-0.5 tabular-nums">{sub}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Add stock form                                                     */
/* ------------------------------------------------------------------ */

function AddStockForm({
  entrepriseId, userId, books, existingStocks, prefillManuscritId, onSaved,
}: {
  entrepriseId: string;
  userId: string | null;
  books: PubManuscrit[];
  existingStocks: StockInterne[];
  prefillManuscritId: string | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    manuscrit_id: prefillManuscritId ?? "",
    quantite: 0,
    date_impression: new Date(),
    cout_unitaire: 0,
    prix_vente: 0,
    emplacement: "Entrepôt principal",
    notes: "",
  });
  const [loading, setLoading] = useState(false);

  // Auto-fill from last estimation when picking a book
  useEffect(() => {
    if (!form.manuscrit_id) return;
    const existing = existingStocks.find((s) => s.manuscrit_id === form.manuscrit_id);
    if (existing) {
      setForm((f) => ({
        ...f,
        cout_unitaire: f.cout_unitaire || Number(existing.cout_unitaire_impression_fcfa) || 0,
        prix_vente: f.prix_vente || Number(existing.prix_vente_direct_fcfa) || 0,
        emplacement: existing.emplacement || f.emplacement,
      }));
      return;
    }
    (async () => {
      const { data } = await (supabase as any)
        .from("estimations_cout")
        .select("cout_total_fcfa, tirage, prix_vente_suggere_fcfa")
        .eq("manuscrit_id", form.manuscrit_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        const unit = data.tirage ? Number(data.cout_total_fcfa) / Number(data.tirage) : 0;
        setForm((f) => ({
          ...f,
          cout_unitaire: f.cout_unitaire || Math.round(unit),
          prix_vente: f.prix_vente || Number(data.prix_vente_suggere_fcfa) || 0,
        }));
      }
    })();
  }, [form.manuscrit_id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.manuscrit_id) return toast.error("Sélectionnez un livre");
    if (form.quantite <= 0) return toast.error("Quantité invalide");
    setLoading(true);

    const existing = existingStocks.find((s) => s.manuscrit_id === form.manuscrit_id);

    if (!existing) {
      const { error } = await (supabase as any).from("stock_interne").insert({
        entreprise_id: entrepriseId,
        manuscrit_id: form.manuscrit_id,
        quantite_imprimee: 0,
        quantite_disponible: 0,
        cout_unitaire_impression_fcfa: form.cout_unitaire,
        prix_vente_direct_fcfa: form.prix_vente,
        emplacement: form.emplacement,
        date_impression: format(form.date_impression, "yyyy-MM-dd"),
      });
      if (error) { setLoading(false); return toast.error(error.message); }
    } else {
      const { error } = await (supabase as any).from("stock_interne").update({
        cout_unitaire_impression_fcfa: form.cout_unitaire || existing.cout_unitaire_impression_fcfa,
        prix_vente_direct_fcfa: form.prix_vente || existing.prix_vente_direct_fcfa,
        emplacement: form.emplacement,
        date_impression: format(form.date_impression, "yyyy-MM-dd"),
      }).eq("id", existing.id);
      if (error) { setLoading(false); return toast.error(error.message); }
    }

    // Quantités mises à jour côté serveur (atomique) + mouvement enregistré
    const { error: rpcErr } = await (supabase as any).rpc("record_stock_mouvement", {
      p_manuscrit_id: form.manuscrit_id,
      p_type: "impression",
      p_quantite: form.quantite,
      p_notes: form.notes || null,
      p_date: format(form.date_impression, "yyyy-MM-dd"),
    });
    if (rpcErr) { setLoading(false); return toast.error(rpcErr.message); }

    setLoading(false);
    toast.success("Stock mis à jour !");
    onSaved();
  };


  return (
    <form onSubmit={submit} className="space-y-4 mt-6">
      <div className="space-y-2">
        <Label>Livre publié</Label>
        <BookCombobox
          items={books}
          value={form.manuscrit_id}
          onChange={(v) => setForm({ ...form, manuscrit_id: v })}
        />

      </div>
      <div className="space-y-2">
        <Label>Quantité imprimée reçue</Label>
        <Input type="number" min={1} required value={form.quantite}
          onChange={(e) => setForm({ ...form, quantite: Number(e.target.value) })} />
      </div>
      <div className="space-y-2">
        <Label>Date d'impression</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(form.date_impression, "PPP", { locale: fr })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
            <Calendar mode="single" selected={form.date_impression}
              onSelect={(d) => d && setForm({ ...form, date_impression: d })}
              initialFocus locale={fr} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Coût unitaire (FCFA)</Label>
          <Input type="number" min={0} value={form.cout_unitaire}
            onChange={(e) => setForm({ ...form, cout_unitaire: Number(e.target.value) })} />
        </div>
        <div className="space-y-2">
          <Label>Prix vente direct (FCFA)</Label>
          <Input type="number" min={0} value={form.prix_vente}
            onChange={(e) => setForm({ ...form, prix_vente: Number(e.target.value) })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Emplacement</Label>
        <Input value={form.emplacement}
          onChange={(e) => setForm({ ...form, emplacement: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
      </div>
      <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer le stock"}
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Mouvement form                                                     */
/* ------------------------------------------------------------------ */

const MVT_TYPES: { value: string; label: string; hint?: string }[] = [
  { value: "transfert_librairie", label: "📤 Transfert vers librairie", hint: "Envoyer des exemplaires en librairie" },
  { value: "vente_directe",       label: "🛍️ Vente libre",              hint: "Vente hors librairie (événement, particulier, en ligne…)" },
  { value: "evenement",           label: "📚 Événement / Exposition",   hint: "Exemplaires envoyés pour un événement ou exposition" },
  { value: "retour_librairie",    label: "🔄 Retour de dépôt",          hint: "Livres retournés depuis une librairie, un événement ou toute autre destination" },
  { value: "perte",               label: "❌ Perte / Dommage",          hint: "Exemplaires perdus ou endommagés" },
  { value: "ajustement",          label: "🔧 Ajustement manuel",        hint: "Correction manuelle du stock (note obligatoire)" },
];

type ProvenanceKey = "librairie" | "evenement" | "exposition" | "scolaire" | "institution" | "autre";
const PROVENANCE_OPTIONS: { value: ProvenanceKey; label: string }[] = [
  { value: "librairie",   label: "🏪 Librairie partenaire" },
  { value: "evenement",   label: "📚 Événement littéraire" },
  { value: "exposition",  label: "🖼️ Exposition" },
  { value: "scolaire",    label: "🏫 Établissement scolaire" },
  { value: "institution", label: "🏛️ Institution / Organisation" },
  { value: "autre",       label: "📦 Autre" },
];

function MouvementForm({
  entrepriseId, userId, stocks, externalStocks, books, prefillManuscritId, onSaved,
}: {
  entrepriseId: string;
  userId: string | null;
  stocks: StockInterne[];
  externalStocks: any[];
  books: PubManuscrit[];
  prefillManuscritId: string | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    manuscrit_id: prefillManuscritId ?? "",
    type: "transfert_librairie",
    quantite: 1,
    destination: "",
    notes: "",
    date_mouvement: new Date(),
  });
  // Retour de dépôt state
  const [provenance, setProvenance] = useState<ProvenanceKey>("librairie");
  const [librairieStockId, setLibrairieStockId] = useState<string>("");
  const [provenanceTexte, setProvenanceTexte] = useState("");
  const [etat, setEtat] = useState<"bon" | "endommage" | "mixte">("bon");
  const [qteBon, setQteBon] = useState(1);
  const [qteEndo, setQteEndo] = useState(0);

  const [loading, setLoading] = useState(false);
  const [confirmLoss, setConfirmLoss] = useState(false);

  const currentStock = stocks.find((s) => s.manuscrit_id === form.manuscrit_id);
  const book = books.find((b) => b.id === form.manuscrit_id);
  const showDestination = ["transfert_librairie", "evenement"].includes(form.type);
  const isRetour = form.type === "retour_librairie";
  const destinationPlaceholder = form.type === "transfert_librairie"
    ? "ex: Librairie Baobab"
    : "ex: Foire du livre de Bamako";

  // Available bookstores for this manuscript (for retour librairie)
  const librairiesForBook = useMemo(
    () => externalStocks.filter((s) => s.manuscrit_id === form.manuscrit_id),
    [externalStocks, form.manuscrit_id],
  );
  const selectedLibrairie = librairiesForBook.find((s) => s.id === librairieStockId);

  // Max returnable
  const maxRetour = useMemo(() => {
    if (!isRetour) return Infinity;
    if (provenance === "librairie") {
      return selectedLibrairie?.exemplaires_restants ?? 0;
    }
    if (provenance === "evenement" || provenance === "exposition") {
      return currentStock?.quantite_exposee_evenements ?? 0;
    }
    return currentStock?.quantite_transferee_librairies ?? Infinity;
  }, [isRetour, provenance, selectedLibrairie, currentStock]);

  const doSubmit = async () => {
    if (!form.manuscrit_id) return toast.error("Sélectionnez un livre");
    if (!currentStock) return toast.error("Ce livre n'a pas encore de stock interne");
    if (form.type !== "ajustement" && form.quantite <= 0) return toast.error("Quantité invalide");
    if (form.type === "ajustement" && !form.notes.trim()) return toast.error("Une note est obligatoire pour un ajustement");
    if (showDestination && !form.destination.trim()) return toast.error("Destination requise");

    const callRpc = (args: Record<string, unknown>) =>
      (supabase as any).rpc("record_stock_mouvement", {
        p_manuscrit_id: form.manuscrit_id,
        p_date: format(form.date_mouvement, "yyyy-MM-dd"),
        ...args,
      });

    // ------- RETOUR DE DÉPÔT (dedicated flow) -------
    if (isRetour) {
      if (provenance === "librairie" && !librairieStockId) {
        return toast.error("Sélectionnez la librairie de provenance");
      }
      if (provenance !== "librairie" && !provenanceTexte.trim()) {
        return toast.error("Précisez la provenance");
      }
      if (form.quantite > maxRetour) {
        return toast.error(`Maximum retournable : ${maxRetour} exemplaire(s)`);
      }
      let goodQty = form.quantite;
      let damagedQty = 0;
      if (etat === "endommage") { goodQty = 0; damagedQty = form.quantite; }
      if (etat === "mixte") {
        if (qteBon + qteEndo !== form.quantite) {
          return toast.error("La somme (bon état + endommagés) doit égaler la quantité retournée");
        }
        goodQty = qteBon; damagedQty = qteEndo;
      }

      setLoading(true);
      const provLabel = PROVENANCE_OPTIONS.find((p) => p.value === provenance)?.label ?? provenance;
      const destLabel = provenance === "librairie"
        ? (selectedLibrairie?.librairie_nom ?? "Librairie")
        : provenanceTexte.trim();
      const noteBase = `Provenance : ${provLabel}${form.notes ? " — " + form.notes : ""}`;

      // 1) Good copies → increase disponible + decrement source counter (atomic, server-side)
      if (goodQty > 0) {
        const { error } = await callRpc({
          p_type: "retour_librairie",
          p_quantite: goodQty,
          p_destination: destLabel,
          p_notes: noteBase,
          p_provenance: provenance,
          p_stock_externe_id: provenance === "librairie" ? (selectedLibrairie?.id ?? null) : null,
        });
        if (error) { setLoading(false); return toast.error(error.message); }
      }

      // 2) Damaged copies → perte movement
      if (damagedQty > 0) {
        const { error } = await callRpc({
          p_type: "perte",
          p_quantite: damagedQty,
          p_destination: destLabel,
          p_notes: `Retour endommagé depuis ${provLabel}${form.notes ? " — " + form.notes : ""}`,
        });
        if (error) { setLoading(false); return toast.error(error.message); }
        toast.warning(`⚠️ ${damagedQty} exemplaire(s) endommagé(s) enregistré(s) comme perte`);
      }

      setLoading(false);
      toast.success("Retour de dépôt enregistré");
      onSaved();
      return;
    }

    // ------- OTHER MOVEMENTS -------
    setLoading(true);
    const { data, error } = await callRpc({
      p_type: form.type,
      p_quantite: form.quantite,
      p_destination: form.destination || null,
      p_notes: form.notes || null,
      p_valeur_absolue: form.type === "ajustement" ? Math.max(0, form.quantite) : null,
    });
    if (error) { setLoading(false); return toast.error(error.message); }

    // Low-stock toast (valeurs renvoyées par le serveur)
    const res = (data ?? {}) as { quantite_disponible?: number; seuil_alerte?: number };
    const newAvail = res.quantite_disponible ?? currentStock.quantite_disponible;
    const seuil = res.seuil_alerte ?? currentStock.seuil_alerte;
    if (newAvail <= seuil) {
      toast.error(`⚠️ Attention: Le stock de ${book?.titre ?? "ce livre"} est bas (${newAvail} exemplaires restants)`);
    } else if (form.type === "vente_directe") {
      toast.success("Vente libre enregistrée");
    } else {
      toast.success("Mouvement enregistré");
    }

    setLoading(false);
    onSaved();
  };


  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.type === "perte") { setConfirmLoss(true); return; }
    doSubmit();
  };

  return (
    <>
      <form onSubmit={submit} className="space-y-4 mt-6">
        <div className="space-y-2">
          <Label>Livre</Label>
          <BookCombobox
            items={books}
            value={form.manuscrit_id}
            onChange={(v) => setForm({ ...form, manuscrit_id: v })}
          />

          {currentStock && (
            <p className="text-xs text-muted-foreground">Stock disponible: <span className="text-[#C8922A] font-semibold">{currentStock.quantite_disponible}</span></p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Type de mouvement</Label>
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MVT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {MVT_TYPES.find((t) => t.value === form.type)?.hint && (
            <p className="text-xs text-muted-foreground">{MVT_TYPES.find((t) => t.value === form.type)?.hint}</p>
          )}
        </div>

        {/* Retour de dépôt : provenance & état */}
        {isRetour && (
          <>
            <div className="space-y-2">
              <Label>📍 Provenance du retour</Label>
              <Select value={provenance} onValueChange={(v) => { setProvenance(v as ProvenanceKey); setLibrairieStockId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVENANCE_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {provenance === "librairie" ? (
              <div className="space-y-2">
                <Label>Sélectionner la librairie</Label>
                {librairiesForBook.length === 0 ? (
                  <p className="text-xs text-orange-400">Aucun dépôt trouvé pour ce livre.</p>
                ) : (
                  <Select value={librairieStockId} onValueChange={setLibrairieStockId}>
                    <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                    <SelectContent>
                      {librairiesForBook.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.librairie_nom} — {s.exemplaires_restants} ex. restants
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {selectedLibrairie && (
                  <p className="text-xs text-muted-foreground">
                    {selectedLibrairie.exemplaires_deposes} ex. envoyés — <span className="text-[#C8922A] font-semibold">Maximum retournable : {maxRetour}</span>
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Préciser la provenance</Label>
                <Input
                  value={provenanceTexte}
                  onChange={(e) => setProvenanceTexte(e.target.value)}
                  placeholder="ex: Foire du livre de Bamako 2026, Stand principal..."
                />
                {(provenance === "evenement" || provenance === "exposition") && currentStock && (
                  <p className="text-xs text-muted-foreground">
                    <span className="text-[#C8922A] font-semibold">Maximum retournable : {maxRetour}</span> (exemplaires exposés)
                  </p>
                )}
              </div>
            )}
          </>
        )}

        <div className="space-y-2">
          <Label>{form.type === "ajustement" ? "Nouveau stock disponible" : isRetour ? "Quantité retournée" : "Quantité"}</Label>
          <Input type="number" min={form.type === "ajustement" ? 0 : 1} required value={form.quantite}
            onChange={(e) => setForm({ ...form, quantite: Number(e.target.value) })} />
          {isRetour && form.quantite > maxRetour && (
            <p className="text-xs text-red-400">Dépasse le maximum retournable ({maxRetour})</p>
          )}
        </div>

        {/* État des livres retournés */}
        {isRetour && (
          <div className="space-y-2">
            <Label>État des livres retournés</Label>
            <div className="space-y-2">
              {[
                { v: "bon", l: "✅ Bon état (ajouter au stock disponible)" },
                { v: "endommage", l: "❌ Endommagés (enregistrer comme pertes)" },
                { v: "mixte", l: "🔀 Mixte (préciser les quantités)" },
              ].map((o) => (
                <label key={o.v} className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors",
                  etat === o.v ? "border-primary bg-primary/10" : "border-border hover:border-primary/40",
                )}>
                  <input type="radio" name="etat" value={o.v} checked={etat === o.v}
                    onChange={() => setEtat(o.v as any)} className="accent-primary" />
                  {o.l}
                </label>
              ))}
            </div>
            {etat === "endommage" && (
              <p className="text-xs text-red-400">⚠️ Ces exemplaires seront enregistrés comme perdus.</p>
            )}
            {etat === "mixte" && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="space-y-1">
                  <Label className="text-xs">En bon état</Label>
                  <Input type="number" min={0} value={qteBon} onChange={(e) => setQteBon(Number(e.target.value))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Endommagés</Label>
                  <Input type="number" min={0} value={qteEndo} onChange={(e) => setQteEndo(Number(e.target.value))} />
                </div>
                <p className={cn("text-xs col-span-2", qteBon + qteEndo === form.quantite ? "text-muted-foreground" : "text-red-400")}>
                  Total : {qteBon + qteEndo} / {form.quantite}
                </p>
              </div>
            )}
          </div>
        )}

        {showDestination && (
          <div className="space-y-2">
            <Label>Destination</Label>
            <Input required value={form.destination} placeholder={destinationPlaceholder}
              onChange={(e) => setForm({ ...form, destination: e.target.value })} />
          </div>
        )}
        <div className="space-y-2">
          <Label>Date du mouvement</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(form.date_mouvement, "PPP", { locale: fr })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
              <Calendar mode="single" selected={form.date_mouvement}
                onSelect={(d) => d && setForm({ ...form, date_mouvement: d })}
                initialFocus locale={fr} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>Notes {form.type === "ajustement" && <span className="text-red-400">*</span>}</Label>
          <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3}
            placeholder={form.type === "ajustement"
              ? "Expliquez la raison de l'ajustement…"
              : isRetour ? "Détails sur le retour, conditions des livres..." : ""} />
        </div>
        <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer le mouvement"}
        </Button>
      </form>

      <AlertDialog open={confirmLoss} onOpenChange={setConfirmLoss}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la perte ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. {form.quantite} exemplaire(s) seront définitivement retirés du stock.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); setConfirmLoss(false); doSubmit(); }}
            >
              Confirmer la perte
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Threshold dialog                                                    */
/* ------------------------------------------------------------------ */

function ThresholdDialog({
  open, stock, onClose, onSaved,
}: {
  open: boolean; stock: StockInterne | null; onClose: () => void; onSaved: () => void;
}) {
  const [val, setVal] = useState(0);
  const [loading, setLoading] = useState(false);
  useEffect(() => { if (stock) setVal(stock.seuil_alerte); }, [stock]);
  if (!stock) return null;

  const save = async () => {
    if (!stock.id) { onClose(); return; }
    setLoading(true);
    const { error } = await (supabase as any).from("stock_interne")
      .update({ seuil_alerte: Math.max(0, val) }).eq("id", stock.id);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Seuil mis à jour");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader><DialogTitle>Modifier le seuil d'alerte</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Label>Nombre d'exemplaires</Label>
          <Input type="number" min={0} value={val} onChange={(e) => setVal(Number(e.target.value))} />
          <Button onClick={save} disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Edit / correct stock dialog                                         */
/* ------------------------------------------------------------------ */

function EditStockDialog({
  open, stock, titre, entrepriseId, userId, onClose, onSaved,
}: {
  open: boolean;
  stock: StockInterne | null;
  titre: string;
  entrepriseId: string | null;
  userId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    quantite_imprimee: 0,
    quantite_disponible: 0,
    quantite_reservee: 0,
    seuil_alerte: 0,
    cout_unitaire: 0,
    prix_vente: 0,
    emplacement: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!stock) return;
    setForm({
      quantite_imprimee: stock.quantite_imprimee,
      quantite_disponible: stock.quantite_disponible,
      quantite_reservee: stock.quantite_reservee,
      seuil_alerte: stock.seuil_alerte,
      cout_unitaire: Number(stock.cout_unitaire_impression_fcfa || 0),
      prix_vente: Number(stock.prix_vente_direct_fcfa || 0),
      emplacement: stock.emplacement ?? "",
      notes: "",
    });
  }, [stock]);

  if (!stock) return null;

  const sortis =
    stock.quantite_transferee_librairies + stock.quantite_vendue_directement + stock.quantite_exposee_evenements;
  const delta = form.quantite_disponible - stock.quantite_disponible;

  const save = async () => {
    if (!stock.id) return;
    if (form.quantite_imprimee < 0 || form.quantite_disponible < 0) return toast.error("Les quantités ne peuvent pas être négatives");
    if (form.quantite_disponible > form.quantite_imprimee) {
      return toast.error("Les exemplaires disponibles ne peuvent pas dépasser les exemplaires imprimés");
    }
    if (form.quantite_disponible + sortis > form.quantite_imprimee) {
      return toast.error(`Incohérent : ${sortis} ex. déjà sortis (librairies, ventes, événements). Imprimés doit être ≥ ${form.quantite_disponible + sortis}.`);
    }
    setLoading(true);
    const { error } = await (supabase as any).from("stock_interne").update({
      quantite_imprimee: form.quantite_imprimee,
      quantite_disponible: form.quantite_disponible,
      quantite_reservee: Math.max(0, form.quantite_reservee),
      seuil_alerte: Math.max(0, form.seuil_alerte),
      cout_unitaire_impression_fcfa: form.cout_unitaire,
      prix_vente_direct_fcfa: form.prix_vente,
      emplacement: form.emplacement.trim() || null,
    }).eq("id", stock.id);

    if (error) { setLoading(false); return toast.error(error.message); }

    if (delta !== 0) {
      await (supabase as any).from("mouvements_stock").insert({
        entreprise_id: entrepriseId,
        stock_interne_id: stock.id,
        manuscrit_id: stock.manuscrit_id,
        type_mouvement: "ajustement",
        quantite: Math.abs(delta),
        notes: form.notes.trim()
          || `Correction manuelle : disponibles ${stock.quantite_disponible} → ${form.quantite_disponible}`,
        effectue_par: userId,
        date_mouvement: format(new Date(), "yyyy-MM-dd"),
      });
    }

    setLoading(false);
    toast.success("Stock corrigé");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>✏️ Corriger le stock — {titre}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Corrigez une saisie erronée. Toute modification du nombre d'exemplaires disponibles est enregistrée
            comme « Ajustement manuel » dans l'historique.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Exemplaires imprimés</Label>
              <Input type="number" min={0} value={form.quantite_imprimee}
                onChange={(e) => setForm({ ...form, quantite_imprimee: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Exemplaires disponibles</Label>
              <Input type="number" min={0} value={form.quantite_disponible}
                onChange={(e) => setForm({ ...form, quantite_disponible: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Réservés</Label>
              <Input type="number" min={0} value={form.quantite_reservee}
                onChange={(e) => setForm({ ...form, quantite_reservee: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Seuil d'alerte</Label>
              <Input type="number" min={0} value={form.seuil_alerte}
                onChange={(e) => setForm({ ...form, seuil_alerte: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Coût unitaire (FCFA)</Label>
              <Input type="number" min={0} value={form.cout_unitaire}
                onChange={(e) => setForm({ ...form, cout_unitaire: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Prix de vente direct (FCFA)</Label>
              <Input type="number" min={0} value={form.prix_vente}
                onChange={(e) => setForm({ ...form, prix_vente: Number(e.target.value) })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Emplacement</Label>
            <Input value={form.emplacement} placeholder="Ex. Entrepôt principal"
              onChange={(e) => setForm({ ...form, emplacement: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Motif de la correction (optionnel)</Label>
            <Input value={form.notes} placeholder="Ex. erreur de saisie lors de la réception"
              onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-1">
            <p className="text-muted-foreground">
              Déjà sortis (librairies / ventes libres / événements) : <span className="font-semibold text-foreground tabular-nums">{sortis} ex.</span>
            </p>
            {delta !== 0 && (
              <p className={cn("font-semibold", delta > 0 ? "text-[color:var(--gold)]" : "text-red-400")}>
                Ajustement : {delta > 0 ? "+" : ""}{delta} ex. disponibles
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1">Annuler</Button>
            <Button onClick={save} disabled={loading} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer la correction"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* History view                                                       */
/* ------------------------------------------------------------------ */

function HistoryView({
  stock, titre, auteur, mouvements,
}: {
  stock: StockInterne; titre: string; auteur: string; mouvements: Mouvement[];
}) {
  const sorted = [...mouvements].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // Compute evolution: running availability over time
  const chartData = useMemo(() => {
    let avail = 0;
    const rows: { date: string; stock: number }[] = [];
    sorted.forEach((m) => {
      switch (m.type_mouvement) {
        case "impression":
        case "retour_librairie":
          avail += m.quantite; break;
        case "transfert_librairie":
        case "vente_directe":
        case "evenement":
        case "perte":
          avail -= m.quantite; break;
        case "ajustement":
          avail = m.quantite; break;
      }
      rows.push({ date: format(new Date(m.created_at), "dd/MM"), stock: avail });
    });
    return rows;
  }, [sorted]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-lg font-semibold">{titre}</p>
        <p className="text-sm text-muted-foreground">{auteur}</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <MiniStat label="Total imprimé" value={stock.quantite_imprimee} />
        <MiniStat label="Disponible" value={stock.quantite_disponible} highlight />
        <MiniStat label="Librairies" value={stock.quantite_transferee_librairies} />
        <MiniStat label="Ventes libres" value={stock.quantite_vendue_directement} />
      </div>

      {chartData.length > 1 && (
        <div className="rounded-xl border border-border bg-background/40 p-4">
          <h4 className="font-medium mb-3 text-sm">📈 Évolution du stock</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" />
                <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#1A1208", border: "1px solid #1E3A5F", borderRadius: 8 }} />
                <ReferenceLine y={stock.seuil_alerte} stroke="#EF4444" strokeDasharray="4 4" label={{ value: "seuil", fill: "#EF4444", fontSize: 10 }} />
                <Line type="monotone" dataKey="stock" stroke="#C8922A" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div>
        <h4 className="font-medium mb-3 text-sm">🕐 Mouvements ({sorted.length})</h4>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Aucun mouvement enregistré.</p>
        ) : (
          <ol className="space-y-2">
            {[...sorted].reverse().map((m) => {
              const meta = MOUVEMENT_LABEL[m.type_mouvement] ?? { icon: "•", label: m.type_mouvement, sign: "~", color: "" };
              return (
                <li key={m.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background/40">
                  <span className="text-xl">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{meta.label}</p>
                    {m.destination && <p className="text-xs text-muted-foreground">→ {m.destination}</p>}
                    {m.notes && <p className="text-xs text-muted-foreground italic">"{m.notes}"</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(m.created_at), "dd MMM yyyy à HH:mm", { locale: fr })}
                    </p>
                  </div>
                  <span className={cn("font-semibold tabular-nums whitespace-nowrap", meta.color)}>
                    {meta.sign === "~" ? "~" : meta.sign}{m.quantite}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-lg font-bold tabular-nums", highlight && "text-[#C8922A]")}>{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Distribution analytics                                             */
/* ------------------------------------------------------------------ */

function DistributionAnalytics({
  stocks, mMap, valeurStock, mouvements,
}: {
  stocks: StockInterne[];
  mMap: Record<string, PubManuscrit>;
  valeurStock: number;
  mouvements: Mouvement[];
}) {
  const distribution = useMemo(() => {
    return stocks
      .filter((s) => s.quantite_imprimee > 0)
      .map((s) => {
        const total = s.quantite_imprimee || 1;
        return {
          name: mMap[s.manuscrit_id]?.titre ?? "—",
          librairies: Math.round((s.quantite_transferee_librairies / total) * 100),
          direct: Math.round((s.quantite_vendue_directement / total) * 100),
          evenements: Math.round((s.quantite_exposee_evenements / total) * 100),
          restant: Math.round((s.quantite_disponible / total) * 100),
        };
      })
      .slice(0, 8);
  }, [stocks, mMap]);

  const rotation = useMemo(() => {
    // For each stock with date_impression, compute days until all impression
    // quantity is gone (disponible == 0 and (sold + transferred + events + lost) >= imprimee).
    return stocks
      .filter((s) => s.date_impression && s.quantite_imprimee > 0)
      .map((s) => {
        const distributed = s.quantite_vendue_directement + s.quantite_transferee_librairies + s.quantite_exposee_evenements;
        const ratio = distributed / s.quantite_imprimee;
        const days = Math.max(1, Math.round((Date.now() - new Date(s.date_impression!).getTime()) / 86400000));
        const projected = ratio > 0 ? Math.round(days / ratio) : null;
        return {
          titre: mMap[s.manuscrit_id]?.titre ?? "—",
          ratio: Math.round(ratio * 100),
          projected,
        };
      })
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 5);
  }, [stocks, mMap]);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5">
      <h2 className="font-semibold flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" /> 📊 Analytiques stock interne</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-background/40 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">💰 Valeur totale du stock</p>
          <p className="mt-1 text-2xl font-bold text-[color:var(--gold)] tabular-nums">{fcfa(valeurStock)}</p>
        </div>
        <div className="rounded-lg border border-border bg-background/40 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">📦 Livres en gestion</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{stocks.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-background/40 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">🔁 Mouvements enregistrés</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{mouvements.length}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-background/40 p-5">
          <h3 className="font-semibold mb-3">🔄 Flux de distribution</h3>
          <div className="h-72">
            {distribution.length === 0 ? (
              <p className="h-full flex items-center justify-center text-sm text-muted-foreground">Aucune donnée</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" />
                  <XAxis type="number" stroke="#94A3B8" fontSize={11} unit="%" />
                  <YAxis type="category" dataKey="name" stroke="#94A3B8" fontSize={11} width={110} />
                  <Tooltip contentStyle={{ background: "#1A1208", border: "1px solid #1E3A5F", borderRadius: 8 }} formatter={(v: number) => `${v}%`} />
                  <Legend />
                  <Bar dataKey="librairies" name="Librairies" stackId="d" fill="#3B82F6" />
                  <Bar dataKey="direct"     name="Vente libre" stackId="d" fill="#E8B84B" />
                  <Bar dataKey="evenements" name="Événements" stackId="d" fill="#A855F7" />
                  <Bar dataKey="restant"    name="Restant" stackId="d" fill="#C8922A" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background/40 p-5">
          <h3 className="font-semibold mb-3">📈 Meilleure rotation de stock</h3>
          {rotation.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">Aucune donnée disponible</p>
          ) : (
            <ul className="space-y-2">
              {rotation.map((r, i) => (
                <li key={i} className="flex items-center gap-3 p-2 rounded-lg border border-border bg-background/30">
                  <span className="text-lg">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{r.titre}</p>
                    <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, r.ratio)}%` }} />
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-semibold tabular-nums">{r.ratio}%</p>
                    {r.projected && <p className="text-muted-foreground">~{r.projected}j total</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
