import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Wallet, TrendingUp, ShoppingBag, Clock, Loader2, Check } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, ComposedChart, Line, CartesianGrid } from "recharts";
import { format, subMonths, startOfMonth } from "date-fns";
import { AnalyticsSection, defaultRange, inRange, EmptyChart, type DateRange } from "@/components/analytics-section";
import { BestSellingBooks, type BookRanking } from "@/components/best-selling-books";
import { TrendingDown, ArrowUp, ArrowDown } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fcfa } from "@/lib/format";
import { planFor } from "@/lib/plans";
import { LockedPage } from "@/components/locked-page";

export const Route = createFileRoute("/_authenticated/finances")({
  component: FinancesPage,
  head: () => ({ meta: [{ title: "Finances — FIGDITIONS" }] }),
});

interface Vente {
  id: string;
  manuscrit_id: string;
  auteur_id: string | null;
  quantite_vendue: number;
  prix_unitaire_fcfa: number;
  montant_total_fcfa: number;
  droits_auteur_fcfa: number;
  statut_paiement: "en_attente" | "paye";
  date_vente: string;
  created_at: string;
}
interface Manuscrit { id: string; titre: string; auteur: string; auteur_id?: string | null; }
interface Auteur { id: string; nom_complet: string; }
interface Stock { id: string; manuscrit_id: string; librairie_nom: string | null; exemplaires_restants: number; prix_unitaire_fcfa: number | null; exemplaires_vendus: number; }

const COLORS = ["#00C896", "#D4AF37", "#4F8FF7", "#E85D8C", "#7E5FFF", "#FF9F45"];

function FinancesPage() {
  const { user } = useAuth();
  const { profile, entreprise, loading: pLoading } = useProfile(user?.id);
  if (pLoading) return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-96 w-full" /></div>;
  const plan = planFor(entreprise?.plan);
  if (!plan.finances) return <LockedPage feature="le module finances & royalties" requiredPlan="pro" />;
  return <FinancesInner entrepriseId={profile?.entreprise_id ?? null} />;
}

