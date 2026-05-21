import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, X, Sparkles, UserPlus, Trash2, Loader2, Crown, Lock, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile, type AppRole, type AppPlan } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PLANS, planFor } from "@/lib/plans";

export const Route = createFileRoute("/_authenticated/parametres")({
  component: ParametresPage,
  head: () => ({ meta: [{ title: "Paramètres — FIGDITIONS" }] }),
});

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  editeur: "Éditeur",
  comptable: "Comptable",
  commercial: "Commercial",
};

interface Member {
  id: string;
  full_name: string;
  role: AppRole;
  email?: string;
  created_at?: string;
}
interface Invitation {
  id: string;
  email: string;
  role: string;
  statut: string;
  token: string;
  created_at: string;
  expires_at: string;
}

function ParametresPage() {
  const { user } = useAuth();
  const { profile, entreprise, loading: profileLoading } = useProfile(user?.id);
  const plan = planFor(entreprise?.plan);
  const isAdmin = profile?.role === "admin";

  if (profileLoading) {
    return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground mt-1">Gérez votre plan, votre équipe et vos préférences.</p>
      </header>

      <PlanCard plan={plan.key} />

      <Tabs defaultValue={isAdmin ? "equipe" : "compte"} className="w-full">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="compte">Mon compte</TabsTrigger>
          {isAdmin && <TabsTrigger value="equipe">Mon équipe</TabsTrigger>}
          <TabsTrigger value="plan" id="plan">Plans</TabsTrigger>
        </TabsList>

        <TabsContent value="compte" className="mt-6">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nom complet</Label>
                <Input value={profile?.full_name ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <Label>Maison d'édition</Label>
                <Input value={entreprise?.nom ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <Label>Rôle</Label>
                <Input value={ROLE_LABELS[profile?.role ?? "admin"]} disabled />
              </div>
            </div>
          </div>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="equipe" className="mt-6">
            <TeamSection
              entrepriseId={profile?.entreprise_id ?? null}
              currentUserId={user?.id ?? ""}
              plan={plan.key}
            />
          </TabsContent>
        )}

        <TabsContent value="plan" className="mt-6">
          <PlansComparison currentPlan={plan.key} canChange={isAdmin} entrepriseId={profile?.entreprise_id ?? null} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PlanCard({ plan }: { plan: AppPlan }) {
  const p = PLANS[plan];
  return (
    <div className="rounded-2xl border border-border bg-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className={cn("h-12 w-12 rounded-xl border flex items-center justify-center", p.badgeClass)}>
          <Crown className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Mon plan actuel</p>
          <div className="flex items-center gap-2 mt-1">
            <h2 className="text-2xl font-bold">{p.label}</h2>
            <span className={cn("text-xs font-semibold border rounded-full px-2 py-0.5", p.badgeClass)}>
              {p.monthlyFcfa === 0 ? "Gratuit" : `${p.monthlyFcfa.toLocaleString("fr-FR")} FCFA / mois`}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {p.maxManuscrits === Infinity ? "Manuscrits illimités" : `Jusqu'à ${p.maxManuscrits} manuscrits`}
            {" · "}
            {p.maxUsers === Infinity ? "Utilisateurs illimités" : `${p.maxUsers} utilisateur${p.maxUsers > 1 ? "s" : ""}`}
          </p>
        </div>
      </div>
      <a href="#plan" className="inline-flex">
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Sparkles className="h-4 w-4" /> Changer de plan
        </Button>
      </a>
    </div>
  );
}

function TeamSection({ entrepriseId, currentUserId, plan }: { entrepriseId: string | null; currentUserId: string; plan: AppPlan }) {
  const p = PLANS[plan];
  const [members, setMembers] = useState<Member[] | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [toRemove, setToRemove] = useState<Member | null>(null);

  const load = async () => {
    if (!entrepriseId) return;
    setMembers(null);
    const [{ data: profs }, { data: invs }] = await Promise.all([
      supabase.from("profiles").select("*").eq("entreprise_id", entrepriseId),
      supabase.from("invitations").select("*").eq("statut", "en_attente").order("created_at", { ascending: false }),
    ]);
    setMembers((profs ?? []) as Member[]);
    setInvitations((invs ?? []) as Invitation[]);
  };
  useEffect(() => { load(); }, [entrepriseId]);

  const totalSeats = (members?.length ?? 0) + invitations.length;
  const atLimit = totalSeats >= p.maxUsers;

  const changeRole = async (m: Member, role: AppRole) => {
    if (m.id === currentUserId) return toast.error("Vous ne pouvez pas modifier votre propre rôle");
    const { error } = await supabase.from("profiles").update({ role }).eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("Rôle mis à jour");
    setMembers((prev) => prev?.map((x) => x.id === m.id ? { ...x, role } : x) ?? prev);
  };

  const cancelInvite = async (inv: Invitation) => {
    const { error } = await supabase.from("invitations").delete().eq("id", inv.id);
    if (error) return toast.error(error.message);
    toast.success("Invitation annulée");
    setInvitations((prev) => prev.filter((x) => x.id !== inv.id));
  };

  const copyInviteLink = (inv: Invitation) => {
    const link = `${window.location.origin}/signup?invite=${inv.token}`;
    navigator.clipboard.writeText(link);
    toast.success("Lien d'invitation copié");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Membres de l'équipe</h2>
          <p className="text-sm text-muted-foreground">{totalSeats} / {p.maxUsers === Infinity ? "∞" : p.maxUsers} utilisateurs</p>
        </div>
        {p.maxUsers <= 1 ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Lock className="h-4 w-4 text-[color:var(--gold)]" />
            Passez au plan Pro pour inviter votre équipe
          </div>
        ) : atLimit ? (
          <div className="text-sm text-muted-foreground">
            Limite atteinte. Passez au plan {plan === "pro" ? "Business" : "supérieur"} pour plus d'utilisateurs.
          </div>
        ) : (
          <Button onClick={() => setInviteOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <UserPlus className="h-4 w-4" /> Inviter un membre
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {members === null ? (
          <div className="p-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Nom</th>
                  <th className="px-4 py-3 font-medium">Rôle</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Ajouté</th>
                  <th className="px-4 py-3 font-medium w-20 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const isYou = m.id === currentUserId;
                  const initial = (m.full_name || "?").charAt(0).toUpperCase();
                  return (
                    <tr key={m.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold text-xs">
                            {initial}
                          </div>
                          <span className="font-medium">{m.full_name}</span>
                          {isYou && <span className="text-xs font-semibold bg-primary/15 text-primary border border-primary/30 rounded-full px-2 py-0.5">Vous</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isYou ? (
                          <span className="text-muted-foreground">{ROLE_LABELS[m.role]}</span>
                        ) : (
                          <Select value={m.role} onValueChange={(v) => changeRole(m, v as AppRole)}>
                            <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
                                <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold bg-primary/15 text-primary border border-primary/30 rounded-full px-2 py-0.5">Actif</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                        {m.created_at ? new Date(m.created_at).toLocaleDateString("fr-FR") : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!isYou && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-destructive/15 hover:text-destructive" onClick={() => setToRemove(m)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {invitations.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Invitations en attente</h3>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Rôle</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Expire le</th>
                  <th className="px-4 py-3 font-medium w-32 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => (
                  <tr key={inv.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{inv.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{ROLE_LABELS[inv.role as AppRole] ?? inv.role}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {new Date(inv.expires_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyInviteLink(inv)} title="Copier le lien">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-destructive/15 hover:text-destructive" onClick={() => cancelInvite(inv)} title="Annuler">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <InviteModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        entrepriseId={entrepriseId}
        onCreated={load}
      />

      <AlertDialog open={!!toRemove} onOpenChange={(o) => !o && setToRemove(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer ce membre ?</AlertDialogTitle>
            <AlertDialogDescription>
              {toRemove?.full_name} n'aura plus accès à votre maison d'édition. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                if (!toRemove) return;
                const { error } = await supabase.from("profiles").update({ entreprise_id: null }).eq("id", toRemove.id);
                if (error) return toast.error(error.message);
                toast.success("Membre retiré");
                setMembers((prev) => prev?.filter((x) => x.id !== toRemove.id) ?? prev);
                setToRemove(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Retirer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InviteModal({
  open, onOpenChange, entrepriseId, onCreated,
}: { open: boolean; onOpenChange: (o: boolean) => void; entrepriseId: string | null; onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("editeur");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entrepriseId) return;
    setLoading(true);
    const { error } = await supabase.from("invitations").insert({
      entreprise_id: entrepriseId,
      email,
      role,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Invitation envoyée");
    setEmail(""); setRole("editeur");
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader><DialogTitle>Inviter un membre</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="collaborateur@exemple.com" />
          </div>
          <div className="space-y-2">
            <Label>Rôle</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin — accès complet</SelectItem>
                <SelectItem value="editeur">Éditeur — manuscrits et auteurs</SelectItem>
                <SelectItem value="comptable">Comptable — finances</SelectItem>
                <SelectItem value="commercial">Commercial — stocks</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={loading} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Envoyer l'invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PlansComparison({ currentPlan, canChange, entrepriseId }: { currentPlan: AppPlan; canChange: boolean; entrepriseId: string | null }) {
  const [updating, setUpdating] = useState<AppPlan | null>(null);

  const switchPlan = async (plan: AppPlan) => {
    if (!entrepriseId || plan === currentPlan) return;
    setUpdating(plan);
    const max = PLANS[plan].maxUsers === Infinity ? 999 : PLANS[plan].maxUsers;
    const { error } = await supabase.from("entreprises").update({ plan, max_utilisateurs: max }).eq("id", entrepriseId);
    setUpdating(null);
    if (error) return toast.error(error.message);
    toast.success(`Plan ${PLANS[plan].label} activé`);
    setTimeout(() => window.location.reload(), 600);
  };

  const features = useMemo(() => ([
    { key: "maxManuscrits", label: "Manuscrits" },
    { key: "maxBookstores", label: "Librairies" },
    { key: "maxUsers", label: "Utilisateurs" },
    { key: "contrats", label: "Contrats OHADA" },
    { key: "finances", label: "Finances & royalties" },
    { key: "exportPdf", label: "Export PDF" },
    { key: "exportEpub", label: "Export ePub" },
    { key: "prioritySupport", label: "Support prioritaire" },
  ] as const), []);

  const plans: AppPlan[] = ["starter", "pro", "business"];

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      {plans.map((p) => {
        const pl = PLANS[p];
        const isCurrent = p === currentPlan;
        const highlighted = p === "pro";
        const gold = p === "business";
        return (
          <div key={p} className={cn(
            "rounded-2xl border bg-card p-6 flex flex-col",
            highlighted && "border-primary shadow-glow scale-[1.02]",
            gold && "border-[color:var(--gold)]/60",
            !highlighted && !gold && "border-border",
          )}>
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">{pl.label}</h3>
              {isCurrent && <span className="text-xs font-semibold bg-primary/15 text-primary border border-primary/30 rounded-full px-2 py-0.5">Actuel</span>}
            </div>
            <p className="mt-3 text-3xl font-bold">
              {pl.monthlyFcfa === 0 ? "Gratuit" : `${pl.monthlyFcfa.toLocaleString("fr-FR")}`}
              {pl.monthlyFcfa > 0 && <span className="text-sm font-normal text-muted-foreground"> FCFA / mois</span>}
            </p>
            <ul className="mt-6 space-y-2 text-sm flex-1">
              {features.map((f) => {
                const v = (pl as any)[f.key];
                const on = typeof v === "boolean" ? v : true;
                const display = typeof v === "boolean" ? f.label : `${f.label} : ${v === Infinity ? "illimités" : v}`;
                return (
                  <li key={f.key} className="flex items-start gap-2">
                    {on
                      ? <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      : <X className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                    <span className={on ? "" : "text-muted-foreground line-through"}>{display}</span>
                  </li>
                );
              })}
            </ul>
            <Button
              disabled={!canChange || isCurrent || updating !== null}
              onClick={() => switchPlan(p)}
              className={cn(
                "mt-6 w-full",
                gold ? "bg-[color:var(--gold)] text-background hover:bg-[color:var(--gold)]/90"
                  : highlighted ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
              )}
            >
              {updating === p ? <Loader2 className="h-4 w-4 animate-spin" />
                : isCurrent ? "Plan actuel"
                : `Choisir ${pl.label}`}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
