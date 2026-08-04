import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2, Clock, Wallet, Users, TrendingUp, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { fcfa } from "@/lib/format";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { AccessDenied } from "@/components/access-denied";
import {
  adminConfirmPaiement, adminListPaiements, adminPaiementsStats, adminRejectPaiement,
  type AdminPaiementRow, type AdminStats,
} from "@/lib/manual-payment";

export const Route = createFileRoute("/_authenticated/admin/paiements")({
  component: AdminPaiementsPage,
  head: () => ({
    meta: [
      { title: "Validation des paiements — FIGDITIONS" },
      { name: "description", content: "Espace super administrateur : validation des paiements Orange Money." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const STATUTS = [
  { key: "en_attente_confirmation", label: "En attente" },
  { key: "confirme", label: "Confirmés" },
  { key: "rejete", label: "Rejetés" },
  { key: "all", label: "Tous" },
];

function AdminPaiementsPage() {
  const { user } = useAuth();
  const { profile, loading } = useProfile(user?.id);
  const isSuper = (profile as { is_superadmin?: boolean } | null)?.is_superadmin === true;

  const [tab, setTab] = useState("en_attente_confirmation");
  const [rows, setRows] = useState<AdminPaiementRow[] | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [raison, setRaison] = useState("");

  const load = async () => {
    setRows(null);
    try {
      const [list, s] = await Promise.all([
        adminListPaiements(tab === "all" ? undefined : tab),
        adminPaiementsStats(),
      ]);
      setRows(list);
      setStats(s);
    } catch (e) {
      setRows([]);
      toast.error(e instanceof Error ? e.message : "Erreur de chargement");
    }
  };

  useEffect(() => { if (isSuper) load(); }, [isSuper, tab]);

  if (loading) return <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!isSuper) return <AccessDenied pathname="/admin/paiements" adminEmail={null} />;

  const confirm = async (id: string) => {
    setBusyId(id);
    const res = await adminConfirmPaiement(id);
    setBusyId(null);
    if (!res.ok) return toast.error(res.error ?? "Erreur");
    toast.success("Paiement confirmé — plan activé");
    load();
  };

  const reject = async () => {
    if (!rejectId) return;
    if (raison.trim().length < 3) return toast.error("Indiquez une raison");
    setBusyId(rejectId);
    const res = await adminRejectPaiement(rejectId, raison.trim());
    setBusyId(null);
    if (!res.ok) return toast.error(res.error ?? "Erreur");
    toast.success("Paiement rejeté");
    setRejectId(null);
    setRaison("");
    load();
  };

  const statutClass = (s: string) =>
    s === "confirme" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    : s === "rejete" ? "bg-destructive/15 text-destructive border-destructive/30"
    : "bg-orange-500/15 text-orange-400 border-orange-500/30";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Validation des paiements</h1>
          <p className="text-muted-foreground mt-1">Espace super administrateur — Orange Money manuel.</p>
        </div>
        <Button variant="outline" onClick={load} className="min-h-10">
          <RefreshCw className="h-4 w-4" /> Rafraîchir
        </Button>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<Clock className="h-4 w-4" />} label="En attente" value={String(stats?.pending ?? "—")} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Confirmés (mois)" value={String(stats?.confirmed_month ?? "—")} />
        <StatCard icon={<Wallet className="h-4 w-4" />} label="Revenus (mois)" value={stats ? fcfa(stats.revenue_month) : "—"} gold />
        <StatCard icon={<Users className="h-4 w-4" />} label="Abonnements actifs" value={String(stats?.active_subs ?? "—")} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-card border border-border flex flex-wrap h-auto w-full justify-start gap-1">
          {STATUTS.map((s) => (
            <TabsTrigger key={s.key} value={s.key} className="min-h-10">{s.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {!rows ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Aucun paiement dans cette catégorie.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-[200px]">
                  <div className="font-semibold">{r.entreprise_nom ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{r.user_email ?? "—"}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(r.created_at).toLocaleString("fr-FR")}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-[color:var(--gold)]">{fcfa(r.montant_fcfa)}</div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {r.plan_demande ?? "—"} · {r.periode ?? "—"}
                  </div>
                  <span className={cn("inline-block mt-1 text-[11px] font-semibold border rounded-full px-2 py-0.5", statutClass(r.statut))}>
                    {r.statut === "confirme" ? "Confirmé" : r.statut === "rejete" ? "Rejeté" : "En attente"}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">Référence :</span>
                <code className="font-bold tracking-wider text-[color:var(--gold)]">{r.reference_paiement ?? "—"}</code>
                <span className="text-muted-foreground">· Plan actuel : <span className="capitalize">{r.entreprise_plan ?? "—"}</span></span>
              </div>

              {r.raison_rejet && (
                <p className="text-xs text-destructive">Raison du rejet : {r.raison_rejet}</p>
              )}

              {r.statut === "en_attente_confirmation" && (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => confirm(r.id)}
                      disabled={busyId === r.id}
                      className="min-h-10 bg-emerald-600 text-white hover:bg-emerald-600/90"
                    >
                      {busyId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Confirmer & activer
                    </Button>
                    <Button
                      variant="outline"
                      className="min-h-10 text-destructive border-destructive/40"
                      onClick={() => { setRejectId(rejectId === r.id ? null : r.id); setRaison(""); }}
                    >
                      <XCircle className="h-4 w-4" /> Rejeter
                    </Button>
                  </div>
                  {rejectId === r.id && (
                    <div className="flex flex-wrap gap-2 animate-fade-in">
                      <Input
                        value={raison}
                        onChange={(e) => setRaison(e.target.value)}
                        placeholder="Raison du rejet (visible par le client)"
                        className="flex-1 min-w-[200px]"
                      />
                      <Button onClick={reject} disabled={busyId === r.id} className="min-h-10">
                        Envoyer le rejet
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, gold }: { icon: React.ReactNode; label: string; value: string; gold?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon} {label}</div>
      <div className={cn("mt-1 text-xl font-bold", gold ? "text-[color:var(--gold)]" : undefined)}>{value}</div>
    </div>
  );
}
