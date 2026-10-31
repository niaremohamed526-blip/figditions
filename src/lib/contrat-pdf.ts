// One place that turns a contract row into its PDF, so the list, the detail
// page, the form preview and the template editor all print the same thing.
import {
  ARTICLES_HISTORIQUES, renderArticles, variablesContrat,
  type ContratDonnees, type ContratModele, type TexteFige,
} from "@/lib/contrat-template";
import { generateContratProPdf, type ContratPdfTexte, type ContratProPdfData, type Livre } from "@/lib/pdf-contrat-pro";

type ModeleTexte = Pick<ContratModele, "nom" | "titre_document" | "sous_titre" | "articles" | "couleur" | "style" | "filigrane">;

/** Text of a contract: frozen at signature > its template > the historical text. */
export function texteContrat(
  vars: Record<string, string>,
  texteFige: TexteFige | null | undefined,
  modele: ModeleTexte | null | undefined,
): ContratPdfTexte & { modele_nom: string | null } {
  if (texteFige && Array.isArray(texteFige.articles) && texteFige.articles.length > 0) {
    return {
      titre_document: texteFige.titre_document,
      sous_titre: texteFige.sous_titre,
      couleur: texteFige.couleur,
      style: texteFige.style ?? "classique",
      filigrane: texteFige.filigrane,
      articles: texteFige.articles,
      modele_nom: texteFige.modele_nom,
    };
  }
  if (modele) {
    return {
      titre_document: modele.titre_document,
      sous_titre: modele.sous_titre,
      couleur: modele.couleur,
      style: modele.style ?? "classique",
      filigrane: modele.filigrane,
      articles: renderArticles(modele.articles ?? [], vars),
      modele_nom: modele.nom,
    };
  }
  return {
    titre_document: "Contrat d'édition",
    sous_titre: "Conditions générales",
    couleur: "or",
    style: "classique",
    filigrane: true,
    articles: renderArticles(ARTICLES_HISTORIQUES, vars),
    modele_nom: null,
  };
}

// Logo and stamp images stay live; every printed name, address and term is
// kept as it was at signature.
const CHAMPS_VIVANTS = new Set<keyof ContratProPdfData>(["logo_url", "cachet_url"]);

/** Snapshot stored on the contract when it is signed. */
export function figerTexte(t: ReturnType<typeof texteContrat>, data: ContratProPdfData): TexteFige {
  const donnees: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (!CHAMPS_VIVANTS.has(k as keyof ContratProPdfData)) donnees[k] = v;
  }
  return {
    titre_document: t.titre_document,
    sous_titre: t.sous_titre ?? null,
    couleur: t.couleur,
    style: t.style ?? "classique",
    filigrane: t.filigrane,
    modele_nom: t.modele_nom,
    articles: t.articles,
    donnees,
    fige_le: new Date().toISOString(),
  };
}

/** Freeze a contract's text from its template and current data. */
export function figerContrat(data: ContratProPdfData, modele: ModeleTexte | null | undefined): TexteFige {
  return figerTexte(texteContrat(varsFromPdfData(data), null, modele), data);
}

export function referenceContrat(id: string | null | undefined): string | null {
  return id ? `CTR-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}` : null;
}

/** Contract row (+ house + author) → PDF data. Same defaults as the form. */
export function pdfDataFromContrat(c: any, entreprise: any, auteur: { nom_complet?: string | null; telephone?: string | null } | null, livresFallback: Livre[]): ContratProPdfData {
  const livres: Livre[] = Array.isArray(c.livres) && c.livres.length > 0 ? c.livres : livresFallback;
  return {
    maison: entreprise?.nom ?? "Maison d'édition",
    ville_maison: entreprise?.ville,
    adresse_editeur: entreprise?.adresse,
    telephone_editeur: entreprise?.telephone,
    email_editeur: entreprise?.email ?? entreprise?.email_contact,
    website_editeur: entreprise?.website,
    nif: c.nif_editeur ?? entreprise?.nif,
    rccm: c.rccm_editeur ?? entreprise?.rccm,
    nina: c.nina_editeur ?? entreprise?.nina,
    banque: c.banque ?? entreprise?.banque,
    compte_bancaire: c.compte_bancaire ?? entreprise?.compte_bancaire,
    nom_representant: c.nom_representant_editeur ?? entreprise?.nom_representant,
    qualite_representant: c.qualite_representant ?? entreprise?.qualite_representant,
    logo_url: entreprise?.logo_url,
    cachet_url: c.cachet_url ?? entreprise?.cachet_url,
    auteur: auteur?.nom_complet ?? "L'AUTEUR",
    adresse_auteur: c.adresse_auteur,
    telephone_auteur: c.telephone_auteur ?? auteur?.telephone,
    profession_auteur: c.profession_auteur,
    collection: c.collection,
    livres,
    duree_annees: c.duree_annees ?? 10,
    pourcentage: Number(c.pourcentage_droits ?? 10),
    tirage_minimum: c.tirage_minimum ?? 100,
    contribution_auteur: c.contribution_auteur,
    format: c.format,
    type_couverture: c.type_couverture,
    reliure: c.reliure,
    exemplaires_auteur: c.exemplaires_auteur ?? 10,
    frequence_paiement: c.frequence_paiement ?? "annuel",
    territoire_mali: c.territoire_mali ?? 20,
    territoire_ci: c.territoire_ci ?? 30,
    territoire_senegal: c.territoire_senegal ?? 30,
    territoire_france: c.territoire_france ?? 40,
    lieu_signature: c.lieu_signature ?? entreprise?.ville ?? "Bamako",
    date_signature: c.date_signature ?? new Date().toISOString().slice(0, 10),
  };
}

export function varsFromPdfData(d: ContratProPdfData): Record<string, string> {
  return variablesContrat(d as ContratDonnees);
}

export async function genererPdfContrat(args: {
  data: ContratProPdfData;
  contratId?: string | null;
  texteFige?: TexteFige | null;
  modele?: ModeleTexte | null;
  notes?: string | null;
  output?: "save" | "blob";
  apercu?: boolean;
}) {
  // A signed contract prints the data it was signed with.
  const data: ContratProPdfData = args.texteFige?.donnees
    ? { ...args.data, ...(args.texteFige.donnees as Partial<ContratProPdfData>) }
    : args.data;
  const texte = texteContrat(varsFromPdfData(data), args.texteFige, args.modele);
  return generateContratProPdf(data, {
    texte,
    reference: referenceContrat(args.contratId),
    notes: args.notes,
    output: args.output,
    apercu: args.apercu,
  });
}
