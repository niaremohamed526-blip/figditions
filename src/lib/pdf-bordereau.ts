import jsPDF from "jspdf";
import { fcfa } from "@/lib/format";

export interface BordereauLigne {
  titre: string;
  quantite: number;
  prix_unitaire: number;
  total: number;
  // optional context for depot type
  deposes?: number;
  vendus?: number;
  restants?: number;
}

export interface BordereauPdfData {
  numero: string;
  type: "depot" | "vente";
  maison: string;
  maisonAdresse?: string | null;
  maisonVille?: string | null;
  maisonEmail?: string | null;
  maisonTelephone?: string | null;
  librairieNom: string;
  librairieAdresse?: string | null;
  periodeDebut?: string | null;
  periodeFin?: string | null;
  dateEmission: string; // formatted date
  lignes: BordereauLigne[];
  totalExemplaires: number;
  totalFcfa: number;
  notes?: string | null;
}

export function generateBordereauPdf(d: BordereauPdfData, action: "download" | "open" = "download") {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;

  // Header band
  doc.setFillColor(10, 22, 40);
  doc.rect(0, 0, W, 90, "F");
  doc.setTextColor(0, 200, 150);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("FIGDITIONS", M, 44);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(212, 175, 55);
  doc.text("Plateforme d'édition au Mali", M, 60);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text(d.maison.toUpperCase(), W - M, 40, { align: "right" });
  if (d.maisonAdresse) doc.text(d.maisonAdresse, W - M, 54, { align: "right" });
  if (d.maisonVille) doc.text(d.maisonVille, W - M, 66, { align: "right" });
  const contact = [d.maisonTelephone, d.maisonEmail].filter(Boolean).join(" · ");
  if (contact) doc.text(contact, W - M, 78, { align: "right" });

  // Title
  let y = 120;
  const title = d.type === "depot" ? "BORDEREAU DE DÉPÔT" : "BORDEREAU DE VENTE";
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(`N° ${d.numero}`, W - M, y, { align: "right" });
  y += 8;
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(1);
  doc.line(M, y, W - M, y);
  y += 22;

  // Parties (Éditeur / Librairie)
  const colW = (W - 2 * M - 20) / 2;
  const boxH = 78;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.rect(M, y, colW, boxH);
  doc.rect(M + colW + 20, y, colW, boxH);

  doc.setTextColor(120, 120, 120);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("ÉDITEUR", M + 8, y + 14);
  doc.text("LIBRAIRIE", M + colW + 28, y + 14);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(d.maison, M + 8, y + 30);
  doc.text(d.librairieNom, M + colW + 28, y + 30);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  let leftY = y + 46;
  if (d.maisonAdresse) { doc.text(d.maisonAdresse, M + 8, leftY); leftY += 12; }
  if (d.maisonVille) { doc.text(d.maisonVille, M + 8, leftY); leftY += 12; }
  if (d.maisonTelephone) doc.text(d.maisonTelephone, M + 8, leftY);

  if (d.librairieAdresse) {
    const lines = doc.splitTextToSize(d.librairieAdresse, colW - 16);
    doc.text(lines, M + colW + 28, y + 46);
  }

  y += boxH + 16;

  // Meta line (date + période)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text(`Date d'émission : ${d.dateEmission}`, M, y);
  if (d.periodeDebut && d.periodeFin) {
    doc.text(`Période : du ${d.periodeDebut} au ${d.periodeFin}`, W - M, y, { align: "right" });
  }
  y += 20;

  // Table header
  const isDepot = d.type === "depot";
  const colTitre = M;
  const colTitreW = isDepot ? W - 2 * M - 260 : W - 2 * M - 240;
  const colQte = colTitre + colTitreW;
  const colPrix = colQte + (isDepot ? 60 : 60);
  const colTotal = colPrix + (isDepot ? 100 : 90);

  doc.setFillColor(245, 245, 245);
  doc.rect(M, y, W - 2 * M, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text("Titre", colTitre + 8, y + 15);
  if (isDepot) {
    doc.text("Dép.", colQte, y + 15, { align: "left" });
    doc.text("Vendus", colPrix, y + 15, { align: "left" });
    doc.text("Rest.", colTotal, y + 15, { align: "left" });
  } else {
    doc.text("Qté", colQte, y + 15, { align: "left" });
    doc.text("Prix unit.", colPrix, y + 15, { align: "left" });
    doc.text("Total", W - M - 8, y + 15, { align: "right" });
  }
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(10);

  for (const l of d.lignes) {
    if (y > H - 220) {
      doc.addPage();
      y = M;
    }
    const titreLines = doc.splitTextToSize(l.titre, colTitreW - 12);
    const rowH = Math.max(20, titreLines.length * 12 + 8);
    doc.setDrawColor(235, 235, 235);
    doc.line(M, y, W - M, y);
    doc.text(titreLines, colTitre + 8, y + 14);
    if (isDepot) {
      doc.text(String(l.deposes ?? l.quantite), colQte, y + 14);
      doc.text(String(l.vendus ?? 0), colPrix, y + 14);
      doc.text(String(l.restants ?? 0), colTotal, y + 14);
    } else {
      doc.text(String(l.quantite), colQte, y + 14);
      doc.text(fcfa(l.prix_unitaire), colPrix, y + 14);
      doc.text(fcfa(l.total), W - M - 8, y + 14, { align: "right" });
    }
    y += rowH;
  }

  // Totals
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(1);
  doc.line(M, y, W - M, y);
  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(`Total exemplaires : ${d.totalExemplaires}`, M, y);
  if (!isDepot) {
    doc.setTextColor(0, 130, 100);
    doc.text(`Total : ${fcfa(d.totalFcfa)}`, W - M, y, { align: "right" });
  }
  y += 28;

  // Notes
  if (d.notes) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    const notesLines = doc.splitTextToSize(`Note : ${d.notes}`, W - 2 * M);
    doc.text(notesLines, M, y);
    y += notesLines.length * 12 + 10;
  }

  // Signatures
  if (y > H - 130) { doc.addPage(); y = M; }
  y = Math.max(y, H - 140);
  const sigColW = (W - 2 * M - 40) / 2;
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.5);
  doc.line(M, y, M + sigColW, y);
  doc.line(M + sigColW + 40, y, M + 2 * sigColW + 40, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text("Signature de l'éditeur", M, y + 14);
  doc.text("Signature de la librairie", M + sigColW + 40, y + 14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text(d.maison, M, y + 30);
  doc.text(d.librairieNom, M + sigColW + 40, y + 30);

  // Footer
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Bordereau ${d.numero} · Généré via FIGDITIONS · ${d.dateEmission}`,
    W / 2,
    H - 20,
    { align: "center" },
  );

  const filename = `bordereau-${d.type}-${d.numero}.pdf`;
  if (action === "open") {
    window.open(doc.output("bloburl"), "_blank");
  } else {
    doc.save(filename);
  }
}
