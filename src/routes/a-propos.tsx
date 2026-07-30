import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Mail, MapPin, Shield, Globe, Rocket, Zap, Lock, CreditCard, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/logo";
const figuiraLogo = "/assets/figuira-logo.png";

export const Route = createFileRoute("/a-propos")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "À propos — FIGDITIONS" },
      { name: "description", content: "FIGDITIONS, la première plateforme éditoriale conçue pour l'Afrique de l'Ouest. Fondée à Bamako en 2026." },
      { property: "og:title", content: "À propos de FIGDITIONS" },
      { property: "og:description", content: "Notre mission : démocratiser les outils éditoriaux pour les maisons d'édition africaines." },
    ],
  }),
});

function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo className="h-8 w-auto" />
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <ArrowLeft className="h-4 w-4 mr-1" /> Accueil
            </Button>
          </Link>
        </div>
      </header>

      <Hero />
      <Mission />
      <Story />
      <Numbers />
      <Values />
      <TechStack />
      <Partnership />
      <Contact />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative flex items-center justify-center pt-20 pb-24 px-4 overflow-hidden text-center">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0D0A06] via-[#1A1208] to-[#0D0A06]" />
        <div className="absolute inset-0 opacity-40"
             style={{ backgroundImage: "radial-gradient(circle at 20% 30%, oklch(0.72 0.14 75 / 0.25), transparent 50%), radial-gradient(circle at 80% 70%, oklch(0.82 0.16 80 / 0.18), transparent 55%)" }} />
      </div>
      <div className="max-w-3xl mx-auto">
        <Logo className="h-24 md:h-32 w-auto mx-auto drop-shadow-[0_0_24px_rgba(232,184,75,0.4)]" />
        <h1 className="mt-8 text-4xl md:text-6xl font-bold tracking-tight">
          À Propos de <span className="bg-gradient-to-r from-primary to-[color:var(--gold)] bg-clip-text text-transparent">FIGDITIONS</span>
        </h1>
        <p className="mt-5 text-lg md:text-xl text-muted-foreground">
          La première plateforme éditoriale conçue pour l'Afrique de l'Ouest
        </p>
        <p className="mt-3 text-sm uppercase tracking-widest text-[color:var(--gold)] font-semibold">
          Fondée en 2026 à Bamako, Mali
        </p>
      </div>
    </section>
  );
}

function Mission() {
  return (
    <section className="py-20 px-4 max-w-4xl mx-auto">
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Notre Mission</h2>
      <div className="mt-6 space-y-4 text-muted-foreground leading-relaxed text-[15px]">
        <p>
          FIGDITIONS est née d'un constat simple : les maisons d'édition africaines méritent
          des outils numériques à la hauteur de leur talent.
        </p>
        <p>
          Le secteur de l'édition au Mali et en Afrique de l'Ouest regorge de talents
          extraordinaires, mais souffre d'un manque criant d'outils de gestion adaptés à
          sa réalité.
        </p>
        <p>
          Notre mission est de démocratiser l'accès aux outils de gestion professionnels
          pour toutes les maisons d'édition africaines, quelle que soit leur taille.
        </p>
      </div>
    </section>
  );
}

function Story() {
  return (
    <section className="py-20 px-4 bg-[#1A1208]">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Notre Histoire</h2>
        <div className="mt-6 space-y-4 text-muted-foreground leading-relaxed text-[15px]">
          <p>
            En 2026, face aux défis quotidiens rencontrés par les éditeurs maliens — gestion
            manuelle des manuscrits, stocks dans des cahiers, paiements des droits d'auteur
            non automatisés — FIGDITIONS a été créée pour apporter une solution numérique
            complète et locale.
          </p>
          <p>
            Développée à Bamako, pour Bamako, FIGDITIONS comprend les réalités du terrain :
            les délestages électriques, la connectivité intermittente, les paiements via
            Mobile Money et l'importance des langues nationales.
          </p>
        </div>
      </div>
    </section>
  );
}

