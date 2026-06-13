import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, lazy, Suspense, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Logo } from "@/components/logo";

const Ballpit = lazy(() => import("@/components/Ballpit"));

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Connexion — FIGDITIONS" },
      { name: "description", content: "Connectez-vous à votre espace FIGDITIONS pour gérer manuscrits, contrats, stocks et ventes de votre maison d'édition." },
      { property: "og:title", content: "Connexion — FIGDITIONS" },
      { property: "og:description", content: "Accédez à votre espace éditorial FIGDITIONS." },
      { property: "og:url", content: "https://figditions.xyz/login" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://figditions.xyz/login" }],
  }),
});

const BALL_COLORS = [0xc8922a, 0xe8b84b, 0xa67420, 0xd4af37, 0xf5d07a, 0x6b4c10];

function BallpitPanel({ count = 100 }: { count?: number }) {
  return (
    <div className="hidden md:flex relative w-1/2 h-screen overflow-hidden" style={{ background: "#0D0A06" }}>
      <Suspense fallback={<div className="absolute inset-0" style={{ background: "#0D0A06" }} />}>
        <Ballpit
          count={count}
          gravity={0.3}
          friction={0.9975}
          wallBounce={0.95}
          followCursor
          colors={BALL_COLORS}
          ambientColor={0xc8922a}
          ambientIntensity={0.4}
          lightIntensity={120}
          minSize={0.2}
          maxSize={0.8}
        />
      </Suspense>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-8">
        <Logo className="h-24 w-auto mb-4" />
        <p
          className="font-medium"
          style={{ fontSize: 12, letterSpacing: 4, color: "#C8922A", marginTop: 12 }}
        >
          LA PLATEFORME ÉDITORIALE<br />DE L'AFRIQUE DE L'OUEST
        </p>
      </div>
    </div>
  );
}

function GoldInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        "w-full h-11 px-4 rounded-lg outline-none transition-all text-white placeholder:text-[#6b5a48] " +
        "focus:ring-2 focus:ring-[#C8922A]/40 " +
        (props.className ?? "")
      }
      style={{
        background: "rgba(13,10,6,0.6)",
        border: "1px solid rgba(200,146,42,0.25)",
        ...props.style,
      }}
    />
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
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
    <div className="min-h-screen flex" style={{ background: "#0D0A06" }}>
      <BallpitPanel count={100} />

      <div
        className="flex-1 md:w-1/2 flex items-center justify-center px-6 py-12 min-h-screen"
        style={{
          background:
            "radial-gradient(ellipse at top, rgba(200,146,42,0.10) 0%, #0D0A06 60%)",
          borderLeft: "1px solid rgba(200,146,42,0.1)",
        }}
      >
        <div className="w-full" style={{ maxWidth: 440 }}>
          <div className="md:hidden flex justify-center mb-8">
            <Logo className="h-20 w-auto" />
          </div>

          <div
            className="rounded-[20px] p-6 md:p-12"
            style={{
              background: "rgba(26,18,8,0.6)",
              border: "1px solid rgba(200,146,42,0.15)",
              backdropFilter: "blur(20px)",
            }}
          >
            <p
              className="font-semibold mb-6"
              style={{ color: "#C8922A", letterSpacing: 3, fontSize: 11 }}
            >
              FIGDITIONS
            </p>
            <h1 className="text-white font-bold" style={{ fontSize: 32 }}>
              Bon retour !
            </h1>
            <p style={{ color: "#B8A898", marginBottom: 40, marginTop: 4 }}>
              Connectez-vous à votre espace
            </p>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/90">Adresse email</Label>
                <GoldInput
                  id="email"
                  type="email"
                  required
                  value={email}
                  placeholder="votre@email.com"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/90">Mot de passe</Label>
                <div className="relative">
                  <GoldInput
                    id="password"
                    type={showPwd ? "text" : "password"}
                    required
                    value={password}
                    placeholder="••••••••"
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B8A898] hover:text-[#C8922A]"
                    aria-label={showPwd ? "Masquer" : "Afficher"}
                  >
                    {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="text-right">
                <Link
                  to="/login"
                  className="hover:underline"
                  style={{ color: "#C8922A", fontSize: 13 }}
                >
                  Mot de passe oublié ?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center font-semibold text-white transition-all hover:brightness-110 hover:-translate-y-px disabled:opacity-60"
                style={{
                  height: 48,
                  borderRadius: 12,
                  fontSize: 15,
                  background: "linear-gradient(135deg, #C8922A, #A67420)",
                  boxShadow: "0 4px 20px rgba(200,146,42,0.3)",
                }}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Se connecter"}
              </button>

              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px" style={{ background: "rgba(200,146,42,0.2)" }} />
                <span className="text-xs" style={{ color: "#B8A898" }}>ou</span>
                <div className="flex-1 h-px" style={{ background: "rgba(200,146,42,0.2)" }} />
              </div>

              <p className="text-center text-sm" style={{ color: "#B8A898" }}>
                Pas encore de compte ?{" "}
                <Link to="/signup" className="font-medium hover:underline" style={{ color: "#C8922A" }}>
                  S'inscrire
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
