/**
 * One look for every FIGDITIONS PDF: gold FIGDITIONS logo at the top, the
 * house's logo as a faint filigrane on every page, the same tables, totals,
 * signatures and footer. Generators call chargerMarquePdf() once, then the
 * drawing helpers below.
 */
import type jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { FIGDITIONS_SITE_LOGO_GOLD_URL } from "@/lib/brand-assets";
import { pdfDateLongue } from "@/lib/pdf-format";

export const PDF = {
  gold: "#C8922A",
  goldDark: "#9A6B1A",
  goldSoft: "#FAF5EA",
  zebra: "#F8F4EC",
  ink: "#1F1F1F",
  muted: "#6B6B6B",
  border: "#E4DCCB",
  green: "#2F7D4F",
  red: "#B3261E",
  marge: 48,
};

export interface ImagePdf { dataUrl: string; w: number; h: number }

export interface MarquePdf {
  /** FIGDITIONS logo in gold, margins trimmed. */
  figditions: ImagePdf | null;
  /** House filigrane (its own image, or its logo), null when switched off. */
  filigrane: ImagePdf | null;
}

const cacheImages = new Map<string, Promise<ImagePdf | null>>();

/** Loads an image as PNG data URL; trims transparent or white margins when asked. */
function chargerImage(url: string | null | undefined, rogner = false): Promise<ImagePdf | null> {
  if (!url) return Promise.resolve(null);
  const cle = `${rogner ? "r:" : ""}${url}`;
  const deja = cacheImages.get(cle);
  if (deja) return deja;
  const p = (async () => {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error("image"));
        i.src = url;
      });
      let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
      const c = document.createElement("canvas");
      const ctx = c.getContext("2d");
      if (!ctx || !sw || !sh) return null;
      if (rogner) {
        c.width = sw; c.height = sh;
        ctx.drawImage(img, 0, 0);
        const px = ctx.getImageData(0, 0, sw, sh).data;
        let x0 = sw, y0 = sh, x1 = -1, y1 = -1;
        for (let y = 0; y < sh; y++) {
          for (let x = 0; x < sw; x++) {
            const k = (y * sw + x) * 4;
            const blanc = px[k] > 245 && px[k + 1] > 245 && px[k + 2] > 245;
            if (px[k + 3] > 16 && !blanc) {
              if (x < x0) x0 = x; if (x > x1) x1 = x;
              if (y < y0) y0 = y; if (y > y1) y1 = y;
            }
          }
        }
        if (x1 >= x0 && y1 >= y0) { sx = x0; sy = y0; sw = x1 - x0 + 1; sh = y1 - y0 + 1; }
      }
      // Keep files light: at most 700 px on the long side.
      const k = Math.min(1, 700 / Math.max(sw, sh));
      c.width = Math.max(1, Math.round(sw * k));
      c.height = Math.max(1, Math.round(sh * k));
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
      return { dataUrl: c.toDataURL("image/png"), w: c.width, h: c.height };
    } catch {
      return null;
    }
  })();
  cacheImages.set(cle, p);
  return p;
}

/**
 * Reads the house's PDF settings (filigrane on/off, own image, else its logo).
 * Missing columns or no session simply mean: filigrane = house logo.
 */
export async function chargerMarquePdf(): Promise<MarquePdf> {
  let filigraneUrl: string | null = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: prof } = await supabase.from("profiles").select("entreprise_id").eq("id", user.id).maybeSingle();
      if (prof?.entreprise_id) {
        const { data: e } = await supabase.from("entreprises").select("*").eq("id", prof.entreprise_id).maybeSingle();
        const ent = (e ?? {}) as { logo_url?: string | null; filigrane_url?: string | null; pdf_filigrane?: boolean | null };
        if (ent.pdf_filigrane !== false) filigraneUrl = ent.filigrane_url || ent.logo_url || null;
      }
    }
  } catch {
    /* no filigrane rather than no PDF */
  }
  const [figditions, filigrane] = await Promise.all([
    chargerImage(FIGDITIONS_SITE_LOGO_GOLD_URL, true),
    chargerImage(filigraneUrl),
  ]);
  return { figditions, filigrane };
}

const ajuster = (img: ImagePdf, maxW: number, maxH: number) => {
  const k = Math.min(maxW / img.w, maxH / img.h);
  return { w: img.w * k, h: img.h * k };
};

