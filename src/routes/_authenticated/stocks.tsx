import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Package, Loader2, Pencil, Trash2, Calendar as CalendarIcon, Store, BookOpen, TrendingUp, ShoppingBag, Wallet, PenLine, FileSpreadsheet, Zap, BookMarked, MoreHorizontal, ChevronRight, ArrowUpRight, ChevronLeft, X as XIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { AnimatedCounter } from "@/components/animated-counter";
import { generateManuelStocksPdf } from "@/lib/pdf-manuel-stocks";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { BookCombobox } from "@/components/book-combobox";

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fcfa } from "@/lib/format";
import { planFor } from "@/lib/plans";
import { UpgradeModal } from "@/components/upgrade-modal";
import { AnalyticsSection, defaultRange, inRange, EmptyChart, type DateRange } from "@/components/analytics-section";
import { Link } from "@tanstack/react-router";
import { format as fmtDate, startOfMonth, subMonths } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, Line } from "recharts";
import { AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StockRepartition } from "@/components/stock-repartition";
import { StockInterneTab } from "@/components/stock-interne";
import { BordereauxTab } from "@/components/bordereaux-tab";
import { StockImportDialog } from "@/components/stock-import-dialog";
import { StockPosDialog } from "@/components/stock-pos-dialog";
import { RecordSaleDrawer, RecordSaleTrigger } from "@/components/record-sale-drawer";
import { LibrairiesTab } from "@/components/librairies-tab";
import { StockExterneGroups } from "@/components/stock-externe-groups";

export const Route = createFileRoute("/_authenticated/stocks")({
  component: StocksPage,
  head: () => ({ meta: [{ title: "Stocks — FIGDITIONS" }] }),
});

interface Stock {
  id: string;
  manuscrit_id: string;
  librairie_nom: string | null;
  librairie_adresse: string | null;
  exemplaires_deposes: number;
  exemplaires_vendus: number;
  exemplaires_restants: number;
  derniere_visite: string | null;
  prix_unitaire_fcfa: number | null;
  taux_commission_pct?: number | null;
  applique_droits_auteur?: boolean | null;
}
interface Manuscrit { id: string; titre: string; statut: string; auteur_id?: string | null; }

