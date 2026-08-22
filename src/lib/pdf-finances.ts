import jsPDF from "jspdf";

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
export interface Manuscrit { id: string; titre: string; auteur: string | null; auteur_id: string | null; genre?: string | null; }
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
    period: (a: string, b: string) => `Du ${a} au ${b}`,
    generatedAt: (d: string) => `Généré le ${d}`,
    confidential: "Confidentiel - Usage interne",
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
    kpiResultat: "Résultat net estimé",
    depenses: "DÉPENSES",
    rentabilite: "RENTABILITÉ PAR LIVRE",
    categorie: "Catégorie",
    libelle: "Libellé",
    montantCol: "Montant",
    investi: "Investi",
    coutProd: "Coût production",
    marge: "Marge",
    resultatCol: "Résultat",
    seuilRent: "Seuil (ex.)",
    encaisseCol: "Encaissé",
    nonLiees: "Charges globales",
    depensesText: (n: number, total: string) => `${n} dépense(s) déclarée(s) sur la période pour un total de ${total}.`,
    rentabiliteText: "Investi = coût de production (impressions) + dépenses liées au livre. Résultat = encaissé - commissions - droits d'auteur - investi.",
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
    subtotal: (n: string) => `Total droits ${n}`,
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
      `Durant la période du ${a} au ${b}, ${nom} a enregistré ${nv} vente(s) pour un chiffre d'affaires total de ${ca}. ${na} auteur(s) ont généré des droits s'élevant à ${dr}, dont ${pa} ont été réglés.`,
    footer: (nom: string, d: string) =>
      `Ce rapport a été généré automatiquement par FIGDITIONS le ${d}. Les données présentées sont confidentielles et destinées à l'usage exclusif de ${nom}.`,
    tagline: "FIGDITIONS - La plateforme editoriale de l'Afrique de l'Ouest",
    site: "figditions.xyz",
    headerRight: (a: string, b: string) => `Rapport Financier - ${a} au ${b}`,
    page: "Page",
    of: "/",
    suite: "Suite page suivante",
  },
  en: {
    title: "FINANCIAL REPORT",
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
    kpiResultat: "Estimated net result",
    depenses: "EXPENSES",
    rentabilite: "PER BOOK PROFITABILITY",
    categorie: "Category",
    libelle: "Label",
    montantCol: "Amount",
    investi: "Invested",
    coutProd: "Production cost",
    marge: "Margin",
    resultatCol: "Result",
    seuilRent: "Break-even (copies)",
    encaisseCol: "Collected",
    nonLiees: "Global charges",
    depensesText: (n: number, total: string) => `${n} expense(s) recorded over the period for a total of ${total}.`,
    rentabiliteText: "Invested = production cost (printing) + book-linked expenses. Result = collected - commissions - royalties - invested.",
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
    subtotal: (n: string) => `${n} - royalties subtotal`,
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
      `From ${a} to ${b}, ${nom} recorded ${nv} sale(s) for a total revenue of ${ca}. ${na} author(s) generated royalties amounting to ${dr}, of which ${pa} has been paid.`,
    footer: (nom: string, d: string) =>
      `This report was automatically generated by FIGDITIONS on ${d}. The data is confidential and intended for the exclusive use of ${nom}.`,
    tagline: "FIGDITIONS - West Africa's publishing platform",
    site: "figditions.xyz",
    headerRight: (a: string, b: string) => `Financial Report - ${a} to ${b}`,
    page: "Page",
    of: "/",
    suite: "Continued on next page",
  },
};

