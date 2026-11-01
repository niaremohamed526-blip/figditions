// Server-only: monthly Pr. MEDMO quota per plan (see src/lib/plans.ts).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppPlan } from "@/hooks/use-auth";
import { debutDuMois, planFor } from "@/lib/plans";

type AnySupabase = SupabaseClient<any, "public", any>;

export type QuotaMedmo = { ok: true } | { ok: false; message: string };

/**
 * Records one question and tells whether the house still has quota this month.
 * Fails open: if usage can't be read (e.g. the table is not migrated yet), the
 * question goes through rather than blocking a paying customer.
 */
export async function consommerQuestionMedmo(
  supabase: AnySupabase,
  entrepriseId: string | null,
  userId: string,
  plan: string | null | undefined,
  source: "chat" | "photo_ventes",
): Promise<QuotaMedmo> {
  if (!entrepriseId) return { ok: true };
  const p = planFor(plan as AppPlan);
  const max = p.medmoParMois;

  if (max !== Infinity) {
    const { count, error } = await supabase
      .from("medmo_usage")
      .select("id", { count: "exact", head: true })
      .eq("entreprise_id", entrepriseId)
      .gte("created_at", debutDuMois());
    if (error) {
      console.error("[medmo-quota] usage read failed, allowing:", error.message);
      return { ok: true };
    }
    if ((count ?? 0) >= max) {
      const suite = p.key === "starter"
        ? "Passez au plan Pro (300 questions par mois) pour continuer."
        : "Passez au plan Business (illimité) pour continuer.";
      return {
        ok: false,
        message: `Vous avez utilisé les ${max} questions Pr. MEDMO de votre plan ${p.label} ce mois-ci. ${suite}`,
      };
    }
  }

  // Not awaited: the answer doesn't need to wait for the usage row, and the
  // request stays open while the answer streams, so the insert still lands.
  void supabase
    .from("medmo_usage")
    .insert({ entreprise_id: entrepriseId, user_id: userId, source })
    .then(({ error: insErr }) => {
      if (insErr) console.error("[medmo-quota] usage insert failed:", insErr.message);
    });
  return { ok: true };
}
