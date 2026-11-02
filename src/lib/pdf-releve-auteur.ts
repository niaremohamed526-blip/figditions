import jsPDF from "jspdf";
import { pdfDate, pdfDateLongue, pdfFcfa } from "@/lib/pdf-format";
import {
  chargerMarquePdf, dessinerEntete, dessinerParties, dessinerParagraphe, dessinerSection,
  dessinerTableau, finaliserPdf, PDF,
} from "@/lib/pdf-theme";

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

/** Relevé annuel des droits d'auteur : ventes, droits, ce qui est payé et ce qui reste. */
export async function generateReleveAuteurPdf(input: ReleveInput): Promise<jsPDF> {
  const marque = await chargerMarquePdf();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = PDF.marge;
  let y = dessinerEntete(doc, marque, {
    titre: "RELEVÉ DE DROITS D'AUTEUR",
    date: `Année ${input.annee} · édité le ${pdfDateLongue(new Date())}`,
  });

  y = dessinerParties(doc, y,
    { etiquette: "Éditeur", nom: input.entrepriseNom },
    { etiquette: "Auteur", nom: input.auteurNom },
  );

  // Trois chiffres clés : droits de l'année, déjà payé, reste à payer.
  const total = input.lignes.reduce((a, l) => a + l.droits, 0);
  const paye = input.lignes.filter((l) => l.paye).reduce((a, l) => a + l.droits, 0);
  const cartes: [string, number, boolean][] = [
    ["Droits de l'année", total, false],
    ["Déjà payés", paye, false],
    ["Reste à payer", total - paye, true],
  ];
  const gap = 12;
  const cw = (W - 2 * M - gap * 2) / 3;
  cartes.forEach(([l, v, accent], i) => {
    const x = M + i * (cw + gap);
    doc.setFillColor(accent ? PDF.goldSoft : "#FFFFFF");
    doc.setDrawColor(accent ? PDF.gold : PDF.border);
    doc.setLineWidth(0.8);
    doc.roundedRect(x, y, cw, 52, 6, 6, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(accent ? PDF.goldDark : PDF.muted);
    doc.text(l.toUpperCase(), x + 12, y + 18);
    doc.setFontSize(13);
    doc.setTextColor(PDF.ink);
    doc.text(pdfFcfa(v), x + 12, y + 38);
  });
  y += 52 + 26;

  const exemplaires = input.lignes.reduce((a, l) => a + l.quantite, 0);
  y = dessinerSection(doc, y, `Détail des ventes (${exemplaires} exemplaire${exemplaires > 1 ? "s" : ""})`);
  if (input.lignes.length === 0) {
    y = dessinerParagraphe(doc, y + 8, "Aucune vente sur cette année.", { couleur: PDF.muted });
  } else {
    y = dessinerTableau(doc, marque, `Relevé ${input.auteurNom} · ${input.annee}`, y,
      [
        { titre: "Livre", largeur: 0.38 },
        { titre: "Date", largeur: 0.16 },
        { titre: "Qté", largeur: 0.09, align: "right" },
        { titre: "Droits", largeur: 0.21, align: "right" },
        { titre: "Statut", largeur: 0.16 },
      ],
      input.lignes.map((l) => [
        l.titre, pdfDate(l.date), String(l.quantite), pdfFcfa(l.droits),
        { texte: l.paye ? "Payé" : "À payer", couleur: l.paye ? PDF.green : PDF.goldDark, gras: true },
      ]),
    );
  }

  finaliserPdf(doc, marque, `Relevé ${input.annee} · ${input.auteurNom}`);
  return doc;
}
