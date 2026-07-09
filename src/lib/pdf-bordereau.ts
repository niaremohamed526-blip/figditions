import jsPDF from "jspdf";
import { fcfa } from "@/lib/format";
import figditionsLogoUrl from "@/assets/figditions-logo.png";

export interface BordereauLigne {
  titre: string;
  quantite: number;
  prix_unitaire: number;
  total: number;
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
  dateEmission: string;
  lignes: BordereauLigne[];
  totalExemplaires: number;
  totalFcfa: number;
  /** Commission librairie (default 20% of totalFcfa when omitted, only used for "vente" type). */
  commissionLibrairieFcfa?: number;
  /** Droits auteur (10% by default). Only shown for "vente" type. */
  droitsAuteurFcfa?: number;
  notes?: string | null;
  /** Optional data URL (or http URL) of the publisher's own logo, rendered as a discreet watermark at the center. */
  watermarkLogoUrl?: string | null;
}

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

export async function generateBordereauPdf(
  d: BordereauPdfData,
  action: "download" | "open" = "download",
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 56;

  // Editorial magazine palette
  const INK = [17, 24, 39] as const;         // near-black navy
  const MUTED = [110, 114, 128] as const;
  const HAIR = [220, 216, 208] as const;     // warm hairline
  const GOLD = [176, 141, 62] as const;      // refined gold
  const PAPER_ACCENT = [248, 245, 239] as const;

  // ─── Watermark (user's logo, very discreet, centered) ────────────────
  if (d.watermarkLogoUrl) {
    try {
      const dataUrl = d.watermarkLogoUrl.startsWith("data:")
        ? d.watermarkLogoUrl
        : await urlToDataUrl(d.watermarkLogoUrl);
      const { w, h } = await loadImageSize(dataUrl);
      const maxW = 320;
      const scale = maxW / w;
      const drawW = maxW;
      const drawH = h * scale;
      const x = (W - drawW) / 2;
      const y = (H - drawH) / 2;
      const anyDoc = doc as any;
      if (anyDoc.GState) {
        anyDoc.setGState(new anyDoc.GState({ opacity: 0.07 }));
        doc.addImage(dataUrl, "PNG", x, y, drawW, drawH, undefined, "FAST");
        anyDoc.setGState(new anyDoc.GState({ opacity: 1 }));
      } else {
        doc.addImage(dataUrl, "PNG", x, y, drawW, drawH, undefined, "FAST");
      }
    } catch {
      // silent — watermark is optional
    }
  }

  // ─── Editorial masthead ──────────────────────────────────────────────
  // FIGDITIONS logo top-center
  try {
    const logoData = await urlToDataUrl(figditionsLogoUrl);
    const { w, h } = await loadImageSize(logoData);
    const targetW = 150;
    const targetH = (h / w) * targetW;
    doc.addImage(logoData, "PNG", (W - targetW) / 2, 36, targetW, targetH, undefined, "FAST");
  } catch {
    // fallback wordmark
    doc.setFont("times", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...INK);
    doc.text("FIGDITIONS", W / 2, 60, { align: "center" });
  }

  // Thin gold rule under masthead
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(W / 2 - 24, 96, W / 2 + 24, 96);

  // Small tagline
  doc.setFont("times", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text("Plateforme éditoriale — Bamako", W / 2, 112, { align: "center" });

  // ─── Title block (asymmetric editorial) ──────────────────────────────
  let y = 148;

  // Left: eyebrow + large title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GOLD);
  doc.text(
    (d.type === "depot" ? "N° " : "N° ") + d.numero.toUpperCase(),
    M,
    y,
  );

  doc.setFont("times", "normal");
  doc.setFontSize(28);
  doc.setTextColor(...INK);
  const title = d.type === "depot" ? "Bordereau de dépôt" : "Bordereau de vente";
  doc.text(title, M, y + 30);

  // Right: date stack
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("ÉMIS LE", W - M, y, { align: "right" });
  doc.setFont("times", "normal");
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text(d.dateEmission, W - M, y + 16, { align: "right" });
  if (d.periodeDebut && d.periodeFin) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text("PÉRIODE", W - M, y + 34, { align: "right" });
    doc.setFont("times", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(`${d.periodeDebut} — ${d.periodeFin}`, W - M, y + 48, { align: "right" });
  }

  y += 72;

  // Full-width hairline
  doc.setDrawColor(...HAIR);
  doc.setLineWidth(0.4);
  doc.line(M, y, W - M, y);
  y += 28;

  // ─── Parties (two columns, no boxes, editorial labels) ───────────────
  const colGap = 32;
  const colW = (W - 2 * M - colGap) / 2;

  const renderParty = (
    x: number,
    label: string,
    name: string,
    lines: (string | null | undefined)[],
  ) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(label, x, y);
    doc.setFont("times", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    doc.text(name, x, y + 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 82, 92);
    let ly = y + 34;
    lines.filter(Boolean).forEach((line) => {
      const wrapped = doc.splitTextToSize(String(line), colW);
      doc.text(wrapped, x, ly);
      ly += wrapped.length * 11;
    });
  };

  renderParty(M, "ÉDITEUR", d.maison, [
    d.maisonAdresse,
    d.maisonVille,
    d.maisonTelephone,
    d.maisonEmail,
  ]);
  renderParty(M + colW + colGap, "LIBRAIRIE", d.librairieNom, [d.librairieAdresse]);

  y += 96;

  // ─── Table — clean rows, gold accents ────────────────────────────────
  const isDepot = d.type === "depot";
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.8);
  doc.line(M, y, W - M, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  const headerY = y + 14;
  doc.text("TITRE", M, headerY);
  if (isDepot) {
    doc.text("DÉPOSÉS", W - M - 200, headerY, { align: "right" });
    doc.text("VENDUS", W - M - 110, headerY, { align: "right" });
    doc.text("RESTANTS", W - M, headerY, { align: "right" });
  } else {
    doc.text("QTÉ", W - M - 230, headerY, { align: "right" });
    doc.text("PRIX UNITAIRE", W - M - 110, headerY, { align: "right" });
    doc.text("TOTAL", W - M, headerY, { align: "right" });
  }
  y = headerY + 10;
  doc.setDrawColor(...HAIR);
  doc.setLineWidth(0.4);
  doc.line(M, y, W - M, y);
  y += 14;

  doc.setFont("times", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...INK);

  for (const l of d.lignes) {
    if (y > H - 220) {
      doc.addPage();
      y = M;
    }
    const titreLines = doc.splitTextToSize(l.titre, W - 2 * M - 260);
    const rowH = Math.max(22, titreLines.length * 13 + 10);

    doc.setFont("times", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(titreLines, M, y + 4);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    if (isDepot) {
      doc.text(String(l.deposes ?? l.quantite), W - M - 200, y + 4, { align: "right" });
      doc.text(String(l.vendus ?? 0), W - M - 110, y + 4, { align: "right" });
      doc.text(String(l.restants ?? 0), W - M, y + 4, { align: "right" });
    } else {
      doc.text(String(l.quantite), W - M - 230, y + 4, { align: "right" });
      doc.text(fcfa(l.prix_unitaire), W - M - 110, y + 4, { align: "right" });
      doc.setTextColor(...INK);
      doc.text(fcfa(l.total), W - M, y + 4, { align: "right" });
    }
    y += rowH;
    doc.setDrawColor(...HAIR);
    doc.setLineWidth(0.3);
    doc.line(M, y - 6, W - M, y - 6);
  }

  // ─── Totals block ────────────────────────────────────────────────────
  y += 10;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.8);
  doc.line(M, y, W - M, y);
  y += 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("TOTAL EXEMPLAIRES", M, y);
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.text(String(d.totalExemplaires), M, y + 22);

  if (!isDepot) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("MONTANT TOTAL", W - M, y, { align: "right" });
    doc.setFont("times", "bold");
    doc.setFontSize(20);
    doc.setTextColor(...GOLD);
    doc.text(fcfa(d.totalFcfa), W - M, y + 24, { align: "right" });
  }
  y += 44;

  // Notes
  if (d.notes) {
    doc.setFillColor(...PAPER_ACCENT);
    const notesLines = doc.splitTextToSize(d.notes, W - 2 * M - 24);
    const boxH = notesLines.length * 12 + 24;
    doc.rect(M, y, W - 2 * M, boxH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...GOLD);
    doc.text("NOTE", M + 12, y + 14);
    doc.setFont("times", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(notesLines, M + 12, y + 28);
    y += boxH + 10;
  }

  // ─── Signatures ──────────────────────────────────────────────────────
  if (y > H - 130) { doc.addPage(); y = M; }
  y = Math.max(y, H - 140);
  const sigColW = (W - 2 * M - 40) / 2;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.5);
  doc.line(M, y, M + sigColW, y);
  doc.line(M + sigColW + 40, y, M + 2 * sigColW + 40, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("SIGNATURE — ÉDITEUR", M, y + 14);
  doc.text("SIGNATURE — LIBRAIRIE", M + sigColW + 40, y + 14);
  doc.setFont("times", "italic");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text(d.maison, M, y + 30);
  doc.text(d.librairieNom, M + sigColW + 40, y + 30);

  // Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(
    `Bordereau ${d.numero}   ·   Généré via FIGDITIONS   ·   ${d.dateEmission}`,
    W / 2,
    H - 22,
    { align: "center" },
  );

  const filename = `bordereau-${d.type}-${d.numero}.pdf`;
  if (action === "open") {
    window.open(doc.output("bloburl"), "_blank");
  } else {
    doc.save(filename);
  }
}