function StocksPage() {
  const { user } = useAuth();
  const { profile, entreprise } = useProfile(user?.id);
  const plan = planFor(entreprise?.plan);
  const [items, setItems] = useState<Stock[] | null>(null);
  const [manuscrits, setManuscrits] = useState<Manuscrit[]>([]);
  const [q, setQ] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Stock | null>(null);
  const [toDelete, setToDelete] = useState<Stock | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [posOpen, setPosOpen] = useState(false);
  const [saleOpen, setSaleOpen] = useState(false);
  const [auteurs, setAuteurs] = useState<Array<{ id: string; nom: string | null; prenom: string | null }>>([]);

  // Global desktop filters
  const [periodeFilter, setPeriodeFilter] = useState<string>("all");
  const [librairieFilter, setLibrairieFilter] = useState<string>("all");
  const [livreFilter, setLivreFilter] = useState<string>("all");
  const [statutFilter, setStatutFilter] = useState<string>("all");

  // Pagination (desktop table)
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  const load = async () => {
    setItems(null);
    const [{ data: stocks, error }, { data: ms }, { data: au }] = await Promise.all([
      supabase.from("stocks").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("manuscrits").select("id, titre, statut, auteur_id"),
      (supabase as any).from("auteurs").select("id, nom, prenom"),
    ]);
    if (error) toast.error(error.message);
    setItems((stocks ?? []) as Stock[]);
    setManuscrits((ms ?? []) as Manuscrit[]);
    setAuteurs((au ?? []) as any);
  };

  useEffect(() => { if (profile?.entreprise_id) load(); }, [profile?.entreprise_id]);

  const titreMap = useMemo(() => Object.fromEntries(manuscrits.map((m) => [m.id, m.titre])), [manuscrits]);
  const authorFullName = (a: { nom: string | null; prenom: string | null } | undefined) =>
    a ? [a.prenom, a.nom].filter(Boolean).join(" ").trim() : "";
  const authorMap = useMemo(() => {
    const byId = Object.fromEntries(auteurs.map((a) => [a.id, a]));
    const map: Record<string, string> = {};
    manuscrits.forEach((m) => { if (m.auteur_id && byId[m.auteur_id]) map[m.id] = authorFullName(byId[m.auteur_id]); });
    return map;
  }, [auteurs, manuscrits]);

  const uniqueLibrairies = useMemo(() => {
    const s = new Set<string>();
    (items ?? []).forEach((x) => { const n = (x.librairie_nom ?? "").trim(); if (n) s.add(n); });
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [items]);
  const uniqueLivres = useMemo(() => {
    const s = new Set<string>();
    (items ?? []).forEach((x) => s.add(x.manuscrit_id));
    return [...s].map((id) => ({ id, titre: titreMap[id] ?? "—" })).sort((a, b) => a.titre.localeCompare(b.titre));
  }, [items, titreMap]);

  const statutOf = (rest: number, dep: number): { key: string; label: string; cls: string } => {
    if (rest === 0) return { key: "epuise", label: "✕ Épuisé", cls: "bg-red-500/15 text-red-400 border-red-500/30" };
    if (rest < 5) return { key: "critique", label: "! Critique", cls: "bg-red-500/15 text-red-400 border-red-500/30 animate-pulse" };
    if (rest <= 20) return { key: "bas", label: "⚠ Bas", cls: "bg-orange-500/15 text-orange-400 border-orange-500/30" };
    return { key: "bon", label: "✓ Bon", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
  };

  const monthStart = useMemo(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); }, []);
  const weekStart = useMemo(() => { const d = new Date(); const day = (d.getDay() + 6) % 7; return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day); }, []);

  const filtered = useMemo(() => {
    if (!items) return null;
    const needle = q.toLowerCase().trim();
    return items.filter((s) => {
      if (needle) {
        const hit = (s.librairie_nom ?? "").toLowerCase().includes(needle) || (titreMap[s.manuscrit_id] ?? "").toLowerCase().includes(needle);
        if (!hit) return false;
      }
      if (librairieFilter !== "all" && (s.librairie_nom ?? "") !== librairieFilter) return false;
      if (livreFilter !== "all" && s.manuscrit_id !== livreFilter) return false;
      if (statutFilter !== "all" && statutOf(s.exemplaires_restants ?? 0, s.exemplaires_deposes ?? 0).key !== statutFilter) return false;
      if (periodeFilter !== "all") {
        const dv = s.derniere_visite ? new Date(s.derniere_visite) : null;
        if (!dv) return false;
        if (periodeFilter === "week" && dv < weekStart) return false;
        if (periodeFilter === "month" && dv < monthStart) return false;
      }
      return true;
    });
  }, [items, q, titreMap, librairieFilter, livreFilter, statutFilter, periodeFilter, weekStart, monthStart]);

  const totals = useMemo(() => {
    const list = items ?? [];
    const bookstores = new Set(list.map((s) => (s.librairie_nom ?? "").trim()).filter(Boolean));
    return {
      deposes: list.reduce((s, x) => s + (x.exemplaires_deposes ?? 0), 0),
      vendus: list.reduce((s, x) => s + (x.exemplaires_vendus ?? 0), 0),
      restants: list.reduce((s, x) => s + (x.exemplaires_restants ?? 0), 0),
      librairies: bookstores.size,
      ca: list.reduce((s, x) => s + (x.exemplaires_vendus ?? 0) * Number(x.prix_unitaire_fcfa ?? 0), 0),
    };
  }, [items]);

  const activeFilters = (librairieFilter !== "all" ? 1 : 0) + (livreFilter !== "all" ? 1 : 0) + (statutFilter !== "all" ? 1 : 0) + (periodeFilter !== "all" ? 1 : 0);
  const resetFilters = () => { setLibrairieFilter("all"); setLivreFilter("all"); setStatutFilter("all"); setPeriodeFilter("all"); };

  useEffect(() => { setPage(1); }, [q, librairieFilter, livreFilter, statutFilter, periodeFilter, pageSize]);
  const totalRows = filtered?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const pageRows = useMemo(() => (filtered ? filtered.slice((page - 1) * pageSize, page * pageSize) : null), [filtered, page, pageSize]);

  const openNew = () => {
    const uniqueBookstores = new Set((items ?? []).map((s) => (s.librairie_nom ?? "").trim().toLowerCase()).filter(Boolean));
    if (uniqueBookstores.size >= plan.maxBookstores) { setUpgradeOpen(true); return; }
    setEditing(null); setSheetOpen(true);
  };
  const openEdit = (s: Stock) => { setEditing(s); setSheetOpen(true); };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const { error } = await supabase.from("stocks").delete().eq("id", toDelete.id);
    setDeleting(false);
    if (error) return toast.error(error.message);
    toast.success("Dépôt supprimé");
    setItems((prev) => prev?.filter((x) => x.id !== toDelete.id) ?? prev);
    setToDelete(null);
  };

  const remainingColor = (n: number) =>
    n === 0 ? "text-red-400 bg-red-500/15 border-red-500/30"
      : n <= 5 ? "text-orange-400 bg-orange-500/15 border-orange-500/30"
      : "text-primary bg-primary/15 border-primary/30";

  return (
    <div className="space-y-6">
      {/* ============================================================
          HEADER — mobile (preserved) + desktop (redesigned)
         ============================================================ */}

      {/* Mobile header */}
      <header className="sm:hidden grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Stocks</h1>
          <p className="text-xs text-muted-foreground mt-1">Gérez votre entrepôt interne et vos dépôts en librairie.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => generateManuelStocksPdf({ maison: entreprise?.nom ?? null })}
            title="Guide d'utilisation"
            className="h-10 w-10 rounded-full border-primary/30"
            aria-label="Guide d'utilisation"
          >
            <BookMarked className="h-4 w-4 text-primary" />
          </Button>
        </div>
      </header>

      {/* Desktop header — 2026 SaaS style */}
      <header className="hidden sm:flex items-end justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
            <Link to="/dashboard" className="hover:text-primary transition-colors">Tableau de bord</Link>
            <ChevronRight className="h-3 w-3 opacity-60" />
            <span className="text-foreground/80">Stocks</span>
          </div>
          <h1 className="text-[28px] leading-none font-bold tracking-tight text-foreground">Stocks</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={openNew}
            className="h-11 border-[color:var(--gold)]/60 text-[color:var(--gold)] hover:bg-[color:var(--gold)]/10 hover:text-[color:var(--gold)]"
          >
            <Plus className="h-4 w-4 mr-2" /> Ajouter un dépôt
          </Button>
          <Button
            onClick={() => setSaleOpen(true)}
            className="h-11 px-5 font-semibold text-primary-foreground bg-gradient-to-r from-primary to-[color:var(--gold)] hover:opacity-95 shadow-lg shadow-primary/20"
          >
            <Wallet className="h-4 w-4 mr-2" /> Enregistrer une vente
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-11 w-11" title="Plus d'actions" aria-label="Plus d'actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Plus d'actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setTimeout(() => setImportOpen(true), 0); }}>
                <FileSpreadsheet className="h-4 w-4 mr-2 text-primary" /> Import Excel
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setTimeout(() => setPosOpen(true), 0); }}>
                <Zap className="h-4 w-4 mr-2 text-primary" /> Saisie rapide
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); generateManuelStocksPdf({ maison: entreprise?.nom ?? null }); }}>
                <BookMarked className="h-4 w-4 mr-2 text-primary" /> Guide d'utilisation
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <StockRepartition entrepriseId={profile?.entreprise_id ?? null} />

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">

        {/* Mobile: existing underline tabs; Desktop: page-level underline tabs with count badges */}
        <TabsList
          className={cn(
            "w-full grid grid-cols-3 gap-0 h-11 rounded-none bg-transparent border-0 border-b border-border p-0",
            "sm:h-auto sm:inline-flex sm:w-full sm:justify-start sm:gap-1 sm:border-b sm:border-[color:var(--gold)]/10 sm:rounded-none sm:bg-transparent sm:p-0"
          )}
        >
          <TabsTrigger
            value="externe"
            className={cn(
              "min-h-11 text-sm rounded-none bg-transparent border-b-2 border-transparent text-muted-foreground",
              "data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none",
              "sm:min-h-12 sm:px-5 sm:text-[15px] sm:font-medium sm:text-muted-foreground",
              "sm:data-[state=active]:text-foreground sm:data-[state=active]:border-[color:var(--gold)] sm:data-[state=active]:bg-transparent"
            )}
          >
            <span className="sm:hidden">Externe</span>
            <span className="hidden sm:inline-flex items-center gap-2">
              Stock Externe
              <span className="inline-flex items-center justify-center min-w-6 h-5 px-1.5 rounded-full text-[10px] font-semibold bg-[color:var(--gold)]/15 text-[color:var(--gold)] border border-[color:var(--gold)]/25">
                {items?.length ?? 0}
              </span>
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="interne"
            className={cn(
              "min-h-11 text-sm rounded-none bg-transparent border-b-2 border-transparent text-muted-foreground",
              "data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none",
              "sm:min-h-12 sm:px-5 sm:text-[15px] sm:font-medium sm:text-muted-foreground",
              "sm:data-[state=active]:text-foreground sm:data-[state=active]:border-[color:var(--gold)] sm:data-[state=active]:bg-transparent"
            )}
          >
            <span className="sm:hidden">Interne</span>
            <span className="hidden sm:inline">Stock Interne</span>
          </TabsTrigger>
          <TabsTrigger
            value="bordereaux"
            className={cn(
              "min-h-11 text-sm rounded-none bg-transparent border-b-2 border-transparent text-muted-foreground",
              "data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none",
              "sm:min-h-12 sm:px-5 sm:text-[15px] sm:font-medium sm:text-muted-foreground",
              "sm:data-[state=active]:text-foreground sm:data-[state=active]:border-[color:var(--gold)] sm:data-[state=active]:bg-transparent"
            )}
          >
            <span className="sm:hidden">Bordereaux</span>
            <span className="hidden sm:inline">Bordereaux</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="externe" className="space-y-6 mt-0 animate-fade-in">
          {/* ============================================================
              STATS — mobile 2x2 preserved; desktop = hero + 4 supporting
             ============================================================ */}

          {/* Mobile stats (existing) */}
          <div className="grid grid-cols-2 gap-3 sm:hidden">
            <SummaryCard icon={<BookOpen />} label="En circulation" value={String(totals.deposes)} sublabel="exemplaires" />
            <SummaryCard icon={<ShoppingBag />} label="Vendus" value={String(totals.vendus)} sublabel="exemplaires" accent="primary" />
            <SummaryCard icon={<TrendingUp />} label="Restants" value={String(totals.restants)} sublabel="exemplaires" />
            <SummaryCard icon={<Store />} label="Librairies" value={String(totals.librairies)} sublabel="actives" />
          </div>

          {/* Desktop hero + supporting metrics */}
          <div className="hidden sm:block space-y-3">
            {/* Hero — CA total */}
            <div className="relative rounded-2xl border border-border bg-gradient-to-br from-card via-card to-[color:var(--gold)]/[0.04] pl-8 pr-8 py-6 overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[color:var(--gold)] to-primary" />
              <div className="flex items-center justify-between gap-6 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                    <Wallet className="h-4 w-4 text-[color:var(--gold)]" /> Chiffre d'affaires total
                  </div>
                  <div className="mt-2 flex items-baseline gap-3">
                    <span className="text-[48px] leading-none font-bold text-[color:var(--gold)] tabular-nums drop-shadow-[0_0_18px_rgba(200,146,42,0.25)]">
                      <AnimatedCounter value={totals.ca} />
                    </span>
                    <span className="text-lg font-semibold text-muted-foreground">FCFA</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <ArrowUpRight className="h-3 w-3" />
                    {totals.vendus} exemplaires vendus
                  </span>
                </div>
              </div>
              {/* Progress bar — sell-through */}
              <div className="mt-5">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                  <span>Taux d'écoulement</span>
                  <span className="tabular-nums text-foreground/80 font-medium">
                    {totals.deposes > 0 ? Math.round((totals.vendus / totals.deposes) * 100) : 0}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-[color:var(--gold)] transition-all duration-700"
                    style={{ width: `${totals.deposes > 0 ? Math.min(100, Math.round((totals.vendus / totals.deposes) * 100)) : 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Supporting metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard icon={<BookOpen className="h-5 w-5" />} label="En circulation" value={totals.deposes} sublabel="exemplaires" />
              <MetricCard icon={<ShoppingBag className="h-5 w-5" />} label="Vendus" value={totals.vendus} sublabel="exemplaires" />
              <MetricCard icon={<Package className="h-5 w-5" />} label="Restants" value={totals.restants} sublabel="exemplaires" />
              <MetricCard icon={<Store className="h-5 w-5" />} label="Librairies" value={totals.librairies} sublabel="actives" />
            </div>
          </div>

          {/* ============================================================
              MOBILE actions (preserved)
             ============================================================ */}
          <div className="sm:hidden space-y-3">
            <Button
              onClick={openNew}
              className="w-full h-[52px] text-base font-semibold bg-gradient-to-r from-primary to-[color:var(--gold)] text-primary-foreground hover:opacity-95 shadow-lg shadow-primary/20"
            >
              <Plus className="h-5 w-5 mr-2" /> Ajouter un dépôt
            </Button>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setSaleOpen(true)} className="h-9 rounded-full border border-primary/40 bg-card text-xs font-medium text-foreground inline-flex items-center justify-center gap-1.5 hover:bg-primary/10 transition">
                <Wallet className="h-3.5 w-3.5 text-primary" /> Vente
              </button>
              <button onClick={() => setImportOpen(true)} className="h-9 rounded-full border border-primary/40 bg-card text-xs font-medium text-foreground inline-flex items-center justify-center gap-1.5 hover:bg-primary/10 transition">
                <FileSpreadsheet className="h-3.5 w-3.5 text-primary" /> Import
              </button>
              <button onClick={() => setPosOpen(true)} className="h-9 rounded-full border border-primary/40 bg-card text-xs font-medium text-foreground inline-flex items-center justify-center gap-1.5 hover:bg-primary/10 transition">
                <Zap className="h-3.5 w-3.5 text-primary" /> Rapide
              </button>
            </div>
          </div>

          {/* ============================================================
              GLOBAL FILTER BAR — desktop only
             ============================================================ */}
          <div className="hidden sm:block rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par librairie ou titre…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9 h-11 bg-background/40 border-border"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <FilterPill label="Période" active={periodeFilter !== "all"}>
                <Select value={periodeFilter} onValueChange={setPeriodeFilter}>
                  <SelectTrigger className="h-9 border-0 bg-transparent px-2 focus:ring-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes périodes</SelectItem>
                    <SelectItem value="week">Cette semaine</SelectItem>
                    <SelectItem value="month">Ce mois</SelectItem>
                  </SelectContent>
                </Select>
              </FilterPill>
              <FilterPill label="Librairie" active={librairieFilter !== "all"}>
                <Select value={librairieFilter} onValueChange={setLibrairieFilter}>
                  <SelectTrigger className="h-9 border-0 bg-transparent px-2 focus:ring-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les librairies</SelectItem>
                    {uniqueLibrairies.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FilterPill>
              <FilterPill label="Livre" active={livreFilter !== "all"}>
                <Select value={livreFilter} onValueChange={setLivreFilter}>
                  <SelectTrigger className="h-9 border-0 bg-transparent px-2 focus:ring-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les livres</SelectItem>
                    {uniqueLivres.map((l) => <SelectItem key={l.id} value={l.id}>{l.titre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FilterPill>
              <FilterPill label="Statut" active={statutFilter !== "all"}>
                <Select value={statutFilter} onValueChange={setStatutFilter}>
                  <SelectTrigger className="h-9 border-0 bg-transparent px-2 focus:ring-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="bon">Bon stock</SelectItem>
                    <SelectItem value="bas">Stock bas</SelectItem>
                    <SelectItem value="critique">Critique</SelectItem>
                    <SelectItem value="epuise">Épuisé</SelectItem>
                  </SelectContent>
                </Select>
              </FilterPill>
              {activeFilters > 0 && (
                <button
                  onClick={resetFilters}
                  className="text-xs text-[color:var(--gold)] hover:underline inline-flex items-center gap-1 ml-1 animate-fade-in"
                >
                  <XIcon className="h-3 w-3" /> Réinitialiser les filtres
                </button>
              )}
            </div>
          </div>

          <InventoryAnalytics stocks={items ?? []} titreMap={titreMap} />

          {/* ============================================================
              MOBILE: card list (preserved)
             ============================================================ */}
          <StockExterneGroups
            stocks={(filtered ?? null) as any}
            titreMap={titreMap}
            authorMap={authorMap}
            onAdd={openNew}
            onEdit={(s: any) => openEdit(s)}
            onDelete={(s: any) => setToDelete(s)}
            onSale={() => setSaleOpen(true)}
            librairieFilter={librairieFilter === "all" ? null : librairieFilter}
            onLibrairieFilter={(v) => setLibrairieFilter(v ?? "all")}
          />




      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="bg-card border-border w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>{editing ? "Modifier le dépôt" : "Ajouter un dépôt"}</SheetTitle></SheetHeader>
          <StockForm
            key={editing?.id ?? "new"}
            entrepriseId={profile?.entreprise_id ?? null}
            manuscrits={manuscrits.filter((m) => m.statut === "publie")}
            existing={editing}
            onSaved={() => { setSheetOpen(false); load(); }}
          />
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce dépôt ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce dépôt&nbsp;? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        title="Limite atteinte"
        description={`Vous avez atteint la limite de ${plan.maxBookstores} librairies du plan ${plan.label}. Passez au plan Pro pour suivre des librairies illimitées.`}
      />

      <StockImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        entrepriseId={profile?.entreprise_id ?? null}
        manuscrits={manuscrits}
        onImported={load}
      />

      <StockPosDialog
        open={posOpen}
        onOpenChange={setPosOpen}
        entrepriseId={profile?.entreprise_id ?? null}
        manuscrits={manuscrits}
        onImported={load}
      />
        </TabsContent>

        <TabsContent value="interne" className="space-y-6 mt-0">
          <StockInterneTab entrepriseId={profile?.entreprise_id ?? null} userId={user?.id ?? null} />
        </TabsContent>

        <TabsContent value="librairies" className="space-y-6 mt-0 animate-fade-in">
          <LibrairiesTab
            stocks={(filtered ?? null) as any}
            titreMap={titreMap}
            entreprise={entreprise as any}
            onVoirLivres={(nom) => { setLibrairieFilter(nom); setTab("externe"); }}
          />
        </TabsContent>

        <TabsContent value="bordereaux" className="space-y-6 mt-0">
          <BordereauxTab entreprise={entreprise as any} stocks={(items ?? []) as any} titreMap={titreMap} />
        </TabsContent>

      </Tabs>

      <RecordSaleDrawer
        open={saleOpen}
        onOpenChange={setSaleOpen}
        entrepriseId={profile?.entreprise_id ?? null}
        onSaved={load}
      />

      {/* Mobile FAB — Enregistrer une vente */}
      <button
        onClick={() => setSaleOpen(true)}
        aria-label="Enregistrer une vente"
        className="sm:hidden fixed right-4 bottom-20 z-40 h-14 w-14 rounded-full inline-flex items-center justify-center text-primary-foreground bg-gradient-to-br from-primary to-[color:var(--gold)] shadow-[0_8px_24px_-4px_rgba(200,146,42,0.55)] active:scale-95 transition"
      >
        <Wallet className="h-6 w-6" />
      </button>
    </div>
  );
}

function MetricCard({ icon, label, value, sublabel }: { icon: React.ReactNode; label: string; value: number; sublabel?: string }) {
  return (
    <div className="group relative rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--gold)]/40 hover:shadow-[0_0_0_1px_rgba(200,146,42,0.15),0_10px_30px_-15px_rgba(200,146,42,0.35)]">
      <div className="flex items-start justify-between">
        <span className="text-[color:var(--gold)]">{icon}</span>
      </div>
      <div className="mt-4">
        <p className="text-[28px] font-bold text-foreground tabular-nums leading-none">
          <AnimatedCounter value={value} />
        </p>
        <p className="mt-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
        {sublabel && <p className="mt-0.5 text-[11px] text-muted-foreground/70">{sublabel}</p>}
      </div>
      <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-[color:var(--gold)]/40 to-transparent opacity-60" />
    </div>
  );
}

function FilterPill({ label, active, children }: { label: string; active: boolean; children: React.ReactNode }) {
  return (
    <div className={cn(
      "inline-flex items-center gap-1 rounded-full border transition-colors h-9 pl-3 pr-1",
      active
        ? "bg-[color:var(--gold)]/12 border-[color:var(--gold)]/40 text-[color:var(--gold)]"
        : "bg-background/40 border-border text-muted-foreground hover:border-[color:var(--gold)]/30"
    )}>
      <span className="text-xs font-medium">{label}:</span>
      {children}
    </div>
  );
}

function SummaryCard({ icon, label, value, sublabel, accent }: { icon: React.ReactNode; label: string; value: string; sublabel?: string; accent?: "primary" | "gold" }) {
  const color = accent === "gold" ? "text-[color:var(--gold)]" : accent === "primary" ? "text-primary" : "text-[color:var(--gold)]";
  return (
    <div className="rounded-2xl border border-primary/20 bg-card p-4 sm:p-4 shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground text-[11px] sm:text-xs">
        <span className="text-primary shrink-0">
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>
      <p className={cn("mt-2 text-3xl sm:text-2xl font-bold tabular-nums truncate leading-tight", color)}>{value}</p>
      {sublabel && (
        <p className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground truncate">{sublabel}</p>
      )}
    </div>
  );
}


function EmptyState({ hasItems, onAdd }: { hasItems: boolean; onAdd: () => void }) {
  return (
    <div className="py-16 text-center px-4">
      <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
        <Package className="h-8 w-8" />
      </div>
      <h3 className="mt-4 font-semibold">{hasItems ? "Aucun résultat" : "Aucun dépôt"}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {hasItems ? "Essayez d'ajuster votre recherche." : "Enregistrez votre premier dépôt en librairie."}
      </p>
      {!hasItems && (
        <Button onClick={onAdd} className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" /> Ajouter un dépôt
        </Button>
      )}
    </div>
  );
}

function StockForm({
  entrepriseId, manuscrits, existing, onSaved,
}: {
  entrepriseId: string | null;
  manuscrits: Manuscrit[];
  existing: Stock | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    manuscrit_id: existing?.manuscrit_id ?? "",
    librairie_nom: existing?.librairie_nom ?? "",
    librairie_adresse: existing?.librairie_adresse ?? "",
    exemplaires_deposes: existing?.exemplaires_deposes ?? 0,
    exemplaires_vendus: existing?.exemplaires_vendus ?? 0,
    prix_unitaire_fcfa: Number(existing?.prix_unitaire_fcfa ?? 0),
    derniere_visite: existing?.derniere_visite ? new Date(existing.derniere_visite) : undefined as Date | undefined,
    taux_commission_pct: Number(existing?.taux_commission_pct ?? 20),
    applique_droits_auteur: existing?.applique_droits_auteur ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [tauxTouched, setTauxTouched] = useState(false);
  const previousVendus = Number(existing?.exemplaires_vendus ?? 0);

  // Mémoriser par librairie: pré-remplir taux + droits à partir du dernier dépôt de la même librairie
  useEffect(() => {
    if (existing || tauxTouched) return;
    const nom = form.librairie_nom.trim();
    if (!nom || !entrepriseId) return;
    const handler = setTimeout(async () => {
      const { data } = await (supabase as any)
        .from("stocks")
        .select("taux_commission_pct, applique_droits_auteur, librairie_adresse")
        .eq("entreprise_id", entrepriseId)
        .ilike("librairie_nom", nom)
        .order("created_at", { ascending: false })
        .limit(1);
      const prev = data?.[0];
      if (prev) {
        setForm((f) => ({
          ...f,
          taux_commission_pct: prev.taux_commission_pct ?? f.taux_commission_pct,
          applique_droits_auteur: prev.applique_droits_auteur ?? f.applique_droits_auteur,
          librairie_adresse: f.librairie_adresse || (prev.librairie_adresse ?? ""),
        }));
      }
    }, 350);
    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.librairie_nom, entrepriseId]);

  const restants = Math.max(0, Number(form.exemplaires_deposes) - Number(form.exemplaires_vendus));
  const montantTotal = Number(form.exemplaires_vendus) * Number(form.prix_unitaire_fcfa);
  const tauxComm = Number(form.taux_commission_pct) || 0;
  const commissionLibrairie = Math.round(montantTotal * tauxComm / 100);
  const droitsAuteur = form.applique_droits_auteur ? Math.round(montantTotal * 0.1) : 0;
  const netEditeur = montantTotal - commissionLibrairie - droitsAuteur;
  const deltaVendus = Math.max(0, Number(form.exemplaires_vendus) - previousVendus);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entrepriseId) return toast.error("Profil non chargé");
    if (!form.manuscrit_id) return toast.error("Sélectionnez un manuscrit");
    setLoading(true);
    const payload: any = {
      manuscrit_id: form.manuscrit_id,
      librairie_nom: form.librairie_nom || null,
      librairie_adresse: form.librairie_adresse || null,
      exemplaires_deposes: Number(form.exemplaires_deposes),
      exemplaires_vendus: Number(form.exemplaires_vendus),
      exemplaires_restants: restants,
      exemplaires_total: Number(form.exemplaires_deposes),
      prix_unitaire_fcfa: Number(form.prix_unitaire_fcfa),
      derniere_visite: form.derniere_visite ? format(form.derniere_visite, "yyyy-MM-dd") : null,
      taux_commission_pct: tauxComm,
      applique_droits_auteur: form.applique_droits_auteur,
    };
    const { error } = existing
      ? await supabase.from("stocks").update(payload).eq("id", existing.id)
      : await supabase.from("stocks").insert({ ...payload, entreprise_id: entrepriseId });

    if (error) { setLoading(false); return toast.error(error.message); }
    // Vente auto-créée par trigger SQL `stocks_vente_delta` quand exemplaires_vendus augmente.

    // Répercussion sur l'entrepôt (stock interne) : seule la différence de déposés est appliquée
    const deltaDeposes = Number(form.exemplaires_deposes) - Number(existing?.exemplaires_deposes ?? 0);
    if (deltaDeposes !== 0) {
      const { data: res, error: rpcErr } = await (supabase as any).rpc("apply_depot_transfert", {
        p_manuscrit_id: form.manuscrit_id,
        p_delta: deltaDeposes,
        p_librairie_nom: form.librairie_nom || null,
        p_date: form.derniere_visite ? format(form.derniere_visite, "yyyy-MM-dd") : null,
      });
      if (rpcErr) toast.error(`Entrepôt non mis à jour : ${rpcErr.message}`);
      else if (res?.warning) toast.warning(res.warning);
      else if (deltaDeposes > 0) toast.success(`${deltaDeposes} ex. retiré(s) de l'entrepôt`);
      else toast.success(`${-deltaDeposes} ex. rendu(s) à l'entrepôt`);
    }

    setLoading(false);
    toast.success(existing ? "Stock mis à jour" : "Dépôt ajouté");
    onSaved();

  };

  return (
    <form onSubmit={submit} className="space-y-4 mt-6">
      <div className="space-y-2">
        <Label>Manuscrit publié</Label>
        <BookCombobox
          items={manuscrits}
          value={form.manuscrit_id}
          onChange={(v) => setForm({ ...form, manuscrit_id: v })}
          emptyLabel="Aucun manuscrit publié"
        />

      </div>
      <div className="space-y-2">
        <Label>Nom de la librairie</Label>
        <Input required value={form.librairie_nom} onChange={(e) => setForm({ ...form, librairie_nom: e.target.value })} placeholder="Librairie Harmattan…" />
      </div>
      <div className="space-y-2">
        <Label>Adresse</Label>
        <Input value={form.librairie_adresse} onChange={(e) => setForm({ ...form, librairie_adresse: e.target.value })} placeholder="Hamdallaye ACI 2000…" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Exemplaires déposés</Label>
          <Input type="number" min={0} required value={form.exemplaires_deposes}
            onChange={(e) => setForm({ ...form, exemplaires_deposes: Number(e.target.value) })} />
        </div>
        <div className="space-y-2">
          <Label>Exemplaires vendus</Label>
          <Input type="number" min={0} required value={form.exemplaires_vendus}
            onChange={(e) => setForm({ ...form, exemplaires_vendus: Number(e.target.value) })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Prix unitaire (FCFA)</Label>
        <Input type="number" min={0} required value={form.prix_unitaire_fcfa}
          onChange={(e) => setForm({ ...form, prix_unitaire_fcfa: Number(e.target.value) })}
          placeholder="ex: 5000" />
      </div>

      {/* Taux commission + droits auteur */}
      <div className="rounded-xl border border-border bg-background/30 p-4 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-sm">
              <Store className="h-4 w-4 text-orange-400" />
              Commission librairie
            </Label>
            <Switch
              checked={tauxComm > 0}
              onCheckedChange={(v: boolean) => {
                setTauxTouched(true);
                setForm((f) => ({ ...f, taux_commission_pct: v ? 20 : 0 }));
              }}
            />
          </div>
          {tauxComm > 0 && (
            <div className="flex gap-2 pt-1">
              {[10, 15, 20].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => { setTauxTouched(true); setForm({ ...form, taux_commission_pct: p }); }}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-semibold border transition",
                    tauxComm === p
                      ? "bg-orange-400/15 border-orange-400/50 text-orange-300"
                      : "bg-background border-border text-muted-foreground hover:border-orange-400/30"
                  )}
                >
                  {p} %
                </button>
              ))}
            </div>
          )}
          {tauxComm === 0 && (
            <p className="text-xs text-muted-foreground">Aucune commission ne sera appliquée à la librairie.</p>
          )}
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <Label className="flex items-center gap-2 text-sm">
            <PenLine className="h-4 w-4 text-[color:var(--gold)]" />
            Droits d'auteur (10 %)
          </Label>
          <Switch
            checked={form.applique_droits_auteur}
            onCheckedChange={(v: boolean) => setForm({ ...form, applique_droits_auteur: v })}
          />
        </div>
      </div>

      {/* Live calculations */}
      <div className="rounded-xl border border-border bg-background/40 p-4 space-y-2 text-sm">
        <Row icon={<BookOpen className="h-4 w-4" />} label="Exemplaires restants">
          <span className="font-semibold text-primary">{restants}</span>
        </Row>
        <Row icon={<Wallet className="h-4 w-4" />} label="Chiffre d'affaires brut">
          <span className="font-semibold text-foreground">{fcfa(montantTotal)}</span>
        </Row>
        <Row icon={<Store className="h-4 w-4" />} label={`Commission librairie (${tauxComm} %)`}>
          <span className="font-semibold text-orange-400">− {fcfa(commissionLibrairie)}</span>
        </Row>
        <Row icon={<PenLine className="h-4 w-4" />} label={form.applique_droits_auteur ? "Droits auteur estimés (10 %)" : "Droits auteur (désactivés)"}>
          <span className="font-semibold text-[color:var(--gold)]">− {fcfa(droitsAuteur)}</span>
        </Row>
        <div className="pt-2 border-t border-border">
          <Row icon={<TrendingUp className="h-4 w-4" />} label="Net éditeur">
            <span className="font-bold text-primary text-base">{fcfa(netEditeur)}</span>
          </Row>
        </div>
        {deltaVendus > 0 && Number(form.prix_unitaire_fcfa) > 0 && (
          <p className="pt-2 text-xs text-muted-foreground border-t border-border">
            ✨ Une vente de <span className="text-primary font-medium">{deltaVendus} exemplaire(s)</span> sera enregistrée automatiquement avec une commission de {tauxComm} %{form.applique_droits_auteur ? " et 10 % de droits d'auteur" : " (sans droits d'auteur)"}.
          </p>
        )}
      </div>


      <div className="space-y-2">
        <Label>Dernière visite</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.derniere_visite && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {form.derniere_visite ? format(form.derniere_visite, "PPP", { locale: fr }) : "Choisir une date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
            <Calendar mode="single" selected={form.derniere_visite}
              onSelect={(d) => setForm({ ...form, derniere_visite: d })}
              initialFocus locale={fr} className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
      </div>
      <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (existing ? "Enregistrer les modifications" : "Ajouter le dépôt")}
      </Button>
    </form>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground inline-flex items-center gap-2"><span className="text-primary">{icon}</span>{label}</span>
      {children}
    </div>
  );
}

