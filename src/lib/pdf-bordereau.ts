import jsPDF from "jspdf";
import { pdfDate, pdfFcfa } from "@/lib/pdf-format";
import {
  chargerMarquePdf, dessinerEntete, dessinerParagraphe, dessinerParties, dessinerSection,
  dessinerSignatures, dessinerTableau, dessinerTotaux, finaliserPdf, PDF,
} from "@/lib/pdf-theme";

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

/** Bordereau de dépôt (ou de vente) remis à une librairie, au design commun des PDF FIGDITIONS. */
export async function generateBordereauPdf(
  d: BordereauPdfData,
  action: "download" | "open" = "download",
) {
  const marque = await chargerMarquePdf();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const isDepot = d.type === "depot";
  const numero = d.numero.toUpperCase();
  const titreSuite = `${isDepot ? "Bordereau" : "Facture"} ${numero}`;
  const periode = d.periodeDebut && d.periodeFin ? ` · période du ${pdfDate(d.periodeDebut)} au ${pdfDate(d.periodeFin)}` : "";
  let y = dessinerEntete(doc, marque, {
    titre: isDepot ? "BORDEREAU DE DÉPÔT" : "FACTURE",
    numero,
    date: `Émis le ${pdfDate(d.dateEmission)}${periode}`,
  });

  y = dessinerParties(doc, y,
    { etiquette: "Éditeur", nom: d.maison, lignes: [d.maisonAdresse, d.maisonVille, d.maisonTelephone, d.maisonEmail] },
    { etiquette: "Librairie", nom: d.librairieNom, lignes: [d.librairieAdresse] },
  );

  if (isDepot) {
    y = dessinerTableau(doc, marque, titreSuite, y,
      [
        { titre: "Titre", largeur: 0.52 },
        { titre: "Déposés", largeur: 0.16, align: "right" },
        { titre: "Vendus", largeur: 0.16, align: "right" },
        { titre: "Restants", largeur: 0.16, align: "right" },
      ],
      d.lignes.map((l) => [
        { texte: l.titre, sous: (l.ceDepot ?? 0) > 0 ? `avant : ${l.avant ?? 0}  +  ce dépôt : ${l.ceDepot}  =  ${(l.avant ?? 0) + (l.ceDepot ?? 0)}` : null },
        String(l.deposes ?? l.quantite),
        String(l.vendus ?? 0),
        { texte: String(l.restants ?? 0), gras: true },
      ]),
      200,
    );
    y = dessinerTotaux(doc, y, [{ libelle: "Total exemplaires", valeur: String(d.totalExemplaires), fort: true }]);
  } else {
    y = dessinerTableau(doc, marque, titreSuite, y,
      [
        { titre: "Titre", largeur: 0.46 },
        { titre: "Qté", largeur: 0.1, align: "right" },
        { titre: "Prix unitaire", largeur: 0.2, align: "right" },
        { titre: "Total", largeur: 0.24, align: "right" },
      ],
      d.lignes.map((l) => [l.titre, String(l.quantite), pdfFcfa(l.prix_unitaire), { texte: pdfFcfa(l.total), gras: true }]),
      200,
    );
    const commission = Math.round(d.commissionLibrairieFcfa ?? d.totalFcfa * 0.2);
    y = dessinerTotaux(doc, y, [
      { libelle: `Exemplaires vendus : ${d.totalExemplaires}`, valeur: "" },
      { libelle: "Chiffre d'affaires", valeur: pdfFcfa(d.totalFcfa) },
      { libelle: "Commission librairie", valeur: `- ${pdfFcfa(commission)}`, couleur: PDF.goldDark },
      { libelle: "Net à reverser à l'éditeur", valeur: pdfFcfa(d.totalFcfa - commission), fort: true },
    ]);
  }

  if (isDepot && d.historiqueLots && d.historiqueLots.length > 0) {
    y = dessinerSection(doc, y, "Historique des dépôts");
    y = dessinerTableau(doc, marque, titreSuite, y,
      [
        { titre: "Date", largeur: 0.18 },
        { titre: "Titre", largeur: 0.5 },
        { titre: "Provenance", largeur: 0.18 },
        { titre: "Qté", largeur: 0.14, align: "right" },
      ],
      d.historiqueLots.map((lot) => [
        pdfDate(lot.date),
        lot.titre,
        lot.provenance === "hors_stock" ? "Hors stock interne" : "Stock interne",
        { texte: `+ ${lot.quantite}`, couleur: PDF.goldDark, gras: true },
      ]),
      200,
    );
  }

  if (d.notes) y = dessinerParagraphe(doc, y, `Note : ${d.notes}`, { taille: 9, couleur: PDF.muted, italique: true });

  dessinerSignatures(doc, marque, titreSuite, y,
    { titre: "Pour l'éditeur", note: "Cachet et signature", nom: d.maison },
    { titre: "Pour la librairie", note: "Cachet et signature", nom: d.librairieNom },
  );
  finaliserPdf(doc, marque, titreSuite);

  const filename = `${isDepot ? "bordereau-depot" : "facture"}-${d.numero}.pdf`;
  if (action === "open") {
    window.open(doc.output("bloburl"), "_blank");
  } else {
    doc.save(filename);
  }
}
