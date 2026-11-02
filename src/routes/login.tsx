import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { authErrorFr } from "@/lib/auth-errors";
import { AuthShell, AuthInput, authButtonClass, authLinkClass } from "@/components/auth-shell";


export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Connexion | FIGDITIONS" },
      { name: "description", content: "Connectez-vous à votre espace FIGDITIONS pour gérer manuscrits, contrats, stocks et ventes de votre maison d'édition." },
      { property: "og:title", content: "Connexion | FIGDITIONS" },
      { property: "og:description", content: "Accédez à votre espace éditorial FIGDITIONS." },
      { property: "og:url", content: "https://figditions.xyz/login" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://figditions.xyz/login" }],
  }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  // Already signed in on this device: open the workspace instead.
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(authErrorFr(error.message));
    toast.success("Bienvenue !");
    navigate({ to: "/dashboard" });
  };

  return (
    <AuthShell kicker="Connexion" title={<>Bon <em className="italic text-[#E8B84B]">retour.</em></>} intro="Connectez-vous à l'espace de votre maison d'édition.">
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-white/90">Adresse email</Label>
          <AuthInput
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            placeholder="votre@email.com"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="password" className="text-white/90">Mot de passe</Label>
            <Link to="/mot-de-passe-oublie" className="text-[13px] text-[#8C7B6B] hover:text-white transition-colors">
              Mot de passe oublié ?
            </Link>
          </div>
          <div className="relative">
            <AuthInput
              id="password"
              type={showPwd ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              placeholder="••••••••"
              onChange={(e) => setPassword(e.target.value)}
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C7B6B] hover:text-white"
              aria-label={showPwd ? "Masquer" : "Afficher"}
            >
              {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button type="submit" disabled={loading} className={authButtonClass + " mt-2"}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Se connecter"}
        </button>

        <p className="pt-6 border-t border-white/10 text-sm text-[#8C7B6B]">
          Pas encore de compte ?{" "}
          <Link to="/signup" className={authLinkClass}>
            Créer un compte gratuit
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
