import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.object({ token: z.string().uuid() });

export const getShareInfo = createServerFn({ method: "POST" })
  .inputValidator((d) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: share, error } = await supabaseAdmin

      .from("pdf_partages")
      .select("id, nom_lecteur, email_lecteur, entreprise_lecteur, nombre_vues_max, nombre_vues_actuel, est_actif, manuscrit_id")
      .eq("token", data.token)
      .maybeSingle();
    if (error || !share) return { ok: false as const, reason: "not_found" as const };
    if (!share.est_actif) return { ok: false as const, reason: "disabled" as const };
    if (share.nombre_vues_actuel >= share.nombre_vues_max)
      return { ok: false as const, reason: "exhausted" as const };

    const { data: m } = await supabaseAdmin
      .from("manuscrits")
      .select("titre, auteur")
      .eq("id", share.manuscrit_id)
      .maybeSingle();

    return {
      ok: true as const,
      share: {
        nom_lecteur: share.nom_lecteur,
        email_lecteur: share.email_lecteur,
        entreprise_lecteur: share.entreprise_lecteur,
        nombre_vues_max: share.nombre_vues_max,
        nombre_vues_actuel: share.nombre_vues_actuel,
      },
      manuscrit: { titre: m?.titre ?? "Document", auteur: m?.auteur ?? "" },
    };
  });

export const openSharedPdf = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      token: z.string().uuid(),
      nom_confirme: z.string().min(1).max(200),
      email_confirme: z.string().email().max(200).optional().or(z.literal("")),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Atomic check-and-increment to prevent concurrent requests from bypassing the view cap.
    const { data: rpcData, error: rpcError } = await supabaseAdmin
      .rpc("increment_pdf_view", { p_token: data.token });


    if (rpcError || !rpcData) {
      return { ok: false as const, reason: "not_found" as const };
    }

    const result = rpcData as {
      success: boolean;
      error: "not_found" | "disabled" | "exhausted" | null;
      views_used?: number;
      views_max?: number;
      manuscrit_id?: string;
      nom_lecteur?: string | null;
      entreprise_lecteur?: string | null;
    };

    if (!result.success) {
      return { ok: false as const, reason: (result.error ?? "not_found") as "not_found" | "disabled" | "exhausted" };
    }

    const { data: m } = await supabaseAdmin
      .from("manuscrits")
      .select("titre, auteur, pdf_path, nombre_pages, entreprise_id")
      .eq("id", result.manuscrit_id!)
      .maybeSingle();

    if (!m?.pdf_path) return { ok: false as const, reason: "no_file" as const };

    // SECURITY: verify the share link's enterprise matches the manuscript's enterprise.
    // Without this check, an attacker in enterprise A could create a pdf_partages row
    // referencing a manuscrit_id from enterprise B and obtain a signed URL to it.
    const { data: shareRow } = await supabaseAdmin
      .from("pdf_partages")
      .select("entreprise_id")
      .eq("token", data.token)
      .maybeSingle();

    if (!shareRow || !m.entreprise_id || shareRow.entreprise_id !== m.entreprise_id) {
      return { ok: false as const, reason: "not_found" as const };
    }

    // SECURITY: prevent cross-tenant path injection — the manuscrit's pdf_path
    // MUST live under that manuscrit's own tenant prefix.
    if (!m.pdf_path.startsWith(`${m.entreprise_id}/`)) {
      return { ok: false as const, reason: "no_file" as const };
    }


    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("manuscrits")
      .createSignedUrl(m.pdf_path, 60 * 60);
    if (sErr || !signed) return { ok: false as const, reason: "no_file" as const };

    return {
      ok: true as const,
      pdfUrl: signed.signedUrl,
      titre: m.titre,
      auteur: m.auteur,
      nom_lecteur: result.nom_lecteur ?? "",
      entreprise_lecteur: result.entreprise_lecteur ?? "",
      vue_actuelle: result.views_used ?? 0,
      vue_max: result.views_max ?? 0,
    };
  });

