import jsPDF from "jspdf";
import { pdfFcfa } from "@/lib/pdf-format";
import {
  chargerMarquePdf, dessinerEntete, dessinerParagraphe, dessinerParties, dessinerSignatures,
  dessinerTableau, dessinerTotaux, finaliserPdf, PDF,
} from "@/lib/pdf-theme";

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
  /** Ancien réglage par appareil : le filigrane vient désormais des Paramètres de la maison. */
  watermarkLogoUrl?: string | null;
}

/** Facture A4 d'une vente directe, au design commun des PDF FIGDITIONS. */
export async function generateFactureVentePdf(
  d: FactureVenteData,
  action: "download" | "open" = "download",
) {
  const marque = await chargerMarquePdf();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const numero = d.numero.toUpperCase();
  let y = dessinerEntete(doc, marque, { titre: "FACTURE", numero, date: `Émise le ${d.dateEmission}` });

  y = dessinerParties(doc, y,
    { etiquette: "Éditeur", nom: d.maison, lignes: [d.maisonAdresse, d.maisonVille, d.maisonTelephone, d.maisonEmail] },
    { etiquette: "Client", nom: d.clientNom?.trim() || "Client comptant" },
  );

  y = dessinerTableau(doc, marque, `Facture ${numero}`, y,
    [
      { titre: "Livre", largeur: 0.46 },
      { titre: "Qté", largeur: 0.1, align: "right" },
      { titre: "Prix unitaire", largeur: 0.2, align: "right" },
      { titre: "Total", largeur: 0.24, align: "right" },
    ],
    d.lignes.map((l) => [
      { texte: l.titre, sous: l.auteur || null },
      String(l.quantite),
      pdfFcfa(l.prix_unitaire),
      { texte: pdfFcfa(l.total), gras: true },
    ]),
    230,
  );

  const totaux: { libelle: string; valeur: string; fort?: boolean; couleur?: string }[] = [];
  if (d.remiseFcfa > 0) {
    totaux.push({ libelle: "Total avant remise", valeur: pdfFcfa(d.sousTotal) });
    totaux.push({ libelle: `Remise (${Math.round(d.remisePct)} %)`, valeur: `- ${pdfFcfa(d.remiseFcfa)}`, couleur: PDF.goldDark });
  }
  totaux.push({ libelle: "Total à payer", valeur: pdfFcfa(d.total), fort: true });
  y = dessinerTotaux(doc, y, totaux);

  if (d.notes) y = dessinerParagraphe(doc, y, `Note : ${d.notes}`, { taille: 9, couleur: PDF.muted, italique: true });
  y = dessinerParagraphe(doc, y, "Merci pour votre achat.", { taille: 9.5, couleur: PDF.goldDark, italique: true });

  dessinerSignatures(doc, marque, `Facture ${numero}`, y,
    { titre: "Pour l'éditeur", note: "Cachet et signature", nom: d.maison },
    { titre: "Le client", note: "Signature", nom: d.clientNom?.trim() || "Client comptant" },
  );
  finaliserPdf(doc, marque, `Facture ${numero}`);

  if (action === "open") {
    window.open(doc.output("bloburl"), "_blank");
  } else {
    doc.save(`facture-${d.numero}.pdf`);
  }
}
