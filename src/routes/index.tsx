import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X, ArrowRight, Check } from "lucide-react";
import { Logo } from "@/components/logo";
import { useI18n } from "@/hooks/use-i18n";
import { InstallAppButton } from "@/components/install-app-button";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { CookieBanner } from "@/components/cookie-banner";
import { AdminAccessGate } from "@/components/admin-access-gate";
import { PLANS } from "@/config/plans";
import { PLANS as LIMITES, PLAN_ORDER, type PlanLimits } from "@/lib/plans";
const figuiraLogo = "/assets/figuira-logo.png";
const heroAsset = { url: "/assets/hero-figditions.webp" };


const FAQS = [
  {
    question: "Mes manuscrits sont-ils confidentiels ?",
    answer: "Oui. Vous conservez l'intégralité des droits sur vos manuscrits et vos données. Chaque maison d'édition dispose d'un espace totalement isolé, protégé par une politique de sécurité au niveau des lignes de la base de données. Notre équipe n'accède jamais au contenu de vos manuscrits sans votre autorisation explicite.",
  },
  {
    question: "Est-ce que ça fonctionne sans internet ?",
    answer: "Oui pour consulter. FIGDITIONS s'installe comme une application sur votre téléphone ou votre ordinateur. Pendant une coupure, l'application s'ouvre et affiche les dernières données que vous avez consultées sur l'appareil. Pour enregistrer une vente ou modifier une fiche, il faut la connexion : l'application vous le dit clairement et rien n'est envoyé à moitié.",
  },
  {
    question: "Comment payer mon abonnement ?",
    answer: "Vous payez par Orange Money ou Wave en scannant un QR code depuis votre espace. Vous nous transmettez ensuite la référence de la transaction et nous activons votre abonnement.",
  },
  {
    question: "Puis-je récupérer mes données si j'arrête ?",
    answer: "Oui, à tout moment. Vous pouvez exporter l'ensemble de vos données dans un format lisible depuis vos paramètres, et demander leur suppression complète à la fermeture de votre compte.",
  },
  {
    question: "Les contrats générés sont-ils valables dans mon pays ?",
    answer: "Nos modèles reprennent les clauses classiques d'un contrat d'édition, communes à la plupart des pays : cession des droits, durée, territoires, droits d'auteur, relevés de ventes, résiliation. Vous les adaptez à votre pays (territoires, remises, durée, tribunal compétent), et ils sont entièrement personnalisables avec le plan Business. Le droit d'auteur reste propre à chaque pays : ces modèles sont une aide à la rédaction, pas un conseil juridique. Faites-les relire par un juriste de votre pays avant signature.",
  },
  {
    question: "J'ai déjà tout dans des cahiers. Comment je migre ?",
    answer: "Nous vous accompagnons. Envoyez-nous vos fichiers existants, sous n'importe quel format, et nous importons gratuitement votre catalogue et vos stocks lors de votre mise en route. Vous pouvez aussi photographier une page de cahier de ventes : Pr. MEDMO la lit et vous propose les ventes à enregistrer, que vous validez d'un clic.",
  },
  {
    question: "Qu'est-ce que Pr. MEDMO ?",
    answer: "C'est l'assistant intelligent intégré à FIGDITIONS. Il répond à vos questions sur vos données (ventes, stocks, droits d'auteur), lit vos photos de cahiers et vos documents, et peut préparer des actions dans la plateforme. Rien n'est enregistré sans votre validation, et il vous signale toujours quand un titre ou une librairie ressemble à un autre pour éviter les doublons.",
  },
  {
    question: "Puis-je annuler une opération enregistrée par erreur ?",
    answer: "Oui. Une vente, un mouvement de stock ou un dépôt en librairie peut être annulé avec un motif obligatoire. Les quantités sont remises comme avant, l'opération reste visible barrée avec sa raison, et elle est retirée de tous les totaux et rapports. Tout est conservé dans un historique des annulations.",
  },
  {
    question: "Je vends aussi des livres que je n'ai pas édités. C'est prévu ?",
    answer: "Oui. Les livres étrangers (ouvrages d'autres éditeurs que vous distribuez) ont leur propre section, distincte de vos productions, aussi bien dans le catalogue que dans le stock interne. Vos chiffres restent séparés et lisibles.",
  },
  {
    question: "Combien de personnes de mon équipe peuvent utiliser la plateforme ?",
    answer: "Le plan Starter est prévu pour un seul utilisateur, le plan Pro pour trois, et le plan Business n'a aucune limite. Chaque membre reçoit un rôle qui détermine ce qu'il peut voir et modifier. Les invitations se font par lien sécurisé.",
  },
  {
    question: "Puis-je essayer avant de payer ?",
    answer: "Oui. Le plan Starter est gratuit et sans limite de durée : vous pouvez gérer jusqu'à 5 manuscrits, vos auteurs, votre stock interne et 2 librairies, et poser 20 questions par mois à Pr. MEDMO, sans jamais payer. Vous passez à un plan supérieur uniquement quand vous en avez besoin.",
  },
];


