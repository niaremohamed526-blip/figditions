import jsPDF from "jspdf";
import { pl } from "@/lib/plural";
import { calculerResultat, coutUnitaireParLivre } from "@/lib/finance-calc";
import { chargerMarquePdf, dessinerEnteteSuite, dessinerTableau, finaliserPdf, PDF, type Cellule, type MarquePdf } from "@/lib/pdf-theme";

export type ReportLang = "fr" | "en";

export interface ReportSections {
  resume: boolean;
  ventes: boolean;
  droits: boolean;
  livres: boolean;
  librairies: boolean;
  stocks: boolean;
  depenses: boolean;
  rentabilite: boolean;
  /** Livres distribués pour d'autres maisons (sans droits d'auteur). */
  etrangers?: boolean;
}

export interface Vente {
  id: string;
  manuscrit_id: string;
  auteur_id: string | null;
  quantite_vendue: number;
  prix_unitaire_fcfa: number;
  montant_total_fcfa: number;
  droits_auteur_fcfa: number;
  commission_librairie_fcfa: number;
  remise_fcfa?: number | null;
  prix_catalogue_fcfa?: number | null;
  canal_vente: "externe" | "interne";
  statut_paiement: "en_attente" | "paye";
  date_vente: string;
  librairie_nom?: string | null;
  statut_encaissement?: string | null;
  montant_encaisse_fcfa?: number | null;
}
export interface Manuscrit { id: string; titre: string; auteur: string | null; auteur_id: string | null; genre?: string | null; origine?: string | null; }
export interface Auteur { id: string; nom_complet: string; email?: string | null; telephone?: string | null; mobile_money_operateur?: string | null; mobile_money_numero?: string | null; }
export interface Stock { id: string; manuscrit_id: string; librairie_nom: string | null; librairie_adresse?: string | null; exemplaires_deposes: number; exemplaires_vendus: number; exemplaires_restants: number; derniere_visite?: string | null; prix_unitaire_fcfa: number; }
export interface StockInterne { id: string; manuscrit_id: string; quantite_imprimee?: number; quantite_disponible: number; quantite_reservee?: number; quantite_vendue_directement?: number; prix_vente_direct_fcfa?: number | null; seuil_alerte?: number; cout_unitaire_impression_fcfa?: number | null; }
export interface Depense { categorie: string; libelle: string; montant_fcfa: number; date_depense: string; manuscrit_id?: string | null; }

export interface ReportInput {
  lang: ReportLang;
  from: string; // yyyy-mm-dd
  to: string;
  sections: ReportSections;
  entrepriseNom: string;
  ventes: Vente[];
  manuscrits: Manuscrit[];
  auteurs: Auteur[];
  stocks: Stock[];
  stockInterne: StockInterne[];
  depenses?: Depense[];
  previousVentes?: Vente[]; // for comparison
}

