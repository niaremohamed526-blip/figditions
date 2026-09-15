import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Mail, Phone, Smartphone, BookOpen, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { fcfa } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/auteurs/$auteurId")({
  component: AuteurDetailPage,
  head: () => ({ meta: [{ title: "Auteur | FIGDITIONS" }] }),
});

interface Auteur {
  id: string; nom_complet: string; email: string | null; telephone: string | null;
  numero_mobile_money: string | null; operateur: string | null;
}
interface Manuscrit {
  id: string; titre: string; statut: string; genre: string | null; created_at: string;
}

function AuteurDetailPage() {
  const { auteurId } = Route.useParams();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const [auteur, setAuteur] = useState<Auteur | null>(null);
  const [manuscrits, setManuscrits] = useState<Manuscrit[] | null>(null);
  const [royalties, setRoyalties] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.entreprise_id) return;
    let active = true;
    (async () => {
      setLoading(true);
      const { data: a } = await (supabase as any)
        .from("auteurs").select("*").eq("id", auteurId).maybeSingle();
      if (!active) return;
      setAuteur(a as Auteur | null);

      if (a) {
        const { data: ms } = await (supabase as any).from("manuscrits").select("*");
        const list = ((ms ?? []) as any[]).filter(
          (m) => m.auteur_id === a.id || (m.auteur && m.auteur.toLowerCase() === a.nom_complet.toLowerCase())
        );
        if (!active) return;
        setManuscrits(list as Manuscrit[]);

        const ids = list.map((m: any) => m.id);
        if (ids.length) {
          const { data: ventes } = await (supabase as any)
            .from("ventes").select("droits_auteur_fcfa, manuscrit_id, statut_paiement").eq("statut_annulation", "active")
            .in("manuscrit_id", ids).eq("statut_paiement", "en_attente");
          const total = ((ventes ?? []) as any[]).reduce(
            (s, v) => s + Number(v.droits_auteur_fcfa ?? 0), 0
          );
          if (!active) return;
          setRoyalties(total);
        } else {
          setRoyalties(0);
        }
      } else {
        setManuscrits([]);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [auteurId, profile?.entreprise_id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!auteur) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Auteur introuvable.</p>
        <Link to="/auteurs" className="text-primary hover:underline mt-2 inline-block">← Retour aux auteurs</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/auteurs" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4 mr-1" /> Retour
        </Link>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
        <div className="flex items-start gap-5">
          <div className="h-16 w-16 rounded-2xl bg-primary/15 text-primary flex items-center justify-center text-2xl font-bold shadow-[0_0_20px_var(--color-primary)]">
            {auteur.nom_complet.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold">{auteur.nom_complet}</h1>
            <div className="mt-3 grid sm:grid-cols-2 gap-2 text-sm">
              {auteur.email && <Info icon={<Mail className="h-4 w-4" />}>{auteur.email}</Info>}
              {auteur.telephone && <Info icon={<Phone className="h-4 w-4" />}>{auteur.telephone}</Info>}
              {auteur.numero_mobile_money && (
                <Info icon={<Smartphone className="h-4 w-4" />}>
                  {auteur.numero_mobile_money} {auteur.operateur && <span className="text-muted-foreground">· {auteur.operateur}</span>}
                </Info>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <StatCard icon={<BookOpen className="h-5 w-5" />} label="Manuscrits" value={String(manuscrits?.length ?? 0)} />
        <StatCard
          icon={<Wallet className="h-5 w-5" />}
          label="Droits d'auteur en attente"
          value={fcfa(royalties)}
          highlight
        />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold">Manuscrits liés</h2>
        </div>
        {!manuscrits || manuscrits.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Aucun manuscrit lié à cet auteur.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Titre</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Genre</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Ajouté</th>
                </tr>
              </thead>
              <tbody>
                {manuscrits.map((m) => (
                  <tr key={m.id} className="border-t border-border hover:bg-primary/5 transition-colors">
                    <td className="px-4 py-3 font-medium">{m.titre}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{m.genre ?? "—"}</td>
                    <td className="px-4 py-3"><StatusBadge statut={m.statut} /></td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {new Date(m.created_at).toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <span className="text-primary">{icon}</span>
      <span className="truncate">{children}</span>
    </div>
  );
}

function StatCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border border-border bg-card p-5 ${highlight ? "shadow-[0_0_24px_color-mix(in_oklab,var(--gold)_25%,transparent)]" : ""}`}>
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <span className={highlight ? "text-[color:var(--gold)]" : "text-primary"}>{icon}</span>
        {label}
      </div>
      <p className={`mt-2 text-2xl font-bold ${highlight ? "text-[color:var(--gold)]" : ""}`}>{value}</p>
    </div>
  );
}