const OG_IMAGE = "https://figditions.xyz/assets/og-figditions.jpg";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "FIGDITIONS | Logiciel de gestion pour maisons d'édition" },
      { name: "description", content: "Manuscrits, stocks, dépôts en librairie, contrats et finances en un seul endroit, avec l'assistant Pr. MEDMO. Pour les maisons d'édition indépendantes, partout dans le monde." },
      { property: "og:title", content: "FIGDITIONS | Logiciel de gestion pour maisons d'édition" },
      { property: "og:description", content: "Manuscrits, stocks, dépôts en librairie, contrats et finances en un seul endroit, avec l'assistant Pr. MEDMO. Pour les maisons d'édition indépendantes, partout dans le monde." },
      { name: "twitter:title", content: "FIGDITIONS | Logiciel de gestion pour maisons d'édition" },
      { name: "twitter:description", content: "Manuscrits, stocks, dépôts en librairie, contrats et finances en un seul endroit, avec l'assistant Pr. MEDMO. Pour les maisons d'édition indépendantes, partout dans le monde." },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:image", content: OG_IMAGE },
      { property: "og:url", content: "https://figditions.xyz/" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://figditions.xyz/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "FIGDITIONS",
          description:
            "Plateforme éditoriale tout-en-un pour les maisons d'édition, partout dans le monde : manuscrits, auteurs, contrats, stocks, dépôts et finances.",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          inLanguage: "fr",
          url: "https://figditions.xyz/",
          image: OG_IMAGE,
          offers: PLANS.map((p) => ({
            "@type": "Offer",
            name: p.name,
            price: String(p.priceMonthly),
            priceCurrency: "XOF",
            description: p.tagline,
            category: p.seatsLabel,
          })),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQS.map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: f.answer,
            },
          })),
        }),
      },
    ],
  }),
});


