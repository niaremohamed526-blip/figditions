// Rapprochement partagé Pr. MEDMO (chat + photo) : livres, librairies, auteurs.
// Utilise la même logique que les formulaires manuels (src/lib/normalizeText.ts)
// et consulte d'abord les corrections apprises (medmo_ocr_corrections).
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  confidenceTier,
  normalizeMatchKey,
  normalizeMentionKey,
  normalizeName,
  rankCandidates,
  type Confidence,
} from "./normalizeText";

type AnySupabase = SupabaseClient<any, "public", any>;

export type CorrectionType = "titre_livre" | "librairie" | "auteur";

export interface Corrections {
  get(type: CorrectionType, raw: string): string | null;
}

/** Charge les corrections apprises (chat ET photo — même table). */
export async function loadCorrections(supabase: AnySupabase, entrepriseId: string): Promise<Corrections> {
  const { data } = await supabase
    .from("medmo_ocr_corrections")
    .select("texte_extrait, valeur_correcte, type_correction")
    .eq("entreprise_id", entrepriseId)
    .limit(1000);
  const maps: Record<string, Map<string, string>> = {
    titre_livre: new Map(),
    librairie: new Map(),
    auteur: new Map(),
  };
  for (const row of (data ?? []) as any[]) {
    const m = maps[String(row.type_correction)];
    if (m) m.set(normalizeMentionKey(String(row.texte_extrait)), String(row.valeur_correcte));
  }
  return {
    get: (type, raw) => maps[type]?.get(normalizeMentionKey(raw)) ?? null,
  };
}

/** Enregistre une correction utilisateur (apprentissage partagé). */
export async function saveCorrection(
  supabase: AnySupabase,
  entrepriseId: string,
  userId: string,
  type: CorrectionType,
  texteExtrait: string,
  valeurCorrecte: string,
): Promise<void> {
  try {
    await supabase.from("medmo_ocr_corrections").insert({
      entreprise_id: entrepriseId,
      user_id: userId,
      type_correction: type,
      texte_extrait: normalizeName(texteExtrait),
      valeur_correcte: normalizeName(valeurCorrecte),
    } as any);
  } catch {
    /* apprentissage best-effort */
  }
}

export interface Resolution<T> {
  raw: string;
  confiance: Confidence;
  score: number;
  match: T | null;
  via_correction: boolean;
  suggestions: { label: string; score: number }[];
}

function resolve<T>(
  raw: string,
  items: T[],
  label: (t: T) => string,
  corrections: Corrections | null,
  type: CorrectionType,
): Resolution<T> {
  const corrige = corrections?.get(type, raw) ?? null;
  if (corrige) {
    const hit = items.find((i) => normalizeMatchKey(label(i)) === normalizeMatchKey(corrige));
    if (hit) {
      return { raw, confiance: "haute", score: 1, match: hit, via_correction: true, suggestions: [{ label: label(hit), score: 1 }] };
    }
  }
  const ranked = rankCandidates(raw, items, label);
  const best = ranked[0];
  const score = best?.score ?? 0;
  const confiance = confidenceTier(score);
  return {
    raw,
    confiance,
    score,
    match: confiance === "faible" ? null : (best?.item ?? null),
    via_correction: false,
    suggestions: ranked.slice(0, 3).filter((c) => c.score >= 0.4).map((c) => ({ label: label(c.item), score: Math.round(c.score * 100) / 100 })),
  };
}

export interface LivreRef {
  id: string;
  titre: string;
  auteur: string | null;
  auteur_id: string | null;
  statut: string;
}
export interface LibrairieRef {
  nom: string;
  adresse: string | null;
}
export interface AuteurRef {
  id: string;
  nom_complet: string;
}

/** Manuscrits publiés (défaut) ou tous, pour cette entreprise. */
export async function fetchLivres(supabase: AnySupabase, eid: string, publiesSeulement = true): Promise<LivreRef[]> {
  let q = supabase
    .from("manuscrits")
    .select("id, titre, auteur, auteur_id, statut")
    .eq("entreprise_id", eid)
    .limit(1000);
  if (publiesSeulement) q = q.eq("statut", "publie");
  const { data } = await q;
  return (data ?? []) as LivreRef[];
}

export async function fetchLibrairies(supabase: AnySupabase, eid: string): Promise<LibrairieRef[]> {
  const { data } = await supabase
    .from("stocks")
    .select("librairie_nom, librairie_adresse")
    .eq("entreprise_id", eid)
    .limit(2000);
  const seen = new Map<string, LibrairieRef>();
  for (const r of (data ?? []) as any[]) {
    const nom = normalizeName(r.librairie_nom);
    if (!nom) continue;
    const key = `${normalizeMatchKey(nom)}|${normalizeMatchKey(r.librairie_adresse ?? "")}`;
    if (!seen.has(key)) seen.set(key, { nom, adresse: r.librairie_adresse ?? null });
  }
  return [...seen.values()];
}

export async function fetchAuteurs(supabase: AnySupabase, eid: string): Promise<AuteurRef[]> {
  const { data } = await supabase.from("auteurs").select("id, nom_complet").eq("entreprise_id", eid).limit(1000);
  return (data ?? []) as AuteurRef[];
}

export function resolveLivre(raw: string, livres: LivreRef[], corrections: Corrections | null) {
  return resolve(raw, livres, (l) => l.titre, corrections, "titre_livre");
}
export function resolveLibrairie(raw: string, librairies: LibrairieRef[], corrections: Corrections | null) {
  return resolve(raw, librairies, (l) => l.nom, corrections, "librairie");
}
export function resolveAuteur(raw: string, auteurs: AuteurRef[], corrections: Corrections | null) {
  return resolve(raw, auteurs, (a) => a.nom_complet, corrections, "auteur");
}

const NOMS: Record<CorrectionType, string> = {
  titre_livre: "livre",
  librairie: "librairie",
  auteur: "auteur",
};

/**
 * Message de confirmation à renvoyer au modèle quand la confiance n'est pas
 * haute : Pr. MEDMO ne doit jamais créer ni agir en silence dans ce cas.
 */
export function besoinConfirmation<T>(res: Resolution<T>, type: CorrectionType, label: (t: T) => string) {
  const nom = NOMS[type];
  const props = res.suggestions.map((s) => s.label);
  if (res.confiance === "moyenne" && res.match) {
    return {
      confirmation_requise: true,
      interpretation: `${nom} détecté(e) : « ${res.raw} » → je pense qu'il s'agit de « ${label(res.match)} » (déjà existant(e)).`,
      question: `Confirmez-vous qu'il s'agit bien de « ${label(res.match)} » ? Si non, indiquez-moi le nom exact.`,
      suggestions: props,
    };
  }
  return {
    confirmation_requise: true,
    interpretation: `Aucune correspondance fiable pour « ${res.raw} » dans votre ${type === "titre_livre" ? "catalogue" : type === "librairie" ? "liste de librairies" : "liste d'auteurs"}.`,
    question: props.length
      ? `Vouliez-vous dire ${props.slice(0, 2).map((p) => `« ${p} »`).join(" ou ")} ? Sinon, dites-moi s'il faut créer une nouvelle entrée.`
      : `Voulez-vous créer une nouvelle entrée pour « ${res.raw} » ?`,
    suggestions: props,
  };
}

/** Phrase de transparence pour les correspondances hautes non littérales. */
export function noteInterpretation(raw: string, retenu: string, quoi: string): string | null {
  if (normalizeMatchKey(raw) === normalizeMatchKey(retenu)) return null;
  return `J'ai compris « ${raw} » comme ${quoi} « ${retenu} ».`;
}
