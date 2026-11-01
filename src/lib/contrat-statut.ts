// A contract expires because of its dates, not because someone picked the
// word: shown status = signature date + duration, whatever was stored.

export type ContratStatut = "brouillon" | "en_attente_signature" | "signe" | "expire" | "resilie";

interface ContratDates {
  statut: string;
  date_signature?: string | null;
  duree_annees?: number | null;
}

/** End of the contract, or null when it is not signed or has no duration. */
export function finContrat(c: ContratDates): Date | null {
  if (!c.date_signature || !c.duree_annees) return null;
  const end = new Date(c.date_signature);
  end.setFullYear(end.getFullYear() + Number(c.duree_annees));
  return end;
}

export function statutReel(c: ContratDates, now = new Date()): ContratStatut {
  const fin = finContrat(c);
  const echu = fin !== null && fin.getTime() < now.getTime();
  if (c.statut === "resilie") return "resilie";
  if (echu && (c.statut === "signe" || c.statut === "expire")) return "expire";
  // "Expiré" on a contract that never ran out: it is signed, or still a draft.
  if (c.statut === "expire") return c.date_signature ? "signe" : "brouillon";
  return c.statut as ContratStatut;
}
