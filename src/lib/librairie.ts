import { supabase } from "@/integrations/supabase/client";

/**
 * Pattern for `.ilike("librairie_nom", …)` that matches the name exactly, ignoring case.
 * `%` and `_` are escaped so a name never acts as a wildcard: "Tonino" must not
 * match "Tonino Koutiala" (separate branches).
 */
export function nomLibrairieExact(nom: string): string {
  return nom.trim().replace(/[\\%_]/g, (c) => `\\${c}`);
}

export interface ReglagesLibrairie {
  taux_commission_pct: number | null;
  applique_droits_auteur: boolean | null;
  librairie_adresse: string | null;
}

/** Commission, author rights and address from this bookshop's latest deposit, to pre-fill a new one. */
export async function derniersReglagesLibrairie(
  entrepriseId: string,
  nom: string,
): Promise<ReglagesLibrairie | null> {
  const { data } = await supabase
    .from("stocks")
    .select("taux_commission_pct, applique_droits_auteur, librairie_adresse")
    .eq("entreprise_id", entrepriseId)
    .ilike("librairie_nom", nomLibrairieExact(nom))
    .order("created_at", { ascending: false })
    .limit(1);
  return (data?.[0] as ReglagesLibrairie | undefined) ?? null;
}
