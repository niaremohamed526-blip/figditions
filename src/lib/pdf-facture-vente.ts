import jsPDF from "jspdf";
import { FIGDITIONS_SITE_LOGO_URL as figditionsLogoUrl } from "@/lib/brand-assets";

export interface FactureLigne {
  titre: string;
  auteur?: string | null;
  quantite: number;
  prix_unitaire: number;
  /** Montant avant remise (quantité × prix unitaire). */
  total: number;
}

export interface FactureVenteData {
  numero: string;
  dateEmission: string;
  maison: string;
  maisonAdresse?: string | null;
  maisonVille?: string | null;
  maisonTelephone?: string | null;
  maisonEmail?: string | null;
  clientNom?: string | null;
  lignes: FactureLigne[];
  sousTotal: number;
  remisePct: number;
  remiseFcfa: number;
  total: number;
  notes?: string | null;
  watermarkLogoUrl?: string | null;
}

/** Montants avec point comme séparateur de milliers (ex. 98.000 FCFA). */
const fmtFcfa = (n: number | null | undefined) => {
  const v = Math.round(Number(n ?? 0) || 0);
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " FCFA";
};

async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function loadImageSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Facture A4 « Vente directe » — même identité visuelle que le bordereau
 * (masthead FIGDITIONS, filets dorés, typographie éditoriale).
 */
