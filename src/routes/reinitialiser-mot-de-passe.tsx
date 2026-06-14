import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { authErrorFr } from "@/lib/auth-errors";

export const Route = createFileRoute("/reinitialiser-mot-de-passe")({
  component: ResetPasswordPage,
  head: () => ({
    meta: [{ title: "Nouveau mot de passe — FIGDITIONS" }],
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
    <div style={{ minHeight: "100vh", background: "#0D0A06", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Logo style={{ height: 60, width: "auto", margin: "0 auto 12px", display: "block", filter: "drop-shadow(0 0 24px rgba(200,146,42,0.8))" }} />
        </div>
        <div style={{ background: "rgba(13,10,6,0.85)", border: "1px solid rgba(200,146,42,0.25)", borderRadius: 24, padding: 40, backdropFilter: "blur(24px)" }}>
          <h1 style={{ color: "white", fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Nouveau mot de passe</h1>
          <p style={{ color: "#B8A898", fontSize: 14, marginBottom: 28 }}>
            Choisissez un nouveau mot de passe pour votre compte.
          </p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-white/90">Nouveau mot de passe</Label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 px-4 rounded-lg outline-none text-white placeholder:text-[#6b5a48] focus:ring-2 focus:ring-[#C8922A]/40"
                style={{ background: "rgba(13,10,6,0.6)", border: "1px solid rgba(200,146,42,0.25)" }}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/90">Confirmer</Label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
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
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mettre à jour"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
