import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Menu, X, BookOpen, Users, Package, Wallet, FileText, Calculator,
  Linkedin, Instagram, ArrowRight, Check,
  Factory, Shield, BarChart3, Store, Sparkles, Boxes, MousePointer2,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { useI18n } from "@/hooks/use-i18n";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CookieBanner } from "@/components/cookie-banner";
import figuiraLogo from "@/assets/figuira-logo.jpg";
const heroAsset = { url: "/assets/hero-figditions.png" };


export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "FIGDITIONS — Plateforme éditoriale africaine" },
      { name: "description", content: "Gérez manuscrits, stocks, contrats et finances depuis un tableau de bord unique. Conçu pour les maisons d'édition d'Afrique de l'Ouest." },
      { property: "og:title", content: "FIGDITIONS — Plateforme éditoriale africaine" },
      { property: "og:description", content: "La plateforme tout-en-un pour les maisons d'édition africaines." },
      { property: "og:url", content: "https://figditions.xyz/" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://figditions.xyz/" }],
  }),
});

function Landing() {
  return (
    <div className="min-h-screen bg-[#0A0704] text-foreground overflow-x-hidden">
      <Navbar />
      <Hero />
      <Features />
      <Partners />
      <HowItWorks />
      <Pricing />
      <CtaBanner />
      <Footer />
      <CookieBanner />
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

  const navLinks = [
    { label: t("Accueil", "Home"), href: "#top" },
    { label: t("Fonctionnalités", "Features"), href: "#features" },
    { label: t("Prix", "Pricing"), href: "#pricing" },
    { label: t("Contact", "Contact"), href: "#contact" },
  ];

  return (
    <header className={cn(
      "fixed top-0 inset-x-0 z-50 transition-all duration-300",
      scrolled ? "bg-[rgba(10,7,4,0.85)] backdrop-blur-xl border-b border-[rgba(200,146,42,0.15)]" : "bg-transparent"
    )}>
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-20 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center shrink-0">
          <Logo className="h-12 md:h-16 w-auto" style={{ filter: "drop-shadow(0 1px 6px rgba(0,0,0,0.35))" }} />
        </Link>

        <div className="hidden md:flex items-center gap-12 absolute left-1/2 -translate-x-1/2">
          {navLinks.map((l) => (
            <a key={l.label} href={l.href} className="text-[15px] text-white/80 hover:text-white transition-colors">
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3 ml-auto">
          <LangToggle lang={lang} setLang={setLang} />
          <Link
            to="/signup"
            className="group inline-flex items-center gap-2 rounded-full border border-[#C8922A] text-[#C8922A] px-6 py-2.5 text-sm font-medium hover:bg-[#C8922A] hover:text-white transition-colors"
          >
            {t("Démarrer l'Essai", "Start trial")}
            <span className="h-6 w-6 rounded-full bg-[#C8922A] text-white flex items-center justify-center group-hover:bg-white group-hover:text-[#C8922A] transition-colors">
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        </div>

        <button className="md:hidden p-2 ml-auto text-white" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {open && (
        <div className="md:hidden bg-[rgba(10,7,4,0.95)] backdrop-blur-xl border-b border-[rgba(200,146,42,0.2)] px-4 py-4 space-y-3 animate-fade-in">
          {navLinks.map((l) => (
            <a key={l.label} href={l.href} onClick={() => setOpen(false)} className="block text-sm font-medium text-white/80 hover:text-white py-2">
              {l.label}
            </a>
          ))}
          <LangToggle lang={lang} setLang={setLang} />
          <Link to="/login" onClick={() => setOpen(false)} className="block">
            <Button variant="outline" className="w-full">{t("Se connecter", "Sign in")}</Button>
          </Link>
          <Link to="/signup" onClick={() => setOpen(false)} className="block">
            <Button className="w-full bg-primary text-primary-foreground">{t("Démarrer l'Essai", "Start trial")}</Button>
          </Link>
        </div>
      )}
    </header>
  );
}


function LangToggle({ lang, setLang }: { lang: "fr" | "en"; setLang: (l: "fr" | "en") => void }) {
  return (
    <div className="inline-flex items-center rounded-full border border-[rgba(200,146,42,0.3)] bg-[rgba(26,18,8,0.6)] p-0.5 text-xs font-semibold">
      {(["fr", "en"] as const).map((l) => (
        <button key={l} onClick={() => setLang(l)} className={cn(
          "px-3 py-1.5 rounded-full transition-colors uppercase",
          lang === l ? "bg-[#C8922A] text-white" : "text-white/70 hover:text-white"
        )}>{l}</button>
      ))}
    </div>
  );
}

function Hero() {
  const { t } = useI18n();
  return (
    <section id="top" className="relative w-full min-h-screen overflow-hidden bg-[#0A0704]">
      {/* Warm golden ambient glow */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 80% at 65% 40%, rgba(180,110,20,0.35) 0%, rgba(140,80,10,0.2) 30%, transparent 70%)",
        }}
      />

      {/* Hero image — right side */}
      <img
        src={heroAsset.url}
        alt="FIGDITIONS — Plateforme éditoriale africaine"
        className="absolute inset-y-0 right-0 h-full w-full md:w-[70%] object-cover object-center pointer-events-none select-none"
        style={{
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%)",
          maskImage:
            "linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%)",
        }}
      />

      {/* Hero text — bottom left */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 pt-40 md:pt-0 md:absolute md:bottom-[20%] md:left-0 md:right-0">
        <div className="max-w-xl">
          <h1
            className="font-black text-white leading-[0.9] tracking-tight"
            style={{ fontSize: "clamp(48px, 8vw, 100px)", letterSpacing: "-3px" }}
          >
            FIGDITIONS
          </h1>
          <p className="mt-4 text-[18px] leading-[1.5] max-w-[380px]" style={{ color: "rgba(184,168,152,0.9)" }}>
            {t(
              "La plateforme centrale pour les éditeurs ouest-africains",
              "The central platform for West African publishers"
            )}
          </p>

          {/* CTA buttons */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/signup">
              <Button size="lg" className="bg-[#C8922A] text-white hover:bg-[#A67420] h-12 px-7 rounded-full">
                {t("Commencer gratuitement", "Get started")} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="border-[rgba(200,146,42,0.4)] text-white hover:border-[#C8922A] hover:text-[#C8922A] bg-transparent h-12 px-7 rounded-full">
                {t("Se connecter", "Sign in")}
              </Button>
            </Link>
          </div>

          {/* Social icons */}
          <div className="mt-8 flex items-center gap-5">
            {[
              { Icon: Instagram, href: "https://www.instagram.com/medmo_05?igsh=MTBxMHpueTBucHEyMQ%3D%3D&utm_source=qr", label: "Instagram" },
            ].map(({ Icon, href, label }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="text-[#6B5B4E] hover:text-[#C8922A] transition-colors"
              >
                <Icon className="h-5 w-5" />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Floating Manuscript Management card */}
      <div
        className="hidden lg:flex absolute z-10 flex-col gap-2 rounded-2xl border p-5 animate-[float_4s_ease-in-out_infinite]"
        style={{
          top: "22%",
          right: "5%",
          background: "rgba(26,18,8,0.85)",
          borderColor: "rgba(200,146,42,0.3)",
          backdropFilter: "blur(12px)",
          minWidth: "200px",
        }}
      >
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-[#C8922A]" />
          <span className="text-[#E8B84B] font-bold tracking-wide text-sm">MANUSCRIT MANAGEMENT</span>
        </div>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-white font-bold text-2xl">128</span>
          <span className="text-xs text-[rgba(184,168,152,0.8)]">manuscrits actifs</span>
        </div>
        <div className="space-y-1.5 mt-1">
          <div className="h-1.5 rounded-full bg-[rgba(200,146,42,0.25)] w-full" />
          <div className="h-1.5 rounded-full bg-[rgba(200,146,42,0.25)] w-4/5" />
          <div className="h-1.5 rounded-full bg-[rgba(200,146,42,0.25)] w-3/5" />
        </div>
        <div className="mt-2 h-px bg-[rgba(200,146,42,0.4)] w-2/3" />
      </div>

      {/* Floating Stock card */}
      <div
        className="hidden lg:flex absolute z-10 flex-col gap-2 rounded-2xl border p-5 animate-[float_4s_ease-in-out_2s_infinite]"
        style={{
          top: "20%",
          left: "5%",
          background: "rgba(26,18,8,0.85)",
          borderColor: "rgba(200,146,42,0.3)",
          backdropFilter: "blur(12px)",
          minWidth: "180px",
        }}
      >
        <div className="flex items-center gap-2">
          <Boxes className="h-5 w-5 text-[#C8922A]" />
          <span className="text-[#E8B84B] font-bold tracking-wide text-sm">STOCK</span>
        </div>
        <div className="text-white font-bold text-xl">50 634</div>
        <div className="flex items-end gap-1 h-8">
          {[40, 65, 50, 80, 35, 90, 60].map((h, i) => (
            <div key={i} className="w-2 rounded-sm bg-[#C8922A]" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <a
        href="#features"
        aria-label="Scroll"
        className="absolute left-1/2 -translate-x-1/2 bottom-8 z-10 animate-[scrollBounce_2s_infinite]"
        style={{ color: "rgba(200,146,42,0.6)" }}
      >
        <MousePointer2 className="h-8 w-8 rotate-180" />
      </a>


      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes scrollBounce {
          0%, 100% { transform: translate(-50%, 0); }
          50% { transform: translate(-50%, 8px); }
        }
      `}</style>
    </section>
  );
}


function Features() {
  const { t } = useI18n();
  const items = [
    { icon: BookOpen, fr: "Gestion des manuscrits", en: "Manuscript management", dfr: "Suivez chaque livre à travers 10 étapes éditoriales, de la réception à la publication", den: "Track every book through 10 editorial stages, from reception to publication" },
    { icon: Users, fr: "Gestion des auteurs", en: "Author management", dfr: "Centralisez les informations, contrats et droits de vos auteurs en un seul endroit", den: "Centralize information, contracts and royalties of your authors in one place" },
    { icon: Factory, fr: "Stock interne", en: "Internal stock", dfr: "Gérez votre entrepôt, suivez chaque exemplaire imprimé et automatisez les mouvements de stock", den: "Manage your warehouse, track every printed copy and automate stock movements" },
    { icon: Store, fr: "Stock externe", en: "External stock", dfr: "Suivez vos dépôts dans toutes les librairies de Bamako avec alertes de stock bas", den: "Track your deposits across all Bamako bookstores with low-stock alerts" },
    { icon: Wallet, fr: "Finances & Royalties", en: "Finances & Royalties", dfr: "Calculez et suivez les droits d'auteur automatiquement en FCFA", den: "Calculate and track author royalties automatically in FCFA" },
    { icon: FileText, fr: "Contrats OHADA", en: "OHADA Contracts", dfr: "Générez des contrats légaux conformes au droit malien en quelques clics", den: "Generate legal contracts compliant with Malian law in a few clicks" },
    { icon: Calculator, fr: "Estimateur de coûts", en: "Cost estimator", dfr: "Calculez le coût d'impression exact en FCFA avec recommandation offset vs numérique", den: "Calculate exact printing costs in FCFA with offset vs digital recommendation" },
    { icon: Shield, fr: "Partage PDF sécurisé", en: "Secure PDF sharing", dfr: "Partagez vos manuscrits avec des filigranes personnalisés et un nombre de vues limité", den: "Share manuscripts with custom watermarks and limited view counts" },
    { icon: Sparkles, fr: "Conversion ePub & MOBI", en: "ePub & MOBI conversion", dfr: "Convertissez vos manuscrits en ebooks prêts pour Amazon Kindle, Apple Books et Google Play Books", den: "Convert your manuscripts into ebooks ready for Amazon Kindle, Apple Books and Google Play Books" },
    { icon: BarChart3, fr: "Analytiques avancées", en: "Advanced analytics", dfr: "Tableaux de bord complets pour piloter votre maison d'édition avec des données en temps réel", den: "Complete dashboards to manage your publishing house with real-time data" },
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
              <div className="group h-full rounded-2xl border border-border bg-[#1A1208] p-6 transition-all duration-300 hover:border-[color:var(--gold)] hover:-translate-y-1 hover:shadow-[0_0_24px_-4px_var(--gold)]">
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

function Partners() {
  const { t } = useI18n();
  const socials = [
    { Icon: Facebook, href: "https://www.facebook.com/figuira", label: "Facebook" },
    { Icon: Linkedin, href: "https://www.linkedin.com/in/figuira-éditions-113118301/", label: "LinkedIn" },
    { Icon: Instagram, href: "https://www.instagram.com/figuiraeditions2", label: "Instagram" },
    { Icon: Youtube, href: "https://www.youtube.com/@figuira-editions9737", label: "YouTube" },
  ];
  return (
    <section id="partners" className="py-[60px] px-4 bg-[#1A1208]">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
            🤝 {t("Ils nous font confiance", "They trust us")}
          </h2>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            {t(
              "FIGDITIONS est fier de collaborer avec les meilleures maisons d'édition africaines",
              "FIGDITIONS is proud to collaborate with the best African publishing houses"
            )}
          </p>
        </div>

        <RevealOnScroll>
          <div className="max-w-2xl mx-auto rounded-2xl border-2 border-[color:var(--gold)] bg-[#0D0A06] p-8 md:p-10 text-center relative shadow-[0_0_40px_-10px_var(--gold)]">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-[color:var(--gold)] text-background shadow-glow">
                {t("Partenaire officiel ⭐", "Official partner ⭐")}
              </span>
            </div>

            <a
              href="https://figuiraeditions.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-4 transition-transform duration-300 hover:scale-105 hover:drop-shadow-[0_0_24px_rgba(232,184,75,0.6)]"
            >
              <img src={figuiraLogo} alt="Figuira Editions" style={{ height: "80px", width: "auto" }} className="mx-auto" />
            </a>

            <h3 className="mt-5 text-xl font-bold text-white tracking-wide">FIGUIRA ÉDITIONS</h3>
            <p className="mt-1 text-sm font-semibold text-primary">
              {t("En collaboration avec FIGDITIONS", "In collaboration with FIGDITIONS")}
            </p>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-lg mx-auto">
              {t(
                "Maison d'édition malienne fondée en 2019 par Fatoumata Keïta. Spécialisée dans la littérature générale et la jeunesse bilingue (français-langues nationales). Plus de 25 titres publiés par an.",
                "Malian publishing house founded in 2019 by Fatoumata Keïta. Specialized in general literature and bilingual youth (French-national languages). Over 25 titles published per year."
              )}
            </p>

            <div className="mt-5 flex items-center justify-center gap-3">
              {socials.map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="h-10 w-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-[color:var(--gold)] hover:border-[color:var(--gold)] transition-colors"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>

            <a href="https://figuiraeditions.org" target="_blank" rel="noopener noreferrer" className="inline-block mt-6">
              <Button
                variant="outline"
                className="border-[color:var(--gold)] text-[color:var(--gold)] hover:bg-[color:var(--gold)] hover:text-background"
              >
                {t("Visiter le site", "Visit the site")} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </div>
        </RevealOnScroll>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          {t("Vous êtes une maison d'édition ? Rejoignez nos partenaires.", "Are you a publishing house? Join our partners.")}{" "}
          <a href="mailto:contact@figditions.com" className="text-[color:var(--gold)] hover:underline font-semibold">
            {t("Nous contacter", "Contact us")}
          </a>
        </p>
      </div>
    </section>
  );
}

function HowItWorks() {
  const { t } = useI18n();
  const steps = [
    { emoji: "🏢", fr: "Créez votre compte", en: "Create your account", dfr: "Inscrivez votre maison d'édition en 2 minutes et invitez votre équipe", den: "Register your publishing house in 2 minutes and invite your team" },
    { emoji: "📥", fr: "Gérez vos manuscrits", en: "Manage your manuscripts", dfr: "Suivez chaque livre à travers les 10 étapes éditoriales avec votre équipe", den: "Track every book through the 10 editorial stages with your team" },
    { emoji: "📦", fr: "Contrôlez vos stocks", en: "Control your stocks", dfr: "Gérez votre entrepôt interne et vos dépôts dans les librairies de Bamako", den: "Manage your internal warehouse and your deposits in Bamako bookstores" },
    { emoji: "💸", fr: "Pilotez vos finances", en: "Pilot your finances", dfr: "Suivez vos ventes, calculez les droits d'auteur et analysez vos performances", den: "Track your sales, calculate royalties and analyze your performance" },
  ];
  return (
    <section className="py-24 px-4 bg-gradient-to-b from-[#1A1208] to-background">
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
        { ok: true, fr: "Tableau de bord", en: "Dashboard" },
        { ok: true, fr: "Jusqu'à 5 manuscrits (10 étapes éditoriales)", en: "Up to 5 manuscripts (10 editorial stages)" },
        { ok: true, fr: "Gestion des auteurs", en: "Author management" },
        { ok: true, fr: "Stock interne basique", en: "Basic internal stock" },
        { ok: true, fr: "Suivi des stocks (2 librairies max)", en: "Stock tracking (2 bookstores max)" },
        { ok: true, fr: "Estimateur de coûts FCFA", en: "FCFA cost estimator" },
        { ok: false, fr: "Contrats OHADA", en: "OHADA contracts" },
        { ok: false, fr: "Finances & Royalties", en: "Finances & Royalties" },
        { ok: false, fr: "Partage PDF sécurisé", en: "Secure PDF sharing" },
        { ok: false, fr: "Analytiques avancées", en: "Advanced analytics" },
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
        { ok: true, fr: "Tout ce qui est dans Starter", en: "Everything in Starter" },
        { ok: true, fr: "Manuscrits illimités", en: "Unlimited manuscripts" },
        { ok: true, fr: "Stock interne complet", en: "Complete internal stock" },
        { ok: true, fr: "Stocks illimités (librairies)", en: "Unlimited stocks (bookstores)" },
        { ok: true, fr: "Contrats OHADA + PDF", en: "OHADA contracts + PDF" },
        { ok: true, fr: "Finances & Royalties complètes", en: "Full Finances & Royalties" },
        { ok: true, fr: "Partage PDF sécurisé (10 liens/mois)", en: "Secure PDF sharing (10 links/month)" },
        { ok: true, fr: "Analytiques avancées", en: "Advanced analytics" },
        { ok: true, fr: "Répertoire des imprimeries", en: "Print directory" },
        { ok: false, fr: "Conversion ePub & MOBI", en: "ePub & MOBI conversion" },
        { ok: false, fr: "Support prioritaire", en: "Priority support" },
      ],
      cta: t("Choisir Pro", "Choose Pro"),
      ctaVariant: "default" as const,
      cardClass: "border-primary shadow-glow bg-gradient-to-b from-[#1A1208] to-[#0D0A06] lg:scale-105 lg:-my-2 relative",
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
        { ok: true, fr: "Tout ce qui est dans Pro", en: "Everything in Pro" },
        { ok: true, fr: "Utilisateurs illimités", en: "Unlimited users" },
        { ok: true, fr: "Partage PDF illimité", en: "Unlimited PDF sharing" },
        { ok: true, fr: "Conversion ePub & MOBI illimitée (Kindle, Apple Books)", en: "Unlimited ePub & MOBI conversion (Kindle, Apple Books)" },
        { ok: true, fr: "Assistant subventions", en: "Grants assistant" },
        { ok: true, fr: "Branding personnalisé", en: "Custom branding" },
        { ok: true, fr: "Support prioritaire 24/7", en: "Priority support 24/7" },
        { ok: true, fr: "Accès API", en: "API access" },
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
      <div className="max-w-6xl mx-auto rounded-3xl bg-[#1A1208] border border-border p-10 md:p-16 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-30"
             style={{ backgroundImage: "radial-gradient(circle at 20% 50%, oklch(0.72 0.14 75 / 0.3), transparent 50%), radial-gradient(circle at 80% 50%, oklch(0.82 0.16 80 / 0.2), transparent 50%)" }} />
        <div className="relative">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
            {t("Prêt à moderniser votre maison d'édition ?", "Ready to modernize your publishing house?")}
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            {t("Rejoignez les éditeurs africains qui font confiance à FIGDITIONS", "Join African publishers who trust FIGDITIONS")}
          </p>
          <Link to="/signup" className="inline-block mt-8">
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow text-base px-8 h-12">
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
  const scrollTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };
  return (
    <footer className="border-t border-border bg-card/40 py-12 px-4">
      <div className="max-w-7xl mx-auto grid sm:grid-cols-2 lg:grid-cols-5 gap-8 items-start">
        <div>
          <Logo
            className="h-[60px] w-auto"
            style={{ filter: "brightness(1.5) drop-shadow(0px 0px 12px rgba(232,184,75,0.5))" }}
          />
          <p
            className="mt-2 font-bold"
            style={{ color: "#E8B84B", fontSize: "20px", letterSpacing: "3px" }}
          >
            FIGDITIONS
          </p>
          <p className="mt-3 text-sm text-muted-foreground max-w-xs">
            {t("La plateforme éditoriale de l'Afrique de l'Ouest", "The publishing platform of West Africa")}
          </p>
        </div>


        <div>
          <h4 className="text-sm font-semibold mb-3">{t("Navigation", "Navigation")}</h4>
          <ul className="space-y-2 text-sm">
            <li><a href="#features" onClick={scrollTo("features")} className="text-muted-foreground hover:text-primary">{t("Fonctionnalités", "Features")}</a></li>
            <li><a href="#pricing" onClick={scrollTo("pricing")} className="text-muted-foreground hover:text-primary">{t("Tarifs", "Pricing")}</a></li>
            <li><a href="#partners" onClick={scrollTo("partners")} className="text-muted-foreground hover:text-primary">{t("Partenaires", "Partners")}</a></li>
            <li><Link to="/a-propos" className="text-muted-foreground hover:text-primary">{t("À propos", "About")}</Link></li>
            <li><a href="mailto:Figditions@gmail.com" className="text-muted-foreground hover:text-primary">Contact</a></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-3">{t("Légal", "Legal")}</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/politique-de-confidentialite" className="text-muted-foreground hover:text-primary">{t("Politique de confidentialité", "Privacy Policy")}</Link></li>
            <li><Link to="/conditions-utilisation" className="text-muted-foreground hover:text-primary">{t("Conditions d'utilisation", "Terms of Service")}</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-3">{t("Partenaires", "Partners")}</h4>
          <a
            href="https://figuiraeditions.org"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <img src={figuiraLogo} alt="Figuira Editions" style={{ height: "40px", width: "auto" }} />
            <span className="text-sm text-muted-foreground">Figuira Editions</span>
          </a>
        </div>

        <div className="flex md:justify-end gap-3">
          {[
            { Icon: Linkedin, href: "https://www.linkedin.com/in/figuira-éditions-113118301/", label: "LinkedIn" },
            { Icon: Instagram, href: "https://www.instagram.com/medmo_05?igsh=MTBxMHpueTBucHEyMQ%3D%3D&utm_source=qr", label: "Instagram" },
          ].map(({ Icon, href, label }) => (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="h-10 w-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-colors">
              <Icon className="h-4 w-4" />
            </a>
          ))}
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-border text-center text-xs text-muted-foreground space-y-1">
        <p>© 2025 FIGDITIONS. {t("Tous droits réservés.", "All rights reserved.")}</p>
        <p>{t("Conçu pour l'Afrique de l'Ouest 🌍", "Designed for West Africa 🌍")}</p>
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
