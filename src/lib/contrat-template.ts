// Contract templates: fields, rendering and the built-in texts.
// Shared by the browser (editor, PDF) and the server (Medmo import).

export interface ArticleModele { titre: string; texte: string }

/** A preset name, or the house's own colour as "#rrggbb". */
export type CouleurContrat = "or" | "marine" | "bordeaux" | "emeraude" | "noir" | `#${string}`;
export type StyleContrat = "classique" | "moderne" | "epure";
export type TypeContrat = "edition" | "traduction" | "illustration" | "coedition" | "cession" | "autre";

export interface ContratModele {
  id: string;
  entreprise_id: string;
  nom: string;
  type_contrat: TypeContrat;
  titre_document: string;
  sous_titre: string | null;
  articles: ArticleModele[];
  couleur: CouleurContrat;
  style: StyleContrat;
  filigrane: boolean;
  par_defaut: boolean;
  source: "manuel" | "exemple" | "import";
  updated_at?: string;
}

/** Text as it was when the contract was signed. */
export interface TexteFige {
  titre_document: string;
  sous_titre: string | null;
  couleur: CouleurContrat;
  style?: StyleContrat;
  filigrane: boolean;
  modele_nom: string | null;
  articles: ArticleModele[];
  /** Contract data printed at signature (names, terms…), so the PDF never drifts. */
  donnees?: Record<string, unknown>;
  fige_le: string;
}

export const TYPES_CONTRAT: { value: TypeContrat; label: string; titre: string }[] = [
  { value: "edition", label: "Contrat d'édition", titre: "Contrat d'édition" },
  { value: "traduction", label: "Contrat de traduction", titre: "Contrat de traduction" },
  { value: "illustration", label: "Contrat d'illustration", titre: "Contrat d'illustration" },
  { value: "coedition", label: "Contrat de coédition", titre: "Contrat de coédition" },
  { value: "cession", label: "Cession de droits", titre: "Contrat de cession de droits" },
  { value: "autre", label: "Autre", titre: "Contrat" },
];

export const COULEURS_CONTRAT: { value: CouleurContrat; label: string; rgb: [number, number, number] }[] = [
  { value: "or", label: "Or", rgb: [168, 128, 52] },
  { value: "marine", label: "Bleu marine", rgb: [28, 52, 94] },
  { value: "bordeaux", label: "Bordeaux", rgb: [122, 30, 48] },
  { value: "emeraude", label: "Émeraude", rgb: [22, 101, 82] },
  { value: "noir", label: "Noir", rgb: [38, 38, 38] },
];

export const STYLES_CONTRAT: { value: StyleContrat; label: string; description: string }[] = [
  { value: "classique", label: "Classique", description: "Serif élégant, filets dorés, cartes teintées" },
  { value: "moderne", label: "Moderne", description: "Bandeau de couleur, titres sans empattement" },
  { value: "epure", label: "Épuré", description: "Sobre, filets fins, sans aplats de couleur" },
];

export function estCouleurPerso(c: string | null | undefined): c is `#${string}` {
  return !!c && /^#[0-9a-f]{6}$/i.test(c);
}

