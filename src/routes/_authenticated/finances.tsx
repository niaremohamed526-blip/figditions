import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  TrendingUp, ShoppingBag, Clock, Check, Tag, Wallet, Banknote, PiggyBank,
  LayoutDashboard, ShoppingCart, Users, History, ArrowUp, ArrowDown,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie,
  Cell, Legend, ComposedChart, Line, CartesianGrid,
} from "recharts";
import { format, subMonths, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { AnalyticsSection, defaultRange, inRange, EmptyChart, type DateRange } from "@/components/analytics-section";
import { BestSellingBooks, type BookRanking } from "@/components/best-selling-books";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetch-all";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fcfa } from "@/lib/format";
import { planFor } from "@/lib/plans";
import { LockedPage } from "@/components/locked-page";
import { RecordSaleDrawer, RecordSaleTrigger } from "@/components/record-sale-drawer";
import { ExportFinancesDialog, ExportFinancesTrigger } from "@/components/export-finances-dialog";
import { VentesTab } from "@/components/finances/ventes-tab";
import { DepensesTab } from "@/components/finances/depenses-tab";
import { RoyaltiesTab } from "@/components/finances/royalties-tab";
import { RentabiliteTab } from "@/components/finances/rentabilite-tab";
import { JournalTab } from "@/components/finances/journal-tab";
import { EtrangersFinancesTab } from "@/components/finances/etrangers-finances-tab";
import { Globe } from "lucide-react";
import type { DepenseRow, PaiementRoyaltiesRow, VenteRow } from "@/lib/finance-types";

export const Route = createFileRoute("/_authenticated/finances")({
  component: FinancesPage,
  head: () => ({
    meta: [
      { title: "Finances et royalties | FIGDITIONS" },
      { name: "description", content: "Pilotage financier complet : ventes, encaissements, dépenses, royalties, rentabilité par livre et journal d'audit vérifiable." },
    ],
  }),
});

interface Manuscrit { id: string; titre: string; auteur: string; auteur_id?: string | null; origine?: string | null; }
interface Auteur { id: string; nom_complet: string; numero_mobile_money: string | null; operateur: string | null; }
interface StockInterneLite { id: string; manuscrit_id: string; quantite_imprimee: number; cout_unitaire_impression_fcfa: number; }

const COLORS = ["#C8922A", "#E8B84B", "#4F8FF7", "#E85D8C", "#7E5FFF", "#FF9F45"];

/** Normalized author name : stable grouping key when auteur_id is missing. */
const normalizeName = (s: string | null | undefined) => (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

function FinancesPage() {
  const { user } = useAuth();
  const { profile, entreprise, loading: pLoading } = useProfile(user?.id);
  if (pLoading) return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-96 w-full" /></div>;
  const plan = planFor(entreprise?.plan);
  if (!plan.finances) return <LockedPage feature="le module finances & royalties" requiredPlan="pro" />;
  return (
    <FinancesInner
      entrepriseId={profile?.entreprise_id ?? null}
      entrepriseNom={entreprise?.nom ?? "Maison d'édition"}
      entrepriseVille={entreprise?.ville ?? null}
      userId={user?.id ?? ""}
    />
  );
}

function FinancesInner({
  entrepriseId, entrepriseNom, entrepriseVille, userId,
}: {
  entrepriseId: string | null;
  entrepriseNom: string;
  entrepriseVille: string | null;
  userId: string;
}) {
  const [ventes, setVentes] = useState<VenteRow[] | null>(null);
  const [depenses, setDepenses] = useState<DepenseRow[]>([]);
  const [paiements, setPaiements] = useState<PaiementRoyaltiesRow[]>([]);
  const [manuscrits, setManuscrits] = useState<Manuscrit[]>([]);
  const [auteurs, setAuteurs] = useState<Auteur[]>([]);
  const [stockInterne, setStockInterne] = useState<StockInterneLite[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const load = async () => {
    setVentes(null);
    try {
      // fetchAllRows : contourne la limite silencieuse de 1000 lignes de l'API.
      const [v, dp, pr, ms, as, si] = await Promise.all([
        fetchAllRows<VenteRow>(() => supabase.from("ventes").select("*").order("date_vente", { ascending: false })),
        fetchAllRows<DepenseRow>(() => (supabase as any).from("depenses").select("*").order("date_depense", { ascending: false })),
        fetchAllRows<PaiementRoyaltiesRow>(() => (supabase as any).from("paiements_royalties").select("*").order("paye_le", { ascending: false })),
        fetchAllRows<Manuscrit>(() => (supabase as any).from("manuscrits").select("id, titre, auteur, auteur_id, origine")),
        fetchAllRows<Auteur>(() => (supabase as any).from("auteurs").select("id, nom_complet, numero_mobile_money, operateur")),
        fetchAllRows<StockInterneLite>(() => (supabase as any).from("stock_interne").select("id, manuscrit_id, quantite_imprimee, cout_unitaire_impression_fcfa")),
      ]);
      setVentes(v);
      setDepenses(dp);
      setPaiements(pr);
      setManuscrits(ms);
      setAuteurs(as);
      setStockInterne(si);
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur de chargement");
      setVentes([]);
    }
  };
  useEffect(() => { if (entrepriseId) load(); }, [entrepriseId]);

  const mMap = useMemo(() => Object.fromEntries(manuscrits.map((m) => [m.id, m])), [manuscrits]);
  const aMap = useMemo(() => Object.fromEntries(auteurs.map((a) => [a.id, a.nom_complet])), [auteurs]);

  /** Livres étrangers : jamais mélangés aux ventes de nos productions. */
  const etrangerIds = useMemo(
    () => new Set(manuscrits.filter((m) => m.origine === "etranger").map((m) => m.id)),
    [manuscrits],
  );
  const ventesPropres = useMemo(
    () => (ventes ?? []).filter((v) => !etrangerIds.has(v.manuscrit_id)),
    [ventes, etrangerIds],
  );
  const ventesEtrangers = useMemo(
    () => (ventes ?? []).filter((v) => etrangerIds.has(v.manuscrit_id)),
    [ventes, etrangerIds],
  );

  /** Les ventes annulées sont exclues de tous les agrégats financiers. */
  const ventesActives = useMemo(
    () => (ventes ?? []).filter((v) => (v.statut_annulation ?? "active") !== "annulee"),
    [ventes],
  );

  /** Agrégats de royalties : nos productions uniquement. */
  const ventesActivesPropres = useMemo(
    () => ventesActives.filter((v) => !etrangerIds.has(v.manuscrit_id)),
    [ventesActives, etrangerIds],
  );

  const totals = useMemo(() => {
    const v = ventesActives;
    const revenue = v.reduce((a, x) => a + Number(x.montant_total_fcfa || 0), 0);
    const commission = v.reduce((a, x) => a + Number(x.commission_librairie_fcfa || 0), 0);
    const vp = v.filter((x) => !etrangerIds.has(x.manuscrit_id));
    const royalties = vp.reduce((a, x) => a + Number(x.droits_auteur_fcfa || 0), 0);
    const paid = vp.filter((x) => x.statut_paiement === "paye").reduce((a, x) => a + Number(x.droits_auteur_fcfa || 0), 0);
    const encaisse = v.reduce((a, x) => a + Number(x.montant_encaisse_fcfa || 0), 0);
    const totalDepenses = depenses.reduce((a, d) => a + Number(d.montant_fcfa || 0), 0);
    // Coût de production des exemplaires VENDUS seulement : les invendus restent
    // du stock (un actif), pas une perte. Coût unitaire moyen pondéré par tirage.
    const tirages = new Map<string, { qte: number; cout: number }>();
    for (const s of stockInterne) {
      const t = tirages.get(s.manuscrit_id) ?? { qte: 0, cout: 0 };
      const qte = Number(s.quantite_imprimee || 0);
      t.qte += qte;
      t.cout += Number(s.cout_unitaire_impression_fcfa || 0) * qte;
      tirages.set(s.manuscrit_id, t);
    }
    const coutProduction = vp.reduce((a, x) => {
      const t = tirages.get(x.manuscrit_id);
      return t && t.qte > 0 ? a + (t.cout / t.qte) * Number(x.quantite_vendue || 0) : a;
    }, 0);
    return {
      revenue,
      commission,
      remises: v.reduce((a, x) => a + Number(x.remise_fcfa || 0), 0),
      royalties,
      paid,
      pending: royalties - paid,
      copies: v.reduce((a, x) => a + Number(x.quantite_vendue || 0), 0),
      encaisse,
      aEncaisser: Math.max(0, revenue - encaisse),
      totalDepenses,
      resultatNet: revenue - commission - royalties - totalDepenses - coutProduction,
    };
  }, [ventesActives, depenses, stockInterne, etrangerIds]);

  const monthlyData = useMemo(() => {
    const v = ventesActives;
    const buckets: { key: string; label: string; revenue: number; depenses: number; net: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = startOfMonth(subMonths(new Date(), i));
      buckets.push({ key: format(d, "yyyy-MM"), label: format(d, "MMM", { locale: fr }), revenue: 0, depenses: 0, net: 0 });
    }
    const map = new Map(buckets.map((b) => [b.key, b]));
    v.forEach((s) => {
      const b = map.get(s.date_vente?.slice(0, 7));
      if (b) b.revenue += Number(s.montant_total_fcfa || 0);
    });
    depenses.forEach((d) => {
      const b = map.get(d.date_depense?.slice(0, 7));
      if (b) b.depenses += Number(d.montant_fcfa || 0);
    });
    buckets.forEach((b) => { b.net = b.revenue - b.depenses; });
    return buckets;
  }, [ventesActives, depenses]);

  const pieData = useMemo(() => {
    const v = ventesActives;
    const by: Record<string, number> = {};
    v.forEach((s) => {
      const t = mMap[s.manuscrit_id]?.titre ?? "—";
      by[t] = (by[t] ?? 0) + Number(s.montant_total_fcfa || 0);
    });
    return Object.entries(by).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [ventesActives, mMap]);

  const loading = ventes === null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finances</h1>
          <p className="text-muted-foreground mt-1">
            Ventes, encaissements, dépenses et royalties. Chaque opération est traçable et vérifiable.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportFinancesTrigger onClick={() => setExportOpen(true)} />
          <RecordSaleTrigger onClick={() => setSheetOpen(true)} />
        </div>
      </header>

      <Tabs defaultValue="apercu" className="space-y-6">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap h-auto p-1 gap-1">
          <TabsTrigger value="apercu" className="gap-1.5 whitespace-nowrap">
            <LayoutDashboard className="h-4 w-4" /> Vue d'ensemble
          </TabsTrigger>
          <TabsTrigger value="ventes" className="gap-1.5 whitespace-nowrap">
            <ShoppingCart className="h-4 w-4" /> Ventes
            {!loading && ventes.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{ventes.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="depenses" className="gap-1.5 whitespace-nowrap">
            <Wallet className="h-4 w-4" /> Dépenses
          </TabsTrigger>
          <TabsTrigger value="royalties" className="gap-1.5 whitespace-nowrap">
            <Users className="h-4 w-4" /> Royalties
            {totals.pending > 0 && (
              <Badge className="ml-1 text-[10px] px-1.5 py-0 bg-amber-500/20 text-amber-400 border-amber-500/30">
                {fcfa(totals.pending)}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="etrangers" className="gap-1.5 whitespace-nowrap">
            <Globe className="h-4 w-4" /> Livres Étrangers
            {ventesEtrangers.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{ventesEtrangers.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="rentabilite" className="gap-1.5 whitespace-nowrap">
            <PiggyBank className="h-4 w-4" /> Rentabilité
          </TabsTrigger>
          <TabsTrigger value="journal" className="gap-1.5 whitespace-nowrap">
            <History className="h-4 w-4" /> Journal
          </TabsTrigger>
        </TabsList>

        {/* ==================== VUE D'ENSEMBLE ==================== */}
        <TabsContent value="apercu" className="space-y-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={TrendingUp} label="Chiffre d'affaires" value={fcfa(totals.revenue)} accent="gold" />
            <StatCard icon={Banknote} label="Encaissé" value={fcfa(totals.encaisse)} accent="primary" />
            <StatCard icon={Clock} label="À encaisser" value={fcfa(totals.aEncaisser)} accent="warn" />
            <StatCard icon={Wallet} label="Dépenses" value={fcfa(totals.totalDepenses)} accent="danger" />
            <StatCard
              icon={PiggyBank}
              label="Résultat net estimé"
              value={fcfa(totals.resultatNet)}
              accent={totals.resultatNet >= 0 ? "primary" : "danger"}
            />
            <StatCard icon={Check} label="Royalties payées" value={fcfa(totals.paid)} accent="primary" />
            <StatCard icon={Clock} label="Royalties en attente" value={fcfa(totals.pending)} accent="gold" />
            <StatCard icon={ShoppingBag} label="Exemplaires vendus" value={String(totals.copies)} />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-semibold mb-4">CA et dépenses sur les 6 derniers mois</h3>
              <div className="h-64">
                {loading ? <Skeleton className="h-full w-full" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" />
                      <XAxis dataKey="label" stroke="#94A3B8" fontSize={12} />
                      <YAxis stroke="#94A3B8" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{ background: "#1A1208", border: "1px solid #1E3A5F", borderRadius: 8 }}
                        formatter={(v: number) => fcfa(v)}
                      />
                      <Legend />
                      <Bar dataKey="revenue" name="CA" fill="#C8922A" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="depenses" name="Dépenses" fill="#b0413e" radius={[6, 6, 0, 0]} />
                      <Line type="monotone" dataKey="net" name="Net" stroke="#3fb96f" strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-semibold mb-4">Répartition par titre</h3>
              <div className="h-64">
                {loading ? <Skeleton className="h-full w-full" /> : pieData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Aucune vente</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80} label={(e) => `${e.name}`}>
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#1A1208", border: "1px solid #1E3A5F", borderRadius: 8 }} formatter={(v: number) => fcfa(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {totals.remises > 0 && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" /> Remises accordées au total : {fcfa(totals.remises)}
            </p>
          )}

          <FinancesAnalytics ventes={loading ? null : ventesActives} manuscrits={manuscrits} aMap={aMap} mMap={mMap} />
        </TabsContent>

        {/* ==================== VENTES ==================== */}
        <TabsContent value="ventes">
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <VentesTab
              ventes={ventesPropres}
              manuscrits={manuscrits as any}
              auteurs={auteurs}
              onChanged={load}
              entrepriseNom={entrepriseNom}
              entrepriseVille={entrepriseVille}
            />
          )}
        </TabsContent>

        {/* ==================== DÉPENSES ==================== */}
        <TabsContent value="depenses">
          {loading || !entrepriseId ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <DepensesTab
              depenses={depenses}
              manuscrits={manuscrits}
              entrepriseId={entrepriseId}
              userId={userId}
              onChanged={load}
            />
          )}
        </TabsContent>

        {/* ==================== ROYALTIES ==================== */}
        <TabsContent value="royalties">
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <RoyaltiesTab
              ventes={ventesActivesPropres}
              manuscrits={manuscrits as any}
              auteurs={auteurs}
              paiements={paiements}
              entrepriseNom={entrepriseNom}
              entrepriseVille={entrepriseVille}
              onChanged={load}
            />
          )}
        </TabsContent>

        {/* ==================== LIVRES ÉTRANGERS ==================== */}
        <TabsContent value="etrangers">
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <EtrangersFinancesTab
              ventes={ventesEtrangers}
              manuscrits={manuscrits as any}
              onChanged={load}
            />
          )}
        </TabsContent>

        {/* ==================== RENTABILITÉ ==================== */}
        <TabsContent value="rentabilite">
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <RentabiliteTab
              ventes={ventesActives}
              depenses={depenses}
              stockInterne={stockInterne}
              manuscrits={manuscrits}
            />
          )}
        </TabsContent>

        {/* ==================== JOURNAL ==================== */}
        <TabsContent value="journal">
          <JournalTab />
        </TabsContent>
      </Tabs>

      <RecordSaleDrawer
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        entrepriseId={entrepriseId}
        onSaved={load}
        entrepriseNom={entrepriseNom}
        entrepriseVille={entrepriseVille}
      />

      <ExportFinancesDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        entrepriseNom={entrepriseNom}
      />
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, accent,
}: {
  icon: any; label: string; value: string; accent?: "primary" | "gold" | "warn" | "danger";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <div className={cn(
          "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
          accent === "gold" ? "bg-[color:var(--gold)]/15 text-[color:var(--gold)]" :
          accent === "primary" ? "bg-emerald-500/15 text-emerald-400" :
          accent === "warn" ? "bg-amber-500/15 text-amber-400" :
          accent === "danger" ? "bg-red-500/15 text-red-400" :
          "bg-muted text-muted-foreground",
        )}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-xl font-bold mt-0.5 truncate">{value}</p>
        </div>
      </div>
    </div>
  );
}

