import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";
import { Loader2, CheckCircle2, Lock, AlertTriangle, Eye, EyeOff, Check } from "lucide-react";
import { toast } from "sonner";
import { getInvitationByToken, acceptInvitation } from "@/lib/invitations.functions";
import { PAGES, type Permissions, pageLabel } from "@/lib/permissions";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/rejoindre/$token")({
  component: JoinPage,
  head: () => ({ meta: [{ title: "Rejoindre — FIGDITIONS" }] }),
});

type InviteResult = Awaited<ReturnType<typeof getInvitationByToken>>;

function JoinPage() {
  const { token } = useParams({ from: "/rejoindre/$token" });
  const navigate = useNavigate();
  const fetchInvite = useServerFn(getInvitationByToken);
  const accept = useServerFn(acceptInvitation);

  const [invite, setInvite] = useState<InviteResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [shake, setShake] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const strength = useMemo(() => {
    if (password.length === 0) return { level: 0, label: "", color: "" };
    const hasNum = /\d/.test(password);
    const hasSpec = /[^A-Za-z0-9]/.test(password);
    if (password.length < 8) return { level: 1, label: "Faible", color: "#ef4444" };
    if (hasNum && hasSpec) return { level: 3, label: "Fort", color: "#22c55e" };
    return { level: 2, label: "Moyen", color: "#f59e0b" };
  }, [password]);

  const passwordValid = password.length >= 8;
  const matchValid = confirm.length > 0 && password === confirm;
  const canSubmit = passwordValid && matchValid && !submitting;

  useEffect(() => {
    fetchInvite({ data: { token } })
      .then((r) => {
        setInvite(r);
        if (r.valid) setFullName(r.full_name ?? "");
      })
      .catch(() => setInvite({ valid: false as const, reason: "invalid" as const } as InviteResult))
      .finally(() => setLoading(false));
  }, [token, fetchInvite]);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!invite?.valid) return;
    setFormError(null);
    if (!passwordValid) {
      setFormError("Le mot de passe doit contenir au moins 8 caractères.");
      triggerShake();
      return;
    }
    if (!matchValid) {
      setFormError("Les mots de passe ne correspondent pas.");
      triggerShake();
      return;
    }
    setSubmitting(true);
    const { data: existing } = await supabase.auth.getUser();
    const signedInEmail = existing.user?.email?.toLowerCase() ?? null;
    const inviteEmail = invite.email.toLowerCase();
    const isInviteeSignedIn = signedInEmail === inviteEmail;
    try {
      if (existing.user && !isInviteeSignedIn) {
        await supabase.auth.signOut();
      }

      if (!isInviteeSignedIn) {
        const { error } = await supabase.auth.signUp({
          email: invite.email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName, invite_token: token },
          },
        });
        if (error) {
          const m = error.message.toLowerCase();
          const alreadyExists =
            m.includes("already") || m.includes("registered") || m.includes("exists");
          if (alreadyExists) {
            // Account already exists — try to sign in with provided password
            const { error: sErr } = await supabase.auth.signInWithPassword({
              email: invite.email,
              password,
            });
            if (sErr) {
              setFormError(
                "Un compte existe déjà avec cet email. Le mot de passe saisi est incorrect — utilisez votre mot de passe existant ou réinitialisez-le.",
              );
              triggerShake();
              setSubmitting(false);
              return;
            }
            // signed in successfully → fall through to accept()
          } else if (m.includes("weak") || m.includes("password")) {
            setFormError("Mot de passe trop faible. Utilisez au moins 8 caractères.");
            triggerShake();
            setSubmitting(false);
            return;
          } else if (m.includes("network") || m.includes("fetch")) {
            setFormError("Erreur de connexion. Réessayez.");
            triggerShake();
            setSubmitting(false);
            return;
          } else {
            setFormError(error.message);
            triggerShake();
            setSubmitting(false);
            return;
          }
        } else {
          const { error: sErr } = await supabase.auth.signInWithPassword({ email: invite.email, password });
          if (sErr) throw new Error(sErr.message);
        }
      }
      await accept({ data: { token } });

      toast.success("Bienvenue sur FIGDITIONS !");
      navigate({ to: "/dashboard" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors de la création du compte";
      setFormError(msg);
      toast.error(msg);
      triggerShake();
      setSubmitting(false);
    }
  };



  if (loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!invite?.valid) {
    const messages: Record<string, { title: string; sub: string }> = {
      invalid: { title: "Lien invalide", sub: "Ce lien d'invitation est invalide." },
      used: { title: "Invitation déjà utilisée", sub: "Cette invitation a déjà été acceptée." },
      expired: {
        title: "Invitation expirée",
        sub: "Ce lien d'invitation a expiré. Demandez un nouveau lien à votre administrateur.",
      },
    };
    const m = messages[(invite as { reason?: string } | null)?.reason ?? "invalid"] ?? messages.invalid;
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="mx-auto h-20 w-20 rounded-2xl bg-destructive/15 text-destructive flex items-center justify-center">
            <AlertTriangle className="h-10 w-10" />
          </div>
          <h1 className="text-2xl font-bold">{m.title}</h1>
          <p className="text-muted-foreground">{m.sub}</p>
          <Link to="/login">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Aller à la connexion</Button>
          </Link>
        </div>
      </div>
    );
  }

  const enabled = (PAGES as { key: keyof Permissions }[])
    .filter((p) => invite.permissions[p.key])
    .map((p) => pageLabel(p.key as never));

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-[fade-up_0.6s_ease-out_both]">
        <div className="text-center mb-6 flex flex-col items-center">
          <Logo className="h-24 w-auto mb-2" />
          <p className="text-muted-foreground text-sm">Vous avez été invité à rejoindre</p>
          <p className="text-lg font-bold mt-1">{invite.entreprise_nom}</p>
          {invite.role_label && (
            <p className="text-xs text-muted-foreground mt-1">En tant que : {invite.role_label}</p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-6 mb-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" /> Vous aurez accès à :
          </h3>
          <ul className="space-y-1.5 text-sm">
            {enabled.length === 0 && <li className="text-muted-foreground">Aucune page activée</li>}
            {enabled.map((label) => (
              <li key={label} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" /> {label}
              </li>
            ))}
          </ul>
        </div>

        <form onSubmit={onSubmit} className={cn("rounded-2xl border border-border bg-card/60 backdrop-blur p-6 space-y-4", shake && "animate-[shake_0.5s]")}>
          <style>{`@keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-8px)} 40%,80%{transform:translateX(8px)} }`}</style>
          <h2 className="text-lg font-semibold">Créer mon compte</h2>
          <div className="space-y-2">
            <Label>Nom complet</Label>
            <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={invite.email} disabled />
          </div>

          <div className="space-y-2">
            <Label>Mot de passe</Label>
            <div className="relative">
              <Input
                type={showPw ? "text" : "password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground"
                aria-label={showPw ? "Masquer" : "Afficher"}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {password.length > 0 && (
              <div className="space-y-1">
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full transition-all duration-300"
                    style={{ width: `${(strength.level / 3) * 100}%`, backgroundColor: strength.color }}
                  />
                </div>
                <p className="text-xs font-medium" style={{ color: strength.color }}>{strength.label}</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Confirmer le mot de passe</Label>
            <div className="relative">
              <Input
                type={showConfirm ? "text" : "password"}
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={cn(
                  "pr-16",
                  confirm.length > 0 && !matchValid && "border-red-500 focus-visible:ring-red-500",
                  confirm.length > 0 && matchValid && "border-green-500 focus-visible:ring-green-500",
                )}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {confirm.length > 0 && matchValid && <Check className="h-4 w-4 text-green-500" />}
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirm((v) => !v)}
                  className="p-1.5 text-muted-foreground hover:text-foreground"
                  aria-label={showConfirm ? "Masquer" : "Afficher"}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {confirm.length > 0 && !matchValid && (
              <p className="text-xs text-red-500">Les mots de passe ne correspondent pas</p>
            )}
          </div>

          {formError && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {formError}
              {formError.includes("existe déjà") && (
                <>
                  {" "}
                  <Link to="/login" className="underline font-semibold">Se connecter</Link>
                </>
              )}
            </div>
          )}

          <Button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11 font-semibold disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Créer mon compte"}
          </Button>
        </form>

      </div>
    </div>
  );
}
