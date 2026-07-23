import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Package, Loader2, Pencil, Trash2, Calendar as CalendarIcon, Store, BookOpen, TrendingUp, ShoppingBag, Wallet, PenLine, FileSpreadsheet, Zap, BookMarked } from "lucide-react";
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
import { StockInterneTab } from "@/components/stock-interne";
import { BordereauxTab } from "@/components/bordereaux-tab";
import { StockImportDialog } from "@/components/stock-import-dialog";
import { StockPosDialog } from "@/components/stock-pos-dialog";
import { RecordSaleDrawer, RecordSaleTrigger } from "@/components/record-sale-drawer";

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

  const load = async () => {
    setItems(null);
    const [{ data: stocks, error }, { data: ms }] = await Promise.all([
      supabase.from("stocks").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("manuscrits").select("id, titre, statut, auteur_id"),
    ]);
    if (error) toast.error(error.message);
    setItems((stocks ?? []) as Stock[]);
    setManuscrits((ms ?? []) as Manuscrit[]);
  };

  useEffect(() => { if (profile?.entreprise_id) load(); }, [profile?.entreprise_id]);

  const titreMap = useMemo(() => Object.fromEntries(manuscrits.map((m) => [m.id, m.titre])), [manuscrits]);

  const filtered = useMemo(() => {
    if (!items) return null;
    const needle = q.toLowerCase().trim();
    if (!needle) return items;
    return items.filter((s) =>
      (s.librairie_nom ?? "").toLowerCase().includes(needle) ||
      (titreMap[s.manuscrit_id] ?? "").toLowerCase().includes(needle)
    );
  }, [items, q, titreMap]);

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
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Stocks</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Gérez votre entrepôt interne et vos dépôts en librairie.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile: info icon only */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => generateManuelStocksPdf({ maison: entreprise?.nom ?? null })}
            title="Guide d'utilisation"
            className="sm:hidden h-10 w-10 rounded-full border-primary/30"
            aria-label="Guide d'utilisation"
          >
            <BookMarked className="h-4 w-4 text-primary" />
          </Button>
          {/* Desktop: full button */}
          <Button
            variant="outline"
            onClick={() => generateManuelStocksPdf({ maison: entreprise?.nom ?? null })}
            title="Télécharger le guide d'utilisation en PDF"
            className="hidden sm:inline-flex"
          >
            <BookMarked className="h-4 w-4 mr-2" /> Guide d'utilisation
          </Button>
          <div className="hidden sm:block">
            <RecordSaleTrigger onClick={() => setSaleOpen(true)} />
          </div>
        </div>
      </header>

      <Tabs defaultValue="externe" className="space-y-6">
        <TabsList
          className={cn(
            // Mobile: real underline tabs
            "w-full grid grid-cols-3 gap-0 h-11 rounded-none bg-transparent border-0 border-b border-border p-0",
            // Desktop: card-style tabs
            "sm:w-auto sm:inline-flex sm:h-auto sm:rounded-md sm:bg-card sm:border sm:border-border sm:p-1"
          )}
        >
          <TabsTrigger
            value="externe"
            className={cn(
              "min-h-11 text-sm rounded-none bg-transparent border-b-2 border-transparent text-muted-foreground",
              "data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none",
              "sm:rounded-md sm:border-b-0 sm:data-[state=active]:bg-primary sm:data-[state=active]:text-primary-foreground sm:data-[state=active]:border-transparent"
            )}
          >
            <span className="sm:hidden">Externe</span>
            <span className="hidden sm:inline">🏪 Stock Externe</span>
          </TabsTrigger>
          <TabsTrigger
            value="interne"
            className={cn(
              "min-h-11 text-sm rounded-none bg-transparent border-b-2 border-transparent text-muted-foreground",
              "data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none",
              "sm:rounded-md sm:border-b-0 sm:data-[state=active]:bg-primary sm:data-[state=active]:text-primary-foreground sm:data-[state=active]:border-transparent"
            )}
          >
            <span className="sm:hidden">Interne</span>
            <span className="hidden sm:inline">🏭 Stock Interne</span>
          </TabsTrigger>
          <TabsTrigger
            value="bordereaux"
            className={cn(
              "min-h-11 text-sm rounded-none bg-transparent border-b-2 border-transparent text-muted-foreground",
              "data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none",
              "sm:rounded-md sm:border-b-0 sm:data-[state=active]:bg-primary sm:data-[state=active]:text-primary-foreground sm:data-[state=active]:border-transparent"
            )}
          >
            <span className="sm:hidden">Bordereaux</span>
            <span className="hidden sm:inline">📄 Bordereaux</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="externe" className="space-y-5 mt-0">
          {/* Stats — 2x2 grid on mobile, larger numbers */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <SummaryCard icon={<BookOpen />} label="En circulation" value={String(totals.deposes)} sublabel="exemplaires" />
            <SummaryCard icon={<ShoppingBag />} label="Vendus" value={String(totals.vendus)} sublabel="exemplaires" accent="primary" />
            <SummaryCard icon={<TrendingUp />} label="Restants" value={String(totals.restants)} sublabel="exemplaires" />
            <SummaryCard icon={<Store />} label="Librairies" value={String(totals.librairies)} sublabel="actives" />
            <SummaryCard icon={<Wallet />} label="Chiffre d'affaires" value={fcfa(totals.ca)} accent="gold" />
          </div>

          {/* Action buttons — mobile: primary full-width + icon pills row */}
          <div className="space-y-3 sm:space-y-0">
            {/* Primary — full width on mobile */}
            <Button
              onClick={openNew}
              className="w-full sm:hidden h-[52px] text-base font-semibold bg-gradient-to-r from-primary to-[color:var(--gold)] text-primary-foreground hover:opacity-95 shadow-lg shadow-primary/20"
            >
              <Plus className="h-5 w-5 mr-2" /> Ajouter un dépôt
            </Button>
            {/* Secondary — compact pills row on mobile */}
            <div className="grid grid-cols-3 gap-2 sm:hidden">
              <button
                onClick={() => setSaleOpen(true)}
                className="h-9 rounded-full border border-primary/40 bg-card text-xs font-medium text-foreground inline-flex items-center justify-center gap-1.5 hover:bg-primary/10 transition"
              >
                <Wallet className="h-3.5 w-3.5 text-primary" /> Vente
              </button>
              <button
                onClick={() => setImportOpen(true)}
                className="h-9 rounded-full border border-primary/40 bg-card text-xs font-medium text-foreground inline-flex items-center justify-center gap-1.5 hover:bg-primary/10 transition"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-primary" /> Import
              </button>
              <button
                onClick={() => setPosOpen(true)}
                className="h-9 rounded-full border border-primary/40 bg-card text-xs font-medium text-foreground inline-flex items-center justify-center gap-1.5 hover:bg-primary/10 transition"
              >
                <Zap className="h-3.5 w-3.5 text-primary" /> Rapide
              </button>
            </div>
            {/* Desktop: original inline actions */}
            <div className="hidden sm:flex justify-end gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Import Excel
              </Button>
              <Button variant="outline" onClick={() => setPosOpen(true)}>
                <Zap className="h-4 w-4 mr-2" /> Saisie rapide
              </Button>
              <Button onClick={openNew} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" /> Ajouter un dépôt
              </Button>
            </div>
          </div>


          <InventoryAnalytics stocks={items ?? []} titreMap={titreMap} />


      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Rechercher par librairie ou titre…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 bg-card" />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {filtered === null ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasItems={(items?.length ?? 0) > 0} onAdd={openNew} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Titre</th>
                  <th className="px-4 py-3 font-medium">Librairie</th>
                  <th className="px-4 py-3 font-medium text-center">Déposés</th>
                  <th className="px-4 py-3 font-medium text-center">Vendus</th>
                  <th className="px-4 py-3 font-medium text-center">Restants</th>
                  <th className="px-4 py-3 font-medium text-right">Prix unit.</th>
                  <th className="px-4 py-3 font-medium text-right">Chiffre d'affaires</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Dernière visite</th>
                  <th className="px-4 py-3 font-medium w-20 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const ca = (s.exemplaires_vendus ?? 0) * Number(s.prix_unitaire_fcfa ?? 0);
                  return (
                    <tr key={s.id} className="group border-t border-border hover:bg-primary/5 transition-colors">
                      <td className="px-4 py-3 font-medium">{titreMap[s.manuscrit_id] ?? "—"}</td>
                      <td className="px-4 py-3">{s.librairie_nom ?? "—"}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{s.exemplaires_deposes}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{s.exemplaires_vendus}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn("inline-flex items-center justify-center min-w-9 px-2 h-6 rounded-full border text-xs font-semibold transition-colors", remainingColor(s.exemplaires_restants))}>
                          {s.exemplaires_restants}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{s.prix_unitaire_fcfa ? fcfa(s.prix_unitaire_fcfa) : "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[color:var(--gold)]">{fcfa(ca)}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {s.derniere_visite ? format(new Date(s.derniere_visite), "dd MMM yyyy", { locale: fr }) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-primary/15 hover:text-primary" onClick={() => openEdit(s)} title="Modifier">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-destructive/15 hover:text-destructive" onClick={() => setToDelete(s)} title="Supprimer">
                            <Trash2 className="h-4 w-4" />
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

    setLoading(false);
    toast.success(existing ? "Stock mis à jour" : "Dépôt ajouté");
    onSaved();
  };

  return (
    <form onSubmit={submit} className="space-y-4 mt-6">
      <div className="space-y-2">
        <Label>Manuscrit publié</Label>
        <Select value={form.manuscrit_id} onValueChange={(v) => setForm({ ...form, manuscrit_id: v })}>
          <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
          <SelectContent>
            {manuscrits.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Aucun manuscrit publié</div>}
            {manuscrits.map((m) => <SelectItem key={m.id} value={m.id}>{m.titre}</SelectItem>)}
          </SelectContent>
        </Select>
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