// ---------- helpers ----------
const GOLD = "#C8922A";
const DARK = "#0D0A06";
const ROW_ALT = "#F9F7F4";
const TOTAL_BG = "#F0EBE3";
const BORDER = "#E0D5C8";

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
  page = 1;
  cursorY = 0;
  input: ReportInput;
  t: (typeof T)["fr"];
  marginX = 40;
  marginTop = 60;
  marginBottom = 50;

  constructor(input: ReportInput) {
    this.doc = new jsPDF({ unit: "pt", format: "a4" });
    this.input = input;
    this.t = T[input.lang];
  }

  get pageWidth() { return this.doc.internal.pageSize.getWidth(); }
  get pageHeight() { return this.doc.internal.pageSize.getHeight(); }
  get contentWidth() { return this.pageWidth - this.marginX * 2; }

  addPageIfNeeded(needed: number) {
    if (this.cursorY + needed > this.pageHeight - this.marginBottom) {
      this.newPage();
    }
  }

  newPage() {
    this.doc.addPage();
    this.page += 1;
    this.drawHeader();
    this.cursorY = this.marginTop + 10;
  }

  drawHeader() {
    const d = this.doc;
    d.setFont("helvetica", "normal");
    d.setFontSize(9);
    d.setTextColor("#666");
    d.text(this.input.entrepriseNom, this.marginX, 30);
    const right = this.t.headerRight(fmtDate(this.input.from), fmtDate(this.input.to));
    d.text(right, this.pageWidth - this.marginX, 30, { align: "right" });
    d.setDrawColor(GOLD);
    d.setLineWidth(0.8);
    d.line(this.marginX, 40, this.pageWidth - this.marginX, 40);
  }

  drawPageNumbers(total: number) {
    const d = this.doc;
    for (let i = 2; i <= total; i++) {
      d.setPage(i);
      d.setFont("helvetica", "italic");
      d.setFontSize(8);
      d.setTextColor("#888");
      d.text(`${this.t.page} ${i} ${this.t.of} ${total}`, this.pageWidth - this.marginX, this.pageHeight - 20, { align: "right" });
    }
  }

  // ---------- Cover ----------
  drawCover() {
    const d = this.doc;
    d.setFillColor(DARK);
    d.rect(0, 0, this.pageWidth, this.pageHeight, "F");

    // top gold line
    d.setDrawColor(GOLD);
    d.setLineWidth(1.5);
    d.line(this.marginX, 120, this.pageWidth - this.marginX, 120);

    // Brand
    d.setFont("helvetica", "bold");
    d.setFontSize(28);
    d.setTextColor(GOLD);
    d.text("FIGDITIONS", this.pageWidth / 2, 100, { align: "center" });

    // Title
    d.setFont("helvetica", "bold");
    d.setFontSize(32);
    d.setTextColor("#FFFFFF");
    d.text(this.t.title, this.pageWidth / 2, this.pageHeight / 2 - 40, { align: "center" });

    d.setFont("helvetica", "normal");
    d.setFontSize(18);
    d.setTextColor(GOLD);
    d.text(this.input.entrepriseNom, this.pageWidth / 2, this.pageHeight / 2 - 5, { align: "center" });

    d.setFontSize(12);
    d.setTextColor("#BBBBBB");
    d.text(this.t.period(fmtDate(this.input.from), fmtDate(this.input.to)), this.pageWidth / 2, this.pageHeight / 2 + 25, { align: "center" });

    // Bottom
    d.setDrawColor(GOLD);
    d.setLineWidth(1);
    d.line(this.marginX, this.pageHeight - 120, this.pageWidth - this.marginX, this.pageHeight - 120);

    d.setFont("helvetica", "italic");
    d.setFontSize(10);
    d.setTextColor("#CCCCCC");
    d.text(this.t.generatedAt(fmtDateTime(new Date())), this.pageWidth / 2, this.pageHeight - 95, { align: "center" });
    d.text(this.t.confidential, this.pageWidth / 2, this.pageHeight - 78, { align: "center" });
  }

  // ---------- Section title ----------
  sectionTitle(txt: string) {
    this.addPageIfNeeded(50);
    const d = this.doc;
    d.setFont("helvetica", "bold");
    d.setFontSize(16);
    d.setTextColor("#1A1208");
    d.text(txt, this.marginX, this.cursorY);
    d.setDrawColor(GOLD);
    d.setLineWidth(1.5);
    d.line(this.marginX, this.cursorY + 6, this.marginX + 120, this.cursorY + 6);
    this.cursorY += 30;
  }

  // ---------- KPI grid ----------
  drawKpiGrid(kpis: { label: string; value: string; sub?: string; delta?: { pct: number; up: boolean } }[]) {
    const d = this.doc;
    const cols = 2;
    const gap = 12;
    const boxW = (this.contentWidth - gap) / cols;
    const boxH = 80;
    kpis.forEach((k, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = this.marginX + col * (boxW + gap);
      const y = this.cursorY + row * (boxH + gap);
      d.setDrawColor(BORDER);
      d.setFillColor("#FFFFFF");
      d.roundedRect(x, y, boxW, boxH, 6, 6, "FD");
      d.setFont("helvetica", "normal");
      d.setFontSize(9);
      d.setTextColor("#666");
      d.text(k.label.toUpperCase(), x + 14, y + 20);
      d.setFont("helvetica", "bold");
      d.setFontSize(18);
      d.setTextColor(GOLD);
      d.text(truncate(k.value, 28), x + 14, y + 45);
      if (k.sub) {
        d.setFont("helvetica", "normal");
        d.setFontSize(9);
        d.setTextColor("#666");
        d.text(truncate(k.sub, 60), x + 14, y + 62);
      }
      if (k.delta) {
        const label = `${k.delta.up ? "+" : "-"}${Math.abs(k.delta.pct).toFixed(1)}%`;
        d.setTextColor(k.delta.up ? "#0a8a3d" : "#c02323");
        d.setFontSize(9);
        d.text(label, x + boxW - 14, y + 62, { align: "right" });
      }
    });
    const rows = Math.ceil(kpis.length / cols);
    this.cursorY += rows * (boxH + gap) + 10;
  }

  paragraph(txt: string) {
    this.addPageIfNeeded(60);
    const d = this.doc;
    d.setFont("helvetica", "normal");
    d.setFontSize(10);
    d.setTextColor("#333");
    const lines = d.splitTextToSize(txt, this.contentWidth);
    d.text(lines, this.marginX, this.cursorY);
    this.cursorY += lines.length * 13 + 10;
  }

  // ---------- Table ----------
  drawTable(headers: string[], rows: string[][], opts: { widths?: number[]; totalRow?: string[]; aligns?: ("left" | "right" | "center")[] } = {}) {
    const d = this.doc;
    const widths = opts.widths ?? headers.map(() => this.contentWidth / headers.length);
    const aligns = opts.aligns ?? headers.map(() => "left" as const);
    const rowH = 20;
    const headerH = 24;

    const drawHead = () => {
      this.addPageIfNeeded(headerH + rowH * 2);
      d.setFillColor(GOLD);
      d.rect(this.marginX, this.cursorY, this.contentWidth, headerH, "F");
      d.setFont("helvetica", "bold");
      d.setFontSize(9);
      d.setTextColor("#FFFFFF");
      let x = this.marginX;
      headers.forEach((h, i) => {
        const align = aligns[i];
        const tx = align === "right" ? x + widths[i] - 6 : align === "center" ? x + widths[i] / 2 : x + 6;
        d.text(h.toUpperCase(), tx, this.cursorY + 16, { align });
        x += widths[i];
      });
      this.cursorY += headerH;
    };

    drawHead();

    rows.forEach((r, idx) => {
      if (this.cursorY + rowH > this.pageHeight - this.marginBottom) {
        d.setFont("helvetica", "italic");
        d.setFontSize(8);
        d.setTextColor("#888");
        d.text(this.t.suite, this.pageWidth - this.marginX, this.cursorY + 12, { align: "right" });
        this.newPage();
        drawHead();
      }
      if (idx % 2 === 1) {
        d.setFillColor(ROW_ALT);
        d.rect(this.marginX, this.cursorY, this.contentWidth, rowH, "F");
      }
      d.setDrawColor(BORDER);
      d.setLineWidth(0.3);
      d.line(this.marginX, this.cursorY + rowH, this.marginX + this.contentWidth, this.cursorY + rowH);
      d.setFont("helvetica", "normal");
      d.setFontSize(9);
      d.setTextColor("#222");
      let x = this.marginX;
      r.forEach((cell, i) => {
        const align = aligns[i];
        const tx = align === "right" ? x + widths[i] - 6 : align === "center" ? x + widths[i] / 2 : x + 6;
        const maxChars = Math.floor(widths[i] / 5);
        d.text(truncate(String(cell ?? ""), maxChars), tx, this.cursorY + 14, { align });
        x += widths[i];
      });
      this.cursorY += rowH;
    });

    if (opts.totalRow) {
      this.addPageIfNeeded(rowH + 6);
      d.setFillColor(TOTAL_BG);
      d.rect(this.marginX, this.cursorY, this.contentWidth, rowH, "F");
      d.setFont("helvetica", "bold");
      d.setFontSize(9);
      d.setTextColor("#1A1208");
      let x = this.marginX;
      opts.totalRow.forEach((cell, i) => {
        const align = aligns[i];
        const tx = align === "right" ? x + widths[i] - 6 : align === "center" ? x + widths[i] / 2 : x + 6;
        d.text(String(cell ?? ""), tx, this.cursorY + 14, { align });
        x += widths[i];
      });
      this.cursorY += rowH;
    }

    this.cursorY += 15;
  }

  // ---------- Sections ----------
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
    const topTitle = topId ? (mMap[topId[0]]?.titre ?? "—") : "—";
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

    this.drawKpiGrid([
      { label: this.t.kpiRevenue, value: fmtFCFA(totalRev), delta },
      { label: this.t.kpiCount, value: String(v.length), sub: this.t.transactions },
      { label: this.t.kpiRoyalties, value: fmtFCFA(totalRoyalties), sub: `${this.t.paid}: ${fmtFCFA(paidRoy)} | ${this.t.pending}: ${fmtFCFA(pendingRoy)}` },
      { label: this.t.kpiTop, value: topTitle, sub: `${topQty} ${this.t.copies}` },
    ]);

    if (totalRemises > 0) {
      this.paragraph(this.t.remisesLigne(fmtFCFA(totalRemises)));
    }

    this.paragraph(
      this.t.resumeText(
        this.input.entrepriseNom,
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
    const rows = v.map((s) => {
      const m = mMap[s.manuscrit_id];
      const aid = s.auteur_id ?? m?.auteur_id;
      const auteur = (aid && aMap[aid]) || m?.auteur || "-";
      const isExt = s.canal_vente !== "interne";
      return [
        fmtDate(s.date_vente),
        clean(m?.titre ?? "-"),
        auteur,
        isExt ? this.t.canalExt : this.t.canalInt,
        String(s.quantite_vendue),
        fmtFCFA(s.prix_unitaire_fcfa),
        Number(s.remise_fcfa) > 0 ? `-${fmtFCFA(Number(s.remise_fcfa))}` : "-",
        fmtFCFA(s.montant_total_fcfa),
        fmtFCFA(s.droits_auteur_fcfa),
        s.statut_paiement === "paye" ? this.t.payeShort : this.t.attente,
      ];
    });
    const cw = this.contentWidth;
    const widths = [cw * 0.085, cw * 0.18, cw * 0.14, cw * 0.08, cw * 0.05, cw * 0.095, cw * 0.095, cw * 0.10, cw * 0.10, cw * 0.075];
    const aligns: ("left" | "right" | "center")[] = ["left", "left", "left", "center", "center", "right", "right", "right", "right", "center"];
    const totalQty = v.reduce((a, x) => a + Number(x.quantite_vendue || 0), 0);
    const totalRev = v.reduce((a, x) => a + Number(x.montant_total_fcfa || 0), 0);
    const totalRoy = v.reduce((a, x) => a + Number(x.droits_auteur_fcfa || 0), 0);
    const totalRem = v.reduce((a, x) => a + Number(x.remise_fcfa || 0), 0);
    this.drawTable(
      [this.t.date, this.t.livre, this.t.auteur, this.t.type, this.t.qte, this.t.pu, this.t.remise, this.t.total, this.t.droitsCol, this.t.statut],
      rows,
      {
        widths,
        aligns,
        totalRow: [this.t.totalGeneral, "", "", "", String(totalQty), "", totalRem > 0 ? `-${fmtFCFA(totalRem)}` : "", fmtFCFA(totalRev), fmtFCFA(totalRoy), ""],
      },
    );
  }

  buildDroits() {
    this.sectionTitle(this.t.droits);
    const v = this.input.ventes;
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
    Object.entries(byAuthor).forEach(([aid, sales]) => {
      this.addPageIfNeeded(80);
      const auteur = aMap[aid];
      const name = clean(auteur?.nom_complet ?? mMap[sales[0].manuscrit_id]?.auteur ?? "-");
      const d = this.doc;
      d.setFont("helvetica", "bold");
      d.setFontSize(12);
      d.setTextColor(GOLD);
      d.text(name, this.marginX, this.cursorY);
      this.cursorY += 16;
      const info = [
        auteur?.email ? `${this.t.contact}: ${auteur.email}${auteur.telephone ? " | " + auteur.telephone : ""}` : null,
        auteur?.mobile_money_numero ? `${this.t.mm}: ${auteur.mobile_money_operateur ?? ""} - ${auteur.mobile_money_numero}` : null,
      ].filter(Boolean) as string[];
      if (info.length) {
        d.setFont("helvetica", "normal");
        d.setFontSize(9);
        d.setTextColor("#555");
        info.forEach((line) => { d.text(line, this.marginX, this.cursorY); this.cursorY += 12; });
      }
      this.cursorY += 4;

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

      const rows = Object.entries(byBook).map(([mid, b]) => {
        const rate = b.ca > 0 ? (b.droits / b.ca) * 100 : 10;
        return [
          clean(mMap[mid]?.titre ?? "-"),
          String(b.qte),
          fmtFCFA(b.ca),
          `${rate.toFixed(1)}%`,
          fmtFCFA(b.droits),
          b.paid >= b.droits && b.droits > 0 ? this.t.payeShort : this.t.attente,
        ];
      });
      const cw = this.contentWidth;
      const widths = [cw * 0.32, cw * 0.11, cw * 0.18, cw * 0.11, cw * 0.18, cw * 0.10];
      const aligns: ("left" | "right" | "center")[] = ["left", "center", "right", "center", "right", "center"];
      this.drawTable(
        [this.t.livre, this.t.ventesCol, this.t.ca, this.t.taux, this.t.droitsDus, this.t.statut],
        rows,
        { widths, aligns },
      );
      const totalRoy = sales.reduce((a, x) => a + Number(x.droits_auteur_fcfa || 0), 0);
      const paidRoy = sales.filter((x) => x.statut_paiement === "paye").reduce((a, x) => a + Number(x.droits_auteur_fcfa || 0), 0);
      grand += totalRoy;
      d.setFont("helvetica", "bold");
      d.setFontSize(10);
      d.setTextColor("#1A1208");
      d.text(`${this.t.subtotal(name)}: ${fmtFCFA(totalRoy)}   -   ${this.t.paid}: ${fmtFCFA(paidRoy)} | ${this.t.pending}: ${fmtFCFA(totalRoy - paidRoy)}`, this.marginX, this.cursorY);
      this.cursorY += 20;
    });

    this.addPageIfNeeded(30);
    const d = this.doc;
    d.setDrawColor(GOLD);
    d.setLineWidth(1);
    d.line(this.marginX, this.cursorY, this.marginX + this.contentWidth, this.cursorY);
    this.cursorY += 16;
    d.setFont("helvetica", "bold");
    d.setFontSize(12);
    d.setTextColor(GOLD);
    d.text(`${this.t.grandDroits}: ${fmtFCFA(grand)}`, this.marginX, this.cursorY);
    this.cursorY += 20;
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

    ranked.forEach(([mid, r], idx) => {
      this.addPageIfNeeded(85);
      const m = mMap[mid];
      const d = this.doc;
      d.setFont("helvetica", "bold");
      d.setFontSize(12);
      d.setTextColor("#1A1208");
      d.text(truncate(m?.titre ?? "-", 80), this.marginX, this.cursorY);
      this.cursorY += 14;

      const aid = m?.auteur_id;
      const auteur = clean((aid && aMap[aid]) || m?.auteur || "-");
      d.setFont("helvetica", "normal");
      d.setFontSize(9);
      d.setTextColor("#666");
      const meta = `${this.t.auteur}: ${auteur}${m?.genre ? ` | ${this.t.genre}: ${m.genre}` : ""}`;
      d.text(meta, this.marginX, this.cursorY);
      this.cursorY += 14;

      // Compact numbers row
      const rest = stockRestMap[mid] ?? 0;
      const totalBooks = r.qte + rest;
      const rate = totalBooks > 0 ? (r.qte / totalBooks) * 100 : 0;
      d.setFont("helvetica", "normal");
      d.setFontSize(9);
      d.setTextColor("#333");
      d.text(`${this.t.ventesCol}: ${r.qte}   ${this.t.ca}: ${fmtFCFA(r.ca)}   ${this.t.droitsCol}: ${fmtFCFA(r.droits)}   ${this.t.stockRestant}: ${rest}`, this.marginX, this.cursorY);
      this.cursorY += 14;

      // sell-through bar
      const barW = 200;
      const barH = 8;
      d.setFillColor("#E8E2D5");
      d.rect(this.marginX, this.cursorY, barW, barH, "F");
      d.setFillColor(GOLD);
      d.rect(this.marginX, this.cursorY, (barW * rate) / 100, barH, "F");
      d.setFont("helvetica", "normal");
      d.setFontSize(9);
      d.setTextColor("#555");
      d.text(`${this.t.sellthrough}: ${rate.toFixed(0)}%`, this.marginX + barW + 10, this.cursorY + 7);

      let badge = "";
      if (idx === 0) badge = `[TOP] ${this.t.best}`;
      else if (idx < 3) badge = `[BON] ${this.t.good}`;
      else if (rate < 20) badge = `[SURVEILLER] ${this.t.watch}`;
      if (badge) {
        d.setTextColor(GOLD);
        d.setFont("helvetica", "bold");
        d.setFontSize(9);
        d.text(badge, this.pageWidth - this.marginX, this.cursorY + 7, { align: "right" });
      }
      this.cursorY += 22;
    });
  }

  buildLibrairies() {
    this.sectionTitle(this.t.librairies);
    const v = this.input.ventes;
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
    // enrich CA with actual ventes (externes)
    // (kept approximate using stocks totals to align with page)
    void v;

    const ranked = Object.entries(agg).sort((a, b) => b[1].ca - a[1].ca);
    const rows = ranked.map(([nom, r], i) => [
      clean((i === 0 ? "[TOP] " : "") + nom),
      truncate(r.adresse || "-", 30),
      String(r.livres.size),
      String(r.vendus),
      fmtFCFA(r.ca),
      String(r.restants),
      fmtDate(r.derniere),
    ]);
    const cw = this.contentWidth;
    const widths = [cw * 0.20, cw * 0.20, cw * 0.09, cw * 0.10, cw * 0.16, cw * 0.10, cw * 0.15];
    const aligns: ("left" | "right" | "center")[] = ["left", "left", "center", "center", "right", "center", "center"];
    this.drawTable(
      [this.t.librairie, this.t.adresse, this.t.livre, this.t.vendus, this.t.ca, this.t.restants, this.t.derniereVisite],
      rows,
      { widths, aligns },
    );
  }

  buildStocks() {
    this.sectionTitle(this.t.stocks);
    const d = this.doc;
    d.setFont("helvetica", "italic");
    d.setFontSize(9);
    d.setTextColor("#666");
    d.text(this.t.at(fmtDate(new Date().toISOString())), this.marginX, this.cursorY);
    this.cursorY += 20;

    const mMap = Object.fromEntries(this.input.manuscrits.map((m) => [m.id, m]));

    // Interne
    d.setFont("helvetica", "bold");
    d.setFontSize(11);
    d.setTextColor(GOLD);
    d.text(this.t.interne, this.marginX, this.cursorY);
    this.cursorY += 14;
    if (this.input.stockInterne.length === 0) {
      this.paragraph(this.t.noData);
    } else {
      const rows = this.input.stockInterne.map((s) => {
        const price = Number(s.prix_vente_direct_fcfa || 0);
        return [
          clean(mMap[s.manuscrit_id]?.titre ?? "-"),
          String(s.quantite_imprimee ?? 0),
          String(s.quantite_disponible ?? 0),
          String(s.quantite_reservee ?? 0),
          String(s.quantite_vendue_directement ?? 0),
          fmtFCFA(Number(s.quantite_disponible || 0) * price),
        ];
      });
      const cw = this.contentWidth;
      const widths = [cw * 0.32, cw * 0.12, cw * 0.12, cw * 0.12, cw * 0.12, cw * 0.20];
      const aligns: ("left" | "right" | "center")[] = ["left", "center", "center", "center", "center", "right"];
      this.drawTable(
        [this.t.livre, this.t.imprimes, this.t.dispo, this.t.reserves, this.t.vendus, this.t.valeur],
        rows, { widths, aligns },
      );
    }

    // Externe
    d.setFont("helvetica", "bold");
    d.setFontSize(11);
    d.setTextColor(GOLD);
    d.text(this.t.externe, this.marginX, this.cursorY);
    this.cursorY += 14;
    if (this.input.stocks.length === 0) {
      this.paragraph(this.t.noData);
    } else {
      const rows = this.input.stocks.map((s) => {
        const rest = Number(s.exemplaires_restants || 0);
        const statut = rest === 0 ? "CRITIQUE" : rest <= 5 ? "STOCK BAS" : "OK";
        return [
          clean(s.librairie_nom ?? "-"),
          truncate(mMap[s.manuscrit_id]?.titre ?? "-", 30),
          String(s.exemplaires_deposes ?? 0),
          String(s.exemplaires_vendus ?? 0),
          String(rest),
          statut,
        ];
      });
      const cw = this.contentWidth;
      const widths = [cw * 0.20, cw * 0.30, cw * 0.11, cw * 0.11, cw * 0.11, cw * 0.17];
      const aligns: ("left" | "right" | "center")[] = ["left", "left", "center", "center", "center", "center"];
      this.drawTable(
        [this.t.librairie, this.t.livre, this.t.deposes, this.t.vendus, this.t.restants, this.t.statut],
        rows, { widths, aligns },
      );
    }
  }

  buildFooter() {
    this.addPageIfNeeded(120);
    const d = this.doc;
    this.cursorY = Math.max(this.cursorY, this.pageHeight - 150);
    d.setDrawColor(GOLD);
    d.setLineWidth(0.8);
    d.line(this.marginX, this.cursorY, this.pageWidth - this.marginX, this.cursorY);
    this.cursorY += 14;
    d.setFont("helvetica", "italic");
    d.setFontSize(9);
    d.setTextColor("#555");
    const lines = d.splitTextToSize(this.t.footer(this.input.entrepriseNom, fmtDateTime(new Date())), this.contentWidth);
    d.text(lines, this.marginX, this.cursorY);
    this.cursorY += lines.length * 12 + 10;
    d.setFont("helvetica", "bold");
    d.setFontSize(10);
    d.setTextColor(GOLD);
    d.text(this.t.tagline, this.pageWidth / 2, this.cursorY, { align: "center" });
    this.cursorY += 14;
    d.setFont("helvetica", "normal");
    d.setFontSize(9);
    d.setTextColor("#888");
    d.text(this.t.site, this.pageWidth / 2, this.cursorY, { align: "center" });
  }

  build(): jsPDF {
    this.drawCover();
    this.newPage();
    if (this.input.sections.resume) this.buildResume();
    if (this.input.sections.ventes) this.buildVentes();
    if (this.input.sections.droits) this.buildDroits();
    if (this.input.sections.livres) this.buildLivres();
    if (this.input.sections.librairies) this.buildLibrairies();
    if (this.input.sections.stocks) this.buildStocks();
    this.buildFooter();

    const total = this.doc.getNumberOfPages();
    this.drawPageNumbers(total);
    return this.doc;
  }
}

export function generateFinanceReport(input: ReportInput): jsPDF {
  return new PdfBuilder(input).build();
}

export function reportFilename(entrepriseNom: string, from: string, to: string): string {
  const clean = entrepriseNom.replace(/[^a-zA-Z0-9]+/g, "").slice(0, 30) || "Entreprise";
  return `FIGDITIONS_Rapport_${clean}_${from}_${to}.pdf`;
}
