import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { authErrorFr } from "@/lib/auth-errors";
import { AuthShell, AuthInput, authButtonClass, authLinkClass } from "@/components/auth-shell";

export const Route = createFileRoute("/reinitialiser-mot-de-passe")({
  component: ResetPasswordPage,
  head: () => ({
    meta: [{ title: "Nouveau mot de passe | FIGDITIONS" }, { name: "robots", content: "noindex,nofollow" }],
  }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("Le mot de passe doit contenir au moins 6 caractères.");
    if (password !== confirm) return toast.error("Les mots de passe ne correspondent pas.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(authErrorFr(error.message));
    toast.success("Mot de passe mis à jour !");
    navigate({ to: "/dashboard" });
  };

  return (
    <AuthShell
      kicker="Mot de passe"
      title={<>Nouveau <em className="italic text-[#E8B84B]">mot de passe.</em></>}
      intro="Choisissez un nouveau mot de passe pour votre compte."
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="password" className="text-white/90">Nouveau mot de passe</Label>
          <AuthInput
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm" className="text-white/90">Confirmer</Label>
          <AuthInput
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <button type="submit" disabled={loading} className={authButtonClass}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mettre à jour"}
        </button>
      </form>
    </AuthShell>
  );
}
