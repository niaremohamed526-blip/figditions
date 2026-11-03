import { CHART_TOOLTIP_STYLE } from "@/lib/chart-style";
import { fmtMontant } from "@/components/finances/finance-ui";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Wallet, PiggyBank,
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
import { CreancesLibrairies } from "@/components/finances/creances-librairies";
import {
  calculerResultat, coutUnitaireParLivre, dansPeriode, prefixePeriode, resteAEncaisser, PERIODES, type Periode,
} from "@/lib/finance-calc";
import { pl } from "@/lib/plural";

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

/** Vues de détail, ouvertes depuis la Vue d'ensemble plutôt que par un onglet. */
const SECONDAIRES = [
  { value: "rentabilite", label: "Rentabilité par livre", desc: "Ce que chaque livre rapporte", icon: PiggyBank },
  { value: "etrangers", label: "Livres étrangers", desc: "Ventes pour d'autres maisons", icon: Globe },
  { value: "journal", label: "Journal", desc: "Qui a fait quoi, et quand", icon: History },
];

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
  // "Enregistrer une vente" shortcut on the installed app's icon opens the form.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("vente") !== "1") return;
    setSheetOpen(true);
    url.searchParams.delete("vente");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, []);
  const [exportOpen, setExportOpen] = useState(false);

  const load = async () => {
    setVentes(null);
    try {
      // fetchAllRows : contourne la limite silencieuse de 1000 lignes de l'API.
      const [v, dp, pr, ms, as, si] = await Promise.all([
        fetchAllRows<VenteRow>(() => supabase.from("ventes").select("*").order("date_vente", { ascending: false })),
        fetchAllRows<DepenseRow>(() => supabase.from("depenses").select("*").order("date_depense", { ascending: false })),
        fetchAllRows<PaiementRoyaltiesRow>(() => supabase.from("paiements_royalties").select("*").order("paye_le", { ascending: false })),
        fetchAllRows<Manuscrit>(() => supabase.from("manuscrits").select("id, titre, auteur, auteur_id, origine")),
        fetchAllRows<Auteur>(() => supabase.from("auteurs").select("id, nom_complet, numero_mobile_money, operateur")),
        fetchAllRows<StockInterneLite>(() => supabase.from("stock_interne").select("id, manuscrit_id, quantite_imprimee, cout_unitaire_impression_fcfa")),
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
  const titres = useMemo(() => Object.fromEntries(manuscrits.map((m) => [m.id, m.titre])), [manuscrits]);
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

  const [periode, setPeriode] = useState<Periode>("mois");
  const coutUnitaire = useMemo(() => coutUnitaireParLivre(stockInterne), [stockInterne]);

  /** Bénéfice de la période : une seule définition (lib/finance-calc), nos propres livres uniquement. */
  const resultat = useMemo(() => {
    const p = prefixePeriode(periode);
    return calculerResultat(
      ventesActivesPropres.filter((v) => dansPeriode(v.date_vente, p)),
      depenses.filter((d) => dansPeriode(d.date_depense, p)),
      coutUnitaire,
    );
  }, [periode, ventesActivesPropres, depenses, coutUnitaire]);

  /** Ce qui est dû aujourd'hui, quelle que soit la période. */
  const totals = useMemo(() => {
    const aEncaisser = ventesActives.reduce((a, v) => a + resteAEncaisser(v), 0);
    const pendingVentes = ventesActivesPropres.filter((v) => v.statut_paiement === "en_attente" && Number(v.droits_auteur_fcfa) > 0);
    const pending = pendingVentes.reduce((a, v) => a + Number(v.droits_auteur_fcfa || 0), 0);
    const auteursEnAttente = new Set(pendingVentes.map((v) => v.auteur_id ?? mMap[v.manuscrit_id]?.auteur_id ?? mMap[v.manuscrit_id]?.auteur ?? v.manuscrit_id)).size;
    const ventesTotal = ventesActives.reduce((a, v) => a + Number(v.montant_total_fcfa || 0), 0);
    const pctEncaisse = ventesTotal > 0 ? Math.round(((ventesTotal - aEncaisser) / ventesTotal) * 100) : 100;
    return { aEncaisser, pending, auteursEnAttente, pctEncaisse };
  }, [ventesActives, ventesActivesPropres, mMap]);

  const [tab, setTab] = useState("apercu");
  const [nouvelleDepense, setNouvelleDepense] = useState(false);
  const libellePeriode = PERIODES.find((p) => p.value === periode)!.label.toLowerCase();

  /** 6 derniers mois, avec le même calcul de bénéfice que la carte « gagné ». */
  const monthlyData = useMemo(() => {
    const out: { key: string; label: string; revenue: number; depenses: number; net: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = startOfMonth(subMonths(new Date(), i));
      const key = format(d, "yyyy-MM");
      const r = calculerResultat(
        ventesActivesPropres.filter((v) => dansPeriode(v.date_vente, key)),
        depenses.filter((x) => dansPeriode(x.date_depense, key)),
        coutUnitaire,
      );
      out.push({ key, label: format(d, "MMM", { locale: fr }), revenue: r.ventes, depenses: r.depenses, net: r.benefice });
    }
    return out;
  }, [ventesActivesPropres, depenses, coutUnitaire]);

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
            Ce que vous gagnez, ce qu'on vous doit, ce que vous devez.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportFinancesTrigger onClick={() => setExportOpen(true)} />
          <RecordSaleTrigger onClick={() => setSheetOpen(true)} />
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 h-auto p-1 gap-1">
          <TabsTrigger value="apercu" className="gap-1.5 whitespace-nowrap px-1 text-[13px] sm:text-sm">
            <LayoutDashboard className="hidden h-4 w-4 sm:block" /> <span className="sm:hidden">Aperçu</span><span className="hidden sm:inline">Vue d'ensemble</span>
          </TabsTrigger>
          <TabsTrigger value="ventes" className="gap-1.5 whitespace-nowrap px-1 text-[13px] sm:text-sm">
            <ShoppingCart className="hidden h-4 w-4 sm:block" /> Ventes
            {!loading && ventes.length > 0 && (
              <Badge variant="secondary" className="ml-1 hidden sm:inline-flex text-[10px] px-1.5 py-0">{ventes.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="depenses" className="gap-1.5 whitespace-nowrap px-1 text-[13px] sm:text-sm">
            <Wallet className="hidden h-4 w-4 sm:block" /> Dépenses
          </TabsTrigger>
          <TabsTrigger value="royalties" className="gap-1.5 whitespace-nowrap px-1 text-[13px] sm:text-sm">
            <Users className="hidden h-4 w-4 sm:block" /> Auteurs
            {totals.pending > 0 && (
              <Badge className="ml-1 hidden sm:inline-flex text-[10px] px-1.5 py-0 bg-amber-500/20 text-amber-400 border-amber-500/30">
                {fcfa(totals.pending)}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {SECONDAIRES.some((x) => x.value === tab) && (
          <button
            type="button"
            onClick={() => setTab("apercu")}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Vue d'ensemble
          </button>
        )}

        {/* ==================== VUE D'ENSEMBLE ==================== */}
        <TabsContent value="apercu" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-[12px] uppercase tracking-[0.2em] text-muted-foreground">
              <span className="h-px w-8 bg-[color:var(--gold)]" /> Vos chiffres
            </div>
            <div className="inline-flex rounded-full border border-border bg-muted/40 p-1" role="group" aria-label="Période">
              {PERIODES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPeriode(p.value)}
                  aria-pressed={periode === p.value}
                  className={cn(
                    "rounded-full px-3.5 py-1 text-[13px] transition-colors",
                    periode === p.value ? "bg-[#C8922A] text-white shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p.value === "tout" ? "Tout" : p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            {/* Bénéfice : la réponse principale */}
            <div className="relative overflow-hidden rounded-2xl border border-[color:var(--gold)]/30 bg-gradient-to-br from-[color:var(--gold)]/10 via-card to-card p-6 lg:col-span-3">
              <p className="text-[12px] uppercase tracking-[0.2em] text-muted-foreground">Gagné {libellePeriode}</p>
              {loading ? <Skeleton className="mt-3 h-12 w-56" /> : (
                <p className={cn(
                  "font-wordmark-serif mt-2 text-5xl leading-none tabular-nums sm:text-6xl",
                  resultat.benefice >= 0 ? "text-foreground" : "text-red-500",
                )}>
                  {fmtMontant(resultat.benefice)}<span className="ml-2 font-sans text-base text-muted-foreground">FCFA</span>
                </p>
              )}
              <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                <Ligne label="Ventes" value={resultat.ventes} />
                <Ligne label="Commissions" value={-resultat.commissions} />
                <Ligne label="Droits d'auteur" value={-resultat.droits} />
                <Ligne label="Impression" value={-resultat.coutVendus} />
                <Ligne label="Dépenses" value={-resultat.depenses} />
              </div>
              <button
                type="button"
                onClick={() => { setTab("depenses"); setNouvelleDepense(true); }}
                className="mt-3 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                + Ajouter une dépense
              </button>
              <button type="button" onClick={() => setTab("rentabilite")} className="mt-5 text-sm font-medium text-[#C8922A] hover:text-[#B5821F]">
                Voir livre par livre →
              </button>
            </div>

            <div className="grid gap-4 lg:col-span-2">
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-[12px] uppercase tracking-[0.2em] text-muted-foreground">On vous doit</p>
                {loading ? <Skeleton className="mt-3 h-9 w-40" /> : (
                  <p className="font-wordmark-serif mt-1.5 text-4xl leading-none tabular-nums">
                    {fmtMontant(totals.aEncaisser)}<span className="ml-1.5 font-sans text-sm text-muted-foreground">FCFA</span>
                  </p>
                )}
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${totals.pctEncaisse}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{totals.pctEncaisse} % des ventes déjà encaissées</p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[12px] uppercase tracking-[0.2em] text-muted-foreground">À payer aux auteurs</p>
                  {totals.pending > 0 && (
                    <button type="button" onClick={() => setTab("royalties")} className="text-sm font-medium text-[#C8922A] hover:text-[#B5821F]">
                      Payer →
                    </button>
                  )}
                </div>
                {loading ? <Skeleton className="mt-3 h-9 w-40" /> : (
                  <p className="font-wordmark-serif mt-1.5 text-4xl leading-none tabular-nums">
                    {fmtMontant(totals.pending)}<span className="ml-1.5 font-sans text-sm text-muted-foreground">FCFA</span>
                  </p>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  {totals.pending > 0 ? pl(totals.auteursEnAttente, "auteur attend", "auteurs attendent") : "Tout est payé"}
                </p>
              </div>
            </div>
          </div>

          {!loading && (
            <CreancesLibrairies ventes={ventesActives} entrepriseNom={entrepriseNom} entrepriseVille={entrepriseVille} titres={titres} onChanged={load} />
          )}

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-semibold mb-4">Ventes, dépenses et bénéfice sur 6 mois</h3>
              <div className="h-64">
                {loading ? <Skeleton className="h-full w-full" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={CHART_TOOLTIP_STYLE}
                        formatter={(v: number) => fcfa(v)}
                      />
                      <Legend />
                      <Bar dataKey="revenue" name="Ventes" fill="#C8922A" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="depenses" name="Dépenses" fill="#b0413e" radius={[6, 6, 0, 0]} />
                      <Line type="monotone" dataKey="net" name="Bénéfice" stroke="#3fb96f" strokeWidth={2} />
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
                      <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => fcfa(v)} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <FinancesAnalytics ventes={loading ? null : ventesActives} manuscrits={manuscrits} aMap={aMap} mMap={mMap} />

          <div className="grid gap-3 sm:grid-cols-3">
            {SECONDAIRES.filter((x) => x.value !== "etrangers" || ventesEtrangers.length > 0 || etrangerIds.size > 0).map((x) => (
              <button
                key={x.value}
                type="button"
                onClick={() => { setTab(x.value); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-[color:var(--gold)]/50"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--gold)]/10 text-[color:var(--gold)]">
                  <x.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{x.label}</span>
                  <span className="block text-xs text-muted-foreground">{x.desc}</span>
                </span>
              </button>
            ))}
          </div>
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
              autoOpen={nouvelleDepense}
              onAutoOpened={() => setNouvelleDepense(false)}
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
              ventes={ventesActivesPropres}
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

/** Montant sans l'unité (affichée à part, plus petite). */

function Ligne({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-border/60 pb-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value < 0 ? "−" : ""}{fmtMontant(Math.abs(value))}</span>
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
    <AnalyticsSection title="Analytiques financières" range={range} setRange={setRange}>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <FCard label="Ce mois" value={fcfa(thisMonth)} />
        <FCard label="Mois dernier" value={fcfa(lastMonth)} />
        <FCard label="Croissance MoM" value={`${growth > 0 ? "+" : ""}${growth}%`} accent={growth >= 0 ? "primary" : "danger"} icon={growth >= 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />} />
        <FCard label="Meilleur mois" value={`${best.label} · ${fcfa(best.revenue)}`} accent="gold" />
        <FCard label="Moyenne mensuelle" value={fcfa(avg)} />
      </div>
      <div className="rounded-xl border border-border bg-background/40 p-5">
        <h3 className="font-semibold mb-3">Évolution du chiffre d'affaires</h3>
        <div className="h-64">
          {months.every((m) => m.revenue === 0) ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={months}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => fcfa(v)} />
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
          <h3 className="font-semibold">Livres les plus vendus</h3>
          <div className="flex gap-1.5">
            <button onClick={() => setSortKey("copies")} className={`text-xs px-3 py-1 rounded-md border ${sortKey === "copies" ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>Exemplaires</button>
            <button onClick={() => setSortKey("revenue")} className={`text-xs px-3 py-1 rounded-md border ${sortKey === "revenue" ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>Revenu</button>
          </div>
        </div>
        <BestSellingBooks books={rankings} limit={5} />
      </div>
      <div className="rounded-xl border border-border bg-background/40 p-5">
        <h3 className="font-semibold mb-3">Suivi des droits d'auteur</h3>
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

