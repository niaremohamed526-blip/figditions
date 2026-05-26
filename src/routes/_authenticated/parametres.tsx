import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, X, Sparkles, UserPlus, Trash2, Loader2, Crown, Lock, Copy, Upload, Save, AlertTriangle, KeyRound, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile, notifyEntrepriseUpdated, type AppRole, type AppPlan } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PLANS, planFor } from "@/lib/plans";
import { UpgradePaymentModal } from "@/components/upgrade-payment-modal";
import { PaymentResultModal } from "@/components/payment-result-modal";
import { fcfa } from "@/lib/format";
import { z } from "zod";

const paramsSchema = z.object({
  payment: z.enum(["success", "cancelled"]).optional(),
}).partial();

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

      <Tabs defaultValue={isAdmin ? "maison" : "compte"} className="w-full">
        <TabsList className="bg-card border border-border flex-wrap h-auto">
          <TabsTrigger value="compte">Mon compte</TabsTrigger>
          {isAdmin && <TabsTrigger value="maison">Maison d'édition</TabsTrigger>}
          {isAdmin && <TabsTrigger value="equipe">Mon équipe</TabsTrigger>}
          <TabsTrigger value="plan" id="plan">Plans</TabsTrigger>
          <TabsTrigger value="danger" className="text-destructive">Zone dangereuse</TabsTrigger>
        </TabsList>

        <TabsContent value="compte" className="mt-6">
          <AccountSection profile={profile} email={user?.email ?? ""} entrepriseName={entreprise?.nom ?? ""} role={profile?.role ?? "admin"} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="maison" className="mt-6">
            <MaisonSection entreprise={entreprise} />
          </TabsContent>
        )}

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

        <TabsContent value="danger" className="mt-6">
          <DangerZone />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AccountSection({ profile, email, entrepriseName, role }: { profile: any; email: string; entrepriseName: string; role: AppRole }) {
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState((profile as any)?.telephone ?? "");
  const [saving, setSaving] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setPhone((profile as any)?.telephone ?? "");
  }, [profile]);

  const save = async () => {
    if (!profile?.id) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName } as any).eq("id", profile.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profil mis à jour");
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold">Profil utilisateur</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nom complet</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Téléphone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+223 ..." />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} disabled />
          </div>
          <div className="space-y-2">
            <Label>Maison d'édition</Label>
            <Input value={entrepriseName} disabled />
          </div>
        </div>
        <div className="flex justify-between items-center pt-2">
          <Button variant="outline" onClick={() => setPwOpen(true)}>
            <KeyRound className="h-4 w-4" /> Changer le mot de passe
          </Button>
          <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Sauvegarder</>}
          </Button>
        </div>
      </div>

      <PasswordModal open={pwOpen} onOpenChange={setPwOpen} />
    </div>
  );
}

function PasswordModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 6) return toast.error("Mot de passe trop court (min 6 caractères)");
    if (pw !== pw2) return toast.error("Les mots de passe ne correspondent pas");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Mot de passe mis à jour");
    setPw(""); setPw2("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader><DialogTitle>Changer le mot de passe</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nouveau mot de passe</Label>
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Confirmer</Label>
            <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={loading} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mettre à jour"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MaisonSection({ entreprise }: { entreprise: any }) {
  const [nom, setNom] = useState("");
  const [adresse, setAdresse] = useState("");
  const [ville, setVille] = useState("Bamako");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!entreprise) return;
    setNom(entreprise.nom ?? "");
    setAdresse(entreprise.adresse ?? "");
    setVille(entreprise.ville ?? "Bamako");
    setTelephone(entreprise.telephone ?? "");
    setEmail(entreprise.email ?? "");
    setLogoUrl(entreprise.logo_url ?? null);
  }, [entreprise]);

  const save = async () => {
    if (!entreprise?.id) return;
    setSaving(true);
    const { error } = await supabase.from("entreprises").update({
      nom, ville, adresse, telephone, email, logo_url: logoUrl,
    } as any).eq("id", entreprise.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    notifyEntrepriseUpdated();
    toast.success("Paramètres sauvegardés");
  };

  const onLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !entreprise?.id) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${entreprise.id}/logo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const { data } = supabase.storage.from("logos").getPublicUrl(path);
    const newUrl = data.publicUrl;
    setLogoUrl(newUrl);
    // Persist immediately so the sidebar updates without waiting for "Save"
    const { error: updErr } = await supabase
      .from("entreprises")
      .update({ logo_url: newUrl } as any)
      .eq("id", entreprise.id);
    setUploading(false);
    if (updErr) return toast.error(updErr.message);
    notifyEntrepriseUpdated();
    toast.success("Logo mis à jour");
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Building2 className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">Profil de la maison d'édition</h2>
      </div>

      <div className="flex items-center gap-4">
        <div className="h-20 w-20 rounded-xl border border-border bg-background flex items-center justify-center overflow-hidden">
          {logoUrl ? <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" /> : <Building2 className="h-8 w-8 text-muted-foreground" />}
        </div>
        <div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onLogoChange} />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4" /> Téléverser un logo</>}
          </Button>
          <p className="text-xs text-muted-foreground mt-1">PNG ou JPG · max 2 Mo</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nom *</Label>
          <Input value={nom} onChange={(e) => setNom(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Ville</Label>
          <Input value={ville} onChange={(e) => setVille(e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Adresse</Label>
          <Input value={adresse} onChange={(e) => setAdresse(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Téléphone</Label>
          <Input value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="+223 ..." />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Sauvegarder</>}
        </Button>
      </div>
    </div>
  );
}

function DangerZone() {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const navigate = useNavigate();

  const doDelete = async () => {
    setLoading(true);
    // Sign out — actual auth deletion requires admin API; we sign out and notify.
    await supabase.auth.signOut();
    setLoading(false);
    toast.success("Compte déconnecté. Contactez le support pour la suppression définitive.");
    navigate({ to: "/login" });
  };

  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 space-y-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <h2 className="font-semibold text-destructive">Zone dangereuse</h2>
          <p className="text-sm text-muted-foreground mt-1">
            La suppression de votre compte est définitive. Toutes vos données (manuscrits, auteurs, ventes, contrats) seront effacées.
          </p>
        </div>
      </div>
      <Button variant="destructive" onClick={() => setStep(1)}>
        <Trash2 className="h-4 w-4" /> Supprimer mon compte
      </Button>

      <AlertDialog open={step === 1} onOpenChange={(o) => !o && setStep(0)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer votre compte ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Tous les manuscrits, auteurs, ventes et contrats associés seront perdus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); setStep(2); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Continuer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={step === 2} onOpenChange={(o) => !o && setStep(0)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-destructive">Confirmation finale</DialogTitle>
            <DialogDescription>
              Tapez <span className="font-mono font-bold text-foreground">SUPPRIMER</span> pour confirmer.
            </DialogDescription>
          </DialogHeader>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="SUPPRIMER" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setStep(0)}>Annuler</Button>
            <Button variant="destructive" disabled={confirmText !== "SUPPRIMER" || loading} onClick={doDelete}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Supprimer définitivement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
