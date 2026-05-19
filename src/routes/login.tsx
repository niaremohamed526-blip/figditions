import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Connexion — FIGDITIONS" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Bienvenue !");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-[fade-up_0.6s_ease-out_both]">
        <div className="text-center mb-10 flex flex-col items-center">
          <Logo className="h-20 w-auto mb-4" />
          <p className="mt-1 text-muted-foreground text-sm">
            La plateforme éditoriale de l'Afrique de l'Ouest
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-8 shadow-2xl">
          <h2 className="text-xl font-semibold mb-1">Connexion</h2>
          <p className="text-sm text-muted-foreground mb-6">Accédez à votre espace éditorial</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-background/50 transition-all focus:ring-2 focus:ring-primary/40" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" type="password" required value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-background/50 transition-all focus:ring-2 focus:ring-primary/40" />
            </div>
            <Button type="submit" disabled={loading}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold h-11">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Se connecter"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Pas encore de compte ?{" "}
            <Link to="/signup" className="text-primary hover:underline font-medium">
              Créer un compte
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
