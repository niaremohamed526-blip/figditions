import jsPDF from "jspdf";
import { FIGDITIONS_SITE_LOGO_URL as figditionsLogoUrl } from "@/lib/brand-assets";

export interface BordereauLigne {
  titre: string;
  quantite: number;
  prix_unitaire: number;
  total: number;
  deposes?: number;
  vendus?: number;
  restants?: number;
  /** Exemplaires restants AVANT le dernier dépôt (traçabilité multi-lots). */
  avant?: number;
  /** Quantité du dépôt le plus récent pour ce titre. */
  ceDepot?: number;
}

export interface BordereauLot {
  date: string;
  titre: string;
  quantite: number;
  provenance?: string | null;
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
  /** Historique des lots de dépôt (type "depot" uniquement). */
  historiqueLots?: BordereauLot[];
  /** Optional data URL (or http URL) of the publisher's own logo, rendered as a discreet watermark at the center. */
  watermarkLogoUrl?: string | null;
}

/**
 * Amounts formatted with a dot as thousands separator (ex. 98.000 FCFA).
 * jsPDF built-in fonts cannot render the narrow no-break space produced by
 * Intl.NumberFormat("fr-FR") — it shows up as "/" — so we format manually.
 */
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

export async function generateBordereauPdf(
  d: BordereauPdfData,
  action: "download" | "open" = "download",
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 50;

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
      const maxW = 280;
      const scale = maxW / w;
      const drawW = maxW;
      const drawH = h * scale;
      const x = (W - drawW) / 2;
      const y = (H - drawH) / 2;
      const anyDoc = doc as any;
      if (anyDoc.GState) {
        anyDoc.setGState(new anyDoc.GState({ opacity: 0.06 }));
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
  // FIGDITIONS logo top-center (compact)
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

  // Thin gold rule under masthead
  y += 8;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(W / 2 - 20, y, W / 2 + 20, y);

  // Small tagline
  doc.setFont("times", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("Plateforme éditoriale — Bamako", W / 2, y + 11);

  // ─── Title block (asymmetric editorial) ──────────────────────────────
  y += 34;

  // Left: eyebrow + large title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...GOLD);
  doc.text("N° " + d.numero.toUpperCase(), M, y);

  doc.setFont("times", "normal");
  doc.setFontSize(21);
  doc.setTextColor(...INK);
  const isDepot = d.type === "depot";
  const title = isDepot ? "Bordereau de dépôt" : "FACTURE";
  doc.text(title, M, y + 22);

  // Right: date stack
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text("ÉMIS LE", W - M, y, { align: "right" });
  doc.setFont("times", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(d.dateEmission, W - M, y + 13, { align: "right" });
  if (d.periodeDebut && d.periodeFin) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text("PÉRIODE", W - M, y + 28, { align: "right" });
    doc.setFont("times", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(`${d.periodeDebut} — ${d.periodeFin}`, W - M, y + 40, { align: "right" });
  }

  y += 52;

  // Full-width hairline
  doc.setDrawColor(...HAIR);
  doc.setLineWidth(0.4);
  doc.line(M, y, W - M, y);
  y += 22;

  // ─── Parties (two columns, no boxes, editorial labels) ───────────────
  const colGap = 30;
  const colW = (W - 2 * M - colGap) / 2;

  const renderParty = (
    x: number,
    label: string,
    name: string,
    lines: (string | null | undefined)[],
  ) => {
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

  renderParty(M, "ÉDITEUR", d.maison, [
    d.maisonAdresse,
    d.maisonVille,
    d.maisonTelephone,
    d.maisonEmail,
  ]);
  renderParty(M + colW + colGap, "LIBRAIRIE", d.librairieNom, [d.librairieAdresse]);

  y += 74;

  // ─── Table — clean rows, gold accents ────────────────────────────────
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.8);
  doc.line(M, y, W - M, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  const headerY = y + 12;
  doc.text("TITRE", M, headerY);
  if (isDepot) {
    doc.text("DÉPOSÉS", W - M - 180, headerY, { align: "right" });
    doc.text("VENDUS", W - M - 95, headerY, { align: "right" });
    doc.text("RESTANTS", W - M, headerY, { align: "right" });
  } else {
    doc.text("QTÉ", W - M - 210, headerY, { align: "right" });
    doc.text("PRIX UNITAIRE", W - M - 100, headerY, { align: "right" });
    doc.text("TOTAL", W - M, headerY, { align: "right" });
  }
  y = headerY + 8;
  doc.setDrawColor(...HAIR);
  doc.setLineWidth(0.4);
  doc.line(M, y, W - M, y);
  y += 12;

  for (const l of d.lignes) {
    if (y > H - 190) {
      doc.addPage();
      y = M;
    }
    const titreLines = doc.splitTextToSize(l.titre, W - 2 * M - 240);
    const rowH = Math.max(18, titreLines.length * 11.5 + 8);

    doc.setFont("times", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(titreLines, M, y + 3);

    let extraH = 0;
    if (isDepot && (l.ceDepot ?? 0) > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(
        `avant : ${l.avant ?? 0}   +   ce depot : ${l.ceDepot}   =   nouveau total : ${(l.avant ?? 0) + (l.ceDepot ?? 0)}`
          .replace(/depot/g, "dépôt"),
        M,
        y + titreLines.length * 11 + 2,
      );
      extraH = 11;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    if (isDepot) {
      doc.text(String(l.deposes ?? l.quantite), W - M - 180, y + 3, { align: "right" });
      doc.text(String(l.vendus ?? 0), W - M - 95, y + 3, { align: "right" });
      doc.text(String(l.restants ?? 0), W - M, y + 3, { align: "right" });
    } else {
      doc.text(String(l.quantite), W - M - 210, y + 3, { align: "right" });
      doc.text(fmtFcfa(l.prix_unitaire), W - M - 100, y + 3, { align: "right" });
      doc.setTextColor(...INK);
      doc.text(fmtFcfa(l.total), W - M, y + 3, { align: "right" });
    }
    y += rowH + extraH;
    doc.setDrawColor(...HAIR);
    doc.setLineWidth(0.3);
    doc.line(M, y - 5, W - M, y - 5);
  }

  // ─── Totals block ────────────────────────────────────────────────────
  y += 8;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.8);
  doc.line(M, y, W - M, y);
  y += 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text("TOTAL EXEMPLAIRES", M, y);
  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text(String(d.totalExemplaires), M, y + 18);

  if (!isDepot) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text("CHIFFRE D'AFFAIRES", W - M, y, { align: "right" });
    doc.setFont("times", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...GOLD);
    doc.text(fmtFcfa(d.totalFcfa), W - M, y + 19, { align: "right" });
  }
  y += 36;

  // Commission + droits + net éditeur breakdown (vente only)
  if (!isDepot) {
    const commission = Math.round(d.commissionLibrairieFcfa ?? d.totalFcfa * 0.2);
    const net = d.totalFcfa - commission;
    const rows: [string, string, readonly [number, number, number]][] = [
      ["Commission librairie", `- ${fmtFcfa(commission)}`, [200, 120, 60]],
    ];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const [label, value, color] of rows) {
      doc.setTextColor(...MUTED);
      doc.text(label, W / 2 + 20, y);
      doc.setTextColor(...color);
      doc.setFont("helvetica", "bold");
      doc.text(value, W - M, y, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += 12;
    }
    doc.setDrawColor(...HAIR);
    doc.setLineWidth(0.4);
    doc.line(W / 2 + 20, y, W - M, y);
    y += 12;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("NET À REVERSER À L'ÉDITEUR", W / 2 + 20, y);
    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.text(fmtFcfa(net), W - M, y, { align: "right" });
    y += 20;
  }

  // ─── Historique des lots de dépôt ────────────────────────────────────
  if (isDepot && d.historiqueLots && d.historiqueLots.length > 0) {
    if (y > H - 200) { doc.addPage(); y = M; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...GOLD);
    doc.text("HISTORIQUE DES DÉPÔTS", M, y);
    y += 10;
    doc.setDrawColor(...HAIR);
    doc.setLineWidth(0.4);
    doc.line(M, y, W - M, y);
    y += 12;
    for (const lot of d.historiqueLots) {
      if (y > H - 150) { doc.addPage(); y = M; }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(lot.date, M, y);
      doc.setTextColor(...INK);
      const t = doc.splitTextToSize(lot.titre, W - 2 * M - 200);
      doc.text(t[0], M + 70, y);
      if (lot.provenance === "hors_stock") {
        doc.setTextColor(...MUTED);
        doc.setFontSize(7);
        doc.text("hors stock interne", W - M - 90, y, { align: "right" });
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...GOLD);
      doc.text(`+ ${lot.quantite}`, W - M, y, { align: "right" });
      y += 12;
    }
    y += 8;
  }

  // Notes
  if (d.notes) {
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

  // ─── Signatures ──────────────────────────────────────────────────────
  if (y > H - 120) { doc.addPage(); y = M; }
  y = Math.max(y, H - 120);
  const sigColW = (W - 2 * M - 36) / 2;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.5);
  doc.line(M, y, M + sigColW, y);
  doc.line(M + sigColW + 36, y, M + 2 * sigColW + 36, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text("SIGNATURE — ÉDITEUR", M, y + 12);
  doc.text("SIGNATURE — LIBRAIRIE", M + sigColW + 36, y + 12);
  doc.setFont("times", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(d.maison, M, y + 26);
  doc.text(d.librairieNom, M + sigColW + 36, y + 26);

  // Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text(
    `${isDepot ? "Bordereau" : "Facture"} ${d.numero}   ·   Généré via FIGDITIONS   ·   ${d.dateEmission}`,
    W / 2,
    H - 20,
    { align: "center" },
  );

  const filename = `${isDepot ? "bordereau-depot" : "facture"}-${d.numero}.pdf`;
  if (action === "open") {
    window.open(doc.output("bloburl"), "_blank");
  } else {
    doc.save(filename);
  }
}