function Landing() {
  const navigate = useNavigate();
  // Opened from the installed app (older installs start here): go straight
  // to the workspace, which asks to sign in only when nobody is signed in.
  useEffect(() => {
    if (window.matchMedia?.("(display-mode: standalone)").matches) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [navigate]);
  return (
    <div className="min-h-screen bg-[#0A0704] text-foreground overflow-x-hidden">
      <Navbar />
      <Hero />
      <Screenshots />
      <MedmoSection />
      <Features />
      <Partners />

      <HowItWorks />
      <Pricing />
      <Faq />
      <CtaBanner />
      <Footer />
      <CookieBanner />
    </div>
  );
}


function Navbar() {
  const { t } = useI18n();
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
    { label: t("Assistant", "Assistant"), href: "#medmo" },
    { label: t("Tarifs", "Pricing"), href: "#pricing" },
    { label: t("Contact", "Contact"), href: "/a-propos#contact" },
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

        <div className="hidden md:flex items-center gap-6 ml-auto">
          <InstallAppButton
            variant="ghost"
            size="sm"
            className="h-10 px-3 text-[15px] font-normal text-white/80 hover:bg-transparent hover:text-white"
          />
          <Link to="/login" className="text-[15px] text-white/80 hover:text-white transition-colors">
            {t("Se connecter", "Sign in")}
          </Link>
          <Link
            to="/signup"
            className="inline-flex items-center h-10 px-5 rounded-md border border-[#C8922A] text-[#E8B84B] text-sm font-medium hover:bg-[#C8922A] hover:text-white transition-colors"
          >
            {t("Commencer gratuitement", "Get started free")}
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
          <InstallAppButton full className="border-[#C8922A]/50 text-[#E8B84B]" />
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



// Shared section opener: chapter number, hairline rule, serif title.
function SectionHead({ num, kicker, title, intro }: {
  num: string;
  kicker: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
}) {
  return (
    <div className="grid md:grid-cols-12 gap-x-8 gap-y-4 border-t border-white/10 pt-6 mb-12 md:mb-16">
      <p className="md:col-span-3 text-[12px] uppercase tracking-[0.2em] text-[#8C7B6B]">
        <span className="text-[#C8922A] tabular-nums">{num}</span>
        <span className="mx-2" aria-hidden="true">·</span>
        {kicker}
      </p>
      <div className="md:col-span-9">
        <h2 className="font-wordmark-serif font-normal text-white text-[40px] md:text-[64px] leading-[1.02] tracking-[-0.01em]">
          {title}
        </h2>
        {intro && <p className="mt-5 text-[17px] leading-relaxed text-[#B8A898] max-w-2xl">{intro}</p>}
      </div>
    </div>
  );
}

function Hero() {
  const { t } = useI18n();
  return (
    <section id="top" className="relative w-full min-h-[100svh] overflow-hidden bg-[#0A0704]">
      <img
        src={heroAsset.url}
        alt="FIGDITIONS, la plateforme des maisons d'édition"
        fetchPriority="high"
        className="absolute inset-y-0 right-0 h-full w-full md:w-[70%] object-cover object-center pointer-events-none select-none"
        style={{
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%)",
          maskImage:
            "linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%)",
        }}
      />
      {/* Keeps the text readable where the image sits behind it on phones */}
      <div className="absolute inset-0 md:hidden bg-gradient-to-t from-[#0A0704] via-[#0A0704]/80 to-[#0A0704]/30" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 pt-36 pb-20 md:pt-0 md:pb-0 md:absolute md:bottom-[16%] md:left-0 md:right-0">
        <div className="max-w-2xl">
          <p className="flex items-center gap-3 text-[12px] uppercase tracking-[0.2em] text-[#B8A898]">
            <span className="h-px w-8 bg-[#C8922A]" aria-hidden="true" />
            {t("Pour les maisons d'édition indépendantes", "For independent publishing houses")}
          </p>
          <h1
            className="mt-6 font-wordmark-serif font-normal text-white leading-[0.98]"
            style={{ fontSize: "clamp(48px, 7vw, 96px)", letterSpacing: "-0.015em" }}
          >
            {t("Votre maison d'édition,", "Your publishing house,")}{" "}
            <em className="italic text-[#E8B84B]">{t("enfin sous contrôle.", "finally under control.")}</em>
          </h1>
          <p className="mt-6 text-[18px] leading-[1.6] max-w-[500px] text-[#B8A898]">
            {t(
              "Manuscrits, stocks en librairie, ventes et droits d'auteur au même endroit. Et Pr. MEDMO, un assistant qui connaît vos chiffres.",
              "Manuscripts, bookstore stock, sales and royalties in one place. And Pr. MEDMO, an assistant that knows your numbers."
            )}
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
            <Link
              to="/signup"
              className="inline-flex items-center h-12 px-6 rounded-md bg-[#C8922A] text-white text-[15px] font-medium hover:bg-[#B5821F] transition-colors"
            >
              {t("Commencer gratuitement", "Get started for free")} <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <a
              href="#demo"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="text-[15px] text-white underline decoration-[#C8922A]/60 underline-offset-[6px] hover:decoration-[#C8922A] transition-colors"
            >
              {t("Voir l'interface", "See the interface")}
            </a>
            <InstallAppButton
              className="h-12 px-5 border-[#C8922A]/60 bg-transparent text-[#E8B84B] hover:bg-[#C8922A]/15 hover:text-[#E8B84B]"
            />
          </div>
          <p className="mt-5 text-[13px] text-[#8C7B6B]">
            {t("Gratuit pour toujours · Sans carte bancaire · Prêt en 2 minutes", "Free forever · No card needed · Ready in 2 minutes")}
          </p>
        </div>
      </div>
    </section>
  );
}


// Real captures of the app; contact details on the authors screen are blurred.
const SCREENS = [
  { id: "tableau-de-bord", label: "Tableau de bord", caption: "Votre maison en un coup d'œil : manuscrits, stock, ventes et chiffre d'affaires." },
  { id: "medmo", label: "Pr. MEDMO", caption: "Une question, une photo ou un PDF : Pr. MEDMO consulte vos données et prépare les actions, que vous confirmez." },
  { id: "manuscrits", label: "Manuscrits", caption: "Suivez chaque titre à travers les 10 étapes éditoriales, de la réception à la publication." },
  { id: "stocks", label: "Stocks", caption: "Entrepôt et dépôts en librairie, avec le taux d'écoulement de vos livres." },
  { id: "finances", label: "Finances", caption: "Chiffre d'affaires, encaissements, dépenses et royalties. Chaque opération reste traçable." },
  { id: "auteurs", label: "Auteurs", caption: "Vos auteurs, leurs manuscrits et leurs coordonnées de paiement Mobile Money." },
  { id: "contrats", label: "Contrats", caption: "Droits, territoires et durée de chaque contrat d'édition, avec son statut." },
  { id: "estimateur", label: "Estimateur", caption: "Le coût exact d'un tirage, et la méthode d'impression la plus avantageuse." },
  { id: "imprimeries", label: "Imprimeries", caption: "Les imprimeries partenaires, leurs services et leurs contacts." },
  { id: "conversions", label: "Conversions", caption: "Vos manuscrits en ebooks ePub et MOBI, prêts pour Kindle, Apple Books et Kobo." },
];

function Screenshots() {
  return (
    <section id="demo" className="py-24 md:py-32 px-6 lg:px-12 bg-[#0A0704]">
      <div className="max-w-7xl mx-auto">
        <SectionHead
          num="01"
          kicker="L'interface"
          title="Voyez la plateforme en action."
          intro="Voici les écrans que vous utiliserez au quotidien, sans maquette ni promesse abstraite."
        />
        <Tabs defaultValue="tableau-de-bord" className="w-full">
          <TabsList className="mb-8 h-auto w-full justify-start gap-8 overflow-x-auto overflow-y-hidden whitespace-nowrap rounded-none border-b border-white/10 bg-transparent p-0 [scrollbar-width:none]">
            {SCREENS.map((s) => (
              <TabsTrigger
                key={s.id}
                value={s.id}
                className="relative rounded-none bg-transparent px-0 pb-3 pt-0 text-[15px] font-normal text-[#8C7B6B] shadow-none data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none after:absolute after:inset-x-0 after:-bottom-px after:h-px data-[state=active]:after:bg-[#C8922A]"
              >
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {SCREENS.map((s) => (
            <TabsContent key={s.id} value={s.id} className="mt-0">
              <figure>
                <div className="rounded-lg border border-white/10 bg-[#0D0A06] overflow-hidden">
                  <img
                    src={`/assets/screens/${s.id}.webp`}
                    alt={`Écran ${s.label} de FIGDITIONS`}
                    className="w-full h-auto"
                    loading="lazy"
                    width={1360}
                    height={640}
                  />
                </div>
                <figcaption className="mt-4 text-sm text-[#8C7B6B]">{s.caption}</figcaption>
              </figure>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}


function MedmoSection() {
  const points = [
    {
      title: "Posez vos questions",
      text: "« Combien d'exemplaires reste-t-il à la Librairie Nouvel Horizon ? » La réponse vient de vos données réelles, en français.",
    },
    {
      title: "Photographiez votre cahier",
      text: "Une page de cahier de ventes manuscrite est lue, les titres reconnus dans votre catalogue, et les ventes proposées à l'enregistrement.",
    },
    {
      title: "Vous gardez le dernier mot",
      text: "Aucune écriture sans votre validation. En cas de doute sur un titre ou une librairie, l'assistant demande confirmation au lieu de créer un doublon.",
    },
  ];
  return (
    <section id="medmo" className="py-24 md:py-32 px-6 lg:px-12 bg-[#0D0A06]">
      <div className="max-w-7xl mx-auto">
        <SectionHead
          num="02"
          kicker="L'assistant"
          title={<>Pr. MEDMO connaît <em className="italic text-[#E8B84B]">vos chiffres.</em></>}
          intro="Il connaît votre catalogue, vos stocks et vos ventes. Il lit vos photos et vos documents, puis prépare le travail à votre place. Vous validez."
        />
        <ol className="grid md:grid-cols-3 border-t border-white/10 md:divide-x md:divide-white/10">
          {points.map((p, i) => (
            <li key={p.title} className="py-8 md:px-8 md:first:pl-0 md:last:pr-0 border-b md:border-b-0 border-white/10">
              <span className="font-wordmark-serif text-2xl text-[#C8922A] tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-3 text-lg font-medium text-white">{p.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[#B8A898]">{p.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}


function Features() {
  const { t } = useI18n();
  const offlineFr = "Pendant les délestages et les coupures de réseau, vos pages et vos derniers chiffres restent consultables. Installez l'application en un clic.";
  const bordereauxFr = "Générez vos bordereaux de dépôt et de vente en quelques clics, prêts à signer avec vos libraires.";
  const imprimeriesFr = "Accédez aux tarifs et contacts des imprimeries partenaires pour comparer avant d'imprimer.";
  const groups = [
    {
      fr: "Catalogue et auteurs", en: "Catalogue and authors",
      items: [
        { fr: "Gestion des manuscrits", en: "Manuscript management", dfr: "Suivez chaque livre à travers 10 étapes éditoriales, de la réception à la publication.", den: "Track every book through 10 editorial stages, from reception to publication." },
        { fr: "Gestion des auteurs", en: "Author management", dfr: "Informations, contrats et droits de vos auteurs au même endroit.", den: "Your authors' details, contracts and royalties in one place." },
        { fr: "Contrats et droits", en: "Contracts and rights", dfr: "Des contrats d'édition professionnels en quelques clics, adaptés à votre pays.", den: "Professional publishing contracts in a few clicks, adapted to your country." },
        { fr: "Livres étrangers", en: "Foreign books", dfr: "Vos productions séparées des ouvrages d'autres éditeurs que vous distribuez.", den: "Your own titles kept apart from other publishers' books you distribute." },
        { fr: "Partage PDF sécurisé", en: "Secure PDF sharing", dfr: "Filigrane à votre nom et nombre de lectures limité.", den: "Watermarked with your name, with a limited number of views." },
        { fr: "Conversion ePub et MOBI", en: "ePub and MOBI conversion", dfr: "Des ebooks prêts pour Kindle, Apple Books et Google Play Books.", den: "Ebooks ready for Kindle, Apple Books and Google Play Books." },
      ],
    },
    {
      fr: "Stock et librairies", en: "Stock and bookstores",
      items: [
        { fr: "Stock interne", en: "Internal stock", dfr: "Chaque exemplaire imprimé suivi, chaque mouvement enregistré.", den: "Every printed copy tracked, every movement logged." },
        { fr: "Dépôts en librairie", en: "Bookstore deposits", dfr: "Vos stocks chez chaque libraire, avec alerte quand ils baissent.", den: "Your stock at each bookstore, with an alert when it runs low." },
        { fr: "Dépôts multiples", en: "Multiple deposits", dfr: "Chaque lot garde sa date, sa quantité et son historique.", den: "Each batch keeps its date, quantity and history." },
        { fr: "Dons et exemplaires offerts", en: "Donations", dfr: "Le stock est déduit, sans revenu ni droits d'auteur.", den: "Stock is deducted, with no revenue or royalties." },
        { fr: "Bordereaux de vente", en: "Sales slips", dfr: bordereauxFr, den: "Deposit and sales slips in a few clicks, ready to sign with your bookstores." },
        { fr: "Import Excel et vente rapide", en: "Excel import and quick sale", dfr: "Catalogue et stocks importés depuis Excel, ventes saisies en mode caisse.", den: "Catalogue and stock imported from Excel, sales logged in checkout mode." },
      ],
    },
    {
      fr: "Finances", en: "Finances",
      items: [
        { fr: "Journal et royalties", en: "Ledger and royalties", dfr: "Ventes, dépenses, rentabilité par titre et droits d'auteur, avec reçus imprimables.", den: "Sales, expenses, per-title profitability and royalties, with printable receipts." },
        { fr: "Estimateur de coûts", en: "Cost estimator", dfr: "Le coût d'impression exact, et le conseil offset ou numérique.", den: "The exact printing cost, and whether to go offset or digital." },
        { fr: "Tableaux de bord", en: "Dashboards", dfr: "Vos chiffres du jour pour piloter la maison.", den: "Today's numbers to run the house." },
        { fr: "Annulation traçable", en: "Traceable cancellation", dfr: "Une erreur s'annule avec un motif, et reste visible dans l'historique.", den: "A mistake is cancelled with a reason, and stays visible in the log." },
        { fr: "Répertoire des imprimeries", en: "Printer directory", dfr: imprimeriesFr, den: "Prices and contacts of partner printers, to compare before printing." },
      ],
    },
    {
      fr: "Sur le terrain", en: "In the field",
      items: [
        { fr: "Assistant Pr. MEDMO", en: "Pr. MEDMO assistant", dfr: "Une question, une photo ou un document : il prépare, vous validez.", den: "A question, a photo or a document: it prepares, you approve." },
        { fr: "Photo de cahier en ventes", en: "Notebook photo to sales", dfr: "Titres, quantités et prix reconnus sur une page de cahier.", den: "Titles, quantities and prices read from a notebook page." },
        { fr: "Fonctionne sans connexion", en: "Works offline", dfr: offlineFr, den: "During power and network cuts, your pages and latest numbers stay readable. Install the app in one click." },
      ],
    },
  ];

  return (
    <section id="features" className="py-24 md:py-32 px-6 lg:px-12 bg-[#0A0704]">
      <div className="max-w-7xl mx-auto">
        <SectionHead
          num="03"
          kicker={t("Fonctionnalités", "Features")}
          title={t("Tout le métier d'éditeur, au même endroit.", "The whole publishing trade, in one place.")}
          intro={t("Du manuscrit reçu au chèque versé à l'auteur.", "From the manuscript you receive to the royalty you pay.")}
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-14">
          {groups.map((g) => (
            <div key={g.fr}>
              <h3 className="pb-4 border-b border-white/10 text-[12px] uppercase tracking-[0.2em] text-[#C8922A]">{t(g.fr, g.en)}</h3>
              <dl className="divide-y divide-white/[0.06]">
                {g.items.map((f) => (
                  <div key={f.fr} className="py-4">
                    <dt className="text-[15px] font-medium text-white">{t(f.fr, f.en)}</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-[#8C7B6B]">{t(f.dfr, f.den)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


function Partners() {
  const { t } = useI18n();
  const links = [
    { label: t("Site web", "Website"), href: "https://figuiraeditions.org" },
    { label: "Facebook", href: "https://www.facebook.com/figuira" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/figuira-éditions-113118301/" },
    { label: "Instagram", href: "https://www.instagram.com/figuiraeditions2" },
    { label: "YouTube", href: "https://www.youtube.com/@figuira-editions9737" },
  ];
  return (
    <section id="partners" className="py-24 md:py-32 px-6 lg:px-12 bg-[#0D0A06]">
      <div className="max-w-7xl mx-auto">
        <SectionHead
          num="04"
          kicker={t("Partenaire", "Partner")}
          title={<>{t("Construit avec une ", "Built with a ")}<em className="italic text-[#E8B84B]">{t("vraie", "real")}</em>{t(" maison d'édition.", " publishing house.")}</>}
          intro={t(
            "FIGDITIONS est développé main dans la main avec une maison d'édition malienne, sur des cas d'usage réels.",
            "FIGDITIONS is built hand in hand with a Malian publishing house, on real day-to-day work."
          )}
        />
        <div className="grid md:grid-cols-12 gap-8 items-start">
          <a href="https://figuiraeditions.org" target="_blank" rel="noopener noreferrer" className="md:col-span-3 inline-block">
            <img src={figuiraLogo} alt="Figuira Éditions" loading="lazy" decoding="async" style={{ height: "88px", width: "auto" }} />
          </a>
          <div className="md:col-span-9 max-w-2xl">
            <h3 className="font-wordmark-serif font-normal text-white text-3xl md:text-4xl">Figuira Éditions</h3>
            <p className="mt-4 text-[17px] leading-relaxed text-[#B8A898]">
              {t(
                "Maison d'édition malienne fondée en 2019 par Fatoumata Keïta. Spécialisée dans la littérature générale et la jeunesse bilingue (français-langues nationales). Plus de 25 titres publiés par an.",
                "Malian publishing house founded in 2019 by Fatoumata Keïta. Specialized in general literature and bilingual youth books (French and national languages). Over 25 titles published per year."
              )}
            </p>
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {links.map((l) => (
                <li key={l.label}>
                  <a href={l.href} target="_blank" rel="noopener noreferrer" className="text-white underline decoration-white/20 underline-offset-4 hover:decoration-[#C8922A] transition-colors">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-10 pt-6 border-t border-white/10 text-sm text-[#8C7B6B]">
              {t("Vous êtes une maison d'édition ? Rejoignez nos partenaires.", "Are you a publishing house? Join our partners.")}{" "}
              <a href="mailto:figditions@gmail.com" className="text-[#E8B84B] underline underline-offset-4 decoration-[#E8B84B]/40 hover:decoration-[#E8B84B]">
                {t("Nous contacter", "Contact us")}
              </a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}


function HowItWorks() {
  const { t } = useI18n();
  const steps = [
    { fr: "Créez votre compte", en: "Create your account", dfr: "Inscrivez votre maison d'édition en 2 minutes et invitez votre équipe.", den: "Register your publishing house in 2 minutes and invite your team." },
    { fr: "Ajoutez vos manuscrits", en: "Add your manuscripts", dfr: "Suivez chaque livre à travers les 10 étapes éditoriales avec votre équipe.", den: "Track every book through the 10 editorial stages with your team." },
    { fr: "Déposez en librairie", en: "Stock the bookstores", dfr: "Votre entrepôt et vos dépôts en librairie, à jour en permanence.", den: "Your warehouse and bookstore deposits, always up to date." },
    { fr: "Versez les droits", en: "Pay the royalties", dfr: "Les ventes calculent les droits d'auteur. Vous n'avez plus qu'à payer.", den: "Sales calculate the royalties. All that's left is to pay them." },
  ];
  return (
    <section className="py-24 md:py-32 px-6 lg:px-12 bg-[#0A0704]">
      <div className="max-w-7xl mx-auto">
        <SectionHead num="05" kicker={t("Mise en route", "Getting started")} title={t("Prêt en quatre étapes.", "Ready in four steps.")} />
        <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-12">
          {steps.map((s, i) => (
            <li key={s.fr} className="border-t border-white/10 pt-6">
              <span className="font-wordmark-serif text-5xl leading-none text-[#E8B84B] tabular-nums">{i + 1}</span>
              <h3 className="mt-5 text-lg font-medium text-white">{t(s.fr, s.en)}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[#8C7B6B]">{t(s.dfr, s.den)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// Side-by-side table built from src/lib/plans.ts, so it always matches the app.
function PlanComparison() {
  const { t } = useI18n();
  const n = (v: number) => (v === Infinity ? t("Illimité", "Unlimited") : v === 0 ? false : String(v));
  const rows: { label: string; value: (p: PlanLimits) => string | boolean }[] = [
    { label: t("Utilisateurs", "Users"), value: (p) => n(p.maxUsers) },
    { label: t("Manuscrits", "Manuscripts"), value: (p) => n(p.maxManuscrits) },
    { label: t("Librairies partenaires", "Partner bookstores"), value: (p) => n(p.maxBookstores) },
    { label: t("Questions à Pr. MEDMO / mois", "Pr. MEDMO questions / month"), value: (p) => n(p.medmoParMois) },
    { label: t("Finances, royalties et bordereaux", "Finances, royalties and slips"), value: (p) => p.finances },
    { label: t("Contrats d'édition", "Publishing contracts"), value: (p) => (p.modelesContrat ? t("Vos propres modèles", "Your own templates") : p.contrats ? t("Modèle standard", "Standard template") : false) },
    { label: t("Liens de lecture PDF / mois", "PDF reading links / month"), value: (p) => n(p.partagesParMois) },
    { label: t("Conversions ePub & MOBI / mois", "ePub & MOBI conversions / month"), value: (p) => n(p.conversionsParMois) },
    { label: t("Support", "Support"), value: (p) => (p.prioritySupport ? t("Prioritaire WhatsApp", "Priority WhatsApp") : "Email") },
  ];
  return (
    <div className="mt-20">
      <h3 className="font-wordmark-serif font-normal text-white text-3xl md:text-4xl">{t("Comparez les plans en détail.", "Compare plans in detail.")}</h3>
      <div className="mt-6 overflow-x-auto border-t border-white/10">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr>
              <th className="text-left px-4 pl-0 py-4 font-medium !normal-case !tracking-normal !text-[13px] !bg-transparent !text-[#8C7B6B]">{t("Fonctionnalité", "Feature")}</th>
              {PLAN_ORDER.map((k) => (
                <th key={k} className={cn("px-4 py-4 text-center font-medium !normal-case !tracking-normal !text-[13px] !bg-transparent", k === "pro" ? "!text-[#E8B84B]" : "!text-white")}>{LIMITES[k].label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-white/[0.06]">
                <td className="px-4 pl-0 py-3.5 text-[#B8A898]">{r.label}</td>
                {PLAN_ORDER.map((k) => {
                  const v = r.value(LIMITES[k]);
                  return (
                    <td key={k} className="px-4 py-3.5 text-center tabular-nums">
                      {v === true ? <Check className="h-4 w-4 text-[#C8922A] mx-auto" aria-label={t("Inclus", "Included")} />
                        : v === false ? <span className="text-white/25" aria-label={t("Non inclus", "Not included")}>—</span>
                        : <span className="text-white">{v}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Pricing() {
  const { t } = useI18n();
  const [yearly, setYearly] = useState(false);

  const fmt = (n: number) => n.toLocaleString("fr-FR");
  // FCFA is pegged to the euro (1 € = 655,957 FCFA), so this is exact, not a live rate.
  const eur = (fcfaAmount: number) => Math.round(fcfaAmount / 655.957).toLocaleString("fr-FR");

  return (
    <section id="pricing" className="py-24 md:py-32 px-6 lg:px-12 bg-[#0D0A06]">
      <div className="max-w-7xl mx-auto">
        <SectionHead
          num="06"
          kicker={t("Tarifs", "Pricing")}
          title={t("Des tarifs à la taille de votre maison.", "Pricing sized to your house.")}
          intro={t("Commencez gratuitement, évoluez quand vous êtes prêt.", "Start for free, upgrade when you're ready.")}
        />

        <div className="mb-8 flex flex-wrap items-center gap-4">
          <div className="inline-flex rounded-md border border-white/15 p-0.5" role="group" aria-label={t("Période de facturation", "Billing period")}>
            {[false, true].map((y) => (
              <button
                key={String(y)}
                type="button"
                aria-pressed={yearly === y}
                onClick={() => setYearly(y)}
                className={cn(
                  "px-4 py-1.5 rounded-[5px] text-sm transition-colors",
                  yearly === y ? "bg-white text-[#0A0704] font-medium" : "text-[#B8A898] hover:text-white",
                )}
              >
                {y ? t("Annuel", "Yearly") : t("Mensuel", "Monthly")}
              </button>
            ))}
          </div>
          <span className="text-sm text-[#E8B84B]">{t("2 mois offerts en annuel", "2 months free on yearly")}</span>
        </div>

        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {PLANS.map((plan) => {
            const isFree = plan.priceMonthly === 0;
            const highlighted = plan.id === "pro";
            const badge = plan.badge ?? t("Gratuit", "Free");
            const monthlyFromYearly = Math.round(plan.priceYearly / 12);
            return (
              <div
                key={plan.id}
                className={cn(
                  "rounded-lg border p-7 flex flex-col bg-[#0A0704]",
                  highlighted ? "border-[#C8922A]" : "border-white/10",
                )}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-wordmark-serif font-normal text-white text-3xl">{plan.name}</h3>
                  <span className={cn("text-[11px] uppercase tracking-[0.18em]", highlighted ? "text-[#E8B84B]" : "text-[#8C7B6B]")}>{badge}</span>
                </div>
                <p className="mt-1 text-sm text-[#8C7B6B]">{plan.tagline}</p>

                <div className="mt-6 pt-6 border-t border-white/10">
                  {isFree ? (
                    <p className="text-4xl font-semibold text-white tabular-nums">0 FCFA<span className="text-sm font-normal text-[#8C7B6B]"> / {t("mois", "month")}</span></p>
                  ) : yearly ? (
                    <>
                      <p className="text-4xl font-semibold text-white tabular-nums">{fmt(plan.priceYearly)} <span className="text-sm font-normal text-[#8C7B6B]">FCFA / an</span></p>
                      <p className="mt-1 text-xs text-[#8C7B6B]">soit {fmt(monthlyFromYearly)} FCFA / mois · ≈ {eur(plan.priceYearly)} € / an</p>
                      <p className="mt-2 text-xs text-[#E8B84B]">Économisez 2 mois</p>
                    </>
                  ) : (
                    <>
                      <p className="text-4xl font-semibold text-white tabular-nums">{fmt(plan.priceMonthly)} <span className="text-sm font-normal text-[#8C7B6B]">FCFA / {t("mois", "month")}</span></p>
                      <p className="mt-1 text-xs text-[#8C7B6B]">≈ {eur(plan.priceMonthly)} € / {t("mois", "month")}</p>
                    </>
                  )}
                  <p className="mt-3 text-sm font-medium text-white">{plan.seatsLabel}</p>
                </div>

                <ul className="mt-6 space-y-2.5 text-sm flex-1">
                  {plan.included.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[#D9CCBE]">
                      <Check className="h-4 w-4 text-[#C8922A] shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{f}</span>
                    </li>
                  ))}
                  {plan.excluded.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <X className="h-4 w-4 text-white/25 shrink-0 mt-0.5" aria-hidden="true" />
                      <span className="text-[#6B5B4E] line-through" aria-label={`Non inclus dans ce plan : ${f}`}>{f}</span>
                    </li>
                  ))}
                  {(plan.comingSoon ?? []).map((f) => (
                    <li key={f} className="flex items-start gap-2.5 pl-[26px] text-[#8C7B6B]">
                      <span>{f}</span>
                      <span className="text-[11px] uppercase tracking-[0.14em] text-[#6B5B4E]">Bientôt</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to="/signup"
                  search={{ plan: plan.id }}
                  className={cn(
                    "mt-8 inline-flex h-11 w-full items-center justify-center rounded-md text-[15px] font-medium transition-colors",
                    highlighted
                      ? "bg-[#C8922A] text-white hover:bg-[#B5821F]"
                      : "border border-white/20 text-white hover:border-white/50",
                  )}
                >
                  {isFree ? t("Commencer gratuitement", "Get started for free") : `${t("Choisir", "Choose")} ${plan.name}`}
                </Link>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-sm text-[#8C7B6B]">
          Pas de carte bancaire requise · Annulez à tout moment · Paiement par Orange Money ou Wave
          <br />
          Vous avez un code promotionnel ? Vous pourrez l'activer depuis vos paramètres après inscription.
        </p>

        <PlanComparison />
      </div>
    </section>
  );
}


function Faq() {
  return (
    <section id="faq" className="py-24 md:py-32 px-6 lg:px-12 bg-[#0A0704]">
      <div className="max-w-7xl mx-auto">
        <SectionHead num="07" kicker="Questions" title="Questions fréquentes." />
        <div className="md:grid md:grid-cols-12 md:gap-8">
          <Accordion type="single" collapsible className="md:col-start-4 md:col-span-9 border-t border-white/10">
            {FAQS.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border-white/10">
                <AccordionTrigger className="py-5 text-left text-[17px] font-medium text-white hover:text-[#E8B84B] hover:no-underline">
                  {f.question}
                </AccordionTrigger>
                <AccordionContent className="text-[15px] text-[#B8A898] leading-relaxed max-w-2xl">
                  {f.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}

function CtaBanner() {
  const { t } = useI18n();
  return (
    <section className="px-6 lg:px-12 pb-24 md:pb-32 bg-[#0A0704]">
      <div className="max-w-7xl mx-auto border-t border-white/10 pt-14 grid md:grid-cols-12 gap-8 items-end">
        <h2 className="md:col-span-8 font-wordmark-serif font-normal text-white text-[44px] md:text-[76px] leading-[1]">
          {t("Votre catalogue mérite ", "Your catalogue deserves ")}
          <em className="italic text-[#E8B84B]">{t("mieux qu'un cahier.", "better than a notebook.")}</em>
        </h2>
        <div className="md:col-span-4 md:text-right">
          <p className="text-[15px] text-[#B8A898]">
            {t("Créez votre compte gratuitement. Sans carte bancaire, sans engagement.", "Create your free account. No card, no commitment.")}
          </p>
          <Link
            to="/signup"
            className="mt-6 inline-flex items-center h-12 px-6 rounded-md bg-[#C8922A] text-white text-[15px] font-medium hover:bg-[#B5821F] transition-colors"
          >
            {t("Commencer gratuitement", "Get started for free")} <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const { t } = useI18n();
  const [adminOpen, setAdminOpen] = useState(false);
  const scrollTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };
  const link = "text-[#8C7B6B] hover:text-white transition-colors";
  return (
    <footer className="border-t border-white/10 bg-[#0A0704] pt-14 pb-10 px-6 lg:px-12">
      <AdminAccessGate open={adminOpen} onOpenChange={setAdminOpen} />
      <div className="max-w-7xl mx-auto grid sm:grid-cols-2 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-4">
          <button
            type="button"
            onClick={() => setAdminOpen(true)}
            aria-label="FIGDITIONS"
            className="block cursor-pointer bg-transparent border-0 p-0"
          >
            <Logo className="h-[52px] w-auto" />
          </button>
          <p className="mt-4 text-sm text-[#8C7B6B] max-w-xs">
            {t("La plateforme des maisons d'édition", "The platform for publishing houses")}
          </p>
        </div>

        <div className="lg:col-span-2">
          <h4 className="text-[12px] uppercase tracking-[0.2em] text-[#C8922A] mb-4">{t("Navigation", "Navigation")}</h4>
          <ul className="space-y-2.5 text-sm">
            <li><a href="#features" onClick={scrollTo("features")} className={link}>{t("Fonctionnalités", "Features")}</a></li>
            <li><a href="#pricing" onClick={scrollTo("pricing")} className={link}>{t("Tarifs", "Pricing")}</a></li>
            <li><a href="#partners" onClick={scrollTo("partners")} className={link}>{t("Partenaires", "Partners")}</a></li>
            <li><Link to="/a-propos" className={link}>{t("À propos", "About")}</Link></li>
            <li><a href="mailto:figditions@gmail.com" className={link}>Contact</a></li>
          </ul>
        </div>

        <div className="lg:col-span-3">
          <h4 className="text-[12px] uppercase tracking-[0.2em] text-[#C8922A] mb-4">{t("Légal", "Legal")}</h4>
          <ul className="space-y-2.5 text-sm">
            <li><Link to="/politique-de-confidentialite" className={link}>{t("Politique de confidentialité", "Privacy Policy")}</Link></li>
            <li><Link to="/conditions-utilisation" className={link}>{t("Conditions d'utilisation", "Terms of Service")}</Link></li>
            <li><Link to="/mentions-legales" className={link}>Mentions légales</Link></li>
          </ul>
        </div>

        <div className="lg:col-span-3">
          <h4 className="text-[12px] uppercase tracking-[0.2em] text-[#C8922A] mb-4">{t("Suivez-nous", "Follow us")}</h4>
          <ul className="space-y-2.5 text-sm">
            <li><a href="https://www.instagram.com/figditions" target="_blank" rel="noopener noreferrer" className={link}>Instagram</a></li>
            <li><a href="https://www.linkedin.com/in/figuira-éditions-113118301/" target="_blank" rel="noopener noreferrer" className={link}>LinkedIn</a></li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row gap-2 justify-between text-xs text-[#6B5B4E]">
        <p>© {new Date().getFullYear()} FIGDITIONS. {t("Tous droits réservés.", "All rights reserved.")}</p>
        <p>{t("Né en Afrique, ouvert au monde.", "Born in Africa, open to the world.")}</p>
      </div>
    </footer>
  );
}