const opacite = (doc: jsPDF, o: number) => {
  try {
    const GState = (doc as any).GState;
    (doc as any).setGState(new GState({ opacity: o }));
  } catch { /* old viewers: drawn opaque */ }
};

export interface EnteteInfos {
  /** "FACTURE", "REÇU DE PAIEMENT"… */
  titre: string;
  numero?: string | null;
  /** Already formatted, e.g. "Bamako, le 02 novembre 2026". */
  date?: string | null;
}

/** Top of the first page. Returns the y where the body starts. */
export function dessinerEntete(doc: jsPDF, marque: MarquePdf, infos: EnteteInfos): number {
  const W = doc.internal.pageSize.getWidth();
  const M = PDF.marge;
  doc.setFillColor(PDF.gold);
  doc.rect(0, 0, W, 6, "F");

  const top = 30;
  if (marque.figditions) {
    const s = ajuster(marque.figditions, 120, 58);
    try { doc.addImage(marque.figditions.dataUrl, "PNG", M, top, s.w, s.h, "figditions-logo", "FAST"); } catch { /* noop */ }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(PDF.goldDark);
    doc.text("FIGDITIONS", M, top + 30);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(PDF.ink);
  doc.text(infos.titre, W - M, top + 18, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(PDF.muted);
  let ly = top + 34;
  if (infos.numero) { doc.text(`N° ${infos.numero}`, W - M, ly, { align: "right" }); ly += 13; }
  if (infos.date) doc.text(infos.date, W - M, ly, { align: "right" });

  const y = top + 72;
  doc.setDrawColor(PDF.gold);
  doc.setLineWidth(1);
  doc.line(M, y, W - M, y);
  return y + 26;
}

/** Slim header for pages 2 and more. Returns the y where the body continues. */
export function dessinerEnteteSuite(doc: jsPDF, marque: MarquePdf, titre: string): number {
  const W = doc.internal.pageSize.getWidth();
  const M = PDF.marge;
  doc.setFillColor(PDF.gold);
  doc.rect(0, 0, W, 6, "F");
  if (marque.figditions) {
    const s = ajuster(marque.figditions, 70, 30);
    try { doc.addImage(marque.figditions.dataUrl, "PNG", M, 18, s.w, s.h, "figditions-logo", "FAST"); } catch { /* noop */ }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(PDF.muted);
  doc.text(titre, W - M, 36, { align: "right" });
  doc.setDrawColor(PDF.border);
  doc.setLineWidth(0.6);
  doc.line(M, 56, W - M, 56);
  return 80;
}

export interface Partie { etiquette: string; nom: string; lignes?: (string | null | undefined)[] }

/** Two side-by-side blocks, e.g. "Émis par" / "Client". Returns the y below them. */
export function dessinerParties(doc: jsPDF, y: number, gauche: Partie, droite?: Partie | null): number {
  const W = doc.internal.pageSize.getWidth();
  const M = PDF.marge;
  const col = (W - 2 * M) / 2;
  const bloc = (p: Partie, x: number) => {
    let yy = y;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(PDF.goldDark);
    doc.text(p.etiquette.toUpperCase(), x, yy);
    yy += 15;
    doc.setFontSize(11.5);
    doc.setTextColor(PDF.ink);
    const nom = doc.splitTextToSize(p.nom, col - 16) as string[];
    doc.text(nom, x, yy);
    yy += nom.length * 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(PDF.muted);
    for (const l of (p.lignes ?? []).filter(Boolean) as string[]) {
      const t = doc.splitTextToSize(l, col - 16) as string[];
      doc.text(t, x, yy);
      yy += t.length * 12;
    }
    return yy;
  };
  const a = bloc(gauche, M);
  const b = droite ? bloc(droite, M + col) : y;
  return Math.max(a, b) + 18;
}

export interface Colonne { titre: string; largeur: number; align?: "left" | "right" | "center" }
export type Cellule = string | { texte: string; sous?: string | null; couleur?: string; gras?: boolean };

/**
 * Table with a gold header row, zebra lines and a header redrawn on each new page.
 * `largeur` values are fractions of the text width. Returns the y below the table.
 */
export function dessinerTableau(
  doc: jsPDF, marque: MarquePdf, titreSuite: string, y: number,
  colonnes: Colonne[], lignes: Cellule[][], basDePage = 90, total?: Cellule[] | null,
): number {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = PDF.marge;
  const CW = W - 2 * M;
  const largeurs = colonnes.map((c) => c.largeur * CW);
  // Never leave a lonely header at the bottom of a page.
  if (y + 22 + 30 > H - basDePage) {
    doc.addPage();
    y = dessinerEnteteSuite(doc, marque, titreSuite);
  }
  const tx = (i: number, x: number) => {
    const a = colonnes[i].align ?? "left";
    return a === "right" ? x + largeurs[i] - 7 : a === "center" ? x + largeurs[i] / 2 : x + 7;
  };
  const enteteTableau = () => {
    doc.setFillColor(PDF.gold);
    doc.rect(M, y, CW, 22, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor("#FFFFFF");
    let x = M;
    colonnes.forEach((c, i) => {
      // Long headers shrink rather than run into the next column.
      let taille = 7.5;
      doc.setFontSize(taille);
      while (taille > 5.5 && doc.getTextWidth(c.titre.toUpperCase()) > largeurs[i] - 10) doc.setFontSize((taille -= 0.5));
      doc.text(c.titre.toUpperCase(), tx(i, x), y + 14.5, { align: c.align ?? "left" });
      x += largeurs[i];
    });
    y += 22;
  };
  enteteTableau();
  lignes.forEach((ligne, idx) => {
    const aSous = ligne.some((c) => typeof c !== "string" && c.sous);
    const h = aSous ? 30 : 20;
    if (y + h > H - basDePage) {
      doc.addPage();
      y = dessinerEnteteSuite(doc, marque, titreSuite);
      enteteTableau();
    }
    if (idx % 2 === 1) {
      doc.setFillColor(PDF.zebra);
      doc.rect(M, y, CW, h, "F");
    }
    let x = M;
    ligne.forEach((cel, i) => {
      const c = typeof cel === "string" ? { texte: cel } : cel;
      doc.setFont("helvetica", c.gras ? "bold" : "normal");
      doc.setFontSize(9);
      doc.setTextColor(c.couleur ?? PDF.ink);
      const max = largeurs[i] - 12;
      let t = c.texte;
      while (t.length > 1 && doc.getTextWidth(t) > max) t = t.slice(0, -2) + "…";
      doc.text(t, tx(i, x), y + 13.5, { align: colonnes[i].align ?? "left" });
      if (c.sous) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(PDF.muted);
        doc.text(c.sous, tx(i, x), y + 24, { align: colonnes[i].align ?? "left" });
      }
      x += largeurs[i];
    });
    doc.setDrawColor(PDF.border);
    doc.setLineWidth(0.4);
    doc.line(M, y + h, M + CW, y + h);
    y += h;
  });
  if (total) {
    // The total may sit a little lower than normal rows, just above the footer.
    if (y + 24 > H - Math.min(basDePage, 50)) {
      doc.addPage();
      y = dessinerEnteteSuite(doc, marque, titreSuite);
    }
    doc.setFillColor(PDF.goldSoft);
    doc.rect(M, y, CW, 24, "F");
    doc.setDrawColor(PDF.gold);
    doc.setLineWidth(0.8);
    doc.line(M, y, M + CW, y);
    let x = M;
    total.forEach((cel, i) => {
      const c = typeof cel === "string" ? { texte: cel } : cel;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(c.couleur ?? PDF.ink);
      let t = c.texte;
      while (t.length > 1 && doc.getTextWidth(t) > largeurs[i] - 12) t = t.slice(0, -2) + "…";
      doc.text(t, tx(i, x), y + 15.5, { align: colonnes[i].align ?? "left" });
      x += largeurs[i];
    });
    y += 24;
  }
  return y + 18;
}

/** Highlighted amount box (gold frame). Returns the y below it. */
export function dessinerMontant(doc: jsPDF, y: number, libelle: string, montant: string, note?: string | null): number {
  const W = doc.internal.pageSize.getWidth();
  const M = PDF.marge;
  const h = note ? 62 : 52;
  doc.setFillColor(PDF.goldSoft);
  doc.setDrawColor(PDF.gold);
  doc.setLineWidth(0.8);
  doc.roundedRect(M, y, W - 2 * M, h, 6, 6, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(PDF.goldDark);
  doc.text(libelle.toUpperCase(), M + 16, y + 22);
  if (note) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(PDF.muted);
    doc.text(note, M + 16, y + 38);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(PDF.ink);
  doc.text(montant, W - M - 16, y + (note ? 36 : 32), { align: "right" });
  return y + h + 22;
}

/** Right-aligned summary lines (sous-total, remise, total…). Returns the y below. */
export function dessinerTotaux(doc: jsPDF, y: number, lignes: { libelle: string; valeur: string; fort?: boolean; couleur?: string }[]): number {
  const W = doc.internal.pageSize.getWidth();
  const M = PDF.marge;
  const x0 = W - M - 230;
  for (const l of lignes) {
    if (l.fort) {
      doc.setDrawColor(PDF.gold);
      doc.setLineWidth(0.8);
      doc.line(x0, y - 4, W - M, y - 4);
      y += 12;
    }
    doc.setFont("helvetica", l.fort ? "bold" : "normal");
    doc.setFontSize(l.fort ? 12 : 9.5);
    doc.setTextColor(l.fort ? PDF.ink : PDF.muted);
    doc.text(l.libelle, x0, y);
    doc.setTextColor(l.couleur ?? PDF.ink);
    doc.text(l.valeur, W - M, y, { align: "right" });
    y += l.fort ? 22 : 16;
  }
  return y + 8;
}

/** Small section title. Returns the y below it. */
export function dessinerSection(doc: jsPDF, y: number, titre: string): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(PDF.ink);
  doc.text(titre, PDF.marge, y);
  return y + 12;
}

/** Paragraph wrapped to the text width. Returns the y below it. */
export function dessinerParagraphe(doc: jsPDF, y: number, texte: string, opts: { taille?: number; couleur?: string; italique?: boolean } = {}): number {
  const W = doc.internal.pageSize.getWidth();
  const taille = opts.taille ?? 9.5;
  doc.setFont("helvetica", opts.italique ? "italic" : "normal");
  doc.setFontSize(taille);
  doc.setTextColor(opts.couleur ?? PDF.ink);
  const l = doc.splitTextToSize(texte, W - 2 * PDF.marge) as string[];
  doc.text(l, PDF.marge, y);
  return y + l.length * (taille * 1.35) + 8;
}

/** Two signature blocks, kept together near the bottom of the page. */
export function dessinerSignatures(doc: jsPDF, marque: MarquePdf, titreSuite: string, y: number, gauche: { titre: string; note?: string; nom?: string | null }, droite: { titre: string; note?: string; nom?: string | null }) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = PDF.marge;
  if (y + 120 > H - 70) {
    doc.addPage();
    y = dessinerEnteteSuite(doc, marque, titreSuite);
  }
  const sy = Math.max(y + 10, H - 190);
  const largeur = (W - 2 * M - 40) / 2;
  const bloc = (b: typeof gauche, x: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(PDF.ink);
    doc.text(b.titre, x, sy);
    if (b.note) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(PDF.muted);
      doc.text(b.note, x, sy + 13);
    }
    doc.setDrawColor(PDF.border);
    doc.setLineWidth(0.6);
    doc.line(x, sy + 80, x + largeur, sy + 80);
    if (b.nom) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(PDF.muted);
      doc.text(b.nom, x, sy + 94);
    }
  };
  bloc(gauche, M);
  bloc(droite, M + largeur + 40);
}

