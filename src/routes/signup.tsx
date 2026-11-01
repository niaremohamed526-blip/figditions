import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Check, X } from "lucide-react";
import { authErrorFr } from "@/lib/auth-errors";
import { PLANS } from "@/config/plans";
import { fcfa } from "@/lib/format";
import { AuthShell, AuthInput, authButtonClass, authLinkClass } from "@/components/auth-shell";



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
      { property: "og:image", content: "https://figditions.xyz/assets/og-figditions.jpg" },
      { name: "twitter:image", content: "https://figditions.xyz/assets/og-figditions.jpg" },
      { property: "og:url", content: "https://figditions.xyz/signup" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://figditions.xyz/signup" }],
  }),
});

// Suggestions only: any city can be typed.
const CITIES = [
  "Bamako", "Abidjan", "Dakar", "Accra", "Ouagadougou", "Conakry", "Niamey",
  "Lomé", "Cotonou", "Lagos", "Douala", "Yaoundé", "Libreville", "Kinshasa",
  "Casablanca", "Tunis", "Nairobi", "Kigali", "Paris", "Bruxelles", "Genève",
  "Montréal", "Londres", "New York", "Sikasso", "Ségou", "Kayes", "Mopti",
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
  const isKnown = (CITIES as readonly string[]).includes(value);
  const [other, setOther] = useState(!isKnown && value.length > 0);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(
    () => CITIES.filter((c) => normalize(c).includes(normalize(query))),
    [query],
  );

  if (other) {
    return (
      <div className="space-y-2">
        <AuthInput
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
          onClick={() => { setOther(false); onChange(""); }}
        >
          ← Choisir dans la liste
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <AuthInput
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
          className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-md border border-white/15 bg-[#0D0A06] shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
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
          {query.trim() && !results.some((c) => normalize(c) === normalize(query.trim())) ? (
            <button
              type="button"
              className="w-full text-left px-4 py-2 text-sm hover:bg-[#C8922A]/15"
              style={{ color: "#C8922A" }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(query.trim()); setOpen(false); }}
            >
              Utiliser « {query.trim()} »
            </button>
          ) : (
            <button
              type="button"
              className="w-full text-left px-4 py-2 text-sm hover:bg-[#C8922A]/15"
              style={{ color: "#C8922A" }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setOther(true); onChange(""); setOpen(false); }}
            >
              Autre ville…
            </button>
          )}
        </div>
      )}
    </div>
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
  const { plan: planParam } = Route.useSearch();
  const selectedPlan = PLANS.find((p) => p.id === (planParam ?? "starter")) ?? PLANS[0];

  const [form, setForm] = useState({
    full_name: "",
    entreprise_nom: "",
    email: "",
    password: "",
    confirm: "",
    ville: "",
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
    <AuthShell
      kicker="Inscription"
      title={<>Créez votre <em className="italic text-[#E8B84B]">maison.</em></>}
      intro="Deux minutes, sans carte bancaire. Vos manuscrits restent votre propriété exclusive."
    >
          <div className="mb-8 flex items-baseline justify-between gap-3 border-y border-white/10 py-4">
            <p className="text-sm text-[#B8A898] m-0">
              Plan <span className="font-wordmark-serif text-xl text-white">{selectedPlan.name}</span>
              <span className="mx-2 text-white/25">·</span>
              {selectedPlan.priceMonthly === 0 ? "Gratuit" : `${fcfa(selectedPlan.priceMonthly)} / mois`}
            </p>
            <a href="/#pricing" className="text-[13px] text-[#8C7B6B] hover:text-white transition-colors shrink-0">
              Modifier
            </a>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="full_name" className="text-white/90">Nom complet</Label>
              <AuthInput id="full_name" name="full_name" required value={form.full_name} placeholder="Votre nom complet" onChange={onChange("full_name")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entreprise_nom" className="text-white/90">Nom de la maison d'édition</Label>
              <AuthInput id="entreprise_nom" name="entreprise_nom" required value={form.entreprise_nom} placeholder="ex: Éditions Jamana" onChange={onChange("entreprise_nom")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/90">Email</Label>
              <AuthInput id="email" name="email" type="email" required value={form.email} placeholder="votre@email.com" onChange={onChange("email")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/90">Mot de passe</Label>
              <div className="relative">
                <AuthInput
                  id="password"
                  name="password"
                  type={showPwd ? "text" : "password"}
                  required
                  minLength={6}
                  value={form.password}
                  placeholder="••••••••"
                  onChange={onChange("password")}
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
              {form.password.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full overflow-hidden bg-white/10">
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
                <AuthInput
                  id="confirm"
                  name="confirm"
                  type={showPwd ? "text" : "password"}
                  required
                  value={form.confirm}
                  placeholder="••••••••"
                  onChange={onChange("confirm")}
                  className="pr-11"
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
                <Link to="/conditions-utilisation" target="_blank" rel="noopener noreferrer" className={authLinkClass}>
                  Conditions d'Utilisation
                </Link>{" "}
                et la{" "}
                <Link to="/politique-de-confidentialite" target="_blank" rel="noopener noreferrer" className={authLinkClass}>
                  Politique de Confidentialité
                </Link>
              </span>
            </label>

            <button type="submit" disabled={loading || !accepted} className={authButtonClass + " mt-2"}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Créer mon compte"}
            </button>

            <p className="pt-6 border-t border-white/10 text-sm text-[#8C7B6B]">
              Déjà un compte ?{" "}
              <Link to="/login" className={authLinkClass}>
                Se connecter
              </Link>
            </p>
          </form>
    </AuthShell>
  );
}
