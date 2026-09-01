// Source de vérité unique du rapprochement de noms (formulaires manuels,
// import Excel, Pr. MEDMO chat et Photo-to-Action).

/** Nettoyage d'affichage : espaces normalisés, pas de casse forcée. */
export function normalizeName(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

/** Clé de comparaison : minuscules, sans accents, sans ponctuation. */
export function normalizeMatchKey(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Mots de remplissage à ignorer dans une mention conversationnelle. */
const FILLERS = new Set([
  "a", "au", "aux", "la", "le", "les", "l", "de", "du", "des", "d",
  "chez", "en", "dans", "pour", "vers", "monsieur", "madame", "mr", "mme", "m",
]);

/**
 * Clé de comparaison « conversationnelle » : retire les mots de remplissage
 * (« à la librairie bah » → « librairie bah »). Le mot « librairie » est
 * conservé car il fait souvent partie du nom réel.
 */
export function normalizeMentionKey(s: string | null | undefined): string {
  const toks = normalizeMatchKey(s).split(" ").filter((t) => t && !FILLERS.has(t));
  return toks.join(" ");
}

/** Clé insensible à l'ordre des mots (« Bah Mohamed » = « Mohamed Bah »). */
export function sortedTokenKey(s: string | null | undefined): string {
  return normalizeMentionKey(s).split(" ").filter(Boolean).sort().join(" ");
}

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n]!;
}

/** Similarité 0→1 sur deux clés déjà normalisées. */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;
  return Math.max(0, 1 - levenshtein(a, b) / Math.max(a.length, b.length));
}

/**
 * Similarité tolérante utilisée partout : compare la clé simple ET la clé à
 * mots triés (variations d'ordre des noms), sur les formes « conversation ».
 */
export function nameSimilarity(rawA: string, rawB: string): number {
  const a1 = normalizeMentionKey(rawA);
  const b1 = normalizeMentionKey(rawB);
  const direct = similarity(a1, b1);
  const sorted = similarity(sortedTokenKey(rawA), sortedTokenKey(rawB));
  // Un fragment de nom (« bah ») contenu dans un nom complet reste crédible.
  const tokensA = a1.split(" ").filter(Boolean);
  const tokensB = b1.split(" ").filter(Boolean);
  const shared = tokensA.filter((t) => t.length > 2 && tokensB.includes(t)).length;
  const tokenScore = shared > 0 ? 0.6 + 0.1 * Math.min(3, shared) : 0;
  return Math.max(direct, sorted, tokenScore);
}

export type Confidence = "haute" | "moyenne" | "faible";

/** Paliers partagés : ≥0,90 haute · 0,75–0,89 moyenne · <0,75 faible. */
export function confidenceTier(score: number): Confidence {
  return score >= 0.9 ? "haute" : score >= 0.75 ? "moyenne" : "faible";
}

export interface Candidate<T> {
  item: T;
  score: number;
}

/** Classe des candidats par similarité décroissante sur un champ texte. */
export function rankCandidates<T>(raw: string, items: T[], label: (t: T) => string): Candidate<T>[] {
  return items
    .map((item) => ({ item, score: nameSimilarity(raw, label(item)) }))
    .sort((a, b) => b.score - a.score);
}