// ---------- i18n ----------
const T = {
  fr: {
    title: "RAPPORT FINANCIER",
    kpiVsAvant: "vs période précédente",
    depenseUn: "dépense", depensePlusieurs: "dépenses",
    kpiResultatSub: "Ventes - commissions - droits - impression - dépenses",
    canal: "Vendu par",
    droitsStatut: "Droits",
    venteUn: "vente", ventePlusieurs: "ventes",
    resteAPayer: "Reste à payer",
    reste: "Reste dû",
    titresCol: "Titres",
    etrangers: "LIVRES ÉTRANGERS DISTRIBUÉS",
    commission: "Commission",
    net: "Net",
    etrangersNote: "Aucun droit d'auteur n'est calculé sur ces ventes : les livres appartiennent à d'autres maisons d'édition.",
    epuise: "Épuisé", stockBas: "Stock bas", disponible: "Disponible",
    ventesMontant: "Ventes",
    period: (a: string, b: string) => `Du ${a} au ${b}`,
    generatedAt: (d: string) => `Généré le ${d}`,
    confidential: "Document confidentiel, usage interne",
    resume: "RÉSUMÉ EXÉCUTIF",
    ventes: "DÉTAIL DES VENTES",
    droits: "DROITS D'AUTEUR",
    livres: "ANALYSE PAR LIVRE",
    librairies: "ANALYSE PAR LIBRAIRIE",
    stocks: "ÉTAT DES STOCKS",
    kpiRevenue: "Chiffre d'affaires",
    kpiCount: "Nombre de ventes",
    kpiRoyalties: "Droits d'auteur",
    kpiTop: "Livre le plus vendu",
    kpiEncaisse: "Encaissé",
    kpiAEncaisser: "À encaisser",
    kpiDepenses: "Dépenses",
    kpiResultat: "Bénéfice de la période",
    depenses: "DÉPENSES",
    rentabilite: "RENTABILITÉ PAR LIVRE",
    categorie: "Catégorie",
    libelle: "Libellé",
    montantCol: "Montant",
    investi: "Investi",
    coutProd: "Coût production",
    marge: "Marge",
    resultatCol: "Bénéfice",
    seuilRent: "Seuil (ex.)",
    encaisseCol: "Encaissé",
    nonLiees: "Charges globales",
    depensesText: (n: number, total: string) => `${pl(n, "dépense déclarée", "dépenses déclarées")} sur la période pour un total de ${total}.`,
    rentabiliteText: "Bénéfice = ventes - commissions - droits d'auteur - impression des exemplaires vendus - dépenses du livre. Les exemplaires non vendus restent du stock. Investi = tout le tirage imprimé + dépenses du livre. Seuil = exemplaires à vendre pour rembourser l'investissement.",
    fcfa: "FCFA",
    transactions: "transactions",
    copies: "exemplaires vendus",
    paid: "Payés",
    pending: "En attente",
    noData: "Aucune donnée pour cette période",
    date: "Date",
    livre: "Livre",
    auteur: "Auteur",
    type: "Type",
    librairie: "Librairie",
    qte: "Qté",
    pu: "Prix unit.",
    total: "Total",
    droitsCol: "Droits",
    statut: "Statut",
    canalExt: "Librairie",
    canalInt: "Vente Libre",
    payeShort: "Payé",
    attente: "En attente",
    totalGeneral: "TOTAL",
    remise: "Remise",
    remisesLigne: (r: string) => `Remises accordées sur la période (ventes libres) : ${r}.`,
    grandDroits: "TOTAL GÉNÉRAL DES DROITS",
    subtotal: (n: string) => `Total ${n}`,
    contact: "Contact",
    mm: "Mobile Money",
    ventesCol: "Ventes",
    ca: "CA généré",
    taux: "Taux",
    droitsDus: "Droits dus",
    genre: "Genre",
    stockRestant: "Stock restant",
    sellthrough: "Taux d'écoulement",
    best: "Meilleure vente",
    good: "Bonne performance",
    watch: "À surveiller",
    adresse: "Adresse",
    deposes: "Déposés",
    vendus: "Vendus",
    restants: "Restants",
    derniereVisite: "Dernière visite",
    interne: "STOCK INTERNE",
    externe: "STOCK EXTERNE",
    imprimes: "Imprimés",
    dispo: "Disponibles",
    reserves: "Réservés",
    valeur: "Valeur stock",
    at: (d: string) => `Au ${d}`,
    resumeText: (nom: string, a: string, b: string, nv: number, ca: string, na: number, dr: string, pa: string) =>
      `Durant la période du ${a} au ${b}, ${nom} a enregistré ${pl(nv, "vente", "ventes")} pour un chiffre d'affaires total de ${ca}. ${pl(na, "auteur a", "auteurs ont")} généré des droits s'élevant à ${dr}, dont ${pa} ont été réglés.`,
    footer: (nom: string, d: string) =>
      `Ce rapport a été généré automatiquement par FIGDITIONS le ${d}. Les données présentées sont confidentielles et destinées à l'usage exclusif de ${nom}.`,
    tagline: "FIGDITIONS · La plateforme des maisons d'édition · figditions.xyz",
    site: "figditions.xyz",
    headerRight: (a: string, b: string) => `Rapport financier du ${a} au ${b}`,
    page: "Page",
    of: "/",
    suite: "Suite page suivante",
  },
  en: {
    title: "FINANCIAL REPORT",
    kpiVsAvant: "vs previous period",
    depenseUn: "expense", depensePlusieurs: "expenses",
    kpiResultatSub: "Sales - commissions - royalties - printing - expenses",
    canal: "Sold by",
    droitsStatut: "Royalties",
    venteUn: "sale", ventePlusieurs: "sales",
    resteAPayer: "Left to pay",
    reste: "Left",
    titresCol: "Titles",
    etrangers: "DISTRIBUTED FOREIGN BOOKS",
    commission: "Commission",
    net: "Net",
    etrangersNote: "No royalties apply to these sales: the titles belong to other publishers.",
    epuise: "Sold out", stockBas: "Low stock", disponible: "Available",
    ventesMontant: "Sales",
    period: (a: string, b: string) => `From ${a} to ${b}`,
    generatedAt: (d: string) => `Generated on ${d}`,
    confidential: "Confidential - Internal use",
    resume: "EXECUTIVE SUMMARY",
    ventes: "SALES DETAIL",
    droits: "AUTHOR ROYALTIES",
    livres: "PER BOOK ANALYSIS",
    librairies: "PER BOOKSTORE ANALYSIS",
    stocks: "INVENTORY STATUS",
    kpiRevenue: "Revenue",
    kpiCount: "Number of sales",
    kpiRoyalties: "Author royalties",
    kpiTop: "Top selling book",
    kpiEncaisse: "Collected",
    kpiAEncaisser: "Outstanding",
    kpiDepenses: "Expenses",
    kpiResultat: "Profit for the period",
    depenses: "EXPENSES",
    rentabilite: "PER BOOK PROFITABILITY",
    categorie: "Category",
    libelle: "Label",
    montantCol: "Amount",
    investi: "Invested",
    coutProd: "Production cost",
    marge: "Margin",
    resultatCol: "Profit",
    seuilRent: "Break-even (copies)",
    encaisseCol: "Collected",
    nonLiees: "Global charges",
    depensesText: (n: number, total: string) => `${pl(n, "expense", "expenses")} recorded over the period for a total of ${total}.`,
    rentabiliteText: "Profit = sales - commissions - royalties - printing of the copies sold - book expenses. Unsold copies remain stock. Invested = whole print run + book expenses. Break-even = copies to sell to pay back the investment.",
    fcfa: "FCFA",
    transactions: "transactions",
    copies: "copies sold",
    paid: "Paid",
    pending: "Pending",
    noData: "No data for this period",
    date: "Date",
    livre: "Book",
    auteur: "Author",
    type: "Type",
    librairie: "Bookstore",
    qte: "Qty",
    pu: "Unit price",
    total: "Total",
    droitsCol: "Royalties",
    statut: "Status",
    canalExt: "Bookstore",
    canalInt: "Direct sale",
    payeShort: "Paid",
    attente: "Pending",
    totalGeneral: "TOTAL",
    remise: "Discount",
    remisesLigne: (r: string) => `Discounts granted over the period (direct sales): ${r}.`,
    grandDroits: "GRAND TOTAL ROYALTIES",
    subtotal: (n: string) => `Total ${n}`,
    contact: "Contact",
    mm: "Mobile Money",
    ventesCol: "Sales",
    ca: "Revenue",
    taux: "Rate",
    droitsDus: "Royalties due",
    genre: "Genre",
    stockRestant: "Remaining stock",
    sellthrough: "Sell-through rate",
    best: "Best seller",
    good: "Good performance",
    watch: "Watch",
    adresse: "Address",
    deposes: "Deposited",
    vendus: "Sold",
    restants: "Remaining",
    derniereVisite: "Last visit",
    interne: "INTERNAL STOCK",
    externe: "EXTERNAL STOCK",
    imprimes: "Printed",
    dispo: "Available",
    reserves: "Reserved",
    valeur: "Stock value",
    at: (d: string) => `As of ${d}`,
    resumeText: (nom: string, a: string, b: string, nv: number, ca: string, na: number, dr: string, pa: string) =>
      `From ${a} to ${b}, ${nom} recorded ${pl(nv, "sale", "sales")} for a total revenue of ${ca}. ${pl(na, "author", "authors")} generated royalties amounting to ${dr}, of which ${pa} has been paid.`,
    footer: (nom: string, d: string) =>
      `This report was automatically generated by FIGDITIONS on ${d}. The data is confidential and intended for the exclusive use of ${nom}.`,
    tagline: "FIGDITIONS · The publishing house platform · figditions.xyz",
    site: "figditions.xyz",
    headerRight: (a: string, b: string) => `Financial report, ${a} to ${b}`,
    page: "Page",
    of: "/",
    suite: "Continued on next page",
  },
};

// ---------- helpers ----------
const GOLD = PDF.goldDark;

// Strip any characters outside WinAnsi-safe range (jsPDF built-in fonts).
// Keeps ASCII + French accents; replaces smart quotes/dashes/emoji with plain equivalents.
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
    // strip emoji + all remaining non-WinAnsi symbols (keep accented latin letters)
    .replace(/[^\x20-\x7EÀ-ÖØ-öø-ÿ€œŒŸ]/g, "");
}

