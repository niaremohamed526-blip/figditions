import jsPDF from "jspdf";

const GOLD = "#C8922A";
const DARK_GOLD = "#A67420";
const INK = "#1A1208";
const MUTED = "#6b6154";
const BORDER = "#d8cfbc";

export interface RecuLigne {
  titre: string;
  dateVente: string;
  quantite: number;
  montant: number;
}

export interface RecuLibrairieInput {
  entrepriseNom: string;
  entrepriseVille?: string | null;
  numero: string;
  date: Date;
  librairieNom: string;
  montant: number;
  resteDu: number;
  lignes: RecuLigne[];
}

const fmt = (n: number) => `${Math.round(n).toLocaleString("fr-FR").replace(/ | /g, " ")} FCFA`;
const fmtDate = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

/** Numéro lisible et stable pour un même paiement : REC-AAAAMMJJ-XXXX. */
export function numeroRecu(date: Date, seed: string): string {
  const d = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `REC-${d}-${seed.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase()}`;
}

/** Reçu remis à une librairie quand elle règle des ventes (A4 portrait). */
export function generateRecuLibrairiePdf(input: RecuLibrairieInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 50;
  const CW = W - M * 2;

  doc.setFillColor(GOLD);
  doc.rect(0, 0, W, 8, "F");

  let y = 60;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(DARK_GOLD);
  doc.text(input.entrepriseNom, M, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK);
  doc.text(`Reçu N° ${input.numero}`, W - M, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED);
  const lieu = input.entrepriseVille ? `${input.entrepriseVille}, le ` : "Le ";
  doc.text(`${lieu}${fmtDate(input.date)}`, W - M, y + 16, { align: "right" });

  y += 45;
  doc.setDrawColor(GOLD);
  doc.setLineWidth(1.2);
  doc.line(M, y, W - M, y);

  y += 40;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(INK);
  doc.text("REÇU DE PAIEMENT", W / 2, y, { align: "center" });

  y += 36;
  doc.setFontSize(10.5);
  const label = (l: string, v: string) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(MUTED);
    doc.text(l, M, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(INK);
    doc.text(v, M + 130, y);
    y += 18;
  };
  label("Reçu de :", input.librairieNom);
  label("Reçu par :", input.entrepriseNom);
  label("Date :", fmtDate(input.date));

  y += 12;
  doc.setFillColor("#faf5ea");
  doc.setDrawColor(GOLD);
  doc.setLineWidth(1);
  doc.roundedRect(M, y, CW, 52, 6, 6, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(DARK_GOLD);
  doc.text("MONTANT REÇU", M + 16, y + 21);
  doc.setFontSize(17);
  doc.text(fmt(input.montant), W - M - 16, y + 34, { align: "right" });
  y += 52 + 30;

  if (input.lignes.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(INK);
    doc.text("Ventes réglées", M, y);
    y += 10;
    const cols = [CW * 0.44, CW * 0.2, CW * 0.1, CW * 0.26];
    const heads = ["Livre", "Date de vente", "Qté", "Montant réglé"];
    doc.setFillColor(GOLD);
    doc.rect(M, y, CW, 22, "F");
    doc.setFontSize(9);
    doc.setTextColor("#FFFFFF");
    let x = M;
    heads.forEach((h, i) => {
      const right = i >= 2;
      doc.text(h.toUpperCase(), right ? x + cols[i] - 6 : x + 6, y + 15, { align: right ? "right" : "left" });
      x += cols[i];
    });
    y += 22;
    input.lignes.forEach((l, idx) => {
      if (y + 18 > H - 160) { doc.addPage(); y = 80; }
      if (idx % 2 === 1) { doc.setFillColor("#f7f3ea"); doc.rect(M, y, CW, 18, "F"); }
      doc.setDrawColor(BORDER);
      doc.setLineWidth(0.4);
      doc.line(M, y + 18, M + CW, y + 18);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(INK);
      let cx = M;
      doc.text(l.titre.length > 48 ? `${l.titre.slice(0, 47)}…` : l.titre, cx + 6, y + 13); cx += cols[0];
      doc.text(l.dateVente, cx + 6, y + 13); cx += cols[1];
      doc.text(String(l.quantite), cx + cols[2] - 6, y + 13, { align: "right" }); cx += cols[2];
      doc.text(fmt(l.montant), cx + cols[3] - 6, y + 13, { align: "right" });
      y += 18;
    });
    y += 24;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(INK);
  doc.text(
    input.resteDu > 0 ? `Reste à régler après ce paiement : ${fmt(input.resteDu)}` : "Toutes les ventes de cette librairie sont réglées.",
    M, y,
  );

  const sigY = Math.max(y + 50, H - 150);
  doc.setFont("helvetica", "bold");
  doc.text(`Pour ${input.entrepriseNom}`, W - M, sigY, { align: "right" });
  doc.setDrawColor(BORDER);
  doc.setLineWidth(0.6);
  doc.line(W - M - 200, sigY + 70, W - M, sigY + 70);

  doc.setFillColor(GOLD);
  doc.rect(0, H - 8, W, 8, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  doc.text(`Reçu généré avec FIGDITIONS | ${input.numero}`, W / 2, H - 24, { align: "center" });
  return doc;
}
