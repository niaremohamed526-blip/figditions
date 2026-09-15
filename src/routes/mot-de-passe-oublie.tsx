import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { authErrorFr } from "@/lib/auth-errors";

export const Route = createFileRoute("/mot-de-passe-oublie")({
  component: ForgotPasswordPage,
  head: () => ({
    meta: [
      { title: "Mot de passe oublié | FIGDITIONS" },
      { name: "description", content: "Réinitialisez votre mot de passe FIGDITIONS." },
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
    <div style={{ minHeight: "100vh", background: "#0D0A06", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Logo style={{ height: 60, width: "auto", margin: "0 auto 12px", display: "block", filter: "drop-shadow(0 0 24px rgba(200,146,42,0.8))" }} />
        </div>
        <div style={{ background: "rgba(13,10,6,0.85)", border: "1px solid rgba(200,146,42,0.25)", borderRadius: 24, padding: 40, backdropFilter: "blur(24px)" }}>
          <h1 style={{ color: "white", fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Mot de passe oublié</h1>
          <p style={{ color: "#B8A898", fontSize: 14, marginBottom: 28 }}>
            {sent
              ? "Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé."
              : "Entrez votre email pour recevoir un lien de réinitialisation."}
          </p>
          {!sent && (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-white/90">Email</Label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  className="w-full h-11 px-4 rounded-lg outline-none text-white placeholder:text-[#6b5a48] focus:ring-2 focus:ring-[#C8922A]/40"
                  style={{ background: "rgba(13,10,6,0.6)", border: "1px solid rgba(200,146,42,0.25)" }}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center font-semibold text-white transition-all hover:brightness-110 disabled:opacity-60"
                style={{ height: 48, borderRadius: 12, background: "linear-gradient(135deg, #C8922A, #A67420)" }}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Envoyer le lien"}
              </button>
            </form>
          )}
          <p className="text-center text-sm mt-6" style={{ color: "#B8A898" }}>
            <Link to="/login" className="font-medium hover:underline" style={{ color: "#C8922A" }}>
              Retour à la connexion
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
