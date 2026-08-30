import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Clock, Boxes, Wallet, Trophy, PenLine, Store, Activity, CheckCircle2, Plus, MessageSquare, PackagePlus } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";
import { format, formatDistanceToNow, startOfMonth, subDays, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetch-all";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { AnimatedCounter } from "@/components/animated-counter";
import { STATUT_PROGRESSION, STATUT_LABEL, STATUT_COLOR } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalyticsSection, defaultRange, inRange, EmptyChart, type DateRange } from "@/components/analytics-section";
import { BestSellingBooks, type BookRanking } from "@/components/best-selling-books";
import { fcfa } from "@/lib/format";
import { useRealtimeTable } from "@/hooks/use-realtime";
import { ActivityFeed } from "@/components/activity-feed";
import { computeStockTotals, nf, type StockInterneRow } from "@/lib/stock-totals";
import {
  StatCard, BreakdownLine, MiniBar, ProgressRing, StatCardSkeletonV2, Sparkline,
} from "@/components/dashboard/stat-card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Tableau de bord — FIGDITIONS" }] }),
});

interface Manuscrit { id: string; titre: string; auteur: string; auteur_id?: string | null; genre?: string | null; statut: string; created_at: string; origine?: string | null; }
interface StockInterneRowWithM extends StockInterneRow { manuscrit_id?: string | null }
interface Vente { id: string; manuscrit_id: string; auteur_id: string | null; quantite_vendue: number; montant_total_fcfa: number; droits_auteur_fcfa: number; statut_paiement: string; date_vente: string; created_at: string; }
interface Auteur { id: string; nom_complet: string; }
interface Stock { id: string; manuscrit_id: string; librairie_nom: string | null; librairie_adresse?: string | null; exemplaires_deposes: number; exemplaires_vendus: number; exemplaires_restants: number; prix_unitaire_fcfa: number | null; created_at: string; }
interface Contrat { id: string; created_at: string; statut: string; manuscrit_id: string; }

const STATUTS = STATUT_PROGRESSION;

