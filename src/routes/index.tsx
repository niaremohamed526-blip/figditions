import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X, Star, BookOpen, Users, Package, Wallet, FileText, Calculator, Twitter, Linkedin, Facebook, ArrowRight, Check } from "lucide-react";
import { Logo } from "@/components/logo";
import { useI18n } from "@/hooks/use-i18n";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "FIGDITIONS — Plateforme éditoriale pour maisons d'édition africaines" },
      { name: "description", content: "Gérez vos manuscrits, stocks, contrats et finances depuis un seul tableau de bord. Conçu pour Bamako, pensé pour l'Afrique." },
      { property: "og:title", content: "FIGDITIONS — Plateforme éditoriale" },
      { property: "og:description", content: "La plateforme tout-en-un pour les maisons d'édition africaines." },
    ],
  }),
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Pricing />
      <CtaBanner />
      <Footer />
    </div>
  );
}

function Navbar() {
  const { t, lang, setLang } = useI18n();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cn(
      "fixed top-0 inset-x-0 z-50 transition-all duration-300",
      scrolled ? "bg-background/70 backdrop-blur-xl border-b border-border" : "bg-transparent"
    )}>
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Logo className="h-9 md:h-10 w-auto" />
        </Link>

        <div className="hidden md:flex items-center gap-3">
          <LangToggle lang={lang} setLang={setLang} />
          <Link to="/login">
            <Button variant="outline" className="border-border hover:border-primary hover:text-primary">
              {t("Se connecter", "Sign in")}
            </Button>
          </Link>
          <Link to="/signup">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow-sm">
              {t("Commencer gratuitement", "Get started free")}
            </Button>
          </Link>
        </div>

        <button className="md:hidden p-2" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {open && (
        <div className="md:hidden bg-background/95 backdrop-blur-xl border-b border-border px-4 py-4 space-y-3 animate-fade-in">
          <LangToggle lang={lang} setLang={setLang} />
          <Link to="/login" onClick={() => setOpen(false)} className="block">
            <Button variant="outline" className="w-full">{t("Se connecter", "Sign in")}</Button>
          </Link>
          <Link to="/signup" onClick={() => setOpen(false)} className="block">
            <Button className="w-full bg-primary text-primary-foreground">{t("Commencer gratuitement", "Get started free")}</Button>
          </Link>
        </div>
      )}
    </header>
  );
}

function LangToggle({ lang, setLang }: { lang: "fr" | "en"; setLang: (l: "fr" | "en") => void }) {
  return (
    <div className="inline-flex items-center rounded-full border border-border bg-card p-0.5 text-xs font-semibold">
      {(["fr", "en"] as const).map((l) => (
        <button key={l} onClick={() => setLang(l)} className={cn(
          "px-3 py-1.5 rounded-full transition-colors uppercase",
          lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
        )}>{l}</button>
      ))}
    </div>
  );
}

