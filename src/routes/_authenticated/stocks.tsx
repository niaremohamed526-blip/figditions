import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Package, Loader2, Pencil, Trash2, Calendar as CalendarIcon, Store, BookOpen, TrendingUp, ShoppingBag, Wallet, PenLine, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stocks</h1>
          <p className="text-muted-foreground mt-1">Gérez votre entrepôt interne et vos dépôts en librairie.</p>
        </div>
      </header>

      <Tabs defaultValue="externe" className="space-y-6">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="externe">🏪 Stock Externe</TabsTrigger>
          <TabsTrigger value="interne">🏭 Stock Interne</TabsTrigger>
          <TabsTrigger value="bordereaux">📄 Bordereaux</TabsTrigger>
        </TabsList>

        <TabsContent value="externe" className="space-y-6 mt-0">
          <div className="flex justify-end">
            <Button onClick={openNew} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" /> Ajouter un dépôt
            </Button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <SummaryCard icon={<BookOpen />} label="En circulation" value={String(totals.deposes)} />
            <SummaryCard icon={<ShoppingBag />} label="Vendus" value={String(totals.vendus)} accent="primary" />
            <SummaryCard icon={<TrendingUp />} label="Restants" value={String(totals.restants)} />
            <SummaryCard icon={<Store />} label="Librairies" value={String(totals.librairies)} />
            <SummaryCard icon={<Wallet />} label="Chiffre d'affaires" value={fcfa(totals.ca)} accent="gold" />
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
        </TabsContent>

        <TabsContent value="interne" className="space-y-6 mt-0">
          <StockInterneTab entrepriseId={profile?.entreprise_id ?? null} userId={user?.id ?? null} />
        </TabsContent>

        <TabsContent value="bordereaux" className="space-y-6 mt-0">
          <BordereauxTab entreprise={entreprise as any} stocks={(items ?? []) as any} titreMap={titreMap} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: "primary" | "gold" }) {
  const color = accent === "gold" ? "text-[color:var(--gold)]" : accent === "primary" ? "text-primary" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <span className={accent === "gold" ? "text-[color:var(--gold)]" : "text-primary"}>
          {icon}
        </span>
        {label}
      </div>
      <p className={cn("mt-1.5 text-2xl font-bold truncate", color)}>{value}</p>
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
  });
  const [loading, setLoading] = useState(false);
  const previousVendus = Number(existing?.exemplaires_vendus ?? 0);

  const restants = Math.max(0, Number(form.exemplaires_deposes) - Number(form.exemplaires_vendus));
  const montantTotal = Number(form.exemplaires_vendus) * Number(form.prix_unitaire_fcfa);
  const commissionLibrairie = Math.round(montantTotal * 0.2);
  const droitsAuteur = Math.round(montantTotal * 0.1);
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

      {/* Live calculations */}
      <div className="rounded-xl border border-border bg-background/40 p-4 space-y-2 text-sm">
        <Row icon={<BookOpen className="h-4 w-4" />} label="Exemplaires restants">
          <span className="font-semibold text-primary">{restants}</span>
        </Row>
        <Row icon={<Wallet className="h-4 w-4" />} label="Chiffre d'affaires brut">
          <span className="font-semibold text-foreground">{fcfa(montantTotal)}</span>
        </Row>
        <Row icon={<Store className="h-4 w-4" />} label="Commission librairie (20%)">
          <span className="font-semibold text-orange-400">− {fcfa(commissionLibrairie)}</span>
        </Row>
        <Row icon={<PenLine className="h-4 w-4" />} label="Droits auteur estimés (10%)">
          <span className="font-semibold text-[color:var(--gold)]">− {fcfa(droitsAuteur)}</span>
        </Row>
        <div className="pt-2 border-t border-border">
          <Row icon={<TrendingUp className="h-4 w-4" />} label="Net éditeur">
            <span className="font-bold text-primary text-base">{fcfa(netEditeur)}</span>
          </Row>
        </div>
        {deltaVendus > 0 && Number(form.prix_unitaire_fcfa) > 0 && (
          <p className="pt-2 text-xs text-muted-foreground border-t border-border">
            ✨ Une vente de <span className="text-primary font-medium">{deltaVendus} exemplaire(s)</span> sera enregistrée automatiquement avec la commission librairie de 20 %.
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
