import jsPDF from "jspdf";
import figditionsLogoUrl from "@/assets/figditions-logo.png";

async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

const BRAND = "#1a1a1a";
const GOLD = "#c9a961";
const MUTED = "#666666";
const RULE = "#dcdcdc";
const BG_SOFT = "#f5f2ea";
const BG_TIP = "#eef6ee";
const BG_WARN = "#fdf3e3";
const BG_EX = "#eef2fb";

// Strip characters not supported by jsPDF built-in (WinAnsi) fonts.
function clean(s: string): string {
  if (!s) return "";
  return String(s)
    .replace(/[\u2018\u2019\u201A\u2039\u203A]/g, "'")
    .replace(/[\u201C\u201D\u201E\u00AB\u00BB]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u2192/g, "->")
    .replace(/\u2022/g, "-")
    .replace(/[\u202F\u00A0\u2007\u2009\u200A\u200B]/g, " ")
    .replace(/[^\x20-\x7EÀ-ÖØ-öø-ÿ€œŒŸ]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function generateManuelStocksPdf(opts: { maison?: string | null } = {}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = M;

  const setColor = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    doc.setTextColor(r, g, b);
  };
  const setFill = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    doc.setFillColor(r, g, b);
  };
  const setDraw = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    doc.setDrawColor(r, g, b);
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > H - M) {
      addFooter();
      doc.addPage();
      y = M;
      addHeader();
    }
  };

  let pageNumber = 0;
  const addHeader = () => {
    pageNumber++;
    setColor(MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("FIGDITIONS - Manuel Stocks", M, 24);
    doc.text(`Page ${pageNumber}`, W - M, 24, { align: "right" });
    setDraw(RULE);
    doc.setLineWidth(0.5);
    doc.line(M, 30, W - M, 30);
    y = M;
  };
  const addFooter = () => {
    setColor(MUTED);
    doc.setFontSize(8);
    doc.text("(c) FIGDITIONS - Guide d'utilisation", M, H - 20);
  };

  // ─── COVER ─────────────────────────────────────────────
  try {
    const logoData = await urlToDataUrl(figditionsLogoUrl);
    doc.addImage(logoData, "PNG", (W - 140) / 2, 120, 140, 140, undefined, "FAST");
  } catch { /* ignore */ }

  setColor(BRAND);
  doc.setFont("times", "bold");
  doc.setFontSize(30);
  doc.text("Manuel d'utilisation", W / 2, 300, { align: "center" });
  doc.setFontSize(20);
  setColor(GOLD);
  doc.text("Gestion des Stocks", W / 2, 328, { align: "center" });

  setColor(MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Stock interne - Stock externe - Ventes - Bordereaux", W / 2, 356, { align: "center" });

  // Decorative rule
  setDraw(GOLD);
  doc.setLineWidth(1);
  doc.line(W / 2 - 60, 380, W / 2 + 60, 380);

  setColor(BRAND);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  if (opts.maison) {
    doc.text(clean(opts.maison), W / 2, 420, { align: "center" });
  }

  setColor(MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  doc.text(`Édité le ${today}`, W / 2, H - 100, { align: "center" });
  doc.setFontSize(9);
  doc.text("Un guide simple, en français, pour bien démarrer.", W / 2, H - 82, { align: "center" });

  doc.addPage();
  addHeader();

  // ─── HELPERS ───────────────────────────────────────────
  const h1 = (text: string) => {
    ensureSpace(60);
    setColor(BRAND);
    doc.setFont("times", "bold");
    doc.setFontSize(22);
    doc.text(clean(text), M, y + 20);
    setDraw(GOLD);
    doc.setLineWidth(1.2);
    doc.line(M, y + 28, M + 60, y + 28);
    y += 50;
  };
  const h2 = (text: string) => {
    ensureSpace(40);
    setColor(BRAND);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(clean(text), M, y + 14);
    y += 26;
  };
  const p = (text: string, opts: { bold?: boolean } = {}) => {
    setColor("#222222");
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(10.5);
    const lines = doc.splitTextToSize(clean(text), W - 2 * M);
    for (const line of lines) {
      ensureSpace(16);
      doc.text(line, M, y + 12);
      y += 14;
    }
    y += 4;
  };
  const bullet = (text: string) => {
    setColor("#222222");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    const lines = doc.splitTextToSize(clean(text), W - 2 * M - 16);
    lines.forEach((line: string, i: number) => {
      ensureSpace(16);
      if (i === 0) {
        setColor(GOLD);
        doc.text("-", M + 4, y + 12);
        setColor("#222222");
      }
      doc.text(line, M + 16, y + 12);
      y += 14;
    });
    y += 2;
  };
  const step = (n: number, text: string) => {
    setColor("#222222");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    const lines = doc.splitTextToSize(clean(text), W - 2 * M - 26);
    lines.forEach((line: string, i: number) => {
      ensureSpace(18);
      if (i === 0) {
        setFill(BRAND);
        doc.circle(M + 8, y + 8, 8, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(String(n), M + 8, y + 11, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10.5);
        setColor("#222222");
      }
      doc.text(line, M + 26, y + 12);
      y += 15;
    });
    y += 4;
  };
  const callout = (title: string, body: string, tone: "tip" | "warn" | "example") => {
    const bg = tone === "tip" ? BG_TIP : tone === "warn" ? BG_WARN : BG_EX;
    const border = tone === "tip" ? "#5b9d5b" : tone === "warn" ? "#d89b3a" : "#5b7bd0";
    const prefix = tone === "tip" ? "ASTUCE" : tone === "warn" ? "ATTENTION" : "NOTE";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(clean(body), W - 2 * M - 24);
    const boxH = 22 + lines.length * 13 + 8;
    ensureSpace(boxH + 6);
    setFill(bg);
    doc.roundedRect(M, y, W - 2 * M, boxH, 4, 4, "F");
    setDraw(border);
    doc.setLineWidth(0.8);
    doc.line(M, y, M, y + boxH);
    setColor(border);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`${prefix} : ${clean(title)}`, M + 10, y + 14);
    setColor("#222222");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    let ly = y + 30;
    for (const line of lines) {
      doc.text(line, M + 10, ly);
      ly += 13;
    }
    y += boxH + 10;
  };

  // ─── SOMMAIRE ──────────────────────────────────────────
  h1("Sommaire");
  const toc = [
    "1. Bienvenue",
    "2. Stock interne — Vos livres chez vous",
    "3. Stock externe — Vos livres en librairie",
    "4. Enregistrer les ventes",
    "5. Bordereaux (plan Business)",
    "6. Comprendre les calculs",
    "7. Questions fréquentes",
    "8. Support",
  ];
  toc.forEach((raw) => {
    const t = clean(raw);
    setColor("#333333");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    ensureSpace(18);
    doc.text(t, M + 4, y + 12);
    setDraw(RULE);
    doc.setLineDashPattern([1, 2], 0);
    doc.line(M + 4 + doc.getTextWidth(t) + 6, y + 10, W - M, y + 10);
    doc.setLineDashPattern([], 0);
    y += 20;
  });

  // ─── 1. Bienvenue ──────────────────────────────────────
  doc.addPage(); addHeader();
  h1("1. Bienvenue");
  p("Ce manuel vous explique comment gérer vos livres dans FIGDITIONS, étape par étape et en langage simple. Il couvre les deux endroits où se trouvent vos livres :");
  bullet("Stock interne : les livres qui sont chez vous, dans votre entrepôt ou votre bureau.");
  bullet("Stock externe : les livres que vous avez déposés dans des librairies partenaires.");
  p("À partir de ces deux espaces, vous pouvez enregistrer les entrées (impressions reçues), les sorties (ventes) et éditer des bordereaux officiels à faire signer par les libraires.");
  callout("À retenir", "Toutes vos ventes alimentent automatiquement le calcul des droits d'auteur (10 %) et, quand la vente est faite en librairie, la commission libraire (20 %).", "tip");

  // ─── 2. Stock interne ──────────────────────────────────
  h1("2. Stock interne — Vos livres chez vous");
  h2("Ouvrir l'onglet");
  p("Dans la page Stocks, cliquez sur l'onglet 🏭 Stock Interne en haut. Vous voyez alors tous les titres que vous détenez, avec la quantité disponible.");

  h2("Ajouter un titre au stock interne");
  step(1, "Cliquez sur le bouton « Ajouter au stock ».");
  step(2, "Choisissez le titre du livre dans la liste déroulante.");
  step(3, "Saisissez la quantité reçue (par exemple : 200 exemplaires livrés par l'imprimeur).");
  step(4, "Saisissez le prix unitaire de vente en FCFA.");
  step(5, "Validez. Le stock est immédiatement disponible.");

  h2("Modifier ou corriger une quantité");
  p("Sur chaque ligne, l'icône crayon permet de mettre à jour la quantité (réception complémentaire, casse, don, retour de dépôt). L'icône poubelle supprime la ligne définitivement.");

  callout("Astuce", "Utilisez la modification pour tracer précisément : ajoutez 50 exemplaires lors d'une réimpression, retirez 3 exemplaires en cas de casse. Le stock reflète toujours la réalité.", "tip");

  h2("Alertes de stock bas");
  p("Une pastille orange apparaît quand il reste 5 exemplaires ou moins, et une pastille rouge quand il reste 0. Vous êtes ainsi prévenu à temps pour relancer l'imprimeur.");

  // ─── 3. Stock externe ──────────────────────────────────
  h1("3. Stock externe — Vos livres en librairie");
  p("Le stock externe recense tous les dépôts que vous avez faits dans les librairies partenaires. Vous savez à tout moment combien de livres sont physiquement dans chaque librairie.");

  h2("Trois façons d'enregistrer un dépôt");
  p("Selon le nombre de livres à saisir, choisissez la méthode la plus adaptée.");

  h2("Méthode 1 : Ajout classique (1 à 3 livres)");
  step(1, "Cliquez sur « Ajouter un dépôt ».");
  step(2, "Renseignez le nom de la librairie et son adresse.");
  step(3, "Choisissez le titre, la quantité déposée et le prix de vente.");
  step(4, "Validez.");

  h2("Méthode 2 : Saisie rapide — mode caisse (idéal 5 à 20 livres)");
  p("Recommandé quand vous venez de faire un dépôt dans une librairie et devez saisir plusieurs titres différents à la suite.");
  step(1, "Cliquez sur « Saisie rapide ».");
  step(2, "Saisissez le nom de la librairie une seule fois.");
  step(3, "Pour chaque livre : choisissez le titre, tapez la quantité, puis le prix.");
  step(4, "Appuyez sur Entrée pour passer d'un champ à l'autre — sans jamais quitter le clavier.");
  step(5, "Quand tout est saisi, appuyez sur Ctrl + Entrée pour tout enregistrer d'un coup.");
  callout("Astuce clavier", "Entrée = champ suivant. Ctrl + Entrée = tout valider. Aucune souris nécessaire.", "tip");

  h2("Méthode 3 : Import Excel (idéal 20 livres et plus)");
  p("Parfait pour une grande librairie qui reçoit 50 titres ou plus en une seule fois.");
  step(1, "Cliquez sur « Import Excel ».");
  step(2, "Téléchargez le modèle Excel (il contient déjà votre catalogue de titres publiés).");
  step(3, "Ouvrez le fichier dans Excel ou Google Sheets. Une ligne = un livre déposé.");
  step(4, "Remplissez les colonnes : titre, librairie, adresse, quantité, prix.");
  step(5, "Enregistrez le fichier, puis dans FIGDITIONS cliquez sur « Uploader le fichier ».");
  step(6, "L'écran affiche un aperçu ligne par ligne : vérifiez, puis validez. Les 55 livres sont créés en quelques secondes.");
  callout("Attention", "Ne modifiez pas les intitulés des colonnes du modèle : le système les utilise pour retrouver chaque titre.", "warn");

  h2("Suivre un dépôt existant");
  p("Chaque ligne du Stock externe affiche : déposés, vendus, restants. La pastille change de couleur en fonction du stock restant pour vous signaler quand la librairie est presque à sec.");

  h2("Personnaliser la commission librairie et les droits d'auteur");
  p("Chaque dépôt possède deux réglages, ajustables dans le formulaire d'ajout ou de modification :");
  bullet("Commission librairie : bascule Activée / Désactivée. Quand elle est activée, choisissez le taux parmi 10 %, 15 % ou 20 %. Désactivée, aucune commission n'est prélevée (0 %).");
  bullet("Droits d'auteur (10 %) : bascule Activés / Désactivés. Utile pour les titres du domaine public ou sans contrat de royalties.");
  callout("Mémorisation par librairie", "Dès que vous tapez le nom d'une librairie déjà utilisée, FIGDITIONS ré-applique automatiquement le taux et les droits choisis la dernière fois pour cette librairie. Vous ne recommencez jamais le réglage.", "tip");
  callout("Cohérence garantie", "Les taux choisis sont utilisés partout : ventes, statistiques Finances, bordereaux PDF. Le calcul se fait automatiquement à chaque vente enregistrée sur ce dépôt.", "example");

  // ─── 4. Ventes ─────────────────────────────────────────
  h1("4. Enregistrer les ventes");
  p("Toute vente doit être enregistrée pour que les royalties de l'auteur et vos statistiques financières restent à jour. FIGDITIONS propose désormais un raccourci unique et rapide : le bouton doré « 💰 Enregistrer une vente ».");

  h2("Le bouton « 💰 Enregistrer une vente »");
  p("Ce bouton doré est présent en haut à droite de deux pages :");
  bullet("Page Stocks — visible sur les onglets Stock interne ET Stock externe.");
  bullet("Page Finances — même bouton, même formulaire.");
  p("Où que vous soyez, un seul clic ouvre le même tiroir latéral pour saisir la vente. Aucun besoin d'ouvrir la fiche du livre au préalable.");

  h2("Étape 1 — Choisir le livre");
  step(1, "Cliquez sur « 💰 Enregistrer une vente ».");
  step(2, "Dans le champ « 📚 Manuscrit », tapez les premières lettres du titre ou du nom de l'auteur : la liste se filtre en direct.");
  step(3, "Sélectionnez le livre. Le nom de l'auteur, le prix unitaire et le stock disponible s'affichent automatiquement.");
  callout("Seuls les livres publiés apparaissent", "La liste ne montre que les manuscrits au statut « Publié ». Si un titre manque, vérifiez qu'il est bien passé en publié dans la page Manuscrits.", "tip");

  h2("Étape 2 — Choisir le type de vente");
  p("Deux cartes cliquables s'affichent côte à côte :");
  bullet("🏪 Vente en Librairie — pour une vente réalisée par une librairie partenaire. Un sélecteur de librairie apparaît juste en dessous : choisissez le point de dépôt concerné. Les librairies en rupture (0 exemplaire) sont grisées.");
  bullet("🛍️ Vente Libre — pour une vente libre hors librairie (salon, événement, particulier, boutique en ligne, bureau). La vente sera automatiquement déduite de votre Stock interne.");

  h2("Étape 3 — Détails de la vente");
  step(1, "Saisissez la quantité vendue. Le système empêche de dépasser le stock disponible et affiche une alerte rouge en cas de saisie trop élevée.");
  step(2, "Vérifiez le prix unitaire (préchargé). Vous pouvez le modifier ponctuellement, par exemple pour appliquer une remise.");
  step(3, "Choisissez la date de la vente (par défaut : aujourd'hui).");
  step(4, "Ajoutez une note si besoin (optionnel).");

  h2("Récapitulatif en temps réel");
  p("Sous le formulaire, un encadré « 📊 Récapitulatif » se met à jour à chaque frappe et affiche :");
  bullet("La quantité et le prix unitaire saisis.");
  bullet("Le montant total de la vente (en doré, mis en évidence).");
  bullet("Les droits d'auteur calculés automatiquement : 10 % par défaut, ou le pourcentage du contrat signé si un contrat existe pour cet auteur et ce manuscrit.");
  bullet("Le stock restant après la vente (vert si confortable, rouge si le seuil d'alerte est atteint).");

  callout("Contrats reconnus automatiquement", "Si un contrat signé prévoit un pourcentage de droits différent (par ex. 12 %), FIGDITIONS l'utilise à la place du 10 % standard. Aucune saisie manuelle nécessaire.", "tip");

  h2("Étape 4 — Enregistrer");
  step(1, "Cliquez sur « 💾 Enregistrer la vente ».");
  step(2, "Le tiroir bascule sur un écran vert de confirmation ✅ résumant la vente : titre, auteur, type, librairie (le cas échéant), quantité, prix, total, droits d'auteur, date.");
  step(3, "Deux boutons apparaissent : « 📝 Enregistrer une autre vente » (réinitialise le formulaire pour une saisie en chaîne) ou « ✕ Fermer ».");

  callout("Mise à jour instantanée partout", "Dès la vente enregistrée, tout est synchronisé : Stocks (exemplaires vendus / restants), Finances (chiffre d'affaires, droits d'auteur en attente), fiche Auteur, Tableau de bord, meilleures ventes, flux d'activité. Aucun rafraîchissement manuel nécessaire.", "example");

  h2("Ce qui se passe en coulisses");
  bullet("Vente en librairie : le stock de la librairie diminue automatiquement, une ligne est créée dans Ventes avec la commission libraire (0, 10, 15 ou 20 % selon le dépôt) et les droits d'auteur.");
  bullet("Vente libre : le Stock interne diminue, un mouvement de type « vente libre » est enregistré, et une ligne apparaît dans Ventes sans commission libraire.");
  bullet("Si le stock passe sous le seuil d'alerte, une notification jaune s'affiche pour vous prévenir.");

  callout("Attention", "Vérifiez toujours la quantité avant de valider : une vente enregistrée diminue immédiatement le stock. En cas d'erreur, ouvrez la page Finances → Ventes pour supprimer ou corriger l'enregistrement.", "warn");

  // ─── 5. Bordereaux ─────────────────────────────────────
  h1("5. Bordereaux (plan Business)");
  p("Un bordereau est un document officiel PDF, à faire signer par vous et le libraire. Il sert de preuve pour le dépôt ou la vente.");

  h2("Générer un bordereau");
  step(1, "Ouvrez l'onglet 📄 Bordereaux.");
  step(2, "Choisissez le type : bordereau de dépôt ou bordereau de vente.");
  step(3, "Sélectionnez la librairie et la période.");
  step(4, "Ajoutez éventuellement un logo maison (filigrane discret).");
  step(5, "Cliquez sur Générer : le PDF se télécharge, prêt à imprimer et à signer.");

  callout("Bon à savoir", "Le logo FIGDITIONS apparaît toujours en tête du document. Le logo que vous ajoutez sert de filigrane, en fond de page, pour personnaliser sans surcharger.", "tip");

  h2("Que contient un bordereau ?");
  bullet("En-tête FIGDITIONS et coordonnées de votre maison d'édition.");
  bullet("Coordonnées de la librairie destinataire.");
  bullet("Tableau des livres (titre, quantité, prix unitaire, sous-total).");
  bullet("Récapitulatif : chiffre d'affaires, commission 20 %, droits auteur 10 %, net éditeur.");
  bullet("Deux zones de signature (éditeur et libraire).");

  callout("Attention", "La génération de bordereaux est réservée au plan Business. Si vous êtes sur Starter ou Pro, un écran vous propose la mise à niveau.", "warn");

  // ─── 6. Calculs ────────────────────────────────────────
  h1("6. Comprendre les calculs");
  p("Prenons un exemple concret : un livre vendu 10 000 FCFA.");

  // Small comparison table
  const drawTable = () => {
    ensureSpace(140);
    const cols = [
      { title: "", w: 170 },
      { title: "Vente libre", w: 170 },
      { title: "Vente en librairie", w: (W - 2 * M) - 340 },
    ];
    const startX = M;
    let cx = startX;
    setFill(BG_SOFT);
    doc.rect(startX, y, W - 2 * M, 22, "F");
    setColor(BRAND);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    cols.forEach((c) => {
      doc.text(c.title, cx + 8, y + 15);
      cx += c.w;
    });
    y += 22;

    const rows: [string, string, string][] = [
      ["Prix affiché", "10 000 FCFA", "10 000 FCFA"],
      ["Commission libraire (20 %)", "0 FCFA", "2 000 FCFA"],
      ["Droits d'auteur (10 %)", "1 000 FCFA", "1 000 FCFA"],
      ["Net éditeur (vous)", "9 000 FCFA", "7 000 FCFA"],
    ];
    doc.setFont("helvetica", "normal");
    setColor("#222222");
    rows.forEach((r, i) => {
      if (i % 2 === 1) {
        setFill("#fafaf7");
        doc.rect(startX, y, W - 2 * M, 20, "F");
      }
      cx = startX;
      r.forEach((cell, idx) => {
        doc.text(cell, cx + 8, y + 14);
        cx += cols[idx].w;
      });
      setDraw(RULE);
      doc.setLineWidth(0.3);
      doc.line(startX, y + 20, W - M, y + 20);
      y += 20;
    });
    y += 10;
  };
  drawTable();

  callout("À retenir", "Une vente en librairie vous rapporte moins par livre, mais élargit énormément votre distribution. Le bordereau vous garantit une preuve écrite de chaque dépôt.", "tip");

  // ─── 7. FAQ ────────────────────────────────────────────
  h1("7. Questions fréquentes");

  h2("Je me suis trompé en saisissant une quantité, que faire ?");
  p("Cliquez sur l'icône crayon de la ligne concernée, corrigez, puis validez. La modification est immédiate.");

  h2("Comment supprimer un dépôt ?");
  p("Cliquez sur l'icône poubelle. Attention : la suppression est définitive et les ventes associées à ce dépôt seront perdues.");

  h2("Je ne vois pas l'onglet Bordereaux, pourquoi ?");
  p("L'onglet 📄 Bordereaux est réservé au plan Business. Un clic dessus affiche l'écran d'upgrade avec le bouton pour passer au plan supérieur.");

  h2("Un libraire me rend des livres invendus, comment enregistrer ?");
  p("Ouvrez la ligne dans Stock externe, modifiez la quantité déposée en la diminuant du nombre retourné, puis augmentez d'autant votre Stock interne. Vos totaux restent cohérents.");

  h2("Puis-je exporter mes ventes ?");
  p("Oui : la page Finances propose l'export CSV / PDF de toutes vos ventes avec commission et droits d'auteur détaillés.");

  // ─── 8. Support ────────────────────────────────────────
  h1("8. Support");
  p("Une question, un bug, une suggestion ? L'équipe FIGDITIONS est joignable :");
  bullet("Email : contact@figditions.xyz");
  bullet("Depuis l'application : Paramètres → Support");
  p("Nous répondons en général sous 24 heures ouvrées.");

  callout("Merci !", "Nous espérons que ce manuel vous rendra la gestion des stocks plus simple et plus rapide. Bonne édition !", "example");

  addFooter();

  doc.save(`Manuel-Stocks-FIGDITIONS.pdf`);
}
