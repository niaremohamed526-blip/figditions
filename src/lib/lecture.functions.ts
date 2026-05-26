import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const tokenSchema = z.object({ token: z.string().uuid() });

export const getShareInfo = createServerFn({ method: "POST" })
  .inputValidator((d) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
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
    const { data: share, error } = await supabaseAdmin
      .from("pdf_partages")
      .select("id, manuscrit_id, est_actif, nombre_vues_max, nombre_vues_actuel, nom_lecteur, entreprise_lecteur")
      .eq("token", data.token)
      .maybeSingle();
    if (error || !share) return { ok: false as const, reason: "not_found" as const };
    if (!share.est_actif) return { ok: false as const, reason: "disabled" as const };
    if (share.nombre_vues_actuel >= share.nombre_vues_max)
      return { ok: false as const, reason: "exhausted" as const };

    const { data: m } = await supabaseAdmin
      .from("manuscrits")
      .select("titre, auteur, pdf_path, nombre_pages")
      .eq("id", share.manuscrit_id)
      .maybeSingle();

    if (!m?.pdf_path) return { ok: false as const, reason: "no_file" as const };

    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("manuscrits")
      .createSignedUrl(m.pdf_path, 60 * 60);
    if (sErr || !signed) return { ok: false as const, reason: "no_file" as const };

    const newCount = share.nombre_vues_actuel + 1;
    await supabaseAdmin
      .from("pdf_partages")
      .update({
        nombre_vues_actuel: newCount,
        last_viewed_at: new Date().toISOString(),
      })
      .eq("id", share.id);

    return {
      ok: true as const,
      pdfUrl: signed.signedUrl,
      titre: m.titre,
      auteur: m.auteur,
      nom_lecteur: share.nom_lecteur,
      entreprise_lecteur: share.entreprise_lecteur,
      vue_actuelle: newCount,
      vue_max: share.nombre_vues_max,
    };
  });
