// Server-only: per-person rate limit on costly AI calls (see migration 20261102180000_rate_limits.sql).
import type { SupabaseClient } from "@supabase/supabase-js";

type AnySupabase = SupabaseClient<any, "public", any>;

export type LimiteAction = "medmo" | "contrat_import";
export type Limite = { ok: true } | { ok: false; message: string };

const MESSAGES: Record<string, string> = {
  minute: "Trop de demandes en une minute. Patientez un instant puis réessayez.",
  jour: "Vous avez atteint la limite de demandes pour aujourd'hui. Réessayez demain.",
};

/**
 * Counts one call for the signed-in person and says whether it may go ahead.
 * Until the migration is run, the function does not exist: the call goes
 * through so nothing breaks. Any other failure refuses the call, so a broken
 * counter can never become an open door.
 */
export async function consommerLimite(supabase: AnySupabase, action: LimiteAction): Promise<Limite> {
  const { data, error } = await supabase.rpc("consommer_limite", { p_action: action });
  if (error) {
    const absente = error.code === "PGRST202" || error.code === "42883";
    if (absente) return { ok: true };
    console.error(`[rate-limit] ${action} check failed:`, error.message);
    return { ok: false, message: "Service momentanément indisponible. Réessayez dans un instant." };
  }
  const res = data as { ok?: boolean; raison?: string } | null;
  if (res?.ok) return { ok: true };
  return { ok: false, message: MESSAGES[res?.raison ?? ""] ?? MESSAGES.minute };
}
