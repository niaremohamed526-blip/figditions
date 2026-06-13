import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, lazy, Suspense, useMemo, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Check, X } from "lucide-react";
import { Logo } from "@/components/logo";

const Ballpit = lazy(() => import("@/components/Ballpit"));

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  head: () => ({
    meta: [
      { title: "Inscription — FIGDITIONS" },
      { name: "description", content: "Créez votre compte FIGDITIONS et digitalisez la gestion de votre maison d'édition : manuscrits, contrats, stocks et finances." },
      { property: "og:title", content: "Inscription — FIGDITIONS" },
      { property: "og:description", content: "Créez votre compte FIGDITIONS pour votre maison d'édition." },
      { property: "og:url", content: "https://figditions.xyz/signup" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://figditions.xyz/signup" }],
  }),
});

const BALL_COLORS = [0xc8922a, 0xe8b84b, 0xa67420, 0xd4af37, 0xf5d07a, 0x6b4c10];

function BallpitPanel() {
  return (
    <div className="hidden md:flex relative w-1/2 h-screen sticky top-0 overflow-hidden" style={{ background: "#0D0A06" }}>
      <Suspense fallback={<div className="absolute inset-0" style={{ background: "#0D0A06" }} />}>
        <Ballpit
          count={120}
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
        <p className="font-medium" style={{ fontSize: 12, letterSpacing: 4, color: "#C8922A", marginTop: 12 }}>
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

function scorePassword(pwd: string) {
  let s = 0;
  if (pwd.length >= 6) s++;
  if (pwd.length >= 10) s++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) s++;
  if (/\d/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  return Math.min(s, 3); // 0..3
}

function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    entreprise_nom: "",
    email: "",
    password: "",
    confirm: "",
    ville: "Bamako",
  });
  const [showPwd, setShowPwd] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const onChange = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const strength = useMemo(() => scorePassword(form.password), [form.password]);
  const strengthLabel = ["Faible", "Faible", "Moyen", "Fort"][strength];
  const strengthColor = ["#EF4444", "#EF4444", "#F59E0B", "#C8922A"][strength];
  const match = form.confirm.length > 0 && form.password === form.confirm;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!accepted) return toast.error("Vous devez accepter les conditions d'utilisation");
    if (!match) return toast.error("Les mots de passe ne correspondent pas");
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
    <div className="min-h-screen flex" style={{ background: "#0D0A06" }}>
      <BallpitPanel />

      <div
        className="flex-1 md:w-1/2 flex items-center justify-center px-6 py-12 min-h-screen"
        style={{
          background: "radial-gradient(ellipse at top, rgba(200,146,42,0.10) 0%, #0D0A06 60%)",
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
            <p className="font-semibold mb-6" style={{ color: "#C8922A", letterSpacing: 3, fontSize: 11 }}>
              FIGDITIONS
            </p>
            <h1 className="text-white font-bold" style={{ fontSize: 32 }}>
              Créer votre compte
            </h1>
            <p style={{ color: "#B8A898", marginBottom: 32, marginTop: 4 }}>
              Rejoignez les éditeurs africains
            </p>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-white/90">Nom complet</Label>
                <GoldInput required value={form.full_name} placeholder="Votre nom complet" onChange={onChange("full_name")} />
              </div>
              <div className="space-y-2">
                <Label className="text-white/90">Nom de la maison d'édition</Label>
                <GoldInput required value={form.entreprise_nom} placeholder="ex: Éditions Jamana" onChange={onChange("entreprise_nom")} />
              </div>
              <div className="space-y-2">
                <Label className="text-white/90">Email</Label>
                <GoldInput type="email" required value={form.email} placeholder="votre@email.com" onChange={onChange("email")} />
              </div>

              <div className="space-y-2">
                <Label className="text-white/90">Mot de passe</Label>
                <div className="relative">
                  <GoldInput
                    type={showPwd ? "text" : "password"}
                    required
                    minLength={6}
                    value={form.password}
                    placeholder="••••••••"
                    onChange={onChange("password")}
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B8A898] hover:text-[#C8922A]"
                  >
                    {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {form.password.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(200,146,42,0.15)" }}>
                      <div
                        className="h-full transition-all"
                        style={{ width: `${((strength + 1) / 4) * 100}%`, background: strengthColor }}
                      />
                    </div>
                    <span className="text-xs font-medium" style={{ color: strengthColor }}>{strengthLabel}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-white/90">Confirmer le mot de passe</Label>
                <div className="relative">
                  <GoldInput
                    type={showPwd ? "text" : "password"}
                    required
                    value={form.confirm}
                    placeholder="••••••••"
                    onChange={onChange("confirm")}
                    style={{ paddingRight: 44 }}
                  />
                  {form.confirm.length > 0 && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      {match ? <Check size={18} className="text-[#C8922A]" /> : <X size={18} className="text-red-500" />}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-white/90">Ville</Label>
                <GoldInput required value={form.ville} placeholder="Bamako" onChange={onChange("ville")} />
              </div>

              <label className="flex items-start gap-2.5 text-xs cursor-pointer select-none pt-1" style={{ color: "#B8A898" }}>
                <input
                  type="checkbox"
                  required
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded cursor-pointer shrink-0"
                  style={{ accentColor: "#C8922A" }}
                />
                <span>
                  J'accepte les{" "}
                  <Link to="/conditions-utilisation" target="_blank" className="hover:underline" style={{ color: "#C8922A" }}>
                    Conditions d'Utilisation
                  </Link>{" "}
                  et la{" "}
                  <Link to="/politique-de-confidentialite" target="_blank" className="hover:underline" style={{ color: "#C8922A" }}>
                    Politique de Confidentialité
                  </Link>
                </span>
              </label>

              <button
                type="submit"
                disabled={loading || !accepted}
                className="w-full inline-flex items-center justify-center font-semibold text-white transition-all hover:brightness-110 hover:-translate-y-px disabled:opacity-60"
                style={{
                  height: 48,
                  borderRadius: 12,
                  fontSize: 15,
                  background: "linear-gradient(135deg, #C8922A, #A67420)",
                  boxShadow: "0 4px 20px rgba(200,146,42,0.3)",
                }}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Créer mon compte"}
              </button>

              <p className="text-center text-sm pt-2" style={{ color: "#B8A898" }}>
                Déjà un compte ?{" "}
                <Link to="/login" className="font-medium hover:underline" style={{ color: "#C8922A" }}>
                  Se connecter
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
