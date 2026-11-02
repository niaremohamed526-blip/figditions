import jsPDF from "jspdf";
import { pdfDate, pdfDateLongue, pdfFcfa } from "@/lib/pdf-format";
import {
  chargerMarquePdf, dessinerEntete, dessinerMontant, dessinerParties, dessinerSection,
  dessinerSignatures, dessinerTableau, finaliserPdf, PDF,
} from "@/lib/pdf-theme";

export interface RecuLigne {
  titre: string;
  dateVente: string;
  quantite: number;
  montant: number;
}

export interface RecuLibrairieInput {
  entrepriseNom: string;
  entrepriseVille?: string | null;
  numero: string;
  date: Date;
  librairieNom: string;
  montant: number;
  resteDu: number;
  lignes: RecuLigne[];
}

/** Numéro lisible et stable pour un même paiement : REC-AAAAMMJJ-XXXX. */
export function numeroRecu(date: Date, seed: string): string {
  const d = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `REC-${d}-${seed.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase()}`;
}

/** Reçu remis à une librairie quand elle règle des ventes (A4 portrait). */
export async function generateRecuLibrairiePdf(input: RecuLibrairieInput): Promise<jsPDF> {
  const marque = await chargerMarquePdf();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const lieu = input.entrepriseVille ? `${input.entrepriseVille}, le ` : "Le ";
  let y = dessinerEntete(doc, marque, {
    titre: "REÇU DE PAIEMENT",
    numero: input.numero,
    date: `${lieu}${pdfDateLongue(input.date)}`,
  });

  y = dessinerParties(doc, y,
    { etiquette: "Reçu par", nom: input.entrepriseNom, lignes: [input.entrepriseVille] },
    { etiquette: "Payé par", nom: input.librairieNom },
  );

  y = dessinerMontant(doc, y, "Montant reçu", pdfFcfa(input.montant),
    input.resteDu > 0 ? `Reste à régler après ce paiement : ${pdfFcfa(input.resteDu)}` : "Tout est réglé : plus rien à payer.");

  if (input.lignes.length > 0) {
    y = dessinerSection(doc, y, "Ventes réglées");
    y = dessinerTableau(doc, marque, "Reçu de paiement", y,
      [
        { titre: "Livre", largeur: 0.46 },
        { titre: "Date de vente", largeur: 0.2 },
        { titre: "Qté", largeur: 0.1, align: "right" },
        { titre: "Montant réglé", largeur: 0.24, align: "right" },
      ],
      input.lignes.map((l) => [l.titre, pdfDate(l.dateVente), String(l.quantite), { texte: pdfFcfa(l.montant), gras: true }]),
      230,
    );
  }

  dessinerSignatures(doc, marque, "Reçu de paiement", y,
    { titre: `Pour ${input.entrepriseNom}`, note: "Cachet et signature" },
    { titre: `Pour ${input.librairieNom}`, note: "Signature" },
  );
  finaliserPdf(doc, marque, `Reçu ${input.numero}`);
  void PDF;
  return doc;
}