function FinancesAnalytics({ ventes, manuscrits, aMap, mMap }: { ventes: VenteRow[] | null; manuscrits: Manuscrit[]; aMap: Record<string, string>; mMap: Record<string, Manuscrit> }) {
  const [range, setRange] = useState<DateRange>(defaultRange());
  const [sortKey, setSortKey] = useState<"copies" | "revenue">("copies");
  if (ventes === null) return <Skeleton className="h-24 w-full" />;
  const filtered = ventes.filter((v) => inRange(v.date_vente, range));

  const now = new Date();
  const thisMonthKey = format(startOfMonth(now), "yyyy-MM");
  const lastMonthKey = format(startOfMonth(subMonths(now, 1)), "yyyy-MM");
  const thisMonth = ventes.filter((v) => v.date_vente?.startsWith(thisMonthKey)).reduce((a, x) => a + Number(x.montant_total_fcfa || 0), 0);
  const lastMonth = ventes.filter((v) => v.date_vente?.startsWith(lastMonthKey)).reduce((a, x) => a + Number(x.montant_total_fcfa || 0), 0);
  const growth = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : 0;

  const months: { key: string; label: string; revenue: number; cumul: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = startOfMonth(subMonths(now, i));
    months.push({ key: format(d, "yyyy-MM"), label: format(d, "MMM"), revenue: 0, cumul: 0 });
  }
  const mMap2 = new Map(months.map((m) => [m.key, m]));
  filtered.forEach((v) => { const b = mMap2.get(v.date_vente?.slice(0, 7)); if (b) b.revenue += Number(v.montant_total_fcfa || 0); });
  let cum = 0; months.forEach((m) => { cum += m.revenue; m.cumul = cum; });
  const best = months.reduce((a, b) => (b.revenue > a.revenue ? b : a), months[0] ?? { revenue: 0, label: "—" } as any);
  const avg = Math.round(months.reduce((a, b) => a + b.revenue, 0) / Math.max(months.length, 1));

  const rankings: BookRanking[] = [...filtered.reduce((map, v) => {
    const m = mMap[v.manuscrit_id]; if (!m) return map;
    const e = map.get(v.manuscrit_id) ?? { manuscritId: v.manuscrit_id, titre: m.titre, auteur: m.auteur, etranger: (m as any).origine === "etranger", copies: 0, revenue: 0 };
    e.copies += Number(v.quantite_vendue || 0); e.revenue += Number(v.montant_total_fcfa || 0);
    map.set(v.manuscrit_id, e); return map;
  }, new Map<string, BookRanking>()).values()].sort((a, b) => (sortKey === "copies" ? b.copies - a.copies : b.revenue - a.revenue));

  const royaltiesByAuthor = new Map<string, { name: string; paid: number; pending: number }>();
  filtered.forEach((v) => {
    const aid = v.auteur_id ?? mMap[v.manuscrit_id]?.auteur_id ?? null;
    const name = (aid && aMap[aid]) || mMap[v.manuscrit_id]?.auteur?.trim() || "Inconnu";
    const key = aid ?? `nom:${normalizeName(name)}`;
    const e = royaltiesByAuthor.get(key) ?? { name, paid: 0, pending: 0 };
    const dr = Number(v.droits_auteur_fcfa || 0);
    if (v.statut_paiement === "paye") e.paid += dr; else e.pending += dr;
    royaltiesByAuthor.set(key, e);
  });

  return (
    <AnalyticsSection title="📊 Analytiques financières" range={range} setRange={setRange}>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <FCard label="Ce mois" value={fcfa(thisMonth)} />
        <FCard label="Mois dernier" value={fcfa(lastMonth)} />
        <FCard label="Croissance MoM" value={`${growth > 0 ? "+" : ""}${growth}%`} accent={growth >= 0 ? "primary" : "danger"} icon={growth >= 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />} />
        <FCard label="Meilleur mois" value={`${best.label} · ${fcfa(best.revenue)}`} accent="gold" />
        <FCard label="Moyenne mensuelle" value={fcfa(avg)} />
      </div>
      <div className="rounded-xl border border-border bg-background/40 p-5">
        <h3 className="font-semibold mb-3">💹 Évolution du chiffre d'affaires</h3>
        <div className="h-64">
          {months.every((m) => m.revenue === 0) ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={months}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" />
                <XAxis dataKey="label" stroke="#94A3B8" fontSize={12} />
                <YAxis stroke="#94A3B8" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "#1A1208", border: "1px solid #1E3A5F", borderRadius: 8 }} formatter={(v: number) => fcfa(v)} />
                <Legend />
                <Bar dataKey="revenue" name="Mensuel" fill="#C8922A" radius={[6, 6, 0, 0]} />
                <Line type="monotone" dataKey="cumul" name="Cumulé" stroke="#E8B84B" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-background/40 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="font-semibold">🏆 Livres les plus vendus</h3>
          <div className="flex gap-1.5">
            <button onClick={() => setSortKey("copies")} className={`text-xs px-3 py-1 rounded-md border ${sortKey === "copies" ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>Exemplaires</button>
            <button onClick={() => setSortKey("revenue")} className={`text-xs px-3 py-1 rounded-md border ${sortKey === "revenue" ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>Revenu</button>
          </div>
        </div>
        <BestSellingBooks books={rankings} limit={5} />
      </div>
      <div className="rounded-xl border border-border bg-background/40 p-5">
        <h3 className="font-semibold mb-3">✍️ Suivi des droits d'auteur</h3>
        {royaltiesByAuthor.size === 0 ? <EmptyChart label="Aucun droit d'auteur sur cette période" /> : (
          <div className="space-y-3">
            {[...royaltiesByAuthor.values()].map((r) => {
              const total = r.paid + r.pending;
              const paidPct = total > 0 ? (r.paid / total) * 100 : 0;
              return (
                <div key={r.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{r.name}</span>
                    <span className="text-xs text-muted-foreground">
                      <span className="text-primary">{fcfa(r.paid)}</span> / <span className="text-orange-400">{fcfa(r.pending)}</span>
                    </span>
                  </div>
                  <Progress value={paidPct} className="h-2" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AnalyticsSection>
  );
}

function FCard({ label, value, accent, icon }: { label: string; value: string; accent?: "primary" | "gold" | "danger"; icon?: React.ReactNode }) {
  const color = accent === "gold" ? "text-[color:var(--gold)]" : accent === "primary" ? "text-primary" : accent === "danger" ? "text-red-400" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-background/40 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-lg font-bold truncate flex items-center gap-1", color)}>{icon}{value}</p>
    </div>
  );
}