function DashboardPage() {
  const { user } = useAuth();
  const { profile, entreprise } = useProfile(user?.id);
  const [manuscrits, setManuscrits] = useState<Manuscrit[] | null>(null);
  const [ventes, setVentes] = useState<Vente[]>([]);
  const [auteurs, setAuteurs] = useState<Auteur[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [stockInterne, setStockInterne] = useState<StockInterneRowWithM[]>([]);
  const [range, setRange] = useState<DateRange>(defaultRange());
  const [period, setPeriod] = useState<PeriodKey>("tout");

  const reload = useMemo(() => {
    return async () => {
      if (!profile?.entreprise_id) return;
      // fetchAllRows : contourne la limite silencieuse de 1000 lignes de l'API.
      const [m, v, a, s, c, si] = await Promise.all([
        fetchAllRows<Manuscrit>(() => supabase.from("manuscrits").select("id, titre, auteur, auteur_id, genre, statut, created_at, origine").order("created_at", { ascending: false })),
        fetchAllRows<Vente>(() => supabase.from("ventes").select("*").order("date_vente", { ascending: false })),
        fetchAllRows<Auteur>(() => supabase.from("auteurs").select("id, nom_complet")),
        fetchAllRows<Stock>(() => supabase.from("stocks").select("id, manuscrit_id, librairie_nom, librairie_adresse, exemplaires_deposes, exemplaires_vendus, exemplaires_restants, prix_unitaire_fcfa, created_at")),
        fetchAllRows<Contrat>(() => supabase.from("contrats").select("id, created_at, statut, manuscrit_id")),
        fetchAllRows<StockInterneRowWithM>(() => supabase.from("stock_interne").select("manuscrit_id, quantite_disponible, quantite_imprimee, quantite_transferee_librairies, quantite_vendue_directement, quantite_exposee_evenements, seuil_alerte")),
      ]);
      setManuscrits(m);
      setVentes(v);
      setAuteurs(a);
      setStocks(s);
      setContrats(c);
      setStockInterne(si);
    };
  }, [profile?.entreprise_id]);

  useEffect(() => { reload(); }, [reload]);

  // Realtime: any change on these tables → reload everything
  useRealtimeTable("manuscrits", profile?.entreprise_id, reload);
  useRealtimeTable("ventes", profile?.entreprise_id, reload);
  useRealtimeTable("stocks", profile?.entreprise_id, reload);
  useRealtimeTable("stock_interne", profile?.entreprise_id, reload);
  useRealtimeTable("contrats", profile?.entreprise_id, reload);
  useRealtimeTable("auteurs", profile?.entreprise_id, reload);

  const mMap = useMemo(() => Object.fromEntries((manuscrits ?? []).map((m) => [m.id, m])), [manuscrits]);
  const aMap = useMemo(() => Object.fromEntries(auteurs.map((a) => [a.id, a.nom_complet])), [auteurs]);

  // Source unique de vérité : stock total = entrepôt + librairies
  const totals = useMemo(() => computeStockTotals(stockInterne, stocks), [stockInterne, stocks]);

  // Répartition par origine : productions propres vs livres étrangers
  const stockByOrigin = useMemo(() => {
    const originOf = (mid: string | null | undefined) =>
      (mid && mMap[mid]?.origine) === "etranger" ? "etranger" : "propre";
    let propres = 0;
    let etrangers = 0;
    stockInterne.forEach((i) => {
      if (originOf(i.manuscrit_id) === "etranger") etrangers += Number(i.quantite_disponible || 0);
      else propres += Number(i.quantite_disponible || 0);
    });
    stocks.forEach((s) => {
      if (originOf(s.manuscrit_id) === "etranger") etrangers += Number(s.exemplaires_restants || 0);
      else propres += Number(s.exemplaires_restants || 0);
    });
    return { propres, etrangers };
  }, [stockInterne, stocks, mMap]);

  const periodRange = useMemo(() => PERIODS.find((p) => p.key === period)!.compute(), [period]);
  const periodVentes = useMemo(
    () => (period === "tout" ? ventes : ventes.filter((v) => inRange(v.date_vente, periodRange))),
    [ventes, period, periodRange],
  );
  const prevPeriodVentes = useMemo(() => {
    if (period === "tout" || !periodRange.from || !periodRange.to) return null;
    const span = periodRange.to.getTime() - periodRange.from.getTime();
    const prev = { from: new Date(periodRange.from.getTime() - span), to: periodRange.from };
    return ventes.filter((v) => inRange(v.date_vente, prev));
  }, [ventes, period, periodRange]);

  const stats = useMemo(() => {
    const ms = manuscrits ?? [];
    return {
      total: ms.length,
      propres: ms.filter((m) => m.origine !== "etranger").length,
      etrangers: ms.filter((m) => m.origine === "etranger").length,
      encours: ms.filter((m) => m.statut !== "publie").length,
      stock: totals.stockTotal,
      circulation: totals.externeDepose,
      vendus: periodVentes.reduce((s, v) => s + Number(v.quantite_vendue || 0), 0),
      paiements: ventes.filter((v) => v.statut_paiement === "en_attente").length,
    };
  }, [manuscrits, totals, ventes, periodVentes]);

  const vendusTrend = useMemo(() => {
    if (!prevPeriodVentes) return null;
    const prev = prevPeriodVentes.reduce((s, v) => s + Number(v.quantite_vendue || 0), 0);
    if (prev === 0) return null;
    const pct = Math.round(((stats.vendus - prev) / prev) * 100);
    return `${pct >= 0 ? "+" : ""}${pct}% vs période précédente`;
  }, [prevPeriodVentes, stats.vendus]);

  const filteredVentes = useMemo(() => ventes.filter((v) => inRange(v.date_vente, range)), [ventes, range]);

  const revenueData = useMemo(() => {
    const buckets: { key: string; label: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = startOfMonth(subMonths(new Date(), i));
      buckets.push({ key: format(d, "yyyy-MM"), label: format(d, "MMM", { locale: fr }), revenue: 0 });
    }
    const map = new Map(buckets.map((b) => [b.key, b]));
    filteredVentes.forEach((s) => {
      const b = map.get(s.date_vente?.slice(0, 7));
      if (b) b.revenue += Number(s.montant_total_fcfa || 0);
    });
    return buckets;
  }, [filteredVentes]);

  const totalRevenue = revenueData.reduce((a, b) => a + b.revenue, 0);

  const statusPie = useMemo(() => {
    const ms = manuscrits ?? [];
    return STATUTS.map((s) => ({ name: STATUT_LABEL[s], value: ms.filter((m) => m.statut === s).length, color: STATUT_COLOR[s] }));
  }, [manuscrits]);

  const bookRankings = useMemo<BookRanking[]>(() => {
    const map = new Map<string, BookRanking>();
    filteredVentes.forEach((v) => {
      const m = mMap[v.manuscrit_id];
      if (!m) return;
      const existing = map.get(v.manuscrit_id) ?? { manuscritId: v.manuscrit_id, titre: m.titre, auteur: m.auteur, genre: m.genre, copies: 0, revenue: 0 };
      existing.copies += Number(v.quantite_vendue || 0);
      existing.revenue += Number(v.montant_total_fcfa || 0);
      map.set(v.manuscrit_id, existing);
    });
    return [...map.values()].sort((a, b) => b.copies - a.copies);
  }, [filteredVentes, mMap]);

  const bestBook = bookRankings[0];

  const topAuthor = useMemo(() => {
    const counts = new Map<string, { id: string; name: string; manuscripts: number; royalties: number }>();
    (manuscrits ?? []).forEach((m) => {
      const id = m.auteur_id ?? m.auteur;
      const name = (m.auteur_id && aMap[m.auteur_id]) ?? m.auteur;
      const e = counts.get(id) ?? { id, name, manuscripts: 0, royalties: 0 };
      e.manuscripts += 1;
      counts.set(id, e);
    });
    filteredVentes.forEach((v) => {
      const id = v.auteur_id ?? mMap[v.manuscrit_id]?.auteur_id ?? mMap[v.manuscrit_id]?.auteur ?? "_";
      const e = counts.get(id);
      if (e) e.royalties += Number(v.droits_auteur_fcfa || 0);
    });
    return [...counts.values()].sort((a, b) => b.manuscripts - a.manuscripts)[0];
  }, [manuscrits, filteredVentes, aMap, mMap]);

  const topStore = useMemo(() => {
    const map = new Map<string, { name: string; copies: number; revenue: number }>();
    stocks.forEach((s) => {
      // Clé = nom + adresse : deux librairies homonymes restent distinctes.
      const nom = s.librairie_nom?.trim() || "—";
      const adresse = s.librairie_adresse?.trim() || "";
      const key = `${nom}|${adresse}`;
      const name = adresse ? `${nom} (${adresse})` : nom;
      const e = map.get(key) ?? { name, copies: 0, revenue: 0 };
      e.copies += s.exemplaires_vendus ?? 0;
      e.revenue += (s.exemplaires_vendus ?? 0) * Number(s.prix_unitaire_fcfa ?? 0);
      map.set(key, e);
    });
    return [...map.values()].sort((a, b) => b.copies - a.copies)[0];
  }, [stocks]);

  const activity = useMemo(() => {
    const items: { id: string; icon: string; text: string; date: string }[] = [];
    (manuscrits ?? []).slice(0, 20).forEach((m) => items.push({ id: `m-${m.id}`, icon: "📖", text: `Nouveau manuscrit: ${m.titre}`, date: m.created_at }));
    ventes.slice(0, 20).forEach((v) => items.push({ id: `v-${v.id}`, icon: "💰", text: `Vente: ${mMap[v.manuscrit_id]?.titre ?? "—"} (${v.quantite_vendue} ex.)`, date: v.created_at || v.date_vente }));
    contrats.slice(0, 20).forEach((c) => items.push({ id: `c-${c.id}`, icon: "📝", text: `Contrat ${c.statut}: ${mMap[c.manuscrit_id]?.titre ?? "—"}`, date: c.created_at }));
    stocks.slice(0, 20).forEach((s) => items.push({ id: `s-${s.id}`, icon: "📦", text: `Dépôt mis à jour: ${mMap[s.manuscrit_id]?.titre ?? "—"} chez ${s.librairie_nom ?? "—"}`, date: s.created_at }));
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);
  }, [manuscrits, ventes, contrats, stocks, mMap]);

  const cards: { label: string; value: number; icon: typeof BookOpen; hint: string; subhint?: string }[] = [
    { label: "Manuscrits", value: stats.total, icon: BookOpen, hint: "", subhint: `📕 Nos productions: ${nf(stats.propres)} · 🌍 Étrangers: ${nf(stats.etrangers)}` },
    { label: "En cours", value: stats.encours, icon: Clock, hint: "" },
    {
      label: "Stock total",
      value: stats.stock,
      icon: Boxes,
      hint: `Entrepôt: ${nf(totals.interneDisponible)} | Librairies: ${nf(totals.externeRestant)}`,
      subhint: `📕 Nos productions: ${nf(stockByOrigin.propres)} · 🌍 Livres étrangers: ${nf(stockByOrigin.etrangers)}`,
    },
    {
      label: "Total déposé",
      value: stats.circulation,
      icon: Store,
      hint: `dont ${nf(totals.externeVendu)} vendus · ${nf(totals.externeRestant)} en rayon`,
      subhint: `${nf(totals.externeLibrairies)} point(s) de vente`,
    },
    { label: "Vendus", value: stats.vendus, icon: Trophy, hint: "exemplaires vendus" },
    { label: "Paiements en attente", value: stats.paiements, icon: Wallet, hint: "" },
  ];

  if (manuscrits === null) {
    return <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-80 w-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">
          Bonjour, <span className="text-[color:var(--gold)]">{profile?.full_name?.split(" ")[0] ?? "…"}</span>
        </h1>
        <p className="text-muted-foreground mt-1">{entreprise?.nom} · {entreprise?.ville}</p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {cards.map(({ label, value, icon: Icon, hint, subhint }, i) => (
          <div key={label} className="stat-card glow-card rounded-xl border border-border bg-card p-5 animate-[fade-up_0.5s_ease-out_both]" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-2 text-3xl font-bold tabular-nums"><AnimatedCounter value={value} /></p>
                {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
                {subhint && <p className="mt-0.5 text-[11px] text-[color:var(--gold)]">{subhint}</p>}
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </section>

      <AnalyticsSection title="📊 Analytiques générales" defaultOpen range={range} setRange={setRange}>
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-background/40 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">📈 Chiffre d'affaires (6 derniers mois)</h3>
              <span className="text-sm text-[color:var(--gold)] font-semibold tabular-nums">Total: {fcfa(totalRevenue)}</span>
            </div>
            <div className="h-64">
              {totalRevenue === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#C8922A" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#C8922A" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" />
                    <XAxis dataKey="label" stroke="#94A3B8" fontSize={12} />
                    <YAxis stroke="#94A3B8" fontSize={12} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ background: "#1A1208", border: "1px solid #1E3A5F", borderRadius: 8 }} formatter={(v: number) => fcfa(v)} />
                    <Area type="monotone" dataKey="revenue" stroke="#C8922A" strokeWidth={2} fill="url(#revGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background/40 p-5">
            <h3 className="font-semibold mb-3">📚 Manuscrits par statut</h3>
            <div className="h-64 relative">
              {stats.total === 0 ? <EmptyChart /> : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusPie.filter((s) => s.value > 0)} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                        {statusPie.filter((s) => s.value > 0).map((s) => <Cell key={s.name} fill={s.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#1A1208", border: "1px solid #1E3A5F", borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-3xl font-bold tabular-nums">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">manuscrits</p>
                  </div>
                </>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              {statusPie.map((s) => (
                <div key={s.name} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                  <span className="flex-1 text-muted-foreground">{s.name}</span>
                  <span className="font-semibold tabular-nums">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <MetricCard
            icon={<Trophy className="h-5 w-5" />}
            title="🏆 Livre le plus vendu"
            primary={bestBook?.titre ?? "—"}
            line1={bestBook ? `${bestBook.copies} exemplaires vendus` : "Aucune vente"}
            line2={bestBook ? fcfa(bestBook.revenue) : ""}
          />
          <MetricCard
            icon={<PenLine className="h-5 w-5" />}
            title="✍️ Auteur le plus actif"
            primary={topAuthor?.name ?? "—"}
            line1={topAuthor ? `${topAuthor.manuscripts} manuscrit(s)` : "—"}
            line2={topAuthor ? `${fcfa(topAuthor.royalties)} de royalties` : ""}
          />
          <MetricCard
            icon={<Store className="h-5 w-5" />}
            title="📦 Librairie la plus performante"
            primary={topStore?.name ?? "—"}
            line1={topStore ? `${topStore.copies} exemplaires vendus` : "—"}
            line2={topStore ? fcfa(topStore.revenue) : ""}
          />
        </div>

        <div className="rounded-xl border border-border bg-background/40 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2"><Trophy className="h-4 w-4 text-[color:var(--gold)]" /> 🏆 Livres les plus vendus</h3>
            <Link to="/finances" className="text-sm text-primary hover:underline">Voir tous les livres →</Link>
          </div>
          <BestSellingBooks books={bookRankings} limit={3} />
        </div>

        <ActivityFeed entrepriseId={profile?.entreprise_id ?? null} limit={10} />

        <div className="rounded-xl border border-border bg-background/40 p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> 🕐 Activité récente</h3>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Aucune activité récente</p>
          ) : (
            <ol className="space-y-2">
              {activity.map((it) => (
                <li key={it.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                  <span className="text-xl">{it.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{it.text}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(it.date), { addSuffix: true, locale: fr })}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </AnalyticsSection>
    </div>
  );
}

function MetricCard({ icon, title, primary, line1, line2 }: { icon: React.ReactNode; title: string; primary: string; line1: string; line2: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
        <span className="text-primary">{icon}</span>{title}
      </div>
      <p className="mt-2 font-bold text-lg truncate">{primary}</p>
      <p className="text-sm text-muted-foreground mt-0.5">{line1}</p>
      {line2 && <p className="text-sm text-[color:var(--gold)] font-semibold mt-0.5 tabular-nums">{line2}</p>}
    </div>
  );
}
