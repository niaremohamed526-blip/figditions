import jsPDF from "jspdf";
import { pdfDate, pdfDateLongue, pdfFcfa } from "@/lib/pdf-format";
import { methodeLabel } from "./finance-types";
import {
  chargerMarquePdf, dessinerEntete, dessinerMontant, dessinerParagraphe, dessinerParties,
  dessinerSection, dessinerSignatures, dessinerTableau, finaliserPdf, PDF,
} from "@/lib/pdf-theme";

export interface QuittanceLigne {
  titre: string;
  date: string;
  quantite: number;
  droits: number;
}

export interface QuittanceInput {
  entrepriseNom: string;
  entrepriseVille?: string | null;
  numero: string;
  datePaiement: Date;
  auteurNom: string;
  montant: number;
  methode: string;
  reference?: string | null;
  notes?: string | null;
  payeParNom?: string | null;
  lignes: QuittanceLigne[];
}

/**
 * Génère une quittance de paiement de droits d'auteur (A4 portrait),
 * prête à être téléchargée, imprimée et signée par les deux parties.
 */
export async function generateQuittancePdf(input: QuittanceInput): Promise<jsPDF> {
  const marque = await chargerMarquePdf();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const lieu = input.entrepriseVille ? `${input.entrepriseVille}, le ` : "Le ";
  let y = dessinerEntete(doc, marque, {
    titre: "QUITTANCE DE DROITS D'AUTEUR",
    numero: input.numero,
    date: `${lieu}${pdfDateLongue(input.datePaiement)}`,
  });

  y = dessinerParties(doc, y,
    { etiquette: "Éditeur", nom: input.entrepriseNom, lignes: [input.payeParNom ? `Payé par ${input.payeParNom}` : null] },
    { etiquette: "Bénéficiaire", nom: input.auteurNom },
  );

  const moyen = [methodeLabel(input.methode), input.reference ? `réf. ${input.reference}` : null].filter(Boolean).join(" · ");
  y = dessinerMontant(doc, y, "Montant total payé", pdfFcfa(input.montant), `Payé par ${moyen}`);

  if (input.lignes.length > 0) {
    y = dessinerSection(doc, y, "Détail des droits réglés");
    y = dessinerTableau(doc, marque, `Quittance ${input.numero}`, y,
      [
        { titre: "Livre", largeur: 0.46 },
        { titre: "Date de vente", largeur: 0.2 },
        { titre: "Qté", largeur: 0.1, align: "right" },
        { titre: "Droits", largeur: 0.24, align: "right" },
      ],
      input.lignes.map((l) => [l.titre, pdfDate(l.date), String(l.quantite), { texte: pdfFcfa(l.droits), gras: true }]),
      260,
    );
  }

  if (input.notes) y = dessinerParagraphe(doc, y, `Note : ${input.notes}`, { taille: 9, couleur: PDF.muted, italique: true });

  y = dessinerParagraphe(doc, y,
    `Je soussigné(e) ${input.auteurNom}, reconnais avoir reçu de ${input.entrepriseNom} la somme de ${pdfFcfa(input.montant)} au titre des droits d'auteur détaillés ci-dessus. Cette quittance vaut reçu définitif, sous réserve de l'encaissement effectif.`,
  );

  dessinerSignatures(doc, marque, `Quittance ${input.numero}`, y,
    { titre: "Pour l'éditeur", note: "Cachet et signature", nom: input.entrepriseNom },
    { titre: "L'auteur (bénéficiaire)", note: "« Lu et approuvé » et signature", nom: input.auteurNom },
  );
  finaliserPdf(doc, marque, `Quittance ${input.numero}`);
  return doc;
}

export function quittanceFilename(numero: string, auteurNom: string): string {
  const clean = auteurNom.replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 30);
  return `${numero}_${clean}.pdf`;
}