function Numbers() {
  const stats = [
    { icon: "🏢", value: "126+", label: "Maisons d'édition ciblées au Mali" },
    { icon: "📚", value: "10", label: "Étapes de workflow éditorial" },
    { icon: "🌍", value: "8+", label: "Pays d'Afrique de l'Ouest supportés" },
    { icon: "⚡", value: "99,5%", label: "Disponibilité de la plateforme garantie" },
  ];
  return (
    <section className="py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center">FIGDITIONS en chiffres</h2>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {stats.map((s, i) => (
            <div key={i} className="rounded-2xl border border-border bg-[#1A1208] p-6 text-center transition-all hover:border-[color:var(--gold)] hover:-translate-y-1">
              <div className="text-4xl mb-3">{s.icon}</div>
              <div className="text-4xl font-bold bg-gradient-to-r from-primary to-[color:var(--gold)] bg-clip-text text-transparent">
                {s.value}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Values() {
  const values = [
    { icon: Globe, emoji: "🌍", title: "Local First", desc: "Conçu pour la réalité africaine, pas adapté de solutions occidentales" },
    { icon: Shield, emoji: "🔒", title: "Confiance", desc: "Vos données sont sécurisées, sauvegardées et vous appartiennent" },
    { icon: Rocket, emoji: "🚀", title: "Innovation", desc: "Nous améliorons constamment la plateforme grâce aux retours de nos utilisateurs" },
  ];
  return (
    <section className="py-20 px-4 bg-[#1A1208]">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center">Nos Valeurs</h2>
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {values.map((v, i) => (
            <div key={i} className="rounded-2xl border border-border bg-background p-7 hover:border-primary transition-colors">
              <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center text-2xl">{v.emoji}</div>
              <h3 className="mt-5 text-xl font-semibold">{v.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TechStack() {
  const stack = [
    { icon: Database, title: "Supabase", desc: "Base de données PostgreSQL avec sauvegardes automatiques quotidiennes hébergée sur AWS Europe" },
    { icon: Zap, title: "Cloudflare", desc: "Déploiement mondial avec CDN pour des performances optimales même au Mali" },
    { icon: Lock, title: "SSL/TLS", desc: "Chiffrement de bout en bout de toutes vos données" },
    { icon: CreditCard, title: "Flutterwave", desc: "Paiements sécurisés via Mobile Money et Carte Bancaire" },
  ];
  return (
    <section className="py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center">Notre Infrastructure Technique</h2>
        <p className="mt-3 text-center text-muted-foreground max-w-2xl mx-auto">
          FIGDITIONS est construit sur des technologies de pointe pour garantir sécurité et performance.
        </p>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {stack.map((s, i) => (
            <div key={i} className="rounded-2xl border border-border bg-[#1A1208] p-6 hover:border-[color:var(--gold)] transition-colors">
              <div className="h-11 w-11 rounded-xl bg-[color:var(--gold)]/15 text-[color:var(--gold)] flex items-center justify-center">
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Partnership() {
  return (
    <section className="py-20 px-4 bg-[#1A1208]">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center">Nos Partenaires</h2>
        <div className="mt-12 max-w-2xl mx-auto rounded-2xl border-2 border-[color:var(--gold)] bg-[#0D0A06] p-8 md:p-10 text-center shadow-[0_0_40px_-10px_var(--gold)]">
          <img src={figuiraLogo} alt="Figuira Editions" style={{ height: "80px", width: "auto" }} className="mx-auto" />
          <h3 className="mt-5 text-xl font-bold tracking-wide">FIGUIRA ÉDITIONS</h3>
          <p className="mt-1 text-sm font-semibold text-primary">Partenaire officiel ⭐</p>
          <p className="mt-4 text-sm text-muted-foreground max-w-lg mx-auto">
            Maison d'édition malienne fondée en 2019 par Fatoumata Keïta. Spécialisée dans
            la littérature générale et la jeunesse bilingue (français-langues nationales).
          </p>
          <a href="https://figuiraeditions.org" target="_blank" rel="noopener noreferrer" className="inline-block mt-6">
            <Button variant="outline" className="border-[color:var(--gold)] text-[color:var(--gold)] hover:bg-[color:var(--gold)] hover:text-background">
              Visiter le site <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </a>
        </div>

        <div className="mt-12 text-center">
          <p className="text-muted-foreground">Vous voulez devenir partenaire ?</p>
          <a href="mailto:Figditions@gmail.com">
            <Button className="mt-3 bg-primary text-primary-foreground hover:bg-primary/90">
              <Mail className="h-4 w-4 mr-2" /> Nous contacter
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}

function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`Contact FIGDITIONS — ${form.name}`);
    const body = encodeURIComponent(`Nom: ${form.name}\nEmail: ${form.email}\n\n${form.message}`);
    window.location.href = `mailto:Figditions@gmail.com?subject=${subject}&body=${body}`;
  };
  return (
    <section className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center">Nous Contacter</h2>

        <div className="mt-10 grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-border bg-[#1A1208] p-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Email</p>
                <a href="mailto:Figditions@gmail.com" className="font-semibold hover:text-primary">Figditions@gmail.com</a>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-[#1A1208] p-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[color:var(--gold)]/15 text-[color:var(--gold)] flex items-center justify-center">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Localisation</p>
                <p className="font-semibold">Bamako, Mali</p>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-8 rounded-2xl border border-border bg-[#1A1208] p-6 md:p-8 space-y-4">
          <div className="space-y-2">
            <Label>Nom</Label>
            <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="bg-background/50" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="bg-background/50" />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea required rows={5} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} className="bg-background/50" />
          </div>
          <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11">
            Envoyer le message
          </Button>
        </form>
      </div>
    </section>
  );
}
