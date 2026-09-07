import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, lazy, Suspense, useEffect, type FormEvent } from "react";
import { lazyWithRetry } from "@/lib/lazy-retry";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Logo } from "@/components/logo";
import { authErrorFr } from "@/lib/auth-errors";

const Ballpit = lazyWithRetry(() => import("@/components/Ballpit"));

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

const BALL_COLORS = [0xc8922a, 0xe8b84b, 0xa67420, 0xf5d07a, 0x8b6914];

function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return m;
}

function BallpitBackground() {
  const isMobile = useIsMobile();
  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          background: "#0D0A06",
        }}
      >
        <Suspense fallback={null}>
          <Ballpit
            count={isMobile ? 80 : 150}
            gravity={0.5}
            friction={0.9975}
            wallBounce={0.95}
            followCursor
            colors={BALL_COLORS}
            ambientColor={0xc8922a}
            ambientIntensity={0.5}
            lightIntensity={150}
            minSize={0.3}
            maxSize={0.9}
          />
        </Suspense>
      </div>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1,
          background:
            "radial-gradient(ellipse at center, rgba(13,10,6,0.3) 0%, rgba(13,10,6,0.7) 100%)",
          pointerEvents: "none",
        }}
      />
    </>
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
  const isMobile = useIsMobile();

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
    <div style={{ minHeight: "100vh", position: "relative", background: "#0D0A06" }}>
      <BallpitBackground />

      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          padding: 24,
          pointerEvents: "none",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 32, pointerEvents: "auto" }}>
          <Logo
            className="mx-auto"
            style={{
              height: isMobile ? 55 : 70,
              width: "auto",
              filter: "drop-shadow(0 0 24px rgba(200,146,42,0.8))",
              display: "block",
              margin: "0 auto 12px auto",
            }}
          />
          <p
            style={{
              color: "#C8922A",
              fontSize: 11,
              letterSpacing: 3,
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            La plateforme éditoriale de l'Afrique de l'Ouest
          </p>
        </div>

        <div
          style={{
            background: "rgba(13,10,6,0.85)",
            border: "1px solid rgba(200,146,42,0.25)",
            borderRadius: 24,
            padding: isMobile ? 32 : 48,
            width: isMobile ? "calc(100% - 32px)" : "100%",
            margin: isMobile ? 16 : 0,
            maxWidth: 440,
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            boxShadow:
              "0 25px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(200,146,42,0.1)",
            pointerEvents: "auto",
          }}
        >
          <h1 style={{ color: "white", fontSize: 32, fontWeight: 700, marginBottom: 8 }}>
            Bon retour !
          </h1>
          <p style={{ color: "#B8A898", fontSize: 15, marginBottom: 40 }}>
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
                to="/mot-de-passe-oublie"
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
  );
}
