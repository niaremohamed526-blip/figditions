import { jsPDF } from "jspdf";
import { couleurRgb, dateFr, frequenceLabel, type ArticleModele, type CouleurContrat, type StyleContrat } from "@/lib/contrat-template";

export interface Livre { titre: string; manuscrit_id?: string | null }

export interface ContratProPdfData {
  // Éditeur
  maison: string;
  ville_maison?: string | null;
  adresse_editeur?: string | null;
  telephone_editeur?: string | null;
  email_editeur?: string | null;
  website_editeur?: string | null;
  nif?: string | null;
  rccm?: string | null;
  nina?: string | null;
  banque?: string | null;
  compte_bancaire?: string | null;
  nom_representant?: string | null;
  qualite_representant?: string | null;
  logo_url?: string | null;
  cachet_url?: string | null;

  // Auteur
  auteur: string;
  adresse_auteur?: string | null;
  telephone_auteur?: string | null;
  profession_auteur?: string | null;

  // Objet
  collection?: string | null;
  livres: Livre[];

  // Conditions
  duree_annees: number;
  pourcentage: number;
  tirage_minimum: number;
  contribution_auteur?: string | null;
  format?: string | null;
  type_couverture?: string | null;
  reliure?: string | null;
  exemplaires_auteur: number;
  frequence_paiement: string; // annuel | semestriel | trimestriel

  // Territoires
  territoire_mali: number;
  territoire_ci: number;
  territoire_senegal: number;
  territoire_france: number;

  // Signature
  lieu_signature: string;
  date_signature: string; // ISO
}

/** The text and look of the document (from a template, or frozen at signature). */
export interface ContratPdfTexte {
  titre_document: string;
  sous_titre?: string | null;
  couleur: CouleurContrat;
  style?: StyleContrat;
  filigrane: boolean;
  articles: ArticleModele[]; // already rendered
}

export interface ContratPdfOptions {
  texte: ContratPdfTexte;
  reference?: string | null;
  notes?: string | null;
  /** "save" downloads the file; "blob" returns it (previews). */
  output?: "save" | "blob";
  /** Diagonal "APERÇU" mark for template previews. */
  apercu?: boolean;
}

type Img = { dataUrl: string; w: number; h: number };

// jsPDF's built-in fonts only cover WinAnsi: normalise spaces, drop emoji.
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
function clean(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/[\u00a0\u202f\u2009]/g, " ")
    .replace(/[‘‛]/g, "‘")
    .split("")
    .filter((ch) => {
      const c = ch.charCodeAt(0);
      return c === 10 || (c >= 32 && c <= 126) || (c >= 160 && c <= 255) || WIN_ANSI_EXTRA.has(ch);
    })
    .join("");
}

/** Any image URL → PNG data URL with its natural size (canvas handles webp/svg). */
async function loadImage(url: string | null | undefined): Promise<Img | null> {
  if (!url || typeof document === "undefined") return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const el = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = objectUrl;
      });
      const w = el.naturalWidth || 400;
      const h = el.naturalHeight || 400;
      const scale = Math.min(1, 1400 / Math.max(w, h));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      canvas.getContext("2d")!.drawImage(el, 0, 0, canvas.width, canvas.height);
      return { dataUrl: canvas.toDataURL("image/png"), w: canvas.width, h: canvas.height };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

function fit(img: Img, maxW: number, maxH: number) {
  const r = Math.min(maxW / img.w, maxH / img.h);
  return { w: img.w * r, h: img.h * r };
}

