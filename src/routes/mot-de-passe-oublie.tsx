import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { authErrorFr } from "@/lib/auth-errors";
import { AuthShell, AuthInput, authButtonClass, authLinkClass } from "@/components/auth-shell";

export const Route = createFileRoute("/mot-de-passe-oublie")({
  component: ForgotPasswordPage,
  head: () => ({
    meta: [
      { title: "Mot de passe oublié | FIGDITIONS" },
      { name: "description", content: "Réinitialisez votre mot de passe FIGDITIONS." },
      { name: "robots", content: "noindex,follow" },
    ],
    links: [{ rel: "canonical", href: "https://figditions.xyz/mot-de-passe-oublie" }],
  }),
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reinitialiser-mot-de-passe`,
    });
    setLoading(false);
    if (error) return toast.error(authErrorFr(error.message));
    setSent(true);
    toast.success("Email envoyé. Vérifiez votre boîte de réception.");
  };

  return (
    <AuthShell
      kicker="Mot de passe"
      title={<>Mot de passe <em className="italic text-[#E8B84B]">oublié.</em></>}
      intro={sent
        ? "Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé."
        : "Entrez votre email pour recevoir un lien de réinitialisation."}
    >
      {!sent && (
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-white/90">Email</Label>
            <AuthInput
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
            />
          </div>
          <button type="submit" disabled={loading} className={authButtonClass}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Envoyer le lien"}
          </button>
        </form>
      )}
      <p className="mt-8 pt-6 border-t border-white/10 text-sm">
        <Link to="/login" className={authLinkClass}>
          Retour à la connexion
        </Link>
      </p>
    </AuthShell>
  );
}