export async function generateFactureVentePdf(
  d: FactureVenteData,
  action: "download" | "open" = "download",
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 50;

  const INK = [17, 24, 39] as const;
  const MUTED = [110, 114, 128] as const;
  const HAIR = [220, 216, 208] as const;
  const GOLD = [176, 141, 62] as const;
  const PAPER_ACCENT = [248, 245, 239] as const;

  // Filigrane (logo de la maison)
  if (d.watermarkLogoUrl) {
    try {
      const dataUrl = d.watermarkLogoUrl.startsWith("data:")
        ? d.watermarkLogoUrl
        : await urlToDataUrl(d.watermarkLogoUrl);
      const { w, h } = await loadImageSize(dataUrl);
      const drawW = 280;
      const drawH = h * (drawW / w);
      const anyDoc = doc as any;
      if (anyDoc.GState) {
        anyDoc.setGState(new anyDoc.GState({ opacity: 0.06 }));
        doc.addImage(dataUrl, "PNG", (W - drawW) / 2, (H - drawH) / 2, drawW, drawH, undefined, "FAST");
        anyDoc.setGState(new anyDoc.GState({ opacity: 1 }));
      } else {
        doc.addImage(dataUrl, "PNG", (W - drawW) / 2, (H - drawH) / 2, drawW, drawH, undefined, "FAST");
      }
    } catch {
      // filigrane optionnel
    }
  }

  // Masthead
  let y = 28;
  try {
    const logoData = await urlToDataUrl(figditionsLogoUrl);
    const { w, h } = await loadImageSize(logoData);
    const targetW = 96;
    const targetH = Math.min(56, (h / w) * targetW);
    doc.addImage(logoData, "PNG", (W - targetW) / 2, y, targetW, targetH, undefined, "FAST");
    y += targetH;
  } catch {
    doc.setFont("times", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...INK);
    doc.text("FIGDITIONS", W / 2, y + 12, { align: "center" });
    y += 16;
  }

  y += 8;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(W / 2 - 20, y, W / 2 + 20, y);
  doc.setFont("times", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("Plateforme éditoriale, Bamako", W / 2, y + 11, { align: "center" });

  // Titre
  y += 34;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...GOLD);
  doc.text("N° " + d.numero.toUpperCase(), M, y);
  doc.setFont("times", "normal");
  doc.setFontSize(21);
  doc.setTextColor(...INK);
  doc.text("FACTURE DE VENTE LIBRE", M, y + 22);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text("ÉMISE LE", W - M, y, { align: "right" });
  doc.setFont("times", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(d.dateEmission, W - M, y + 13, { align: "right" });

  y += 52;
  doc.setDrawColor(...HAIR);
  doc.setLineWidth(0.4);
  doc.line(M, y, W - M, y);
  y += 22;

  // Parties
  const colGap = 30;
  const colW = (W - 2 * M - colGap) / 2;
  const renderParty = (x: number, label: string, name: string, lines: (string | null | undefined)[]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(label, x, y);
    doc.setFont("times", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(...INK);
    doc.text(name, x, y + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80, 82, 92);
    let ly = y + 27;
    lines.filter(Boolean).forEach((line) => {
      const wrapped = doc.splitTextToSize(String(line), colW);
      doc.text(wrapped, x, ly);
      ly += wrapped.length * 9.5;
    });
  };
  renderParty(M, "ÉDITEUR", d.maison, [d.maisonAdresse, d.maisonVille, d.maisonTelephone, d.maisonEmail]);
  renderParty(M + colW + colGap, "CLIENT", d.clientNom?.trim() || "Client comptant", []);

  y += 74;

  // Tableau
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.8);
  doc.line(M, y, W - M, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  const headerY = y + 12;
  doc.text("LIVRE", M, headerY);
  doc.text("QTÉ", W - M - 210, headerY, { align: "right" });
  doc.text("PRIX UNIT.", W - M - 100, headerY, { align: "right" });
  doc.text("TOTAL", W - M, headerY, { align: "right" });
  y = headerY + 8;
  doc.setDrawColor(...HAIR);
  doc.setLineWidth(0.4);
  doc.line(M, y, W - M, y);
  y += 12;

  for (const l of d.lignes) {
    if (y > H - 200) { doc.addPage(); y = M; }
    const titreLines = doc.splitTextToSize(l.titre, W - 2 * M - 240);
    const rowH = Math.max(18, titreLines.length * 11.5 + 8);
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(titreLines, M, y + 3);
    let extraH = 0;
    if (l.auteur) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(String(l.auteur), M, y + titreLines.length * 11 + 2);
      extraH = 11;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(String(l.quantite), W - M - 210, y + 3, { align: "right" });
    doc.text(fmtFcfa(l.prix_unitaire), W - M - 100, y + 3, { align: "right" });
    doc.text(fmtFcfa(l.total), W - M, y + 3, { align: "right" });
    y += rowH + extraH;
    doc.setDrawColor(...HAIR);
    doc.setLineWidth(0.3);
    doc.line(M, y - 5, W - M, y - 5);
  }

  // Totaux
  y += 8;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.8);
  doc.line(M, y, W - M, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("Total avant remise", W / 2 + 20, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...INK);
  doc.text(fmtFcfa(d.sousTotal), W - M, y, { align: "right" });
  y += 14;

  if (d.remiseFcfa > 0) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text(`Remise (${Math.round(d.remisePct)}%)`, W / 2 + 20, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(200, 120, 60);
    doc.text(`Remise de ${fmtFcfa(d.remiseFcfa)}`, W - M, y, { align: "right" });
    y += 14;
  }

  doc.setDrawColor(...HAIR);
  doc.setLineWidth(0.4);
  doc.line(W / 2 + 20, y, W - M, y);
  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("TOTAL À PAYER", W / 2 + 20, y);
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...GOLD);
  doc.text(fmtFcfa(d.total), W - M, y + 2, { align: "right" });
  y += 28;

  // Notes
  if (d.notes) {
    if (y > H - 180) { doc.addPage(); y = M; }
    doc.setFillColor(...PAPER_ACCENT);
    const notesLines = doc.splitTextToSize(d.notes, W - 2 * M - 24);
    const boxH = notesLines.length * 11 + 22;
    doc.rect(M, y, W - 2 * M, boxH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...GOLD);
    doc.text("NOTE", M + 10, y + 12);
    doc.setFont("times", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(notesLines, M + 10, y + 24);
    y += boxH + 8;
  }

  // Remerciement + signatures
  if (y > H - 130) { doc.addPage(); y = M; }
  y = Math.max(y, H - 130);
  doc.setFont("times", "italic");
  doc.setFontSize(11);
  doc.setTextColor(...GOLD);
  doc.text("Merci pour votre achat", M, y);
  y += 26;

  const sigColW = (W - 2 * M - 36) / 2;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.5);
  doc.line(M, y, M + sigColW, y);
  doc.line(M + sigColW + 36, y, M + 2 * sigColW + 36, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text("SIGNATURE DE L'ÉDITEUR", M, y + 12);
  doc.text("SIGNATURE DU CLIENT", M + sigColW + 36, y + 12);
  doc.setFont("times", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(d.maison, M, y + 26);
  doc.text(d.clientNom?.trim() || "Client comptant", M + sigColW + 36, y + 26);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text(
    `Facture ${d.numero}   ·   Générée via FIGDITIONS   ·   ${d.dateEmission}`,
    W / 2,
    H - 20,
    { align: "center" },
  );

  if (action === "open") {
    window.open(doc.output("bloburl"), "_blank");
  } else {
    doc.save(`facture-${d.numero}.pdf`);
  }
}
