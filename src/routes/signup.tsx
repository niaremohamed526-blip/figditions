import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, Suspense, useMemo, useEffect, type FormEvent } from "react";
import { lazyWithRetry } from "@/lib/lazy-retry";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Check, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { authErrorFr } from "@/lib/auth-errors";
import { PLANS } from "@/config/plans";
import { fcfa } from "@/lib/format";


const Ballpit = lazyWithRetry(() => import("@/components/Ballpit"));

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  validateSearch: (search: Record<string, unknown>): { plan?: "starter" | "pro" | "business" } => {
    if (search.plan == null) return {};
    const p = String(search.plan).toLowerCase();
    return { plan: p === "pro" || p === "business" ? p : "starter" };
  },

  head: () => ({
    meta: [
      { title: "Inscription | FIGDITIONS" },
      { name: "description", content: "Créez votre compte FIGDITIONS et digitalisez la gestion de votre maison d'édition : manuscrits, contrats, stocks et finances." },
      { property: "og:title", content: "Inscription | FIGDITIONS" },
      { property: "og:description", content: "Créez votre compte FIGDITIONS et digitalisez la gestion de votre maison d'édition : manuscrits, contrats, stocks et finances." },
      { name: "twitter:title", content: "Inscription | FIGDITIONS" },
      { name: "twitter:description", content: "Créez votre compte FIGDITIONS et digitalisez la gestion de votre maison d'édition : manuscrits, contrats, stocks et finances." },
      { property: "og:image", content: "https://figditions.xyz/assets/og-figditions.png" },
      { name: "twitter:image", content: "https://figditions.xyz/assets/og-figditions.png" },
      { property: "og:url", content: "https://figditions.xyz/signup" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://figditions.xyz/signup" }],
  }),
});

const MALI_CITIES = [
  "Bamako", "Sikasso", "Ségou", "Mopti", "Koutiala", "Kayes",
  "Gao", "Kati", "Tombouctou", "Koulikoro", "San", "Bougouni",
] as const;

function normalize(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function CitySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const isKnown = (MALI_CITIES as readonly string[]).includes(value);
  const [other, setOther] = useState(!isKnown && value.length > 0);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(
    () => MALI_CITIES.filter((c) => normalize(c).includes(normalize(query))),
    [query],
  );

  if (other) {
    return (
      <div className="space-y-2">
        <GoldInput
          id="ville"
          name="ville"
          required
          value={value}
          placeholder="Nom de votre ville"
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="text-xs hover:underline"
          style={{ color: "#C8922A" }}
          onClick={() => { setOther(false); onChange("Bamako"); }}
        >
          ← Choisir dans la liste
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <GoldInput
        id="ville"
        name="ville"
        autoComplete="off"
        required
        value={open ? query : value}
        placeholder="Rechercher une ville…"
        onFocus={() => { setQuery(""); setOpen(true); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <div
          className="absolute left-0 right-0 mt-1 rounded-lg overflow-hidden max-h-56 overflow-y-auto"
          style={{
            zIndex: 30,
            background: "rgba(13,10,6,0.97)",
            border: "1px solid rgba(200,146,42,0.25)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
          }}
        >
          {results.map((c) => (
            <button
              key={c}
              type="button"
              className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#C8922A]/15"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(c); setOpen(false); }}
            >
              {c}
            </button>
          ))}
          <button
            type="button"
            className="w-full text-left px-4 py-2 text-sm hover:bg-[#C8922A]/15"
            style={{ color: "#C8922A" }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { setOther(true); onChange(""); setOpen(false); }}
          >
            Autre…
          </button>
        </div>
      )}
    </div>
  );
}


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
      <div style={{ position: "fixed", inset: 0, zIndex: 0, background: "#0D0A06" }}>
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
          background: "radial-gradient(ellipse at center, rgba(13,10,6,0.3) 0%, rgba(13,10,6,0.7) 100%)",
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

function scorePassword(pwd: string) {
  let s = 0;
  if (pwd.length >= 6) s++;
  if (pwd.length >= 10) s++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) s++;
  if (/\d/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  return Math.min(s, 3);
}

function SignupPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { plan: planParam } = Route.useSearch();
  const selectedPlan = PLANS.find((p) => p.id === (planParam ?? "starter")) ?? PLANS[0];

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
    if (error) return toast.error(authErrorFr(error.message));
    toast.success("Compte créé !");
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
            boxShadow: "0 25px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(200,146,42,0.1)",
            pointerEvents: "auto",
          }}
        >
          <h1 style={{ color: "white", fontSize: 32, fontWeight: 700, marginBottom: 8 }}>
            Créer votre compte
          </h1>
          <p style={{ color: "#B8A898", fontSize: 15, marginBottom: 32 }}>
            Rejoignez les éditeurs africains
          </p>

          <div
            className="mb-6 flex items-center justify-between gap-3 rounded-xl px-4 py-3"
            style={{ background: "rgba(200,146,42,0.08)", border: "1px solid rgba(200,146,42,0.25)" }}
          >
            <p className="text-sm" style={{ color: "#E8D9C5", margin: 0 }}>
              Plan sélectionné : <strong style={{ color: "#C8922A" }}>{selectedPlan.name}</strong>
              {" | "}
              {selectedPlan.priceMonthly === 0 ? "Gratuit" : `${fcfa(selectedPlan.priceMonthly)} / mois`}
            </p>
            <a href="/#pricing" className="text-xs font-medium hover:underline shrink-0" style={{ color: "#C8922A" }}>
              Modifier
            </a>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name" className="text-white/90">Nom complet</Label>
              <GoldInput id="full_name" name="full_name" required value={form.full_name} placeholder="Votre nom complet" onChange={onChange("full_name")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entreprise_nom" className="text-white/90">Nom de la maison d'édition</Label>
              <GoldInput id="entreprise_nom" name="entreprise_nom" required value={form.entreprise_nom} placeholder="ex: Éditions Jamana" onChange={onChange("entreprise_nom")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/90">Email</Label>
              <GoldInput id="email" name="email" type="email" required value={form.email} placeholder="votre@email.com" onChange={onChange("email")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/90">Mot de passe</Label>
              <div className="relative">
                <GoldInput
                  id="password"
                  name="password"
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
              <Label htmlFor="confirm" className="text-white/90">Confirmer le mot de passe</Label>
              <div className="relative">
                <GoldInput
                  id="confirm"
                  name="confirm"
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
              <Label htmlFor="ville" className="text-white/90">Ville</Label>
              <CitySelect value={form.ville} onChange={(v) => setForm((f) => ({ ...f, ville: v }))} />
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
                <Link to="/conditions-utilisation" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: "#C8922A" }}>
                  Conditions d'Utilisation
                </Link>{" "}
                et la{" "}
                <Link to="/politique-de-confidentialite" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: "#C8922A" }}>
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

            <p className="text-center text-xs" style={{ color: "#B8A898" }}>
              Aucune carte bancaire requise. Vos manuscrits restent votre propriété exclusive.
            </p>

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
  );
}