function Hero() {
  const { t } = useI18n();
  const scrollToFeatures = () => {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  };
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-24 pb-16 px-4 overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0A1628] via-[#0D2137] to-[#0A1628]" />
        <div className="absolute inset-0 opacity-40"
             style={{ backgroundImage: "radial-gradient(circle at 20% 30%, oklch(0.78 0.17 165 / 0.25), transparent 50%), radial-gradient(circle at 80% 70%, oklch(0.78 0.13 88 / 0.18), transparent 55%)" }} />
        <div className="absolute inset-0 opacity-[0.07]"
             style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        {/* Floating particles */}
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i}
            className="absolute rounded-full bg-primary/40 animate-float-particle"
            style={{
              width: `${4 + (i % 4)}px`,
              height: `${4 + (i % 4)}px`,
              left: `${(i * 53) % 100}%`,
              top: `${(i * 37) % 100}%`,
              animationDelay: `${(i * 0.4) % 6}s`,
              animationDuration: `${8 + (i % 6)}s`,
            }}
          />
        ))}
      </div>

      <div className="max-w-5xl mx-auto text-center animate-fade-up">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-6">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          {t("Conçu à Bamako 🇲🇱", "Built in Bamako 🇲🇱")}
        </span>
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]">
          {t("La plateforme tout-en-un pour les ", "The all-in-one platform for ")}
          <span className="bg-gradient-to-r from-primary to-[color:var(--gold)] bg-clip-text text-transparent">
            {t("maisons d'édition africaines", "African publishing houses")}
          </span>
        </h1>
        <p className="mt-6 text-base sm:text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
          {t(
            "Gérez vos manuscrits, vos stocks, vos contrats et vos finances depuis un seul tableau de bord. Conçu pour Bamako, pensé pour l'Afrique.",
            "Manage your manuscripts, stocks, contracts and finances from one single dashboard. Built for Bamako, made for Africa."
          )}
        </p>
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/signup">
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow text-base h-12 px-7">
              {t("Commencer gratuitement", "Get started for free")} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Button size="lg" variant="outline" onClick={scrollToFeatures} className="border-border hover:border-primary hover:text-primary text-base h-12 px-7">
            {t("Voir la démo", "Watch demo")}
          </Button>
        </div>
        <div className="mt-10 flex flex-col items-center gap-2">
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-[color:var(--gold)] text-[color:var(--gold)]" />)}
          </div>
          <p className="text-sm text-muted-foreground">
            {t("Déjà plus de 10 maisons d'édition nous font confiance", "Already trusted by 10+ publishing houses")}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes float-particle {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.4; }
          50% { transform: translateY(-30px) translateX(15px); opacity: 0.8; }
        }
        .animate-float-particle { animation: float-particle var(--d, 10s) ease-in-out infinite; }
      `}</style>
    </section>
  );
}

function Features() {
  const { t } = useI18n();
  const items = [
    { icon: BookOpen, fr: "Gestion des manuscrits", en: "Manuscript management", dfr: "Suivez chaque livre de la réception à la publication", den: "Track every book from reception to publication" },
    { icon: Users, fr: "Gestion des auteurs", en: "Author management", dfr: "Centralisez les informations et droits de vos auteurs", den: "Centralize your authors information and royalties" },
    { icon: Package, fr: "Suivi des stocks", en: "Stock tracking", dfr: "Suivez vos dépôts dans toutes les librairies de Bamako", den: "Track your deposits across all Bamako bookstores" },
    { icon: Wallet, fr: "Finances & Royalties", en: "Finances & Royalties", dfr: "Calculez et payez les droits d'auteur automatiquement", den: "Calculate and pay author royalties automatically" },
    { icon: FileText, fr: "Contrats OHADA", en: "OHADA Contracts", dfr: "Générez des contrats légaux conformes au droit malien", den: "Generate legal contracts compliant with Malian law" },
    { icon: Calculator, fr: "Estimateur de coûts", en: "Cost estimator", dfr: "Calculez le coût d'impression exact en FCFA à Bamako", den: "Calculate exact printing costs in FCFA in Bamako" },
  ];
  return (
    <section id="features" className="py-24 px-4 bg-background relative">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">{t("Tout ce dont vous avez besoin", "Everything you need")}</h2>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            {t("Une suite complète pour gérer chaque étape de votre maison d'édition.", "A complete suite to manage every step of your publishing house.")}
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((f, i) => (
            <RevealOnScroll key={i} delay={i * 80}>
              <div className="group h-full rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:border-primary/50 hover:-translate-y-1 hover:shadow-glow">
                <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 font-semibold text-lg">{t(f.fr, f.en)}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{t(f.dfr, f.den)}</p>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const { t } = useI18n();
  const steps = [
    { emoji: "🏢", fr: "Créez votre compte", en: "Create your account", dfr: "Inscrivez votre maison d'édition en 2 minutes", den: "Register your publishing house in 2 minutes" },
    { emoji: "📥", fr: "Ajoutez vos données", en: "Add your data", dfr: "Importez vos auteurs, manuscrits et stocks existants", den: "Import your existing authors, manuscripts and stocks" },
    { emoji: "📊", fr: "Gérez tout en un endroit", en: "Manage everything", dfr: "Utilisez le tableau de bord pour tout piloter", den: "Use the dashboard to manage everything" },
    { emoji: "💸", fr: "Développez votre maison", en: "Grow your house", dfr: "Prenez de meilleures décisions grâce aux données", den: "Make better decisions with your data" },
  ];
  return (
    <section className="py-24 px-4 bg-gradient-to-b from-background to-[#0D2137]">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">{t("Comment ça marche ?", "How it works?")}</h2>
        </div>
        <div className="relative grid md:grid-cols-4 gap-8 md:gap-4">
          <div className="hidden md:block absolute top-7 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-primary/0 via-primary/40 to-primary/0" />
          {steps.map((s, i) => (
            <RevealOnScroll key={i} delay={i * 120}>
              <div className="relative text-center">
                <div className="mx-auto h-14 w-14 rounded-full bg-primary text-primary-foreground font-bold text-lg flex items-center justify-center shadow-glow relative z-10">
                  {i + 1}
                </div>
                <div className="text-3xl mt-4">{s.emoji}</div>
                <h3 className="mt-2 font-semibold">{t(s.fr, s.en)}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t(s.dfr, s.den)}</p>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const { t } = useI18n();
  const [yearly, setYearly] = useState(false);

  const tiers = [
    {
      key: "starter",
      badge: t("Gratuit", "Free"),
      title: "Starter",
      subtitle: t("Pour démarrer votre maison d'édition", "To start your publishing house"),
      monthly: 0, yearly: 0,
      features: [
        { ok: true, fr: "1 compte utilisateur", en: "1 user account" },
        { ok: true, fr: "Jusqu'à 5 manuscrits", en: "Up to 5 manuscripts" },
        { ok: true, fr: "Suivi des stocks (2 librairies max)", en: "Stock tracking (2 bookstores max)" },
        { ok: true, fr: "Estimateur de coûts", en: "Cost estimator" },
        { ok: false, fr: "Générateur de contrats", en: "Contract generator" },
        { ok: false, fr: "Module finances & royalties", en: "Finances & royalties" },
        { ok: false, fr: "Export ePub", en: "ePub export" },
        { ok: false, fr: "Support prioritaire", en: "Priority support" },
      ],
      cta: t("Commencer gratuitement", "Get started for free"),
      ctaVariant: "outline" as const,
      cardClass: "border-border bg-card",
      btnClass: "border-primary text-primary hover:bg-primary hover:text-primary-foreground",
    },
    {
      key: "pro",
      badge: t("Le plus populaire ⭐", "Most popular ⭐"),
      title: "Pro",
      subtitle: t("Pour les maisons d'édition en croissance", "For growing publishing houses"),
      monthly: 20000, yearly: 200000,
      features: [
        { ok: true, fr: "Jusqu'à 3 comptes utilisateurs", en: "Up to 3 user accounts" },
        { ok: true, fr: "Manuscrits illimités", en: "Unlimited manuscripts" },
        { ok: true, fr: "Stocks illimités", en: "Unlimited stocks" },
        { ok: true, fr: "Estimateur de coûts", en: "Cost estimator" },
        { ok: true, fr: "Générateur de contrats OHADA", en: "OHADA contract generator" },
        { ok: true, fr: "Module finances & royalties", en: "Finances & royalties" },
        { ok: true, fr: "Export PDF", en: "PDF export" },
        { ok: false, fr: "Export ePub", en: "ePub export" },
        { ok: false, fr: "Support prioritaire", en: "Priority support" },
      ],
      cta: t("Choisir Pro", "Choose Pro"),
      ctaVariant: "default" as const,
      cardClass: "border-primary shadow-glow bg-gradient-to-b from-[#0D2137] to-[#0A1628] lg:scale-105 lg:-my-2 relative",
      btnClass: "bg-primary text-primary-foreground hover:bg-primary/90",
      highlighted: true,
    },
    {
      key: "business",
      badge: t("Complet", "Complete"),
      title: "Business",
      subtitle: t("Pour les grandes maisons d'édition", "For large publishing houses"),
      monthly: 50000, yearly: 500000,
      features: [
        { ok: true, fr: "Utilisateurs illimités", en: "Unlimited users" },
        { ok: true, fr: "Manuscrits illimités", en: "Unlimited manuscripts" },
        { ok: true, fr: "Stocks illimités", en: "Unlimited stocks" },
        { ok: true, fr: "Estimateur de coûts", en: "Cost estimator" },
        { ok: true, fr: "Générateur de contrats OHADA", en: "OHADA contract generator" },
        { ok: true, fr: "Module finances & royalties", en: "Finances & royalties" },
        { ok: true, fr: "Export PDF + ePub", en: "PDF + ePub export" },
        { ok: true, fr: "Assistant subventions", en: "Grants assistant" },
        { ok: true, fr: "Branding personnalisé", en: "Custom branding" },
        { ok: true, fr: "Support prioritaire", en: "Priority support" },
      ],
      cta: t("Choisir Business", "Choose Business"),
      ctaVariant: "default" as const,
      cardClass: "border-[color:var(--gold)]/60 shadow-[0_0_30px_-10px_var(--gold)] bg-card",
      btnClass: "bg-[color:var(--gold)] text-background hover:bg-[color:var(--gold)]/90",
    },
  ];

  return (
    <section id="pricing" className="py-24 px-4 bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">{t("Des tarifs adaptés à votre maison", "Pricing for every publishing house")}</h2>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            {t("Commencez gratuitement, évoluez quand vous êtes prêt.", "Start for free, upgrade when you're ready.")}
          </p>

          <div className="mt-8 inline-flex items-center gap-3">
            <div className="inline-flex items-center rounded-full border border-border bg-card p-1">
              <button onClick={() => setYearly(false)} className={cn(
                "px-4 py-1.5 rounded-full text-sm font-semibold transition-colors",
                !yearly ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}>{t("Mensuel", "Monthly")}</button>
              <button onClick={() => setYearly(true)} className={cn(
                "px-4 py-1.5 rounded-full text-sm font-semibold transition-colors",
                yearly ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}>{t("Annuel", "Yearly")}</button>
            </div>
            {yearly && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/15 text-primary border border-primary/30 animate-fade-in">
                {t("2 mois offerts 🎉", "2 months free 🎉")}
              </span>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {tiers.map((tier) => {
            const monthlyEquivalent = yearly ? Math.round(tier.yearly / 12) : tier.monthly;
            const savings = tier.monthly * 12 - tier.yearly;
            return (
              <div key={tier.key} className={cn("rounded-2xl border p-7 flex flex-col transition-all duration-300", tier.cardClass)}>
                {tier.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-[color:var(--gold)] text-background shadow-glow">
                      {tier.badge}
                    </span>
                  </div>
                )}
                {!tier.highlighted && (
                  <span className={cn(
                    "self-start text-xs font-semibold border rounded-full px-2.5 py-0.5 mb-3",
                    tier.key === "business" ? "bg-[color:var(--gold)]/15 text-[color:var(--gold)] border-[color:var(--gold)]/30"
                      : "bg-muted text-muted-foreground border-border",
                  )}>{tier.badge}</span>
                )}
                <h3 className="text-2xl font-bold">{tier.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{tier.subtitle}</p>

                <div className="mt-5">
                  {tier.monthly === 0 ? (
                    <p className="text-4xl font-bold">{t("0 FCFA", "0 FCFA")}<span className="text-sm font-normal text-muted-foreground"> / {t("mois", "month")}</span></p>
                  ) : (
                    <>
                      <p className="text-4xl font-bold">{monthlyEquivalent.toLocaleString("fr-FR")} <span className="text-sm font-normal text-muted-foreground">FCFA / {t("mois", "month")}</span></p>
                      {yearly ? (
                        <p className="mt-1 text-xs text-primary font-semibold">
                          {tier.yearly.toLocaleString("fr-FR")} FCFA / {t("an", "year")} · {t("Économisez", "Save")} {savings.toLocaleString("fr-FR")} FCFA
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("ou", "or")} {tier.yearly.toLocaleString("fr-FR")} FCFA / {t("an", "year")}
                        </p>
                      )}
                    </>
                  )}
                </div>

                <ul className="mt-6 space-y-2.5 text-sm flex-1">
                  {tier.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      {f.ok
                        ? <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        : <X className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                      <span className={f.ok ? "" : "text-muted-foreground line-through"}>{t(f.fr, f.en)}</span>
                    </li>
                  ))}
                </ul>

                <Link to="/signup" className="mt-7 block">
                  <Button className={cn("w-full h-11", tier.btnClass)} variant={tier.ctaVariant === "outline" ? "outline" : "default"}>
                    {tier.cta}
                  </Button>
                </Link>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          {t(
            "Pas de carte bancaire requise · Annulez à tout moment · Paiement via Orange Money ou Moov Money",
            "No credit card required · Cancel anytime · Pay with Orange Money or Moov Money"
          )}
        </p>
      </div>
    </section>
  );
}

function CtaBanner() {
  const { t } = useI18n();
  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto rounded-3xl bg-[#0D2137] border border-border p-10 md:p-16 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-30"
             style={{ backgroundImage: "radial-gradient(circle at 20% 50%, oklch(0.78 0.17 165 / 0.3), transparent 50%), radial-gradient(circle at 80% 50%, oklch(0.78 0.13 88 / 0.2), transparent 50%)" }} />
        <div className="relative">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
            {t("Prêt à moderniser votre maison d'édition ?", "Ready to modernize your publishing house?")}
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            {t("Rejoignez les éditeurs africains qui font confiance à FIGDITIONS", "Join African publishers who trust FIGDITIONS")}
          </p>
          <Link to="/signup" className="inline-block mt-8">
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow h-13 text-base px-8 h-12">
              {t("Commencer gratuitement", "Get started for free")} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-border bg-card/40 py-12 px-4">
      <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-8 items-start">
        <div>
          <Logo className="h-10 w-auto" />
          <p className="mt-3 text-sm text-muted-foreground max-w-xs">
            {t("La plateforme éditoriale de l'Afrique de l'Ouest", "The publishing platform of West Africa")}
          </p>
        </div>
        <div className="flex md:justify-center gap-6 text-sm">
          <Link to="/login" className="text-muted-foreground hover:text-primary">{t("Connexion", "Sign in")}</Link>
          <Link to="/signup" className="text-muted-foreground hover:text-primary">{t("Inscription", "Sign up")}</Link>
          <a href="mailto:contact@figditions.com" className="text-muted-foreground hover:text-primary">Contact</a>
        </div>
        <div className="flex md:justify-end gap-3">
          {[Twitter, Linkedin, Facebook].map((Icon, i) => (
            <a key={i} href="#" aria-label="social" className="h-10 w-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-colors">
              <Icon className="h-4 w-4" />
            </a>
          ))}
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-border text-center text-xs text-muted-foreground">
        © 2025 FIGDITIONS. {t("Tous droits réservés.", "All rights reserved.")}
      </div>
    </footer>
  );
}

function RevealOnScroll({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const [visible, setVisible] = useState(false);
  const [ref, setRef] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ref) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); io.disconnect(); }
    }, { threshold: 0.15 });
    io.observe(ref);
    return () => io.disconnect();
  }, [ref]);
  return (
    <div ref={setRef} style={{ transitionDelay: `${delay}ms` }}
      className={cn("transition-all duration-700", visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6")}>
      {children}
    </div>
  );
}