export function couleurRgb(c: string | null | undefined): [number, number, number] {
  if (estCouleurPerso(c)) {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  return COULEURS_CONTRAT.find((x) => x.value === c)?.rgb ?? COULEURS_CONTRAT[0].rgb;
}

/** Fields a template can use, as {cle}. Order = order in the editor menu. */
export const CHAMPS: { cle: string; label: string; groupe: string }[] = [
  { cle: "auteur", label: "Nom de l'auteur", groupe: "Auteur" },
  { cle: "auteur_maj", label: "NOM DE L'AUTEUR (majuscules)", groupe: "Auteur" },
  { cle: "adresse_auteur", label: "Adresse de l'auteur", groupe: "Auteur" },
  { cle: "telephone_auteur", label: "Téléphone de l'auteur", groupe: "Auteur" },
  { cle: "profession_auteur", label: "Profession de l'auteur", groupe: "Auteur" },
  { cle: "maison", label: "Nom de la maison d'édition", groupe: "Éditeur" },
  { cle: "representant", label: "Représentant de la maison", groupe: "Éditeur" },
  { cle: "qualite_representant", label: "Qualité du représentant", groupe: "Éditeur" },
  { cle: "ville_maison", label: "Ville de la maison", groupe: "Éditeur" },
  { cle: "livres", label: "Titre(s) des livres", groupe: "Ouvrages" },
  { cle: "collection", label: "Collection", groupe: "Ouvrages" },
  { cle: "format", label: "Format", groupe: "Ouvrages" },
  { cle: "type_couverture", label: "Couverture", groupe: "Ouvrages" },
  { cle: "reliure", label: "Reliure", groupe: "Ouvrages" },
  { cle: "duree_annees", label: "Durée (années)", groupe: "Conditions" },
  { cle: "pourcentage", label: "% droits d'auteur", groupe: "Conditions" },
  { cle: "tirage_minimum", label: "Tirage minimum", groupe: "Conditions" },
  { cle: "exemplaires_auteur", label: "Exemplaires d'auteur", groupe: "Conditions" },
  { cle: "frequence_paiement", label: "Fréquence de paiement", groupe: "Conditions" },
  { cle: "contribution_auteur", label: "Contribution de l'auteur", groupe: "Conditions" },
  { cle: "commissions_territoires", label: "Commissions libraires (tous pays)", groupe: "Conditions" },
  { cle: "territoire_mali", label: "Commission Mali (%)", groupe: "Conditions" },
  { cle: "territoire_ci", label: "Commission Côte d'Ivoire (%)", groupe: "Conditions" },
  { cle: "territoire_senegal", label: "Commission Sénégal (%)", groupe: "Conditions" },
  { cle: "territoire_france", label: "Commission France (%)", groupe: "Conditions" },
  { cle: "lieu_signature", label: "Lieu de signature", groupe: "Signature" },
  { cle: "date_signature", label: "Date de signature", groupe: "Signature" },
];

const CLES = new Set(CHAMPS.map((c) => c.cle));

export interface ContratDonnees {
  maison: string;
  ville_maison?: string | null;
  nom_representant?: string | null;
  qualite_representant?: string | null;
  auteur: string;
  adresse_auteur?: string | null;
  telephone_auteur?: string | null;
  profession_auteur?: string | null;
  collection?: string | null;
  livres: { titre: string }[];
  duree_annees: number;
  pourcentage: number;
  tirage_minimum: number;
  contribution_auteur?: string | null;
  format?: string | null;
  type_couverture?: string | null;
  reliure?: string | null;
  exemplaires_auteur: number;
  frequence_paiement: string;
  territoire_mali: number;
  territoire_ci: number;
  territoire_senegal: number;
  territoire_france: number;
  lieu_signature: string;
  date_signature: string;
}

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function dateFr(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getDate() === 1 ? "1er" : d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

export function joinLivres(livres: { titre: string }[]): string {
  const t = livres.map((l) => l.titre?.trim()).filter(Boolean).map((x) => `« ${x} »`);
  if (t.length === 0) return "« … »";
  if (t.length === 1) return t[0];
  return `${t.slice(0, -1).join(", ")} et ${t[t.length - 1]}`;
}

export function frequenceLabel(f: string): string {
  if (f === "trimestriel") return "chaque trimestre";
  if (f === "semestriel") return "deux fois par an";
  return "une fois par an, au mois de décembre";
}

export function variablesContrat(d: ContratDonnees): Record<string, string> {
  return {
    auteur: d.auteur,
    auteur_maj: d.auteur.toUpperCase(),
    adresse_auteur: d.adresse_auteur ?? "",
    telephone_auteur: d.telephone_auteur ?? "",
    profession_auteur: d.profession_auteur ?? "",
    maison: d.maison,
    representant: d.nom_representant ?? "",
    qualite_representant: d.qualite_representant ?? "",
    ville_maison: d.ville_maison ?? "",
    livres: joinLivres(d.livres),
    collection: d.collection ?? "",
    format: d.format || "24/26, 170gr",
    type_couverture: d.type_couverture || "quadrichromie cartonnée",
    reliure: d.reliure || "dos carré collé",
    duree_annees: String(d.duree_annees),
    pourcentage: String(d.pourcentage),
    tirage_minimum: String(d.tirage_minimum),
    exemplaires_auteur: String(d.exemplaires_auteur),
    frequence_paiement: frequenceLabel(d.frequence_paiement),
    contribution_auteur: d.contribution_auteur ?? "",
    commissions_territoires: `${d.territoire_mali} % au Mali, ${d.territoire_ci} % en Côte d'Ivoire, ${d.territoire_senegal} % au Sénégal et ${d.territoire_france} % en France`,
    territoire_mali: String(d.territoire_mali),
    territoire_ci: String(d.territoire_ci),
    territoire_senegal: String(d.territoire_senegal),
    territoire_france: String(d.territoire_france),
    lieu_signature: d.lieu_signature,
    date_signature: dateFr(d.date_signature),
  };
}

/**
 * Fills a template text.
 *  {cle}             → the field's value
 *  [[cle: phrase]]   → the phrase only when the field is filled
 */
export function renderTexte(texte: string, vars: Record<string, string>): string {
  const withBlocks = texte.replace(/\[\[\s*(\w+)\s*:([\s\S]*?)\]\]/g, (_, cle: string, inner: string) =>
    String(vars[cle] ?? "").trim() ? inner : "",
  );
  return withBlocks
    .replace(/\{(\w+)\}/g, (m, cle: string) => (cle in vars ? vars[cle] : m))
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Renders every article; an article whose text ends up empty is left out. */
export function renderArticles(articles: ArticleModele[], vars: Record<string, string>): ArticleModele[] {
  return articles
    .map((a) => ({ titre: renderTexte(a.titre ?? "", vars), texte: renderTexte(a.texte ?? "", vars) }))
    .filter((a) => a.texte.length > 0);
}

/** Unknown {fields} in a text, to warn the user in the editor. */
export function champsInconnus(texte: string): string[] {
  const out = new Set<string>();
  for (const m of texte.matchAll(/\{(\w+)\}/g)) if (!CLES.has(m[1])) out.add(m[1]);
  for (const m of texte.matchAll(/\[\[\s*(\w+)\s*:/g)) if (!CLES.has(m[1])) out.add(m[1]);
  return [...out];
}

/** Sample values for previews in the template editor. */
export const DONNEES_EXEMPLE: ContratDonnees = {
  maison: "Votre maison d'édition",
  ville_maison: "Bamako",
  nom_representant: "Aminata Traoré",
  qualite_representant: "Directrice générale",
  auteur: "Moussa Diarra",
  adresse_auteur: "Hamdallaye ACI 2000, Bamako",
  telephone_auteur: "+223 70 00 00 00",
  profession_auteur: "Enseignant",
  collection: "Contes et légendes",
  livres: [{ titre: "Le baobab qui parlait" }, { titre: "La boule grise" }],
  duree_annees: 10,
  pourcentage: 10,
  tirage_minimum: 500,
  contribution_auteur: "",
  format: "14,8 × 21 cm",
  type_couverture: "souple pelliculée mate",
  reliure: "dos carré collé",
  exemplaires_auteur: 10,
  frequence_paiement: "annuel",
  territoire_mali: 25,
  territoire_ci: 30,
  territoire_senegal: 30,
  territoire_france: 40,
  lieu_signature: "Bamako",
  date_signature: new Date().toISOString().slice(0, 10),
};

/**
 * Text used by contracts made before templates existed (no modele_id, not
 * frozen). Kept word for word so those contracts print exactly as before.
 */
export const ARTICLES_HISTORIQUES: ArticleModele[] = [
  { titre: "Objet du contrat", texte: "{auteur_maj}, l'Auteur, charge L'ÉDITEUR {maison}, qui accepte de relire, corriger, réorganiser, restructurer, mettre en page, concevoir la couverture et la quatrième de couverture, imprimer et publier[[collection:, dans sa collection {collection},]] les ouvrages intitulés : {livres}, conformément aux dispositions suivantes." },
  { titre: "Conservation des droits", texte: "L'Auteur reste propriétaire de ses œuvres. Cependant, {maison} bénéficie d'une licence exclusive d'exploitation pour une durée de {duree_annees} ans, renouvelable par accord des parties. {maison} conserve les droits d'édition, d'impression, de traduction, d'adaptation, de commercialisation et de promotion pendant cette période sur le territoire du Mali et à l'étranger. Les droits d'auteur sont payés à l'Auteur et fixés à {pourcentage}% du prix public hors taxes par exemplaire effectivement vendu, ou, dans le cas d'une commande institutionnelle ou d'un projet financé, à partir des {tirage_minimum} premiers exemplaires vendus." },
  { titre: "Sélection du texte", texte: "Les textes sélectionnés seront édités et publiés par ladite maison d'édition. {maison} prend à sa charge la responsabilité des devoirs afférents aux différentes contributions : frais de conception infographique, frais de relecture et correction, de traduction, d'édition, d'impression, de communication et de promotion des ouvrages précités.[[contribution_auteur: Cependant, l'Auteur fera une contribution financière pour {contribution_auteur}.]]" },
  { titre: "Correction du texte et validation", texte: "L'Auteur s'engage à participer au processus de relecture et correction des ouvrages précités et à l'intégration des suggestions de correction faites par {maison}. Les corrections typographiques, orthographiques et syntaxiques sont à la charge de {maison}, mais les corrections des termes techniques, des noms et prénoms utilisés par l'Auteur sont à la seule charge de ce dernier." },
  { titre: "Caractéristiques techniques", texte: "Format : {format} avec une couverture {type_couverture}. La reliure sera {reliure} et les illustrations seront en couleurs." },
  { titre: "Présentation de l'échantillon", texte: "Avant le tirage des ouvrages en quantité, 10 copies de chaque livre seront imprimées pour leur évaluation. {exemplaires_auteur} exemplaires de chaque ouvrage seront envoyés à l'Auteur {auteur_maj} comme échantillons des ouvrages (spécimens), soumis une seule fois à son appréciation pour avis, relecture et corrections." },
  { titre: "Tirage", texte: "Le tirage en quantité sera réalisé dès que les conditions financières le permettront, notamment dans le cadre d'un financement obtenu par {maison} ou sur ses fonds propres." },
  { titre: "Propriété du tirage", texte: "Le nombre d'exemplaires imprimés dépendra des moyens disponibles. L'Auteur sera informé par {maison}, par une lettre formelle, du nombre d'exemplaires imprimés en quantité. En cas d'impression en quantité, {exemplaires_auteur} exemplaires de chaque ouvrage fabriqué seront remis à l'Auteur comme exemplaires d'auteur. {maison} est libérée de ses engagements pour ces exemplaires remis au moment du calcul des droits d'auteur après les ventes." },
  { titre: "Publication", texte: "{maison} s'engage à publier les ouvrages et, à cet effet, 2 exemplaires de chaque ouvrage seront remis à la Bibliothèque nationale du Mali comme dépôt légal, 5 au Bureau malien du droit d'auteur (BUMDA), 2 à l'ORTM pour présentation au journal télévisé et 2 à la presse écrite. Les ouvrages seront inscrits dans le catalogue de {maison} et diffusés sur l'ensemble des plateformes numériques : site internet, réseaux sociaux, magazines, catalogue et tout autre support de communication." },
  { titre: "Droits d'auteur", texte: "Les {pourcentage}% des ventes, après déduction du pourcentage libraire, seront remis à l'Auteur comme droits d'auteur. Les droits d'auteur sont dus uniquement lorsque le premier tirage de chaque ouvrage est supérieur ou égal à {tirage_minimum} exemplaires. En cas de ventes, les droits d'auteur seront payés {frequence_paiement}. Une lettre sera officiellement envoyée à l'Auteur à l'arrêté des comptes pour l'informer de l'état des ventes de chaque ouvrage." },
  { titre: "Promotion et diffusion", texte: "Il est convenu entre l'Auteur et {maison} que la promotion et la diffusion des œuvres seront effectuées par les deux parties. Cependant, {maison} fera une large diffusion de l'œuvre au niveau des écoles du Mali, des foires, fêtes et festivals du livre, espaces culturels, plateaux de télévision ou radios." },
  { titre: "Dépôt légal", texte: "{maison} prend à sa charge les formalités obligatoires de dépôt légal des ouvrages auprès de la Bibliothèque Nationale du Mali et celles obligatoires du dépôt à la BUMDA (Bureau des droits d'auteur)." },
  { titre: "Prix de vente et droits d'auteur", texte: "Les prix publics des ouvrages seront fixés par {maison} en tenant compte des coûts de production, de diffusion et de commercialisation. Les remises commerciales consenties aux diffuseurs et libraires (pourcentage libraire) sont de {territoire_mali}% au Mali, {territoire_ci}% en Côte d'Ivoire, {territoire_senegal}% au Sénégal et {territoire_france}% en France." },
  { titre: "Contribution de l'auteur", texte: "Les ouvrages sont issus d'un atelier d'écriture et de production de textes organisé par {maison}. À ce titre, {maison} assure la coordination scientifique, l'accompagnement éditorial, les corrections, la conception graphique, la recherche de financements, la publication, la diffusion et la promotion des œuvres.[[contribution_auteur: Pour la production des ouvrages précités, l'Auteur ne supportera aucun frais, à l'exception de sa contribution aux frais d'{contribution_auteur}. Les frais de relecture-correction, de traduction, d'édition, de conception infographique, d'impression, de communication et de promotion seront à la charge de {maison}.]]" },
  { titre: "Durée du contrat", texte: "Le présent contrat est conclu pour une durée de {duree_annees} ans, renouvelable d'un commun accord." },
  { titre: "Résiliation du contrat", texte: "En cas de difficulté à commercialiser le livre, l'une ou l'autre des parties pourra résilier le présent contrat après avoir informé l'autre partie." },
  { titre: "Traduction et droits annexes", texte: "{maison} fera part à l'Auteur de toute proposition éventuelle de traduction desdits titres." },
  { titre: "Litiges", texte: "Tout différend sera résolu à l'amiable, au cas échéant, soumis par l'une ou l'autre partie au Tribunal de commerce du Mali." },
];

/** Generic starting model offered to every house: to adapt, then have checked by a lawyer. */
export const MODELE_EXEMPLE: Pick<ContratModele, "nom" | "type_contrat" | "titre_document" | "sous_titre" | "articles" | "couleur" | "style" | "filigrane"> = {
  nom: "Contrat d'édition (modèle exemple)",
  type_contrat: "edition",
  titre_document: "Contrat d'édition",
  sous_titre: "Conditions générales",
  couleur: "or",
  style: "classique",
  filigrane: true,
  articles: [
    { titre: "Objet du contrat", texte: "Par le présent contrat, {auteur_maj}, ci-après « l'Auteur », confie à {maison}, ci-après « l'Éditeur », qui l'accepte, le droit exclusif de reproduire, publier et exploiter[[collection:, dans sa collection {collection},]] l'œuvre ou les œuvres intitulées {livres}, dans les conditions définies ci-après." },
    { titre: "Garanties de l'Auteur", texte: "L'Auteur garantit être le seul titulaire des droits sur l'œuvre et que celle-ci ne contient aucun élément susceptible de porter atteinte aux droits de tiers. Il garantit l'Éditeur contre tout recours à ce titre." },
    { titre: "Étendue et durée", texte: "Les droits sont confiés à l'Éditeur pour une durée de {duree_annees} ans à compter de la signature du présent contrat, renouvelable d'un commun accord, pour une exploitation sous forme imprimée et numérique." },
    { titre: "Remise du manuscrit et corrections", texte: "L'Auteur remet à l'Éditeur un texte définitif et participe à la relecture des épreuves dans les délais convenus. Les corrections typographiques et orthographiques sont à la charge de l'Éditeur." },
    { titre: "Fabrication", texte: "L'Éditeur assure la fabrication de l'œuvre selon les caractéristiques suivantes : format {format}, couverture {type_couverture}, reliure {reliure}. Le premier tirage sera d'au moins {tirage_minimum} exemplaires." },
    { titre: "Exemplaires d'auteur", texte: "L'Éditeur remet gratuitement à l'Auteur {exemplaires_auteur} exemplaires de chaque ouvrage. L'Auteur pourra acquérir des exemplaires supplémentaires à un prix préférentiel." },
    { titre: "Publication et diffusion", texte: "L'Éditeur s'engage à publier l'œuvre, à en assurer une diffusion active et à accomplir les formalités de dépôt légal." },
    { titre: "Prix de vente", texte: "Le prix public de vente est fixé par l'Éditeur. Les remises consenties aux libraires et diffuseurs sont de {commissions_territoires}." },
    { titre: "Droits d'auteur", texte: "En contrepartie, l'Éditeur verse à l'Auteur {pourcentage} % du prix de vente hors taxes de chaque exemplaire vendu, après déduction de la remise libraire. Les exemplaires d'auteur, de presse et de dépôt légal ne donnent pas lieu à droits d'auteur." },
    { titre: "Reddition des comptes", texte: "L'Éditeur adresse à l'Auteur un relevé des ventes de chaque ouvrage et lui règle les droits correspondants {frequence_paiement}." },
    { titre: "Contribution de l'Auteur", texte: "[[contribution_auteur:L'Auteur contribue aux frais suivants : {contribution_auteur}. Tous les autres frais de production et de promotion sont à la charge de l'Éditeur.]]" },
    { titre: "Droits dérivés", texte: "Toute proposition de traduction, d'adaptation ou de cession des droits à un tiers sera soumise à l'accord préalable de l'Auteur. Les recettes correspondantes seront partagées selon une répartition convenue par écrit entre les parties." },
    { titre: "Résiliation", texte: "En cas de manquement de l'une des parties à ses obligations, l'autre partie pourra résilier le présent contrat par lettre recommandée, trente jours après une mise en demeure restée sans effet." },
    { titre: "Litiges", texte: "Les parties s'efforceront de régler à l'amiable tout différend né de l'exécution du présent contrat. À défaut, le litige sera porté devant le tribunal compétent du lieu du siège de l'Éditeur." },
  ],
};