function FinancesInner({ entrepriseId }: { entrepriseId: string | null }) {
  const [ventes, setVentes] = useState<Vente[] | null>(null);
  const [manuscrits, setManuscrits] = useState<Manuscrit[]>([]);
  const [auteurs, setAuteurs] = useState<Auteur[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = async () => {
    setVentes(null);
    const [{ data: v, error }, { data: ms }, { data: as }, { data: st }] = await Promise.all([
      supabase.from("ventes").select("*").order("date_vente", { ascending: false }),
      (supabase as any).from("manuscrits").select("id, titre, auteur, auteur_id"),
      supabase.from("auteurs").select("id, nom_complet"),
      supabase.from("stocks").select("id, manuscrit_id, librairie_nom, exemplaires_restants, prix_unitaire_fcfa, exemplaires_vendus"),
    ]);
    if (error) toast.error(error.message);
    setVentes((v ?? []) as Vente[]);
    setManuscrits((ms ?? []) as Manuscrit[]);
    setAuteurs((as ?? []) as Auteur[]);
    setStocks((st ?? []) as Stock[]);
  };
  useEffect(() => { if (entrepriseId) load(); }, [entrepriseId]);

  const mMap = useMemo(() => Object.fromEntries(manuscrits.map((m) => [m.id, m])), [manuscrits]);
  const aMap = useMemo(() => Object.fromEntries(auteurs.map((a) => [a.id, a.nom_complet])), [auteurs]);
  const sMap = useMemo(() => Object.fromEntries(stocks.map((s) => [s.id, s])), [stocks]);
  const stockOfVente = (_v: Vente) => null; // ventes table doesn't carry stock id; show via manuscrit

  const totals = useMemo(() => {
    const v = ventes ?? [];
    return {
      revenue: v.reduce((a, x) => a + Number(x.montant_total_fcfa || 0), 0),
      paid: v.filter((x) => x.statut_paiement === "paye").reduce((a, x) => a + Number(x.droits_auteur_fcfa || 0), 0),
      pending: v.filter((x) => x.statut_paiement === "en_attente").reduce((a, x) => a + Number(x.droits_auteur_fcfa || 0), 0),
      copies: v.reduce((a, x) => a + Number(x.quantite_vendue || 0), 0),
    };
  }, [ventes]);

  const monthlyData = useMemo(() => {
    const v = ventes ?? [];
    const buckets: { key: string; label: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = startOfMonth(subMonths(new Date(), i));
      buckets.push({ key: format(d, "yyyy-MM"), label: format(d, "MMM", { locale: fr }), revenue: 0 });
    }
    const map = new Map(buckets.map((b) => [b.key, b]));
    v.forEach((s) => {
      const k = s.date_vente?.slice(0, 7);
      const b = map.get(k);
      if (b) b.revenue += Number(s.montant_total_fcfa || 0);
    });
    return buckets;
  }, [ventes]);

  const pieData = useMemo(() => {
    const v = ventes ?? [];
    const by: Record<string, number> = {};
    v.forEach((s) => {
      const t = mMap[s.manuscrit_id]?.titre ?? "—";
      by[t] = (by[t] ?? 0) + Number(s.montant_total_fcfa || 0);
    });
    return Object.entries(by).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [ventes, mMap]);

  const filtered = useMemo(() => {
    if (!ventes) return null;
    return ventes.filter((v) => {
      if (statusFilter !== "all" && v.statut_paiement !== statusFilter) return false;
      if (from && v.date_vente < from) return false;
      if (to && v.date_vente > to) return false;
      return true;
    });
  }, [ventes, statusFilter, from, to]);

  const royaltiesByAuthor = useMemo(() => {
    const v = ventes ?? [];
    const by: Record<string, { name: string; pending: number; ids: string[] }> = {};
    v.filter((x) => x.statut_paiement === "en_attente").forEach((s) => {
      const aid = s.auteur_id ?? mMap[s.manuscrit_id]?.auteur_id ?? "_";
      const name = aMap[aid] ?? mMap[s.manuscrit_id]?.auteur ?? "Auteur inconnu";
      if (!by[aid]) by[aid] = { name, pending: 0, ids: [] };
      by[aid].pending += Number(s.droits_auteur_fcfa || 0);
      by[aid].ids.push(s.id);
    });
    return Object.values(by).filter((x) => x.pending > 0);
  }, [ventes, mMap, aMap]);

  const markPaid = async (ids: string[]) => {
    const { error } = await supabase.from("ventes").update({ statut_paiement: "paye" as any }).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success("Royalties marquées comme payées");
    load();
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finances</h1>
          <p className="text-muted-foreground mt-1">Ventes, royalties et paiements en un coup d'œil.</p>
        </div>
        <Button onClick={() => setSheetOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Enregistrer une vente
        </Button>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} label="Chiffre d'affaires" value={fcfa(totals.revenue)} accent="primary" />
        <StatCard icon={Check} label="Royalties payées" value={fcfa(totals.paid)} accent="primary" />
        <StatCard icon={Clock} label="Royalties en attente" value={fcfa(totals.pending)} accent="gold" />
        <StatCard icon={ShoppingBag} label="Exemplaires vendus" value={String(totals.copies)} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold mb-4">Chiffre d'affaires — 6 derniers mois</h3>
          <div className="h-64">
            {ventes === null ? <Skeleton className="h-full w-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <XAxis dataKey="label" stroke="#94A3B8" fontSize={12} />
                  <YAxis stroke="#94A3B8" fontSize={12} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: "#0D2137", border: "1px solid #1E3A5F", borderRadius: 8 }}
                    formatter={(v: number) => fcfa(v)}
                  />
                  <Bar dataKey="revenue" fill="#00C896" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold mb-4">Répartition par titre</h3>
          <div className="h-64">
            {ventes === null ? <Skeleton className="h-full w-full" /> : pieData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Aucune vente</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80} label={(e) => `${e.name}`}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0D2137", border: "1px solid #1E3A5F", borderRadius: 8 }} formatter={(v: number) => fcfa(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Sales filters + table */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Statut</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="en_attente">En attente</SelectItem>
              <SelectItem value="paye">Payé</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Du</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Au</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {ventes === null ? (
          <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : filtered && filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Wallet className="h-8 w-8" />
            </div>
            <h3 className="mt-4 font-semibold">Aucune vente</h3>
            <p className="mt-1 text-sm text-muted-foreground">Enregistrez votre première vente pour commencer.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Livre</th>
                  <th className="px-4 py-3 font-medium">Auteur</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Qté</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">PU</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Royalties</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered?.map((v) => {
                  const m = mMap[v.manuscrit_id];
                  const auteurName = (v.auteur_id && aMap[v.auteur_id]) ?? (m?.auteur_id && aMap[m.auteur_id!]) ?? m?.auteur ?? "—";
                  return (
                    <tr key={v.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">{m?.titre ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{auteurName}</td>
                      <td className="px-4 py-3 hidden md:table-cell">{v.quantite_vendue}</td>
                      <td className="px-4 py-3 hidden md:table-cell">{fcfa(v.prix_unitaire_fcfa)}</td>
                      <td className="px-4 py-3 font-semibold">{fcfa(v.montant_total_fcfa)}</td>
                      <td className="px-4 py-3 text-[color:var(--gold)] font-semibold">{fcfa(v.droits_auteur_fcfa)}</td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                          v.statut_paiement === "paye"
                            ? "bg-primary/15 text-primary border-primary/40"
                            : "bg-orange-500/15 text-orange-400 border-orange-500/30")}>
                          {v.statut_paiement === "paye" ? "Payé" : "En attente"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                        {v.date_vente ? new Date(v.date_vente).toLocaleDateString("fr-FR") : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Royalties section */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-xl font-semibold mb-4">Royalties à payer par auteur</h2>
        {ventes === null ? <Skeleton className="h-24 w-full" /> :
          royaltiesByAuthor.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune royaltie en attente. 🎉</p>
          ) : (
            <div className="space-y-2">
              {royaltiesByAuthor.map((r) => (
                <div key={r.name} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/50">
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-sm text-[color:var(--gold)] font-semibold">{fcfa(r.pending)}</p>
                  </div>
                  <Button size="sm" onClick={() => markPaid(r.ids)} className="bg-primary text-primary-foreground hover:bg-primary/90">
                    <Check className="h-4 w-4" /> Marquer payé
                  </Button>
                </div>
              ))}
            </div>
          )}
      </div>

      <VenteSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        entrepriseId={entrepriseId}
        manuscrits={manuscrits}
        auteurs={auteurs}
        stocks={stocks}
        onSaved={load}
      />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: "primary" | "gold" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center",
          accent === "gold" ? "bg-[color:var(--gold)]/15 text-[color:var(--gold)]" :
          accent === "primary" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-xl font-bold mt-0.5">{value}</p>
        </div>
      </div>
    </div>
  );
}

function VenteSheet({
  open, onOpenChange, entrepriseId, manuscrits, auteurs, stocks, onSaved,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  entrepriseId: string | null;
  manuscrits: Manuscrit[]; auteurs: Auteur[]; stocks: Stock[];
  onSaved: () => void;
}) {
  const [manuscritId, setManuscritId] = useState("");
  const [auteurId, setAuteurId] = useState("");
  const [stockId, setStockId] = useState("");
  const [qty, setQty] = useState(1);
  const [prix, setPrix] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setManuscritId(""); setAuteurId(""); setStockId(""); setQty(1); setPrix(0);
    }
  }, [open]);

  useEffect(() => {
    if (!manuscritId) return;
    const m = manuscrits.find((x) => x.id === manuscritId);
    if (m?.auteur_id) setAuteurId(m.auteur_id);
    const s = stocks.find((x) => x.manuscrit_id === manuscritId);
    if (s?.prix_unitaire_fcfa) setPrix(Number(s.prix_unitaire_fcfa));
  }, [manuscritId]);

  const availableStocks = stocks.filter((s) => !manuscritId || s.manuscrit_id === manuscritId);
  const total = qty * prix;
  const royalties = Math.round(total * 0.1);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entrepriseId || !manuscritId) return toast.error("Sélectionnez un manuscrit");
    if (qty <= 0 || prix <= 0) return toast.error("Quantité et prix doivent être positifs");
    setSaving(true);
    const { error } = await supabase.from("ventes").insert({
      entreprise_id: entrepriseId,
      manuscrit_id: manuscritId,
      auteur_id: auteurId || null,
      quantite_vendue: qty,
      prix_unitaire_fcfa: prix,
      montant_total_fcfa: total,
      droits_auteur_fcfa: royalties,
      montant: total,
      statut_paiement: "en_attente" as any,
      date_vente: new Date().toISOString().slice(0, 10),
    } as any);
    if (!error && stockId) {
      const s = stocks.find((x) => x.id === stockId);
      if (s) {
        const newVendus = (s.exemplaires_vendus ?? 0) + qty;
        const newRestants = Math.max(0, (s.exemplaires_restants ?? 0) - qty);
        await supabase.from("stocks").update({
          exemplaires_vendus: newVendus,
          exemplaires_restants: newRestants,
        }).eq("id", stockId);
      }
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Vente enregistrée");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-card border-border w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle>Enregistrer une vente</SheetTitle></SheetHeader>
        <form onSubmit={submit} className="space-y-4 mt-6 px-4 pb-6">
          <div className="space-y-2">
            <Label>Manuscrit *</Label>
            <Select value={manuscritId} onValueChange={setManuscritId}>
              <SelectTrigger><SelectValue placeholder="Choisir un manuscrit" /></SelectTrigger>
              <SelectContent>
                {manuscrits.map((m) => <SelectItem key={m.id} value={m.id}>{m.titre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Auteur</Label>
            <Select value={auteurId} onValueChange={setAuteurId}>
              <SelectTrigger><SelectValue placeholder="Auto-rempli" /></SelectTrigger>
              <SelectContent>
                {auteurs.map((a) => <SelectItem key={a.id} value={a.id}>{a.nom_complet}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Librairie (dépôt de stock)</Label>
            <Select value={stockId} onValueChange={setStockId}>
              <SelectTrigger><SelectValue placeholder="Choisir une librairie" /></SelectTrigger>
              <SelectContent>
                {availableStocks.map((s) => <SelectItem key={s.id} value={s.id}>{s.librairie_nom ?? "Librairie"} ({s.exemplaires_restants} restants)</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Quantité vendue *</Label>
              <Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Prix unitaire (FCFA) *</Label>
              <Input type="number" min={0} value={prix} onChange={(e) => setPrix(Number(e.target.value))} />
            </div>
          </div>
          <div className="rounded-lg border border-border bg-background/50 p-4 space-y-1">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Montant total</span><span className="font-semibold">{fcfa(total)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Droits d'auteur (10%)</span><span className="font-semibold text-[color:var(--gold)]">{fcfa(royalties)}</span></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer la vente"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