export async function generateContratProPdf(d: ContratProPdfData, opts: ContratPdfOptions): Promise<Blob | void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 22;
  const CW = W - 2 * M;
  const ACC = couleurRgb(opts.texte.couleur);
  const tint = (k: number): [number, number, number] => ACC.map((c) => Math.round(c + (255 - c) * k)) as [number, number, number];
  const INK: [number, number, number] = [28, 28, 30];
  const GREY: [number, number, number] = [110, 110, 115];
  // Page style: classique (serif, tinted cards), moderne (colour band,
  // sans-serif headings), épuré (outlines only, no colour fills).
  const STYLE: StyleContrat = opts.texte.style ?? "classique";
  const MOD = STYLE === "moderne";
  const EPU = STYLE === "epure";
  const WHITE: [number, number, number] = [255, 255, 255];
  const GState = (doc as any).GState;
  const opacity = (o: number) => { try { doc.setGState(new GState({ opacity: o })); } catch { /* old viewers */ } };

  const [logo, cachet] = await Promise.all([loadImage(d.logo_url), loadImage(d.cachet_url)]);
  const maison = clean(d.maison);
  const titreDoc = clean(opts.texte.titre_document || "Contrat");

  const text = (s: string, x: number, y: number, o: Parameters<jsPDF["text"]>[3] = {}) => doc.text(clean(s), x, y, o);
  const font = (style: "normal" | "bold" | "italic" | "bolditalic", size: number, color: [number, number, number] = INK) => {
    doc.setFont("times", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  // Headings: Helvetica in the modern style, Times otherwise.
  const hfont = (style: "normal" | "bold" | "italic", size: number, color: [number, number, number] = INK) => {
    font(style, size, color);
    if (MOD) doc.setFont("helvetica", style === "italic" ? "oblique" : style);
  };
  // jsPDF measures œ/Œ with a fallback width; use the real Times metrics.
  const tw = (s: string) => {
    const style = doc.getFont().fontStyle;
    const italic = style.includes("italic");
    const extra = (s.match(/œ/g)?.length ?? 0) * ((italic ? 0.667 : 0.722) - 0.51)
      + (s.match(/Œ/g)?.length ?? 0) * ((style === "bold" ? 1 : italic ? 0.944 : 0.889) - 0.51);
    const nbsp = s.match(/\u00a0/g)?.length ?? 0;
    const nbspFix = nbsp ? nbsp * (doc.getTextWidth(" ") - doc.getTextWidth("\u00a0")) : 0;
    return doc.getTextWidth(s) + extra * doc.getFontSize() * (25.4 / 72) + nbspFix;
  };
  // Letter-spaced text placed by its real width (jsPDF ignores charSpace when aligning).
  // With maxW, the font shrinks until it fits.
  const spaced = (raw: string, x: number, y: number, cs: number, align: "left" | "center" | "right" = "left", maxW?: number) => {
    const s = clean(raw);
    const width = () => tw(s) + cs * Math.max(0, s.length - 1);
    if (maxW) { while (width() > maxW && doc.getFontSize() > 4.5) doc.setFontSize(doc.getFontSize() - 0.2); }
    const w = width();
    const x0 = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    doc.text(s, x0, y, { charSpace: cs } as any);
  };

  // ---------------------------------------------------------------- page chrome
  const drawWatermark = () => {
    if (!opts.texte.filigrane) return;
    opacity(0.065);
    if (logo) {
      const s = fit(logo, 125, 125);
      try { doc.addImage(logo.dataUrl, "PNG", (W - s.w) / 2, (H - s.h) / 2, s.w, s.h, "filigrane", "FAST"); } catch { /* noop */ }
    } else {
      font("bold", 54, ACC);
      text(maison.toUpperCase(), W / 2, H / 2, { align: "center", angle: 35, baseline: "middle" } as any);
    }
    opacity(1);
  };

  const drawApercu = () => {
    if (!opts.apercu) return;
    opacity(0.08);
    font("bold", 90, [200, 30, 30]);
    text("APERÇU", W / 2, H / 2 + 20, { align: "center", angle: 35 } as any);
    opacity(1);
  };

  const drawSmallHeader = () => {
    if (MOD) { doc.setFillColor(...ACC); doc.rect(0, 0, W, 5, "F"); }
    let x = M;
    if (logo) {
      const s = fit(logo, 16, 9);
      try { doc.addImage(logo.dataUrl, "PNG", M, 11, s.w, s.h, "logo", "FAST"); } catch { /* noop */ }
      x = M + s.w + 3;
    }
    hfont("bold", 8.5, EPU ? INK : ACC);
    spaced(maison.toUpperCase(), x, 16.5, 0.4);
    font("italic", 8.5, GREY);
    text(titreDoc + (opts.reference ? `  ·  Réf. ${opts.reference}` : ""), W - M, 16.5, { align: "right" });
    doc.setDrawColor(...(EPU ? [190, 190, 195] as [number, number, number] : tint(0.55)));
    doc.setLineWidth(EPU ? 0.15 : 0.25);
    doc.line(M, 21, W - M, 21);
  };

  const TOP_NEXT = 30;
  const BOTTOM = H - 30;
  let y = 0;

  const newPage = () => {
    doc.addPage();
    drawWatermark();
    drawApercu();
    drawSmallHeader();
    y = TOP_NEXT;
  };
  const ensure = (h: number) => { if (y + h > BOTTOM) newPage(); };

  // Paragraph with real justification (last line left-aligned), splitting across pages.
  const LH = 5.15;
  const paragraph = (raw: string, o: { size?: number; style?: "normal" | "bold" | "italic"; color?: [number, number, number]; indent?: number; justify?: boolean; lh?: number } = {}) => {
    const size = o.size ?? 10.5;
    const lh = o.lh ?? LH;
    const x0 = M + (o.indent ?? 0);
    const maxW = CW - (o.indent ?? 0);
    font(o.style ?? "normal", size, o.color ?? INK);
    // Keep « » : ; ! ? on the same line as their word.
    const glued = clean(raw).replace(/« +/g, "«\u00a0").replace(/ +([»:;!?])/g, "\u00a0$1");
    for (const para of glued.split(/\n+/)) {
      const lines = doc.splitTextToSize(para.trim(), maxW - 1) as string[];
      lines.forEach((ln, i) => {
        ensure(lh);
        font(o.style ?? "normal", size, o.color ?? INK);
        const last = i === lines.length - 1;
        const words = ln.trim().split(/ +/);
        if (o.justify !== false && !last && words.length > 1) {
          const wordsW = words.reduce((a, w) => a + tw(w), 0);
          const gapW = (maxW - wordsW) / (words.length - 1);
          let x = x0;
          for (const w of words) { doc.text(w, x, y + 3.6); x += tw(w) + gapW; }
        } else {
          doc.text(ln.trim(), x0, y + 3.6);
        }
        y += lh;
      });
      y += 1.4;
    }
  };

  // ---------------------------------------------------------------- page 1 header
  drawWatermark();
  drawApercu();
  const contact = [d.adresse_editeur, d.telephone_editeur, d.email_editeur, d.website_editeur].filter(Boolean).map((s) => clean(s!)).join("   ·   ");
  if (MOD) {
    // Colour band across the top: logo on a white tile, name and contacts in white.
    let tx = M;
    const tile = logo ? fit(logo, 22, 16) : null;
    font("normal", 8.2, WHITE);
    const cl = contact ? (doc.splitTextToSize(contact, CW - (tile ? 32 : 0)) as string[]) : [];
    const bandH = Math.max(36, 22 + cl.length * 3.8);
    doc.setFillColor(...ACC);
    doc.rect(0, 0, W, bandH, "F");
    if (logo && tile) {
      doc.setFillColor(...WHITE);
      doc.roundedRect(M, (bandH - 22) / 2, 28, 22, 2, 2, "F");
      try { doc.addImage(logo.dataUrl, "PNG", M + 14 - tile.w / 2, bandH / 2 - tile.h / 2, tile.w, tile.h, "logo", "FAST"); } catch { /* noop */ }
      tx = M + 33;
    }
    const top = bandH / 2 - (6 + cl.length * 3.8) / 2 + 4.5;
    hfont("bold", 15, WHITE);
    spaced(maison.toUpperCase(), tx, top, 0.6, "left", W - M - tx);
    font("normal", 8.2, WHITE);
    cl.forEach((l, i) => text(l, tx, top + 6.5 + i * 3.8));
    y = bandH + 14;
  } else {
    y = 13;
    if (logo) {
      const s = fit(logo, 46, 22);
      try { doc.addImage(logo.dataUrl, "PNG", (W - s.w) / 2, y, s.w, s.h, "logo", "FAST"); } catch { /* noop */ }
      y += s.h + 4.5;
    }
    font("bold", 13, INK);
    spaced(maison.toUpperCase(), W / 2, y + 3, 0.9, "center", CW);
    y += 7.5;
    if (contact) {
      font("normal", 8.2, GREY);
      const cl = doc.splitTextToSize(contact, CW) as string[];
      cl.forEach((l) => { text(l, W / 2, y, { align: "center" }); y += 3.8; });
    }
    y += 2.5;
    if (EPU) {
      doc.setDrawColor(...INK);
      doc.setLineWidth(0.15);
      doc.line(M, y, W - M, y);
    } else {
      doc.setDrawColor(...ACC);
      doc.setLineWidth(0.7);
      doc.line(M, y, W - M, y);
      doc.setLineWidth(0.2);
      doc.line(M, y + 1.3, W - M, y + 1.3);
    }
    y += 11;
  }

  // ---------------------------------------------------------------- title block
  hfont("bold", EPU ? 19 : 21, INK);
  spaced(titreDoc.toUpperCase(), W / 2, y, EPU ? 2.2 : MOD ? 1 : 1.6, "center", CW);
  y += 5.5;
  doc.setDrawColor(...ACC);
  doc.setFillColor(...ACC);
  if (MOD) {
    doc.rect(W / 2 - 12, y - 0.6, 24, 1.2, "F");
  } else if (EPU) {
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.15);
    doc.line(W / 2 - 15, y, W / 2 + 15, y);
  } else {
    // ornament: line ◆ line
    doc.setLineWidth(0.35);
    doc.line(W / 2 - 26, y, W / 2 - 3.2, y);
    doc.line(W / 2 + 3.2, y, W / 2 + 26, y);
    doc.triangle(W / 2 - 1.8, y, W / 2, y - 1.8, W / 2 + 1.8, y, "F");
    doc.triangle(W / 2 - 1.8, y, W / 2, y + 1.8, W / 2 + 1.8, y, "F");
  }
  y += 6;
  if (opts.texte.sous_titre) {
    font("italic", 11, GREY);
    text(opts.texte.sous_titre, W / 2, y, { align: "center" });
    y += 5.5;
  }
  if (opts.reference) {
    font("normal", 8.5, GREY);
    spaced(`Réf. ${opts.reference}`, W / 2, y, 0.3, "center");
    y += 4;
  }
  y += 5;

  // ---------------------------------------------------------------- parties
  hfont("bold", 10.5, INK);
  spaced("ENTRE LES SOUSSIGNÉS", M, y, 0.6);
  y += 4;

  const colGap = 6;
  const colW = (CW - colGap) / 2;
  const editeurLines: string[] = [
    d.nom_representant ? `Représentée par ${d.nom_representant}${d.qualite_representant ? `, ${d.qualite_representant}` : ""}` : "",
    [d.nif && `NIF ${d.nif}`, d.rccm && `RCCM ${d.rccm}`, d.nina && `NINA ${d.nina}`].filter(Boolean).join(" · "),
    d.adresse_editeur ?? "",
    [d.telephone_editeur, d.email_editeur].filter(Boolean).join(" · "),
  ].filter(Boolean).map(clean);
  const auteurLines: string[] = [
    d.profession_auteur ? `Profession : ${d.profession_auteur}` : "",
    d.adresse_auteur ? `Adresse : ${d.adresse_auteur}` : "",
    d.telephone_auteur ? `Téléphone : ${d.telephone_auteur}` : "",
  ].filter(Boolean).map(clean);

  const wrapAll = (lines: string[]) => {
    font("normal", 8.8, GREY);
    return lines.flatMap((l) => doc.splitTextToSize(l, colW - 10) as string[]);
  };
  const eW = wrapAll(editeurLines);
  const aW = wrapAll(auteurLines);
  font("bold", 11.5, INK);
  const eName = doc.splitTextToSize(maison, colW - 10) as string[];
  const aName = doc.splitTextToSize(clean(d.auteur), colW - 10) as string[];
  const boxH = 16 + Math.max(eName.length * 5 + eW.length * 4, aName.length * 5 + aW.length * 4) + 6;
  ensure(boxH + 16);

  const partyBox = (x: number, label: string, role: string, name: string[], lines: string[]) => {
    if (EPU) {
      doc.setDrawColor(190, 190, 195);
      doc.setLineWidth(0.2);
      doc.rect(x, y, colW, boxH, "S");
    } else if (MOD) {
      doc.setFillColor(...tint(0.93));
      doc.rect(x, y, colW, boxH, "F");
      doc.setFillColor(...ACC);
      doc.rect(x, y, colW, 1.3, "F");
    } else {
      doc.setFillColor(...tint(0.93));
      doc.roundedRect(x, y, colW, boxH, 2, 2, "F");
      doc.setFillColor(...ACC);
      doc.rect(x, y + 2, 1.1, boxH - 4, "F");
    }
    hfont("bold", 7.8, ACC);
    spaced(label, x + 6, y + 7, 0.9);
    let yy = y + 13;
    hfont("bold", 11.5, INK);
    name.forEach((n) => { doc.text(n, x + 6, yy); yy += 5; });
    font("normal", 8.8, GREY);
    lines.forEach((l) => { doc.text(l, x + 6, yy); yy += 4; });
    font("italic", 8.2, ACC);
    text(role, x + colW - 5, y + boxH - 4, { align: "right" });
  };
  partyBox(M, "L'ÉDITEUR", "ci-après « l'Éditeur »", eName, eW);
  partyBox(M + colW + colGap, "L'AUTEUR", "ci-après « l'Auteur »", aName, aW);
  y += boxH + 6;

  font("italic", 9.5, GREY);
  text("ci-après dénommés ensemble « les Parties »,", W / 2, y, { align: "center" });
  y += 7;
  hfont("bold", 10.5, INK);
  spaced("IL A ÉTÉ CONVENU ET ARRÊTÉ CE QUI SUIT", W / 2, y, 0.8, "center", CW);
  y += 9;

  // ---------------------------------------------------------------- books table
  const livres = d.livres.filter((l) => l.titre?.trim());
  if (livres.length > 0) {
    const rowH = 6.4;
    ensure(9 + rowH * Math.min(livres.length, 4));
    const headInk: [number, number, number] = EPU ? ACC : WHITE;
    if (EPU) {
      doc.setDrawColor(...ACC);
      doc.setLineWidth(0.3);
      doc.line(M, y + 7.5, W - M, y + 7.5);
    } else {
      doc.setFillColor(...ACC);
      if (MOD) doc.rect(M, y, CW, 7.5, "F");
      else { doc.roundedRect(M, y, CW, 7.5, 1.5, 1.5, "F"); doc.rect(M, y + 4, CW, 3.5, "F"); }
    }
    hfont("bold", 8.5, headInk);
    spaced(livres.length > 1 ? "OUVRAGES CONCERNÉS" : "OUVRAGE CONCERNÉ", EPU ? M : M + 5, y + 5, 0.8);
    if (d.collection) {
      font("italic", 8.5, EPU ? GREY : WHITE);
      text(`Collection : ${d.collection}`, EPU ? W - M : W - M - 5, y + 5, { align: "right" });
    }
    y += 7.5;
    livres.forEach((l, i) => {
      ensure(rowH);
      if (i % 2 === 0 && !EPU) { doc.setFillColor(...tint(0.95)); doc.rect(M, y, CW, rowH, "F"); }
      font("bold", 9, ACC);
      text(String(i + 1).padStart(2, "0"), M + 5, y + 4.3);
      font("italic", 10.5, INK);
      text(`« ${l.titre.trim()} »`, M + 14, y + 4.3);
      y += rowH;
    });
    doc.setDrawColor(...tint(0.6));
    doc.setLineWidth(0.2);
    doc.line(M, y, W - M, y);
    y += 8;
  }

  // ---------------------------------------------------------------- key terms strip
  const tiles = [
    { k: "DURÉE", v: `${d.duree_annees} ans` },
    { k: "DROITS D'AUTEUR", v: `${d.pourcentage} %` },
    { k: "EXEMPLAIRES D'AUTEUR", v: String(d.exemplaires_auteur) },
    { k: "PAIEMENT DES DROITS", v: d.frequence_paiement === "trimestriel" ? "Trimestriel" : d.frequence_paiement === "semestriel" ? "Semestriel" : "Annuel" },
  ];
  ensure(24);
  hfont("bold", 8, GREY);
  spaced("CONDITIONS ESSENTIELLES", M, y, 0.8);
  y += 3;
  const tW = (CW - 3 * 3) / 4;
  tiles.forEach((t, i) => {
    const x = M + i * (tW + 3);
    if (MOD) {
      doc.setFillColor(...tint(0.9));
      doc.rect(x, y, tW, 15, "F");
    } else if (EPU) {
      doc.setDrawColor(190, 190, 195);
      doc.setLineWidth(0.2);
      doc.rect(x, y, tW, 15, "S");
    } else {
      doc.setDrawColor(...tint(0.55));
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, tW, 15, 1.6, 1.6, "S");
    }
    hfont("bold", 6.6, GREY);
    spaced(t.k, x + tW / 2, y + 5, 0.4, "center", tW - 4);
    hfont("bold", 12.5, EPU ? INK : ACC);
    text(t.v, x + tW / 2, y + 11.5, { align: "center" });
  });
  y += 23;

  // ---------------------------------------------------------------- articles
  opts.texte.articles.forEach((a, i) => {
    ensure(18);
    hfont("bold", 7.8, ACC);
    spaced(`ARTICLE ${i + 1}`, M, y + 3.4, 1);
    y += 5;
    if (a.titre?.trim()) {
      hfont("bold", 11.5, INK);
      const tl = doc.splitTextToSize(clean(a.titre), CW) as string[];
      tl.forEach((l) => { ensure(5.5); hfont("bold", 11.5, INK); doc.text(l, M, y + 3.8); y += 5.5; });
      doc.setDrawColor(...tint(0.5));
      doc.setLineWidth(0.25);
      doc.line(M, y + 0.4, M + 14, y + 0.4);
      y += 2.8;
    }
    paragraph(a.texte, { justify: true });
    y += 3;
  });

  // ---------------------------------------------------------------- particular clauses
  if (opts.notes?.trim()) {
    const lines = (() => { font("normal", 10, INK); return doc.splitTextToSize(clean(opts.notes), CW - 12) as string[]; })();
    const h = 12 + lines.length * 5;
    ensure(Math.min(h, 60));
    if (y + h <= BOTTOM) {
      if (EPU) {
        doc.setDrawColor(190, 190, 195);
        doc.setLineWidth(0.2);
        doc.rect(M, y, CW, h, "S");
      } else {
        doc.setFillColor(...tint(0.93));
        if (MOD) doc.rect(M, y, CW, h, "F");
        else doc.roundedRect(M, y, CW, h, 2, 2, "F");
      }
      hfont("bold", 7.8, ACC);
      spaced("CLAUSES PARTICULIÈRES", M + 6, y + 6.5, 1);
      font("normal", 10, INK);
      lines.forEach((l, i) => doc.text(l, M + 6, y + 12.5 + i * 5));
      y += h + 6;
    } else {
      hfont("bold", 7.8, ACC);
      spaced("CLAUSES PARTICULIÈRES", M, y + 3.4, 1);
      y += 6;
      paragraph(opts.notes, { justify: false });
      y += 3;
    }
  }

  // ---------------------------------------------------------------- signatures
  ensure(72);
  y += 2;
  font("normal", 10.5, INK);
  text(`Fait à ${d.lieu_signature}, le ${dateFr(d.date_signature) || "…………………"}, en deux exemplaires originaux.`, M, y + 3.5);
  y += 10;
  const sigH = 50;
  const sigBox = (x: number, label: string, name: string, withCachet: boolean, pour?: string) => {
    if (EPU) {
      doc.setDrawColor(190, 190, 195);
      doc.setLineWidth(0.2);
      doc.rect(x, y, colW, sigH, "S");
      doc.line(x, y + 9, x + colW, y + 9);
    } else if (MOD) {
      doc.setDrawColor(...tint(0.45));
      doc.setLineWidth(0.3);
      doc.rect(x, y, colW, sigH, "S");
      doc.setFillColor(...ACC);
      doc.rect(x, y, colW, 9, "F");
    } else {
      doc.setDrawColor(...tint(0.45));
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, colW, sigH, 2, 2, "S");
      doc.setFillColor(...tint(0.93));
      doc.roundedRect(x, y, colW, 9, 2, 2, "F");
      doc.rect(x, y + 5, colW, 4, "F");
    }
    hfont("bold", 8, MOD ? WHITE : ACC);
    spaced(label, x + colW / 2, y + 5.8, 1, "center");
    hfont("bold", 10.5, INK);
    text(name, x + colW / 2, y + 15, { align: "center" });
    if (pour) {
      font("italic", 8.5, GREY);
      text(pour, x + colW / 2, y + 19.5, { align: "center" });
    }
    font("italic", 7.8, GREY);
    text("Signature précédée de la mention « Lu et approuvé »", x + colW / 2, y + sigH - 4, { align: "center" });
    if (withCachet && cachet) {
      const s = fit(cachet, 34, 26);
      opacity(0.92);
      try { doc.addImage(cachet.dataUrl, "PNG", x + colW / 2 - s.w / 2, y + 18, s.w, s.h, "cachet", "FAST"); } catch { /* noop */ }
      opacity(1);
    }
  };
  sigBox(M, "L'AUTEUR", clean(d.auteur), false);
  sigBox(M + colW + colGap, "L'ÉDITEUR", clean(d.nom_representant || d.maison), true,
    d.nom_representant ? `${d.qualite_representant ? `${clean(d.qualite_representant)}, ` : ""}pour ${maison}` : undefined);
  y += sigH + 4;

  // ---------------------------------------------------------------- footers + initials
  const total = doc.getNumberOfPages();
  const legal = [d.nif && `NIF ${d.nif}`, d.rccm && `RCCM ${d.rccm}`, d.nina && `NINA ${d.nina}`].filter(Boolean).join("  ·  ");
  const bank = d.banque && d.compte_bancaire ? `${d.banque} · ${d.compte_bancaire}` : "";
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    const fy = H - 14;
    if (p < total) {
      font("italic", 7.8, GREY);
      text("Paraphes", W - M - 52, fy - 9);
      doc.setDrawColor(...tint(0.45));
      doc.setLineWidth(0.25);
      doc.roundedRect(W - M - 38, fy - 15, 17, 9, 1.2, 1.2, "S");
      doc.roundedRect(W - M - 18, fy - 15, 17, 9, 1.2, 1.2, "S");
    }
    doc.setDrawColor(...(EPU ? INK : ACC));
    doc.setLineWidth(EPU ? 0.15 : 0.35);
    doc.line(M, fy - 3.5, W - M, fy - 3.5);
    hfont("bold", 7.6, EPU ? INK : ACC);
    spaced(maison.toUpperCase(), M, fy + 0.5, 0.4);
    font("normal", 7.4, GREY);
    if (legal) text(legal, M, fy + 4.2);
    if (bank) text(bank, M, fy + 7.6);
    font("normal", 8, GREY);
    text(`Page ${p} / ${total}`, W - M, fy + 0.5, { align: "right" });
  }

  if (opts.output === "blob") return doc.output("blob");
  const safe = (d.livres[0]?.titre ?? "contrat").normalize("NFD").replace(/[̀-ͯ]/g, "");
  doc.save(`contrat-${safe.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "document"}.pdf`);
}

export { frequenceLabel };
