import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, Clock, Boxes, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { AnimatedCounter } from "@/components/animated-counter";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Tableau de bord — FIGDITIONS" }] }),
});

interface Manuscrit {
  id: string; titre: string; auteur: string; statut: string; created_at: string;
}

const STATUTS = ["recu","lecture","correction","maquette","impression","publie"] as const;
const STATUT_LABEL: Record<string,string> = {
  recu: "Reçu", lecture: "Lecture", correction: "Correction",
  maquette: "Maquette", impression: "Impression", publie: "Publié",
};

function DashboardPage() {
  const { user } = useAuth();
  const { profile, entreprise } = useProfile(user?.id);
  const [stats, setStats] = useState({ total: 0, encours: 0, stock: 0, paiements: 0 });
  const [recent, setRecent] = useState<Manuscrit[] | null>(null);
  const [byStatus, setByStatus] = useState<{ name: string; count: number }[]>([]);

  useEffect(() => {
    if (!profile?.entreprise_id) return;
    (async () => {
      const [{ data: manuscrits }, { data: stocks }, { count: paiements }] = await Promise.all([
        supabase.from("manuscrits").select("id, titre, auteur, statut, created_at").order("created_at", { ascending: false }),
        supabase.from("stocks").select("exemplaires_restants"),
        supabase.from("ventes").select("id", { count: "exact", head: true }).eq("statut_paiement", "en_attente"),
      ]);
      const ms = (manuscrits ?? []) as Manuscrit[];
      setRecent(ms.slice(0, 5));
      setStats({
        total: ms.length,
        encours: ms.filter((m) => m.statut !== "publie").length,
        stock: (stocks ?? []).reduce((s: number, r: any) => s + (r.exemplaires_restants ?? 0), 0),
        paiements: paiements ?? 0,
      });
      setByStatus(STATUTS.map((s) => ({
        name: STATUT_LABEL[s],
        count: ms.filter((m) => m.statut === s).length,
      })));
    })();
  }, [profile?.entreprise_id]);

  const cards = [
    { label: "Manuscrits", value: stats.total, icon: BookOpen },
    { label: "En cours", value: stats.encours, icon: Clock },
    { label: "Stock total", value: stats.stock, icon: Boxes },
    { label: "Paiements en attente", value: stats.paiements, icon: Wallet },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">
          Bonjour, <span className="text-[color:var(--gold)]">{profile?.full_name?.split(" ")[0] ?? "…"}</span>
        </h1>
        <p className="text-muted-foreground mt-1">{entreprise?.nom} · {entreprise?.ville}</p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon }, i) => (
          <div key={label}
            className="stat-card glow-card rounded-xl border border-border bg-card p-5 animate-[fade-up_0.5s_ease-out_both]"
            style={{ animationDelay: `${i * 80}ms` }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-2 text-3xl font-bold tabular-nums">
                  <AnimatedCounter value={value} />
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold mb-4">Manuscrits par statut</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byStatus}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.32 0.05 250)" />
                <XAxis dataKey="name" stroke="oklch(0.71 0.03 250)" fontSize={12} />
                <YAxis stroke="oklch(0.71 0.03 250)" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.23 0.045 250)", border: "1px solid oklch(0.32 0.05 250)", borderRadius: 8 }}
                  cursor={{ fill: "oklch(0.78 0.17 165 / 0.08)" }}
                />
                <Bar dataKey="count" fill="oklch(0.78 0.17 165)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold mb-4">Manuscrits récents</h2>
          {recent === null ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : recent.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Aucun manuscrit pour le moment</p>
          ) : (
            <ul className="space-y-3">
              {recent.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{m.titre}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.auteur}</p>
                  </div>
                  <StatusBadge statut={m.statut} />
                </li>
              ))}
            </ul>
          )}
          <Link to="/manuscrits" className="block mt-4 text-sm text-primary hover:underline">
            Voir tous les manuscrits →
          </Link>
        </div>
      </section>
    </div>
  );
}