/**
 * Last step for every PDF: filigrane on each page (faint, centred), footer
 * with the document reference and "Page x / n".
 */
export function finaliserPdf(doc: jsPDF, marque: MarquePdf, reference?: string | null) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = PDF.marge;
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    doc.setPage(p);
    if (marque.filigrane) {
      const s = ajuster(marque.filigrane, 300, 300);
      opacite(doc, 0.07);
      try { doc.addImage(marque.filigrane.dataUrl, "PNG", (W - s.w) / 2, (H - s.h) / 2, s.w, s.h, "filigrane", "FAST"); } catch { /* noop */ }
      opacite(doc, 1);
    }
    doc.setDrawColor(PDF.border);
    doc.setLineWidth(0.5);
    doc.line(M, H - 40, W - M, H - 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(PDF.muted);
    const gauche = [reference, `Généré avec FIGDITIONS · figditions.xyz · ${pdfDateLongue(new Date())}`].filter(Boolean).join("  ·  ");
    let pied = gauche;
    while (pied.length > 1 && doc.getTextWidth(pied) > W - 2 * M - 60) pied = pied.slice(0, -2) + "…";
    doc.text(pied, M, H - 26);
    doc.text(`Page ${p} / ${n}`, W - M, H - 26, { align: "right" });
    doc.setFillColor(PDF.gold);
    doc.rect(0, H - 6, W, 6, "F");
  }
}
