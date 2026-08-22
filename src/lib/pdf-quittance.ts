import jsPDF from "jspdf";
import { methodeLabel } from "./finance-types";

const GOLD = "#C8922A";
const DARK_GOLD = "#A67420";
const INK = "#1A1208";
const MUTED = "#6b6154";
const BORDER = "#d8cfbc";

export interface QuittanceLigne {
  titre: string;
  date: string;
  quantite: number;
  droits: number;
}

export interface QuittanceInput {
  entrepriseNom: string;
  entrepriseVille?: string | null;
  numero: string;
  datePaiement: Date;
  auteurNom: string;
  montant: number;
  methode: string;
  reference?: string | null;
  notes?: string | null;
  payeParNom?: string | null;
  lignes: QuittanceLigne[];
}

function fmt(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

/**
 * Génère une quittance de paiement de droits d'auteur (A4 portrait),
 * prête à être téléchargée, imprimée et signée par les deux parties.
 */
export function generateQuittancePdf(input: QuittanceInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 50;
  const CW = W - M * 2;
  let y = 0;

  // ---- Bandeau or ----
  doc.setFillColor(GOLD);
  doc.rect(0, 0, W, 8, "F");

  // ---- En-tête ----
  y = 60;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(DARK_GOLD);
  doc.text("FIGDITIONS", M, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text("La plateforme éditoriale de l'Afrique de l'Ouest — figditions.xyz", M, y + 16);

  // Numéro / date à droite
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK);
  doc.text(`Quittance N° ${input.numero}`, W - M, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED);
  const lieu = input.entrepriseVille ? `${input.entrepriseVille}, le ` : "Fait le ";
  doc.text(`${lieu}${fmtDate(input.datePaiement)}`, W - M, y + 16, { align: "right" });

  y += 55;
  doc.setDrawColor(GOLD);
  doc.setLineWidth(1.2);
  doc.line(M, y, W - M, y);

  // ---- Titre ----
  y += 42;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(INK);
  doc.text("QUITTANCE DE PAIEMENT DE DROITS D'AUTEUR", W / 2, y, { align: "center" });

  // ---- Bloc parties ----
  y += 40;
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(INK);

  const label = (l: string, v: string, yy: number) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(MUTED);
    doc.text(l, M, yy);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(INK);
    doc.text(v, M + 150, yy);
  };

  label("Éditeur :", input.entrepriseNom, y); y += 18;
  label("Bénéficiaire :", input.auteurNom, y); y += 18;
  label("Méthode de paiement :", methodeLabel(input.methode), y); y += 18;
  if (input.reference) { label("Référence :", input.reference, y); y += 18; }
  if (input.payeParNom) { label("Payé par :", input.payeParNom, y); y += 18; }

  // ---- Montant en surbrillance ----
  y += 14;
  doc.setFillColor("#faf5ea");
  doc.setDrawColor(GOLD);
  doc.setLineWidth(1);
  doc.roundedRect(M, y, CW, 52, 6, 6, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(DARK_GOLD);
  doc.text("MONTANT TOTAL PAYÉ", M + 16, y + 21);
  doc.setFontSize(17);
  doc.text(fmt(input.montant), W - M - 16, y + 34, { align: "right" });
  y += 52 + 30;

  // ---- Détail des ventes couvertes ----
  if (input.lignes.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(INK);
    doc.text("Détail des droits réglés", M, y);
    y += 10;

    const cols = [CW * 0.42, CW * 0.20, CW * 0.12, CW * 0.26];
    const heads = ["Livre", "Date de vente", "Qté", "Droits"];
    const headH = 22;
    const rowH = 18;

    doc.setFillColor(GOLD);
    doc.rect(M, y, CW, headH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor("#FFFFFF");
    let x = M;
    heads.forEach((h, i) => {
      const align = i >= 2 ? "right" : "left";
      const tx = align === "right" ? x + cols[i] - 6 : x + 6;
      doc.text(h.toUpperCase(), tx, y + 15, { align });
      x += cols[i];
    });
    y += headH;

    input.lignes.forEach((l, idx) => {
      if (y + rowH > H - 260) { doc.addPage(); y = 80; }
      if (idx % 2 === 1) {
        doc.setFillColor("#f7f3ea");
        doc.rect(M, y, CW, rowH, "F");
      }
      doc.setDrawColor(BORDER);
      doc.setLineWidth(0.4);
      doc.line(M, y + rowH, M + CW, y + rowH);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(INK);
      const titre = l.titre.length > 46 ? `${l.titre.slice(0, 45)}…` : l.titre;
      let cx = M;
      doc.text(titre, cx + 6, y + 13); cx += cols[0];
      doc.text(l.date, cx + 6, y + 13); cx += cols[1];
      doc.text(String(l.quantite), cx + cols[2] - 6, y + 13, { align: "right" }); cx += cols[2];
      doc.text(fmt(l.droits), cx + cols[3] - 6, y + 13, { align: "right" });
      y += rowH;
    });
    y += 24;
  }

  // ---- Notes ----
  if (input.notes) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(MUTED);
    const lines = doc.splitTextToSize(`Note : ${input.notes}`, CW);
    doc.text(lines, M, y);
    y += lines.length * 12 + 10;
  }

  // ---- Mention légale ----
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(INK);
  const mention = doc.splitTextToSize(
    `Je soussigné(e) ${input.auteurNom}, reconnais avoir reçu de la part de ${input.entrepriseNom} la somme de ${fmt(input.montant)} au titre des droits d'auteur détaillés ci-dessus. Cette quittance vaut reçu définitif sous réserve d'encaissement effectif.`,
    CW,
  );
  if (y + mention.length * 13 > H - 220) { doc.addPage(); y = 80; }
  doc.text(mention, M, y);
  y += mention.length * 13 + 50;

  // ---- Signatures ----
  const sigY = Math.max(y, H - 190);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(INK);
  doc.text("Pour l'éditeur", M, sigY);
  doc.text("L'auteur (bénéficiaire)", W - M, sigY, { align: "right" });
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(MUTED);
  doc.text("(Cachet et signature)", M, sigY + 14);
  doc.text("(« Lu et approuvé » + signature)", W - M, sigY + 14, { align: "right" });
  doc.setDrawColor(BORDER);
  doc.setLineWidth(0.6);
  doc.line(M, sigY + 90, M + 200, sigY + 90);
  doc.line(W - M - 200, sigY + 90, W - M, sigY + 90);

  // ---- Pied de page ----
  doc.setFillColor(GOLD);
  doc.rect(0, H - 8, W, 8, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  doc.text(
    `Document généré par FIGDITIONS le ${fmtDate(new Date())} — ${input.numero}`,
    W / 2, H - 24, { align: "center" },
  );

  return doc;
}

export function quittanceFilename(numero: string, auteurNom: string): string {
  const clean = auteurNom.replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 30);
  return `${numero}_${clean}.pdf`;
}