function readableValue(value: string | null | undefined): string {
  return clean(String(value ?? "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim());
}
const fmtN = (n: number | null | undefined) => clean(new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0)));
/** Table header with the currency, so cells can show plain numbers. */
const fc = (h: string) => `${h} (FCFA)`;
const fmtFCFA = (n: number) => clean(new Intl.NumberFormat("fr-FR").format(Math.round(n || 0))) + " FCFA";
const fmtDate = (d: string | null | undefined) => {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
};
const fmtDateTime = (d: Date) =>
  `${fmtDate(d.toISOString())} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

function truncate(txt: string, max: number): string {
  const t = clean(txt);
  if (!t) return "";
  return t.length > max ? t.slice(0, max - 1) + "..." : t;
}

// ---------- PDF Builder ----------
class PdfBuilder {
  doc: jsPDF;
  cursorY = 0;
  input: ReportInput;
  t: (typeof T)["fr"];
  marque: MarquePdf;
  marginX = PDF.marge;
  marginBottom = 64;

  constructor(input: ReportInput, marque: MarquePdf) {
    this.doc = new jsPDF({ unit: "pt", format: "a4" });
    this.input = input;
    this.t = T[input.lang];
    this.marque = marque;
  }

  get pageWidth() { return this.doc.internal.pageSize.getWidth(); }
  get pageHeight() { return this.doc.internal.pageSize.getHeight(); }
  get contentWidth() { return this.pageWidth - this.marginX * 2; }
  get titreSuite() {
    return `${clean(this.input.entrepriseNom)} · ${this.t.headerRight(fmtDate(this.input.from), fmtDate(this.input.to))}`;
  }

  addPageIfNeeded(needed: number) {
    if (this.cursorY + needed > this.pageHeight - this.marginBottom) {
      this.newPage();
    }
  }

  newPage() {
    this.doc.addPage();
    this.cursorY = dessinerEnteteSuite(this.doc, this.marque, this.titreSuite);
  }

  /** Text line whose top sits at cursorY; moves the cursor below it. */
  ligne(txt: string, opts: { taille?: number; style?: "normal" | "bold" | "italic"; couleur?: string; espace?: number } = {}) {
    const taille = opts.taille ?? 9.5;
    // A single line may use the space just above the footer.
    if (this.cursorY + taille * 1.4 > this.pageHeight - 50) this.newPage();
    const d = this.doc;
    d.setFont("helvetica", opts.style ?? "normal");
    d.setFontSize(taille);
    d.setTextColor(opts.couleur ?? PDF.ink);
    const lignes = d.splitTextToSize(txt, this.contentWidth) as string[];
    d.text(lignes, this.marginX, this.cursorY + taille * 0.9);
    this.cursorY += lignes.length * taille * 1.35 + (opts.espace ?? 4);
  }

  // ---------- Cover ----------
  drawCover() {
    const d = this.doc;
    const W = this.pageWidth;
    const H = this.pageHeight;
    d.setFillColor(PDF.gold);
    d.rect(0, 0, W, 6, "F");

    let y = 170;
    if (this.marque.figditions) {
      const img = this.marque.figditions;
      const k = Math.min(220 / img.w, 110 / img.h);
      try { d.addImage(img.dataUrl, "PNG", (W - img.w * k) / 2, y, img.w * k, img.h * k, "figditions-logo", "FAST"); } catch { /* noop */ }
      y += img.h * k + 60;
    } else {
      d.setFont("helvetica", "bold");
      d.setFontSize(28);
      d.setTextColor(PDF.goldDark);
      d.text("FIGDITIONS", W / 2, y + 40, { align: "center" });
      y += 110;
    }

    d.setDrawColor(PDF.gold);
    d.setLineWidth(1.2);
    d.line(W / 2 - 40, y, W / 2 + 40, y);
    y += 50;

    d.setFont("helvetica", "bold");
    d.setFontSize(30);
    d.setTextColor(PDF.ink);
    d.text(this.t.title, W / 2, y, { align: "center" });
    y += 34;

    d.setFont("helvetica", "normal");
    d.setFontSize(17);
    d.setTextColor(PDF.goldDark);
    const nom = d.splitTextToSize(clean(this.input.entrepriseNom), this.contentWidth - 40) as string[];
    d.text(nom, W / 2, y, { align: "center" });
    y += nom.length * 22 + 18;

    const periode = this.t.period(fmtDate(this.input.from), fmtDate(this.input.to));
    d.setFont("helvetica", "bold");
    d.setFontSize(11);
    const pw = d.getTextWidth(periode) + 36;
    d.setFillColor(PDF.goldSoft);
    d.setDrawColor(PDF.gold);
    d.setLineWidth(0.8);
    d.roundedRect((W - pw) / 2, y, pw, 28, 14, 14, "FD");
    d.setTextColor(PDF.ink);
    d.text(periode, W / 2, y + 18, { align: "center" });

    d.setFont("helvetica", "normal");
    d.setFontSize(9);
    d.setTextColor(PDF.muted);
    d.text(this.t.generatedAt(fmtDateTime(new Date())), W / 2, H - 110, { align: "center" });
    d.setFont("helvetica", "italic");
    d.text(this.t.confidential, W / 2, H - 95, { align: "center" });
  }

  // ---------- Section title ----------
  sectionTitle(txt: string) {
    if (this.cursorY > 90) this.cursorY += 14;
    this.addPageIfNeeded(110);
    const d = this.doc;
    d.setFont("helvetica", "bold");
    d.setFontSize(14);
    d.setTextColor(PDF.ink);
    d.text(txt, this.marginX, this.cursorY + 12);
    d.setDrawColor(PDF.gold);
    d.setLineWidth(2);
    d.line(this.marginX, this.cursorY + 21, this.marginX + 44, this.cursorY + 21);
    this.cursorY += 38;
  }

  // ---------- KPI grid ----------
  drawKpiGrid(kpis: { label: string; value: string; sub?: string; color?: string; delta?: { pct: number; up: boolean } }[]) {
    const d = this.doc;
    const cols = 2;
    const gap = 12;
    const boxW = (this.contentWidth - gap) / cols;
    const boxH = 72;
    const fit = (s: string, max: number) => {
      let t = s;
      while (t.length > 1 && d.getTextWidth(t) > max) t = t.slice(0, -2) + "…";
      return t;
    };
    for (let i = 0; i < kpis.length; i += cols) {
      this.addPageIfNeeded(boxH + gap);
      kpis.slice(i, i + cols).forEach((k, col) => {
        const x = this.marginX + col * (boxW + gap);
        const y = this.cursorY;
        d.setDrawColor(PDF.border);
        d.setFillColor("#FFFFFF");
        d.setLineWidth(0.8);
        d.roundedRect(x, y, boxW, boxH, 6, 6, "FD");
        d.setFont("helvetica", "bold");
        d.setFontSize(7.5);
        d.setTextColor(PDF.goldDark);
        d.text(fit(k.label.toUpperCase(), boxW - 28), x + 14, y + 18);
        d.setFontSize(16);
        d.setTextColor(k.color ?? PDF.ink);
        d.text(fit(k.value, boxW - 28), x + 14, y + 41);
        if (k.sub) {
          d.setFont("helvetica", "normal");
          d.setFontSize(8.5);
          d.setTextColor(PDF.muted);
          d.text(fit(k.sub, boxW - 28 - (k.delta ? 50 : 0)), x + 14, y + 59);
        }
        if (k.delta) {
          const label = `${k.delta.up ? "+" : "-"}${Math.abs(k.delta.pct).toFixed(1)} %`;
          d.setFont("helvetica", "bold");
          d.setFontSize(8.5);
          d.setTextColor(k.delta.up ? PDF.green : PDF.red);
          d.text(label, x + boxW - 14, y + 59, { align: "right" });
        }
      });
      this.cursorY += boxH + gap;
    }
    this.cursorY += 6;
  }

  paragraph(txt: string) {
    this.ligne(txt, { taille: 9.5, couleur: "#333333", espace: 10 });
  }

  // ---------- Table ----------
  drawTable(headers: string[], rows: Cellule[][], opts: { widths?: number[]; totalRow?: Cellule[]; aligns?: ("left" | "right" | "center")[] } = {}) {
    const cw = this.contentWidth;
    const widths = opts.widths ?? headers.map(() => cw / headers.length);
    const colonnes = headers.map((titre, i) => ({ titre, largeur: widths[i] / cw, align: opts.aligns?.[i] ?? "left" }));
    this.cursorY = dessinerTableau(this.doc, this.marque, this.titreSuite, this.cursorY, colonnes, rows, this.marginBottom, opts.totalRow ?? null);
  }

  // ---------- Sections ----------
  /** Ventes de nos propres livres (les livres distribués pour d'autres maisons n'ont ni droits ni coût d'impression). */
  get ventesPropres() {
    const etrangers = new Set(this.input.manuscrits.filter((m) => m.origine === "etranger").map((m) => m.id));
    return this.input.ventes.filter((v) => !etrangers.has(v.manuscrit_id));
  }

  get coutUnitaire() {
    return coutUnitaireParLivre(this.input.stockInterne.map((s) => ({
      manuscrit_id: s.manuscrit_id,
      quantite_imprimee: Number(s.quantite_imprimee || 0),
      cout_unitaire_impression_fcfa: Number(s.cout_unitaire_impression_fcfa || 0),
    })));
  }

  buildResume() {
    this.sectionTitle(this.t.resume);
    const v = this.input.ventes;
    const totalRev = v.reduce((a, x) => a + Number(x.montant_total_fcfa || 0), 0);
    const totalRoyalties = v.reduce((a, x) => a + Number(x.droits_auteur_fcfa || 0), 0);
    const paidRoy = v.filter((x) => x.statut_paiement === "paye").reduce((a, x) => a + Number(x.droits_auteur_fcfa || 0), 0);
    const pendingRoy = totalRoyalties - paidRoy;
    const totalRemises = v.reduce((a, x) => a + Number(x.remise_fcfa || 0), 0);

    // top book
    const byBook: Record<string, number> = {};
    v.forEach((s) => { byBook[s.manuscrit_id] = (byBook[s.manuscrit_id] ?? 0) + Number(s.quantite_vendue || 0); });
    const topId = Object.entries(byBook).sort((a, b) => b[1] - a[1])[0];
    const mMap = Object.fromEntries(this.input.manuscrits.map((m) => [m.id, m]));
    const topTitle = topId ? clean(mMap[topId[0]]?.titre ?? "-") : "-";
    const topQty = topId ? topId[1] : 0;

    // delta
    let delta: { pct: number; up: boolean } | undefined;
    if (this.input.previousVentes && this.input.previousVentes.length > 0) {
      const prev = this.input.previousVentes.reduce((a, x) => a + Number(x.montant_total_fcfa || 0), 0);
      if (prev > 0) {
        const pct = ((totalRev - prev) / prev) * 100;
        delta = { pct, up: pct >= 0 };
      }
    }

    const authorsSet = new Set<string>();
    v.forEach((s) => { const aid = s.auteur_id ?? mMap[s.manuscrit_id]?.auteur_id; if (aid) authorsSet.add(aid); });

    const encaisse = v.reduce((a, x) => a + Number(x.montant_encaisse_fcfa || 0), 0);
    const aEncaisser = Math.max(0, totalRev - encaisse);
    const totalDep = (this.input.depenses ?? []).reduce((a, x) => a + Number(x.montant_fcfa || 0), 0);
    // Même bénéfice que l'application (lib/finance-calc).
    const resultat = calculerResultat(this.ventesPropres as any, (this.input.depenses ?? []) as any, this.coutUnitaire).benefice;

    this.drawKpiGrid([
      { label: this.t.kpiRevenue, value: fmtFCFA(totalRev), sub: delta ? this.t.kpiVsAvant : undefined, delta },
      { label: this.t.kpiEncaisse, value: fmtFCFA(encaisse), sub: `${this.t.kpiAEncaisser} : ${fmtFCFA(aEncaisser)}` },
      { label: this.t.kpiDepenses, value: fmtFCFA(totalDep), sub: pl(this.input.depenses?.length ?? 0, this.t.depenseUn, this.t.depensePlusieurs) },
      { label: this.t.kpiResultat, value: fmtFCFA(resultat), color: resultat < 0 ? PDF.red : PDF.green, sub: this.t.kpiResultatSub },
      { label: this.t.kpiCount, value: String(v.length), sub: this.t.transactions },
      { label: this.t.kpiRoyalties, value: fmtFCFA(totalRoyalties), sub: `${this.t.paid} : ${fmtFCFA(paidRoy)} · ${this.t.pending} : ${fmtFCFA(pendingRoy)}` },
      { label: this.t.kpiTop, value: topTitle, sub: `${topQty} ${this.t.copies}` },
    ]);

    if (totalRemises > 0) {
      this.paragraph(this.t.remisesLigne(fmtFCFA(totalRemises)));
    }

    this.paragraph(
      this.t.resumeText(
        clean(this.input.entrepriseNom),
        fmtDate(this.input.from),
        fmtDate(this.input.to),
        v.length,
        fmtFCFA(totalRev),
        authorsSet.size,
        fmtFCFA(totalRoyalties),
        fmtFCFA(paidRoy),
      ),
    );
  }

  buildVentes() {
    this.sectionTitle(this.t.ventes);
    const v = this.input.ventes;
    if (v.length === 0) { this.paragraph(this.t.noData); return; }
    const mMap = Object.fromEntries(this.input.manuscrits.map((m) => [m.id, m]));
    const aMap = Object.fromEntries(this.input.auteurs.map((a) => [a.id, a.nom_complet]));
    const rows: Cellule[][] = v.map((s) => {
      const m = mMap[s.manuscrit_id];
      const aid = s.auteur_id ?? m?.auteur_id;
      const auteur = clean((aid && aMap[aid]) || m?.auteur || "");
      const isExt = s.canal_vente !== "interne";
      const paye = s.statut_paiement === "paye";
      const sansDroits = Number(s.droits_auteur_fcfa || 0) === 0;
      return [
        fmtDate(s.date_vente),
        { texte: clean(m?.titre ?? "-"), sous: auteur || null },
        isExt ? clean(s.librairie_nom || this.t.canalExt) : this.t.canalInt,
        String(s.quantite_vendue),
        { texte: fmtN(s.montant_total_fcfa), gras: true },
        sansDroits ? "-" : fmtN(s.droits_auteur_fcfa),
        sansDroits ? "-" : { texte: paye ? this.t.payeShort : this.t.attente, couleur: paye ? PDF.green : PDF.goldDark },
      ];
    });
    const cw = this.contentWidth;
    const totalQty = v.reduce((a, x) => a + Number(x.quantite_vendue || 0), 0);
    const totalRev = v.reduce((a, x) => a + Number(x.montant_total_fcfa || 0), 0);
    const totalRoy = v.reduce((a, x) => a + Number(x.droits_auteur_fcfa || 0), 0);
    this.drawTable(
      [this.t.date, this.t.livre, this.t.canal, this.t.qte, fc(this.t.total), fc(this.t.droitsCol), this.t.droitsStatut],
      rows,
      {
        widths: [cw * 0.125, cw * 0.275, cw * 0.15, cw * 0.06, cw * 0.14, cw * 0.13, cw * 0.12],
        aligns: ["left", "left", "left", "right", "right", "right", "left"],
        totalRow: [this.t.totalGeneral, pl(v.length, this.t.venteUn, this.t.ventePlusieurs), "", String(totalQty), fmtN(totalRev), fmtN(totalRoy), ""],
      },
    );
  }

  buildDroits() {
    this.sectionTitle(this.t.droits);
    const v = this.ventesPropres;
    if (v.length === 0) { this.paragraph(this.t.noData); return; }
    const mMap = Object.fromEntries(this.input.manuscrits.map((m) => [m.id, m]));
    const aMap = Object.fromEntries(this.input.auteurs.map((a) => [a.id, a]));

    // group by author
    const byAuthor: Record<string, Vente[]> = {};
    v.forEach((s) => {
      const aid = s.auteur_id ?? mMap[s.manuscrit_id]?.auteur_id ?? "_unknown";
      (byAuthor[aid] ||= []).push(s);
    });

    let grand = 0;
    let grandPaye = 0;
    Object.entries(byAuthor).forEach(([aid, sales]) => {
      this.addPageIfNeeded(120);
      const auteur = aMap[aid];
      const name = clean(auteur?.nom_complet ?? mMap[sales[0].manuscrit_id]?.auteur ?? "-");
      this.ligne(name, { taille: 11.5, style: "bold", couleur: PDF.ink, espace: 2 });
      const info = [
        auteur?.email || auteur?.telephone ? `${this.t.contact} : ${[auteur?.email, auteur?.telephone].filter(Boolean).join(" · ")}` : null,
        auteur?.mobile_money_numero ? `${this.t.mm} : ${[auteur.mobile_money_operateur, auteur.mobile_money_numero].filter(Boolean).join(" ")}` : null,
      ].filter(Boolean) as string[];
      info.forEach((line) => this.ligne(clean(line), { taille: 8.5, couleur: PDF.muted, espace: 1 }));
      this.cursorY += 6;

      // per-book aggregate
      const byBook: Record<string, { qte: number; ca: number; droits: number; paid: number }> = {};
      sales.forEach((s) => {
        const k = s.manuscrit_id;
        byBook[k] ||= { qte: 0, ca: 0, droits: 0, paid: 0 };
        byBook[k].qte += Number(s.quantite_vendue || 0);
        byBook[k].ca += Number(s.montant_total_fcfa || 0);
        byBook[k].droits += Number(s.droits_auteur_fcfa || 0);
        if (s.statut_paiement === "paye") byBook[k].paid += Number(s.droits_auteur_fcfa || 0);
      });

      const rows: Cellule[][] = Object.entries(byBook).map(([mid, b]) => {
        const rate = b.ca > 0 ? (b.droits / b.ca) * 100 : 0;
        const reste = b.droits - b.paid;
        return [
          clean(mMap[mid]?.titre ?? "-"),
          String(b.qte),
          fmtN(b.ca),
          `${rate.toFixed(1).replace(".", ",")} %`,
          { texte: fmtN(b.droits), gras: true },
          reste > 0 ? { texte: fmtN(reste), couleur: PDF.goldDark } : { texte: this.t.payeShort, couleur: PDF.green },
        ];
      });
      const totalRoy = sales.reduce((a, x) => a + Number(x.droits_auteur_fcfa || 0), 0);
      const paidRoy = sales.filter((x) => x.statut_paiement === "paye").reduce((a, x) => a + Number(x.droits_auteur_fcfa || 0), 0);
      grand += totalRoy;
      grandPaye += paidRoy;
      const cw = this.contentWidth;
      this.drawTable(
        [this.t.livre, this.t.ventesCol, fc(this.t.ca), this.t.taux, fc(this.t.droitsCol), fc(this.t.reste)],
        rows,
        {
          widths: [cw * 0.33, cw * 0.09, cw * 0.16, cw * 0.1, cw * 0.16, cw * 0.16],
          aligns: ["left", "right", "right", "right", "right", "right"],
          totalRow: [this.t.subtotal(name), "", "", "", fmtN(totalRoy), totalRoy - paidRoy > 0 ? fmtN(totalRoy - paidRoy) : this.t.payeShort],
        },
      );
    });

    this.addPageIfNeeded(40);
    const d = this.doc;
    d.setDrawColor(PDF.gold);
    d.setLineWidth(1);
    d.line(this.marginX, this.cursorY, this.marginX + this.contentWidth, this.cursorY);
    this.cursorY += 8;
    this.ligne(`${this.t.grandDroits} : ${fmtFCFA(grand)}`, { taille: 12, style: "bold", couleur: PDF.ink, espace: 2 });
    this.ligne(`${this.t.paid} : ${fmtFCFA(grandPaye)} · ${this.t.resteAPayer} : ${fmtFCFA(grand - grandPaye)}`, { taille: 9, couleur: PDF.muted });
  }

  buildLivres() {
    this.sectionTitle(this.t.livres);
    const v = this.input.ventes;
    const mMap = Object.fromEntries(this.input.manuscrits.map((m) => [m.id, m]));
    const aMap = Object.fromEntries(this.input.auteurs.map((a) => [a.id, a.nom_complet]));
    // aggregate per book
    const agg: Record<string, { qte: number; ca: number; droits: number }> = {};
    v.forEach((s) => {
      agg[s.manuscrit_id] ||= { qte: 0, ca: 0, droits: 0 };
      agg[s.manuscrit_id].qte += Number(s.quantite_vendue || 0);
      agg[s.manuscrit_id].ca += Number(s.montant_total_fcfa || 0);
      agg[s.manuscrit_id].droits += Number(s.droits_auteur_fcfa || 0);
    });
    const stockRestMap: Record<string, number> = {};
    this.input.stocks.forEach((s) => { stockRestMap[s.manuscrit_id] = (stockRestMap[s.manuscrit_id] ?? 0) + Number(s.exemplaires_restants || 0); });
    this.input.stockInterne.forEach((s) => { stockRestMap[s.manuscrit_id] = (stockRestMap[s.manuscrit_id] ?? 0) + Number(s.quantite_disponible || 0); });

    const ranked = Object.entries(agg).sort((a, b) => b[1].qte - a[1].qte);
    if (ranked.length === 0) { this.paragraph(this.t.noData); return; }

    const d = this.doc;
    ranked.forEach(([mid, r], idx) => {
      this.addPageIfNeeded(78);
      const m = mMap[mid];
      const top = this.cursorY;
      const rest = stockRestMap[mid] ?? 0;
      const totalBooks = r.qte + rest;
      const rate = totalBooks > 0 ? (r.qte / totalBooks) * 100 : 0;

      let badge: { txt: string; couleur: string } | null = null;
      if (idx === 0) badge = { txt: this.t.best, couleur: PDF.green };
      else if (idx < 3) badge = { txt: this.t.good, couleur: PDF.goldDark };
      else if (rate < 20) badge = { txt: this.t.watch, couleur: PDF.red };
      let badgeW = 0;
      if (badge) {
        d.setFont("helvetica", "bold");
        d.setFontSize(7.5);
        badgeW = d.getTextWidth(badge.txt.toUpperCase()) + 16;
        d.setDrawColor(badge.couleur);
        d.setLineWidth(0.7);
        d.roundedRect(this.pageWidth - this.marginX - badgeW, top, badgeW, 16, 8, 8, "S");
        d.setTextColor(badge.couleur);
        d.text(badge.txt.toUpperCase(), this.pageWidth - this.marginX - badgeW / 2, top + 11, { align: "center" });
      }

      d.setFont("helvetica", "bold");
      d.setFontSize(11.5);
      d.setTextColor(PDF.ink);
      let titre = clean(m?.titre ?? "-");
      while (titre.length > 1 && d.getTextWidth(titre) > this.contentWidth - badgeW - 12) titre = titre.slice(0, -2) + "…";
      d.text(titre, this.marginX, top + 11);

      const aid = m?.auteur_id;
      const auteur = clean((aid && aMap[aid]) || m?.auteur || "-");
      d.setFont("helvetica", "normal");
      d.setFontSize(8.5);
      d.setTextColor(PDF.muted);
      d.text(`${auteur}${m?.genre ? ` · ${clean(m.genre)}` : ""}`, this.marginX, top + 25);

      d.setFontSize(9);
      d.setTextColor("#333333");
      d.text(
        `${this.t.ventesCol} : ${r.qte}   ·   ${this.t.ca} : ${fmtFCFA(r.ca)}   ·   ${this.t.droitsCol} : ${fmtFCFA(r.droits)}   ·   ${this.t.stockRestant} : ${rest}`,
        this.marginX, top + 41,
      );

      const barW = 220;
      d.setFillColor("#EEE7D8");
      d.roundedRect(this.marginX, top + 49, barW, 6, 3, 3, "F");
      if (rate > 0) {
        d.setFillColor(PDF.gold);
        d.roundedRect(this.marginX, top + 49, Math.max(6, (barW * rate) / 100), 6, 3, 3, "F");
      }
      d.setFontSize(8.5);
      d.setTextColor(PDF.muted);
      d.text(`${this.t.sellthrough} : ${Math.round(rate)} %`, this.marginX + barW + 10, top + 55);

      this.cursorY = top + 66;
      d.setDrawColor(PDF.border);
      d.setLineWidth(0.4);
      d.line(this.marginX, this.cursorY, this.marginX + this.contentWidth, this.cursorY);
      this.cursorY += 12;
    });
  }

  buildLibrairies() {
    this.sectionTitle(this.t.librairies);
    const stocks = this.input.stocks;
    if (stocks.length === 0) { this.paragraph(this.t.noData); return; }
    // aggregate per librairie
    const agg: Record<string, {
      adresse: string;
      deposes: number; vendus: number; restants: number;
      ca: number; derniere: string | null;
      livres: Set<string>;
    }> = {};
    stocks.forEach((s) => {
      const key = s.librairie_nom || "-";
      const a = (agg[key] ||= { adresse: s.librairie_adresse ?? "", deposes: 0, vendus: 0, restants: 0, ca: 0, derniere: null, livres: new Set() });
      a.deposes += Number(s.exemplaires_deposes || 0);
      a.vendus += Number(s.exemplaires_vendus || 0);
      a.restants += Number(s.exemplaires_restants || 0);
      a.ca += Number(s.exemplaires_vendus || 0) * Number(s.prix_unitaire_fcfa || 0);
      a.livres.add(s.manuscrit_id);
      if (s.derniere_visite && (!a.derniere || s.derniere_visite > a.derniere)) a.derniere = s.derniere_visite;
    });

    const ranked = Object.entries(agg).sort((a, b) => b[1].ca - a[1].ca);
    const rows: Cellule[][] = ranked.map(([nom, r]) => [
      { texte: clean(nom), sous: r.adresse ? clean(r.adresse) : null, gras: true },
      String(r.livres.size),
      String(r.deposes),
      String(r.vendus),
      String(r.restants),
      fmtN(r.ca),
      fmtDate(r.derniere),
    ]);
    const cw = this.contentWidth;
    const tot = ranked.reduce((a, [, r]) => ({ dep: a.dep + r.deposes, ven: a.ven + r.vendus, res: a.res + r.restants, ca: a.ca + r.ca }), { dep: 0, ven: 0, res: 0, ca: 0 });
    this.drawTable(
      [this.t.librairie, this.t.titresCol, this.t.deposes, this.t.vendus, this.t.restants, fc(this.t.ca), this.t.derniereVisite],
      rows,
      {
        widths: [cw * 0.3, cw * 0.08, cw * 0.1, cw * 0.09, cw * 0.1, cw * 0.17, cw * 0.16],
        aligns: ["left", "right", "right", "right", "right", "right", "left"],
        totalRow: [this.t.totalGeneral, "", String(tot.dep), String(tot.ven), String(tot.res), fmtN(tot.ca), ""],
      },
    );
  }

  /** Livres étrangers distribués : CA et commission, sans droits d'auteur. */
  buildEtrangers() {
    const etrangerIds = new Set(
      this.input.manuscrits.filter((m) => m.origine === "etranger").map((m) => m.id),
    );
    const v = this.input.ventes.filter((x) => etrangerIds.has(x.manuscrit_id));
    this.sectionTitle(this.t.etrangers);
    if (v.length === 0) { this.paragraph(this.t.noData); return; }
    const titre = (id: string) => this.input.manuscrits.find((m) => m.id === id)?.titre ?? "-";
    const agg: Record<string, { ex: number; ca: number; com: number }> = {};
    v.forEach((x) => {
      const a = (agg[x.manuscrit_id] ||= { ex: 0, ca: 0, com: 0 });
      a.ex += Number(x.quantite_vendue || 0);
      a.ca += Number(x.montant_total_fcfa || 0);
      a.com += Number(x.commission_librairie_fcfa || 0);
    });
    const ranked = Object.entries(agg).sort((a, b) => b[1].ca - a[1].ca);
    const rows: Cellule[][] = ranked.map(([id, r]) => [
      clean(titre(id)),
      String(r.ex),
      fmtN(r.ca),
      fmtN(r.com),
      { texte: fmtN(r.ca - r.com), gras: true },
    ]);
    const tot = ranked.reduce((a, [, r]) => ({ ex: a.ex + r.ex, ca: a.ca + r.ca, com: a.com + r.com }), { ex: 0, ca: 0, com: 0 });
    const cw = this.contentWidth;
    this.drawTable(
      [this.t.livre, this.t.qte, fc(this.t.ca), fc(this.t.commission), fc(this.t.net)],
      rows,
      {
        widths: [cw * 0.38, cw * 0.1, cw * 0.17, cw * 0.18, cw * 0.17],
        aligns: ["left", "right", "right", "right", "right"],
        totalRow: [this.t.totalGeneral, String(tot.ex), fmtN(tot.ca), fmtN(tot.com), fmtN(tot.ca - tot.com)],
      },
    );
    this.paragraph(this.t.etrangersNote);
  }

  buildStocks() {
    this.sectionTitle(this.t.stocks);
    this.ligne(this.t.at(fmtDate(new Date().toISOString())), { taille: 9, style: "italic", couleur: PDF.muted, espace: 10 });

    const mMap = Object.fromEntries(this.input.manuscrits.map((m) => [m.id, m]));
    const cw = this.contentWidth;

    // Interne
    this.addPageIfNeeded(80);
    this.ligne(this.t.interne, { taille: 10.5, style: "bold", couleur: GOLD, espace: 6 });
    if (this.input.stockInterne.length === 0) {
      this.paragraph(this.t.noData);
    } else {
      const rows: Cellule[][] = this.input.stockInterne.map((s) => {
        const price = Number(s.prix_vente_direct_fcfa || 0);
        return [
          clean(mMap[s.manuscrit_id]?.titre ?? "-"),
          String(s.quantite_imprimee ?? 0),
          String(s.quantite_disponible ?? 0),
          String(s.quantite_reservee ?? 0),
          String(s.quantite_vendue_directement ?? 0),
          fmtN(Number(s.quantite_disponible || 0) * price),
        ];
      });
      this.drawTable(
        [this.t.livre, this.t.imprimes, this.t.dispo, this.t.reserves, this.t.vendus, fc(this.t.valeur)],
        rows,
        { widths: [cw * 0.34, cw * 0.11, cw * 0.12, cw * 0.11, cw * 0.1, cw * 0.22], aligns: ["left", "right", "right", "right", "right", "right"] },
      );
    }

    // Externe
    this.addPageIfNeeded(80);
    this.ligne(this.t.externe, { taille: 10.5, style: "bold", couleur: GOLD, espace: 6 });
    if (this.input.stocks.length === 0) {
      this.paragraph(this.t.noData);
    } else {
      const rows: Cellule[][] = this.input.stocks.map((s) => {
        const rest = Number(s.exemplaires_restants || 0);
        const statut = rest === 0
          ? { texte: this.t.epuise, couleur: PDF.red, gras: true }
          : rest <= 5 ? { texte: this.t.stockBas, couleur: PDF.goldDark, gras: true } : { texte: this.t.disponible, couleur: PDF.green };
        return [
          clean(s.librairie_nom ?? "-"),
          clean(mMap[s.manuscrit_id]?.titre ?? "-"),
          String(s.exemplaires_deposes ?? 0),
          String(s.exemplaires_vendus ?? 0),
          String(rest),
          statut,
        ];
      });
      this.drawTable(
        [this.t.librairie, this.t.livre, this.t.deposes, this.t.vendus, this.t.restants, this.t.statut],
        rows,
        { widths: [cw * 0.22, cw * 0.3, cw * 0.11, cw * 0.1, cw * 0.11, cw * 0.16], aligns: ["left", "left", "right", "right", "right", "left"] },
      );
    }
  }

  buildDepenses() {
    this.sectionTitle(this.t.depenses);
    const list = this.input.depenses ?? [];
    if (list.length === 0) { this.paragraph(this.t.noData); return; }
    const mMap = Object.fromEntries(this.input.manuscrits.map((m) => [m.id, m]));
    const total = list.reduce((a, x) => a + Number(x.montant_fcfa || 0), 0);
    this.paragraph(this.t.depensesText(list.length, fmtFCFA(total)));

    const rows: Cellule[][] = list.map((d) => [
      fmtDate(d.date_depense),
      readableValue(d.categorie),
      clean(d.libelle),
      clean(d.manuscrit_id ? (mMap[d.manuscrit_id]?.titre ?? "-") : this.t.nonLiees),
      { texte: fmtN(Number(d.montant_fcfa || 0)), gras: true },
    ]);
    const cw = this.contentWidth;
    this.drawTable(
      [this.t.date, this.t.categorie, this.t.libelle, this.t.livre, fc(this.t.montantCol)],
      rows,
      {
        widths: [cw * 0.12, cw * 0.17, cw * 0.31, cw * 0.22, cw * 0.18],
        aligns: ["left", "left", "left", "left", "right"],
        totalRow: [this.t.totalGeneral, "", "", "", fmtN(total)],
      },
    );
  }

  /** Même calcul que l'onglet Rentabilité de l'application. */
  buildRentabilite() {
    this.sectionTitle(this.t.rentabilite);
    const v = this.ventesPropres;
    const dep = this.input.depenses ?? [];
    if (v.length === 0 && dep.length === 0) { this.paragraph(this.t.noData); return; }
    const mMap = Object.fromEntries(this.input.manuscrits.map((m) => [m.id, m]));
    const etrangers = new Set(this.input.manuscrits.filter((m) => m.origine === "etranger").map((m) => m.id));
    this.paragraph(this.t.rentabiliteText);

    const coutUnitaire = this.coutUnitaire;
    type Agg = { vendus: number; ca: number; comm: number; droits: number; dep: number; coutProd: number };
    const agg: Record<string, Agg> = {};
    const ensure = (id: string) => (agg[id] ||= { vendus: 0, ca: 0, comm: 0, droits: 0, dep: 0, coutProd: 0 });
    v.forEach((s) => {
      const a = ensure(s.manuscrit_id);
      a.vendus += Number(s.quantite_vendue || 0);
      a.ca += Number(s.montant_total_fcfa || 0);
      a.comm += Number(s.commission_librairie_fcfa || 0);
      a.droits += Number(s.droits_auteur_fcfa || 0);
    });
    dep.forEach((d) => { if (d.manuscrit_id) ensure(d.manuscrit_id).dep += Number(d.montant_fcfa || 0); });
    this.input.stockInterne.forEach((s) => {
      if (etrangers.has(s.manuscrit_id)) return;
      const cost = Number(s.cout_unitaire_impression_fcfa || 0) * Number(s.quantite_imprimee || 0);
      if (cost > 0) ensure(s.manuscrit_id).coutProd += cost;
    });

    const entries = Object.entries(agg)
      .map(([mid, a]) => {
        const coutVendus = Math.round((coutUnitaire.get(mid) ?? 0) * a.vendus);
        const benefice = a.ca - a.comm - a.droits - coutVendus - a.dep;
        const investi = a.coutProd + a.dep;
        const netUnit = a.vendus > 0 ? (a.ca - a.comm - a.droits) / a.vendus : 0;
        const seuil = investi > 0 && netUnit > 0 ? Math.ceil(investi / netUnit) : 0;
        return { mid, ...a, investi, benefice, seuil };
      })
      .filter((e) => e.investi > 0 || e.ca > 0)
      .sort((a, b) => b.benefice - a.benefice);

    if (entries.length === 0) { this.paragraph(this.t.noData); return; }

    const rows: Cellule[][] = entries.map((e) => [
      clean(mMap[e.mid]?.titre ?? "-"),
      String(e.vendus),
      fmtN(e.ca),
      fmtN(e.investi),
      { texte: fmtN(e.benefice), gras: true, couleur: e.benefice < 0 ? PDF.red : PDF.green },
      e.seuil > 0 ? `${e.seuil} ex.` : "-",
    ]);
    const somme = entries.reduce((a, e) => a + e.benefice, 0);
    const globales = dep.filter((d) => !d.manuscrit_id).reduce((a, d) => a + Number(d.montant_fcfa || 0), 0);
    const cw = this.contentWidth;
    this.drawTable(
      [this.t.livre, this.t.vendus, fc(this.t.ventesMontant), fc(this.t.investi), fc(this.t.resultatCol), this.t.seuilRent],
      rows,
      {
        widths: [cw * 0.31, cw * 0.09, cw * 0.15, cw * 0.15, cw * 0.15, cw * 0.15],
        aligns: ["left", "right", "right", "right", "right", "right"],
        totalRow: [this.t.totalGeneral, String(entries.reduce((a, e) => a + e.vendus, 0)), fmtN(entries.reduce((a, e) => a + e.ca, 0)), fmtN(entries.reduce((a, e) => a + e.investi, 0)), fmtN(somme), ""],
      },
    );
    if (globales > 0) {
      this.ligne(`${this.t.nonLiees} : - ${fmtFCFA(globales)}`, { taille: 9, couleur: PDF.muted, espace: 2 });
    }
    const benefice = somme - globales;
    this.cursorY -= 8;
    this.ligne(`${this.t.kpiResultat} : ${fmtFCFA(benefice)}`, { taille: 12, style: "bold", couleur: benefice < 0 ? PDF.red : PDF.green, espace: 6 });
  }

  buildFooter() {
    this.cursorY += 18;
    this.addPageIfNeeded(70);
    const d = this.doc;
    d.setDrawColor(PDF.gold);
    d.setLineWidth(0.8);
    d.line(this.marginX, this.cursorY, this.pageWidth - this.marginX, this.cursorY);
    this.cursorY += 10;
    this.ligne(this.t.footer(clean(this.input.entrepriseNom), fmtDateTime(new Date())), { taille: 8.5, style: "italic", couleur: PDF.muted, espace: 4 });
    this.ligne(this.t.tagline, { taille: 9, style: "bold", couleur: GOLD });
  }

  build(): jsPDF {
    this.drawCover();
    this.newPage();
    if (this.input.sections.resume) this.buildResume();
    if (this.input.sections.ventes) this.buildVentes();
    if (this.input.sections.droits) this.buildDroits();
    if (this.input.sections.depenses) this.buildDepenses();
    if (this.input.sections.livres) this.buildLivres();
    if (this.input.sections.rentabilite) this.buildRentabilite();
    if (this.input.sections.librairies) this.buildLibrairies();
    if (this.input.sections.etrangers) this.buildEtrangers();
    if (this.input.sections.stocks) this.buildStocks();
    this.buildFooter();

    finaliserPdf(this.doc, this.marque, `${this.t.title} · ${clean(this.input.entrepriseNom)}`);
    return this.doc;
  }
}

/** Rapport financier complet, au design commun des PDF FIGDITIONS. */
export async function generateFinanceReport(input: ReportInput): Promise<jsPDF> {
  const marque = await chargerMarquePdf();
  return new PdfBuilder(input, marque).build();
}

export function reportFilename(entrepriseNom: string, from: string, to: string): string {
  const clean = entrepriseNom.replace(/[^a-zA-Z0-9]+/g, "").slice(0, 30) || "Entreprise";
  return `FIGDITIONS_Rapport_${clean}_${from}_${to}.pdf`;
}