function InventoryAnalytics({ stocks, titreMap }: { stocks: Stock[]; titreMap: Record<string, string> }) {
  const [range, setRange] = useState<DateRange>(defaultRange());
  const [ventes, setVentes] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("ventes").select("manuscrit_id, quantite_vendue, date_vente");
      setVentes(data ?? []);
    })();
  }, []);

  const totalCirc = stocks.reduce((s, x) => s + (x.exemplaires_deposes ?? 0), 0);
  const totalVendus = stocks.reduce((s, x) => s + (x.exemplaires_vendus ?? 0), 0);
  const sellThrough = totalCirc > 0 ? Math.round((totalVendus / totalCirc) * 100) : 0;
  const lowStock = stocks.filter((s) => (s.exemplaires_restants ?? 0) > 0 && (s.exemplaires_restants ?? 0) < 3);
  const critical = stocks.filter((s) => (s.exemplaires_restants ?? 0) <= 3);

  const byStore = useMemo(() => {
    const map = new Map<string, { name: string; deposited: number; remaining: number }>();
    stocks.forEach((s) => {
      const name = s.librairie_nom?.trim() || "—";
      const e = map.get(name) ?? { name, deposited: 0, remaining: 0 };
      e.deposited += s.exemplaires_deposes ?? 0;
      e.remaining += s.exemplaires_restants ?? 0;
      map.set(name, e);
    });
    return [...map.values()].slice(0, 10);
  }, [stocks]);

  const salesEvolution = useMemo(() => {
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) months.push(fmtDate(startOfMonth(subMonths(new Date(), i)), "yyyy-MM"));
    const byManuscript = new Map<string, Record<string, number>>();
    ventes.filter((v) => inRange(v.date_vente, range)).forEach((v) => {
      const k = v.date_vente?.slice(0, 7);
      if (!months.includes(k)) return;
      const m = byManuscript.get(v.manuscrit_id) ?? {};
      m[k] = (m[k] ?? 0) + Number(v.quantite_vendue || 0);
      byManuscript.set(v.manuscrit_id, m);
    });
    const data = months.map((m) => {
      const row: any = { label: fmtDate(new Date(m + "-01"), "MMM") };
      byManuscript.forEach((counts, mid) => { row[titreMap[mid] ?? mid.slice(0, 6)] = counts[m] ?? 0; });
      return row;
    });
    const titles = [...byManuscript.keys()].map((id) => titreMap[id] ?? id.slice(0, 6));
    return { data, titles };
  }, [ventes, range, titreMap]);

  const colors = ["#C8922A", "#E8B84B", "#3B82F6", "#F59E0B", "#8B5CF6", "#EC4899"];

  return (
    <AnalyticsSection title="📊 Analytiques stocks" range={range} setRange={setRange}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard icon={<BookOpen />} label="En circulation" value={String(totalCirc)} />
        <SummaryCard icon={<ShoppingBag />} label="Vendus (total)" value={String(totalVendus)} accent="primary" />
        <SummaryCard icon={<TrendingUp />} label="Taux de vente" value={`${sellThrough}%`} accent="gold" />
        <SummaryCard icon={<AlertTriangle />} label="Stock faible" value={String(lowStock.length)} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-background/40 p-5">
          <h3 className="font-semibold mb-3">📦 Stock par librairie</h3>
          <div className="h-64">
            {byStore.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byStore}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" />
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} angle={-20} textAnchor="end" height={60} />
                  <YAxis stroke="#94A3B8" fontSize={12} />
                  <Tooltip contentStyle={{ background: "#1A1208", border: "1px solid #1E3A5F", borderRadius: 8 }} />
                  <Legend />
                  <Bar dataKey="deposited" name="Déposés" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="remaining" name="Restants" fill="#C8922A" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-5">
          <h3 className="font-semibold mb-3">📉 Évolution des ventes par livre</h3>
          <div className="h-64">
            {salesEvolution.titles.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesEvolution.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" />
                  <XAxis dataKey="label" stroke="#94A3B8" fontSize={12} />
                  <YAxis stroke="#94A3B8" fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#1A1208", border: "1px solid #1E3A5F", borderRadius: 8 }} />
                  <Legend />
                  {salesEvolution.titles.map((t, i) => <Line key={t} type="monotone" dataKey={t} stroke={colors[i % colors.length]} strokeWidth={2} />)}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {critical.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-400" /> Alertes de stock critique</h3>
          {critical.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-red-500/30 bg-red-500/10">
              <p className="text-sm">
                ⚠️ Stock critique: <span className="font-semibold">{titreMap[s.manuscrit_id] ?? "—"}</span> à {s.librairie_nom ?? "—"} — Plus que {s.exemplaires_restants} exemplaire(s)
              </p>
              <Link to="/imprimeries" className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 whitespace-nowrap">
                Contacter l'imprimeur
              </Link>
            </div>
          ))}
        </div>
      )}
    </AnalyticsSection>
  );
}
