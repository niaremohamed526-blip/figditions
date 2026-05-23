import jsPDF from "jspdf";

export interface ContratPdfData {
  maison: string;
  ville?: string | null;
  adresse?: string | null;
  email?: string | null;
  telephone?: string | null;
  titre: string;
  auteur: string;
  pourcentage: number;
  duree: string;
  statut: string;
  dateCreation: string;
  dateSignature?: string | null;
  notes?: string | null;
}

const STATUTS: Record<string, string> = {
  brouillon: "Brouillon",
  signe: "Signé",
  expire: "Expiré",
};

export function generateContratPdf(d: ContratPdfData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 56;

  // Watermark
  doc.setTextColor(220, 220, 220);
  doc.setFontSize(46);
  doc.setFont("helvetica", "bold");
  const wm = `Document officiel - ${d.maison}`;
  // Diagonal watermark
  doc.text(wm, W / 2, H / 2, { align: "center", angle: 30 });

  // Header band
  doc.setFillColor(10, 22, 40);
  doc.rect(0, 0, W, 90, "F");
  doc.setTextColor(0, 200, 150);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("FIGDITIONS", M, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(212, 175, 55);
  doc.text("Plateforme d'édition au Mali", M, 64);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text(d.maison.toUpperCase(), W - M, 46, { align: "right" });
  if (d.ville) doc.text(d.ville, W - M, 60, { align: "right" });
  if (d.email) doc.text(d.email, W - M, 74, { align: "right" });

  // Title
  let y = 130;
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("CONTRAT D'ÉDITION", W / 2, y, { align: "center" });
  y += 10;
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(1);
  doc.line(W / 2 - 60, y, W / 2 + 60, y);
  y += 30;

  // Parties
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("ENTRE LES SOUSSIGNÉS :", M, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const p1 = doc.splitTextToSize(
    `La maison d'édition ${d.maison}${d.adresse ? `, sise ${d.adresse}` : ""}${d.ville ? `, ${d.ville}` : ""}${d.telephone ? `, tél. ${d.telephone}` : ""}, ci-après dénommée "L'Éditeur",`,
    W - 2 * M,
  );
  doc.text(p1, M, y);
  y += p1.length * 14 + 8;
  doc.text("ET", M, y);
  y += 18;
  const p2 = doc.splitTextToSize(
    `${d.auteur}, ci-après dénommé "L'Auteur",`,
    W - 2 * M,
  );
  doc.text(p2, M, y);
  y += p2.length * 14 + 18;

  // Article 1
  const article = (n: number, title: string, body: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Article ${n} — ${title}`, M, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(body, W - 2 * M);
    doc.text(lines, M, y);
    y += lines.length * 14 + 12;
  };

  article(1, "Objet du contrat",
    `L'Auteur cède à l'Éditeur, qui accepte, le droit exclusif d'éditer, de publier et de commercialiser l'œuvre intitulée « ${d.titre} ».`);

  article(2, "Durée",
    `Le présent contrat est conclu pour une durée de ${d.duree} à compter de sa signature, renouvelable par tacite reconduction sauf dénonciation écrite par l'une des parties.`);

  article(3, "Droits d'auteur",
    `L'Éditeur s'engage à verser à l'Auteur des droits d'auteur s'élevant à ${d.pourcentage}% du prix de vente public hors taxes de chaque exemplaire vendu, payés selon les relevés trimestriels.`);

  article(4, "Obligations de l'Éditeur",
    `L'Éditeur prend en charge l'ensemble des frais de fabrication, de promotion et de distribution de l'ouvrage, et garantit à l'Auteur une diffusion conforme aux usages de la profession.`);

  if (d.notes) {
    article(5, "Clauses particulières", d.notes);
  }

  // Status line
  if (y > H - 200) { doc.addPage(); y = 80; }
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 130, 100);
  doc.text(`Statut : ${STATUTS[d.statut] ?? d.statut}`, M, y);
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "normal");
  doc.text(`Créé le ${d.dateCreation}`, W - M, y, { align: "right" });
  y += 40;

  // Signatures
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("FAIT À " + (d.ville?.toUpperCase() ?? "BAMAKO") + ", le " + (d.dateSignature ?? "____________________"), M, y);
  y += 50;

  const colW = (W - 2 * M - 40) / 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  // Left
  doc.line(M, y, M + colW, y);
  doc.text("L'Éditeur", M, y + 16);
  doc.setFont("helvetica", "bold");
  doc.text(d.maison, M, y + 32);
  // Right
  doc.setFont("helvetica", "normal");
  doc.line(M + colW + 40, y, M + 2 * colW + 40, y);
  doc.text("L'Auteur", M + colW + 40, y + 16);
  doc.setFont("helvetica", "bold");
  doc.text(d.auteur, M + colW + 40, y + 32);

  // Footer
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Document officiel - ${d.maison} · Généré via FIGDITIONS`, W / 2, H - 24, { align: "center" });

  doc.save(`contrat-${d.titre.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`);
}
