import jsPDF from "jspdf";

export interface Livre { titre: string; manuscrit_id?: string | null }

export interface ContratProPdfData {
  // Éditeur
  maison: string;
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

const MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

function formatDateFr(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

function joinLivres(livres: Livre[]): string {
  const titres = livres.map((l) => `« ${l.titre} »`).filter(Boolean);
  if (titres.length === 0) return "« … »";
  if (titres.length === 1) return titres[0];
  if (titres.length === 2) return `${titres[0]} et ${titres[1]}`;
  return `${titres.slice(0, -1).join(", ")} et ${titres[titres.length - 1]}`;
}

function frequenceLabel(f: string): string {
  if (f === "trimestriel") return "chaque trimestre";
  if (f === "semestriel") return "deux fois par an";
  return "une fois par an, au mois de décembre";
}

async function urlToDataUrl(url: string): Promise<{ dataUrl: string; format: "PNG" | "JPEG" } | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const fmt: "PNG" | "JPEG" = blob.type.includes("png") ? "PNG" : "JPEG";
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    return { dataUrl, format: fmt };
  } catch {
    return null;
  }
}

export async function generateContratProPdf(d: ContratProPdfData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("times", "normal");

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 25;
  const contentW = W - 2 * M;
  const LH = 6; // line height (mm) ≈ 1.6 for 11pt

  const logo = d.logo_url ? await urlToDataUrl(d.logo_url) : null;
  const cachet = d.cachet_url ? await urlToDataUrl(d.cachet_url) : null;

  const drawHeader = () => {
    let x = M;
    let topY = 12;
    if (logo) {
      try { doc.addImage(logo.dataUrl, logo.format, M, topY, 18, 18); } catch { /* noop */ }
      x = M + 22;
    }
    doc.setFont("times", "bold");
    doc.setFontSize(15);
    doc.setTextColor(20, 20, 20);
    doc.text(d.maison.toUpperCase(), x, topY + 6);

    doc.setFont("times", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(90, 90, 90);
    doc.text(
      "Édition de livres | Communication | Formations | Promotion des langues nationales",
      x, topY + 11,
    );

    const contactParts = [
      d.adresse_editeur,
      d.telephone_editeur,
      d.email_editeur,
      d.website_editeur,
    ].filter(Boolean) as string[];
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    doc.setTextColor(70, 70, 70);
    if (contactParts.length) doc.text(contactParts.join("  ·  "), x, topY + 16);

    doc.setDrawColor(180, 150, 60);
    doc.setLineWidth(0.5);
    doc.line(M, 32, W - M, 32);
  };

  const drawFooter = (page: number, totalPages: number) => {
    const y = H - 15;
    doc.setDrawColor(180, 150, 60);
    doc.setLineWidth(0.3);
    doc.line(M, y - 4, W - M, y - 4);

    doc.setFont("times", "normal");
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    const legal = [
      d.nif ? `NIF : ${d.nif}` : null,
      d.rccm ? `RCCM : ${d.rccm}` : null,
      d.nina ? `NINA : ${d.nina}` : null,
    ].filter(Boolean).join(" . ");
    if (legal) doc.text(legal, W / 2, y, { align: "center" });

    const bank = d.banque && d.compte_bancaire ? `COMPTE ${d.banque} N° : ${d.compte_bancaire}` : "";
    if (bank) doc.text(bank, W / 2, y + 4, { align: "center" });

    doc.text(`Page ${page} / ${totalPages}`, W - M, y + 4, { align: "right" });
  };

  const TOP_Y = 40;
  const BOTTOM_LIMIT = H - 25;
  let y = TOP_Y;

  drawHeader();

  const ensureSpace = (needed: number) => {
    if (y + needed > BOTTOM_LIMIT) {
      doc.addPage();
      drawHeader();
      y = TOP_Y;
    }
  };

  const writeParagraph = (text: string, opts: { bold?: boolean; italic?: boolean; size?: number; align?: "left" | "center" | "justify"; indent?: number; color?: [number,number,number]; underline?: boolean } = {}) => {
    const size = opts.size ?? 11;
    doc.setFontSize(size);
    doc.setFont("times", opts.bold ? "bold" : (opts.italic ? "italic" : "normal"));
    const [r,g,b] = opts.color ?? [20,20,20];
    doc.setTextColor(r,g,b);
    const indent = opts.indent ?? 0;
    const maxW = contentW - indent;
    const lines = doc.splitTextToSize(text, maxW) as string[];
    ensureSpace(lines.length * LH);
    if (opts.align === "center") {
      lines.forEach((ln) => {
        doc.text(ln, W / 2, y + 4, { align: "center" });
        if (opts.underline) {
          const tw = doc.getTextWidth(ln);
          doc.setDrawColor(r,g,b);
          doc.setLineWidth(0.3);
          doc.line(W / 2 - tw / 2, y + 5, W / 2 + tw / 2, y + 5);
        }
        y += LH;
      });
    } else {
      doc.text(lines, M + indent, y + 4, { align: opts.align === "justify" ? "justify" : "left", maxWidth: maxW });
      y += lines.length * LH;
    }
  };

  const gap = (mm: number) => { ensureSpace(mm); y += mm; };

  const article = (n: number, title: string, body: string) => {
    ensureSpace(LH * 3);
    gap(2);
    writeParagraph(`Article ${n}. — ${title.toUpperCase()}`, { bold: true, size: 11 });
    writeParagraph(body, { align: "justify" });
  };

  // ============================================================
  // TITLE
  // ============================================================
  gap(4);
  writeParagraph("Contrat d'édition", { bold: true, size: 16, align: "center", underline: true });
  gap(6);

  // ============================================================
  // PARTIES
  // ============================================================
  writeParagraph("Entre les soussignés :", { bold: true });
  gap(2);

  const editeurLine = `${d.maison}${d.nif ? `  NIF : ${d.nif}` : ""}${d.rccm ? ` - RCCM : ${d.rccm}` : ""}${d.nina ? ` - NINA : ${d.nina}` : ""}${d.nom_representant ? `, représentée par ${d.nom_representant}` : ""}${d.qualite_representant ? ` en qualité de ${d.qualite_representant}` : ""}${d.email_editeur ? `, mail : ${d.email_editeur}` : ""}.`;
  writeParagraph(editeurLine, { bold: true, align: "justify" });
  gap(1);
  writeParagraph("D'UNE PART,", { bold: true });
  gap(2);

  const auteurBits: string[] = [];
  if (d.adresse_auteur) auteurBits.push(`adresse : ${d.adresse_auteur}`);
  if (d.telephone_auteur) auteurBits.push(`numéro de téléphone : ${d.telephone_auteur}`);
  if (d.profession_auteur) auteurBits.push(`profession : ${d.profession_auteur}`);
  const auteurLine = `Et ${d.auteur.toUpperCase()}, l'Auteur${auteurBits.length ? ", " + auteurBits.join(" ; ") : ""}.`;
  writeParagraph(auteurLine, { align: "justify" });
  gap(1);
  writeParagraph("D'AUTRE PART,", { bold: true });
  gap(2);
  writeParagraph("IL EST CONVENU CE QUI SUIT :", { bold: true, align: "center" });
  gap(4);
  writeParagraph("CONDITIONS GÉNÉRALES", { bold: true, align: "center", size: 12 });
  gap(3);

  // ============================================================
  // ARTICLES
  // ============================================================
  const livresStr = joinLivres(d.livres);
  const collectionStr = d.collection ? `, dans sa collection ${d.collection},` : "";

  article(1, "Objet du contrat",
    `${d.auteur.toUpperCase()}, l'Auteur, charge L'ÉDITEUR ${d.maison}, qui accepte de relire, corriger, réorganiser, restructurer, mettre en page, concevoir la couverture et la quatrième de couverture, imprimer et publier${collectionStr} les ouvrages intitulés : ${livresStr}, conformément aux dispositions suivantes.`);

  article(2, "Conservation des droits",
    `L'Auteur reste propriétaire de ses œuvres. Cependant, ${d.maison} bénéficie d'une licence exclusive d'exploitation pour une durée de ${d.duree_annees} ans, renouvelable par accord des parties. ${d.maison} conserve les droits d'édition, d'impression, de traduction, d'adaptation, de commercialisation et de promotion pendant cette période sur le territoire du Mali et à l'étranger. Les droits d'auteur sont payés à l'Auteur et fixés à ${d.pourcentage}% du prix public hors taxes par exemplaire effectivement vendu, ou, dans le cas d'une commande institutionnelle ou d'un projet financé, à partir des ${d.tirage_minimum} premiers exemplaires vendus.`);

  article(3, "Sélection du texte",
    `Les textes sélectionnés seront édités et publiés par ladite maison d'édition. ${d.maison} prend à sa charge la responsabilité des devoirs afférents aux différentes contributions : frais de conception infographique, frais de relecture-correction, de traduction, d'édition, d'impression, de communication et de promotion des ouvrages précités.${d.contribution_auteur ? ` Cependant, l'Auteur fera une contribution financière pour ${d.contribution_auteur}.` : ""}`);

  article(4, "Correction du texte et validation",
    `L'Auteur s'engage à participer au processus de relecture-correction des ouvrages précités et à l'intégration des suggestions de correction faites par ${d.maison}. Les corrections typographiques, orthographiques et syntaxiques sont à la charge de ${d.maison}, mais les corrections des termes techniques, des noms et prénoms utilisés par l'Auteur sont à la seule charge de ce dernier.`);

  article(5, "Caractéristiques techniques",
    `Format : ${d.format || "24/26, 170gr"} avec une couverture ${d.type_couverture || "quadrichromie cartonnée"}. La reliure sera ${d.reliure || "dos carré-collé"} et les illustrations seront en couleurs.`);

  article(6, "Présentation de l'échantillon",
    `Avant le tirage des ouvrages en quantité, 10 copies de chaque livre seront imprimées pour leur évaluation. ${d.exemplaires_auteur} exemplaires de chaque ouvrage seront envoyés à l'Auteur ${d.auteur.toUpperCase()} comme échantillons des ouvrages (spécimens), soumis une seule fois à son appréciation pour avis, relecture et corrections.`);

  article(7, "Tirage",
    `Le tirage en quantité sera réalisé dès que les conditions financières le permettront, notamment dans le cadre d'un financement obtenu par ${d.maison} ou sur ses fonds propres.`);

  article(8, "Propriété du tirage",
    `Le nombre d'exemplaires imprimés dépendra des moyens disponibles. L'Auteur sera informé par ${d.maison}, par une lettre formelle, du nombre d'exemplaires imprimés en quantité. En cas d'impression en quantité, ${d.exemplaires_auteur} exemplaires de chaque ouvrage fabriqué seront remis à l'Auteur comme exemplaires d'auteur. ${d.maison} est libérée de ses engagements pour ces exemplaires remis au moment du calcul des droits d'auteur après les ventes.`);

  article(9, "Publication",
    `${d.maison} s'engage à publier les ouvrages et, à cet effet, 2 exemplaires de chaque ouvrage seront remis à la Bibliothèque nationale du Mali comme dépôt légal, 5 au Bureau malien du droit d'auteur (BUMDA), 2 à l'ORTM pour présentation au journal télévisé et 2 à la presse écrite. Les ouvrages seront inscrits dans le catalogue de ${d.maison} et diffusés sur l'ensemble des plateformes numériques : site internet, réseaux sociaux, magazines, catalogue et tout autre support de communication.`);

  article(10, "Droits d'auteur",
    `Les ${d.pourcentage}% des ventes, après déduction du pourcentage libraire, seront remis à l'Auteur comme droits d'auteur. Les droits d'auteur sont dus uniquement lorsque le premier tirage de chaque ouvrage est supérieur ou égal à ${d.tirage_minimum} exemplaires. En cas de ventes, les droits d'auteur seront payés ${frequenceLabel(d.frequence_paiement)}. Une lettre sera officiellement envoyée à l'Auteur à l'arrêté des comptes pour l'informer de l'état des ventes de chaque ouvrage.`);

  article(11, "Promotion et diffusion",
    `Il est convenu entre l'Auteur et ${d.maison} que la promotion et la diffusion des œuvres seront effectuées par les deux parties. Cependant, ${d.maison} fera une large diffusion de l'œuvre au niveau des écoles du Mali, des foires, fêtes et festivals du livre, espaces culturels, plateaux de télévision ou radios.`);

  article(12, "Dépôt légal",
    `${d.maison} prend à sa charge les formalités obligatoires de dépôt légal des ouvrages auprès de la Bibliothèque Nationale du Mali et celles obligatoires du dépôt à la BUMDA (Bureau des droits d'auteur).`);

  article(13, "Prix de vente et droits d'auteur",
    `Les prix publics des ouvrages seront fixés par ${d.maison} en tenant compte des coûts de production, de diffusion et de commercialisation. Les remises commerciales consenties aux diffuseurs et libraires (pourcentage libraire) sont de ${d.territoire_mali}% au Mali, ${d.territoire_ci}% en Côte d'Ivoire, ${d.territoire_senegal}% au Sénégal et ${d.territoire_france}% en France.`);

  article(14, "Contribution de l'auteur",
    `Les ouvrages sont issus d'un atelier d'écriture et de production de textes organisé par ${d.maison}. À ce titre, ${d.maison} assure la coordination scientifique, l'accompagnement éditorial, les corrections, la conception graphique, la recherche de financements, la publication, la diffusion et la promotion des œuvres.${d.contribution_auteur ? ` Pour la production des ouvrages précités, l'Auteur ne supportera aucun frais, à l'exception de sa contribution aux frais d'${d.contribution_auteur}. Les frais de relecture-correction, de traduction, d'édition, de conception infographique, d'impression, de communication et de promotion seront à la charge de ${d.maison}.` : ""}`);

  article(15, "Durée du contrat",
    `Le présent contrat est conclu pour une durée de ${d.duree_annees} ans, renouvelable d'un commun accord.`);

  article(16, "Résiliation du contrat",
    `En cas de difficulté à commercialiser le livre, l'une ou l'autre des parties pourra résilier le présent contrat après avoir informé l'autre partie.`);

  article(17, "Traduction et droits annexes",
    `${d.maison} fera part à l'Auteur de toute proposition éventuelle de traduction desdits titres.`);

  article(18, "Litiges",
    `Tout différend sera résolu à l'amiable, au cas échéant, soumis par l'une ou l'autre partie au Tribunal de commerce du Mali.`);

  // ============================================================
  // SIGNATURES
  // ============================================================
  gap(6);
  ensureSpace(70);
  writeParagraph(`Fait à ${d.lieu_signature}, le ${formatDateFr(d.date_signature)}.`, { bold: true });
  gap(10);

  const colW = (contentW - 20) / 2;
  const startY = y;
  const boxH = 40;

  // Left column — Auteur
  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text("L'AUTEUR,", M, startY);
  doc.setFont("times", "normal");
  doc.text(d.auteur, M, startY + 6);
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.3);
  doc.line(M, startY + boxH, M + colW, startY + boxH);

  // Right column — Éditeur (+ cachet)
  const rx = M + colW + 20;
  doc.setFont("times", "bold");
  doc.text("L'ÉDITEUR,", rx, startY);
  doc.setFont("times", "normal");
  doc.text(d.nom_representant || d.maison, rx, startY + 6);
  if (cachet) {
    try { doc.addImage(cachet.dataUrl, cachet.format, rx, startY + 10, 30, 25); } catch { /* noop */ }
  }
  doc.line(rx, startY + boxH, rx + colW, startY + boxH);

  y = startY + boxH + 4;

  // ============================================================
  // FOOTERS (paginate)
  // ============================================================
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawFooter(i, total);
  }

  const safe = d.livres[0]?.titre ?? "contrat";
  doc.save(`contrat-${safe.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`);
}
