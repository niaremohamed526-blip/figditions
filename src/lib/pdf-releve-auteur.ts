import jsPDF from "jspdf";

const GOLD = "#C8922A";
const DARK_GOLD = "#A67420";
const INK = "#1A1208";
const MUTED = "#6b6154";
const BORDER = "#d8cfbc";

export interface ReleveLigne {
  titre: string;
  date: string;
  quantite: number;
  droits: number;
  paye: boolean;
}

export interface ReleveInput {
  entrepriseNom: string;
  auteurNom: string;
  annee: number;
  lignes: ReleveLigne[];
}

const fmt = (n: number) => `${Math.round(n).toLocaleString("fr-FR").replace(/ | /g, " ")} FCFA`;

/** Relevé annuel des droits d'auteur : ventes, droits, ce qui est payé et ce qui reste. */
export function generateReleveAuteurPdf(input: ReleveInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 50;
  const CW = W - M * 2;
  const total = input.lignes.reduce((a, l) => a + l.droits, 0);
  const paye = input.lignes.filter((l) => l.paye).reduce((a, l) => a + l.droits, 0);
  const exemplaires = input.lignes.reduce((a, l) => a + l.quantite, 0);

  doc.setFillColor(GOLD);
  doc.rect(0, 0, W, 8, "F");
  let y = 60;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(DARK_GOLD);
  doc.text(input.entrepriseNom, M, y);
  doc.setFontSize(11);
  doc.setTextColor(INK);
  doc.text(`Relevé ${input.annee}`, W - M, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED);
  doc.text(`Édité le ${new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}`, W - M, y + 16, { align: "right" });
  y += 45;
  doc.setDrawColor(GOLD);
  doc.setLineWidth(1.2);
  doc.line(M, y, W - M, y);

  y += 40;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(INK);
  doc.text("RELEVÉ DE DROITS D'AUTEUR", W / 2, y, { align: "center" });
  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(MUTED);
  doc.text(`${input.auteurNom} · année ${input.annee}`, W / 2, y, { align: "center" });

  // Trois chiffres clés
  y += 30;
  const boxW = (CW - 20) / 3;
  [["Droits de l'année", total], ["Déjà payés", paye], ["Reste à payer", total - paye]].forEach(([l, v], i) => {
    const x = M + i * (boxW + 10);
    doc.setFillColor(i === 2 ? "#faf5ea" : "#ffffff");
    doc.setDrawColor(i === 2 ? GOLD : BORDER);
    doc.setLineWidth(0.8);
    doc.roundedRect(x, y, boxW, 52, 6, 6, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(MUTED);
    doc.text(String(l).toUpperCase(), x + 12, y + 18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(i === 2 ? DARK_GOLD : INK);
    doc.text(fmt(Number(v)), x + 12, y + 38);
  });
  y += 52 + 30;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK);
  doc.text(`Détail des ventes (${exemplaires} exemplaires)`, M, y);
  y += 10;
  const cols = [CW * 0.4, CW * 0.17, CW * 0.1, CW * 0.18, CW * 0.15];
  const heads = ["Livre", "Date", "Qté", "Droits", "Statut"];
  const header = () => {
    doc.setFillColor(GOLD);
    doc.rect(M, y, CW, 22, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor("#FFFFFF");
    let x = M;
    heads.forEach((h, i) => {
      const right = i === 2 || i === 3;
      doc.text(h.toUpperCase(), right ? x + cols[i] - 6 : x + 6, y + 15, { align: right ? "right" : "left" });
      x += cols[i];
    });
    y += 22;
  };
  header();
  input.lignes.forEach((l, idx) => {
    if (y + 18 > H - 60) { doc.addPage(); y = 60; header(); }
    if (idx % 2 === 1) { doc.setFillColor("#f7f3ea"); doc.rect(M, y, CW, 18, "F"); }
    doc.setDrawColor(BORDER);
    doc.setLineWidth(0.4);
    doc.line(M, y + 18, M + CW, y + 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(INK);
    let cx = M;
    doc.text(l.titre.length > 42 ? `${l.titre.slice(0, 41)}…` : l.titre, cx + 6, y + 13); cx += cols[0];
    doc.text(l.date, cx + 6, y + 13); cx += cols[1];
    doc.text(String(l.quantite), cx + cols[2] - 6, y + 13, { align: "right" }); cx += cols[2];
    doc.text(fmt(l.droits), cx + cols[3] - 6, y + 13, { align: "right" }); cx += cols[3];
    doc.setTextColor(l.paye ? "#2f7d4f" : DARK_GOLD);
    doc.text(l.paye ? "Payé" : "À payer", cx + 6, y + 13);
    y += 18;
  });
  if (input.lignes.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setTextColor(MUTED);
    doc.text("Aucune vente sur cette année.", M, y + 20);
  }

  doc.setFillColor(GOLD);
  doc.rect(0, H - 8, W, 8, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  doc.text("Relevé généré avec FIGDITIONS", W / 2, H - 24, { align: "center" });
  return doc;
}
