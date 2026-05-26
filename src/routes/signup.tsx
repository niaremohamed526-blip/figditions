import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  head: () => ({ meta: [{ title: "Inscription — FIGDITIONS" }] }),
});

function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    entreprise_nom: "",
    ville: "Bamako",
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const onChange = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms) {
      toast.error("Vous devez accepter les conditions d'utilisation et la politique de confidentialité");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          full_name: form.full_name,
          entreprise_nom: form.entreprise_nom,
          ville: form.ville,
        },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Compte créé !");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-[fade-up_0.6s_ease-out_both]">
        <div className="text-center mb-8 flex flex-col items-center">
          <Logo className="h-28 w-auto mb-2" />
          <p className="mt-1 text-muted-foreground text-sm">
            La plateforme éditoriale de l'Afrique de l'Ouest
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-8 shadow-2xl">
          <h2 className="text-xl font-semibold mb-1">Créer un compte</h2>
          <p className="text-sm text-muted-foreground mb-6">Lancez votre maison d'édition</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nom complet</Label>
              <Input required value={form.full_name} onChange={onChange("full_name")} className="bg-background/50" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" required value={form.email} onChange={onChange("email")} className="bg-background/50" />
            </div>
            <div className="space-y-2">
              <Label>Mot de passe</Label>
              <Input type="password" required minLength={6} value={form.password} onChange={onChange("password")} className="bg-background/50" />
            </div>
            <div className="space-y-2">
              <Label>Nom de la maison d'édition</Label>
              <Input required value={form.entreprise_nom} onChange={onChange("entreprise_nom")} className="bg-background/50" />
            </div>
            <div className="space-y-2">
              <Label>Ville</Label>
              <Input required value={form.ville} onChange={onChange("ville")} className="bg-background/50" />
            </div>
            <label className="flex items-start gap-2.5 text-xs text-muted-foreground cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                required
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border accent-primary cursor-pointer shrink-0"
              />
              <span>
                J'accepte les{" "}
                <Link to="/conditions-utilisation" target="_blank" className="text-primary hover:underline">
                  Conditions d'Utilisation
                </Link>{" "}
                et la{" "}
                <Link to="/politique-de-confidentialite" target="_blank" className="text-primary hover:underline">
                  Politique de Confidentialité
                </Link>{" "}
                de FIGDITIONS
              </span>
            </label>
            <Button type="submit" disabled={loading || !acceptedTerms}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold h-11">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Créer mon compte"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Déjà inscrit ?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">Se connecter</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
