// Edge function: gère l'accès aux PDF partagés via token sécurisé.
// Utilise le service role (disponible automatiquement dans les edge functions Supabase)
// pour contourner l'absence de SUPABASE_SERVICE_ROLE_KEY côté Vercel.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    const action = body?.action as string | undefined;
    const token = body?.token as string | undefined;

    if (!token || typeof token !== "string") {
      return json({ ok: false, reason: "not_found" }, 400);
    }

    if (action === "info") {
      const { data: share, error } = await admin
        .from("pdf_partages")
        .select("nom_lecteur, email_lecteur, entreprise_lecteur, nombre_vues_max, nombre_vues_actuel, est_actif, manuscrit_id")
        .eq("token", token)
        .maybeSingle();

      if (error || !share) return json({ ok: false, reason: "not_found" });
      if (!share.est_actif) return json({ ok: false, reason: "disabled" });
      if (share.nombre_vues_actuel >= share.nombre_vues_max)
        return json({ ok: false, reason: "exhausted" });

      const { data: m } = await admin
        .from("manuscrits")
        .select("titre, auteur")
        .eq("id", share.manuscrit_id)
        .maybeSingle();

      return json({
        ok: true,
        share: {
          nom_lecteur: share.nom_lecteur,
          email_lecteur: share.email_lecteur,
          entreprise_lecteur: share.entreprise_lecteur,
          nombre_vues_max: share.nombre_vues_max,
          nombre_vues_actuel: share.nombre_vues_actuel,
        },
        manuscrit: { titre: m?.titre ?? "Document", auteur: m?.auteur ?? "" },
      });
    }

    if (action === "open") {
      const nom_confirme = String(body?.nom_confirme ?? "").trim();
      if (!nom_confirme) return json({ ok: false, reason: "not_found" });

      const { data: rpcData, error: rpcError } = await admin.rpc("increment_pdf_view", {
        p_token: token,
      });
      if (rpcError || !rpcData) return json({ ok: false, reason: "not_found" });

      const result = rpcData as {
        success: boolean;
        error: "not_found" | "disabled" | "exhausted" | null;
        views_used?: number;
        views_max?: number;
        manuscrit_id?: string;
        nom_lecteur?: string | null;
        entreprise_lecteur?: string | null;
      };
      if (!result.success) return json({ ok: false, reason: result.error ?? "not_found" });

      const { data: m } = await admin
        .from("manuscrits")
        .select("titre, auteur, pdf_path, entreprise_id")
        .eq("id", result.manuscrit_id!)
        .maybeSingle();

      if (!m?.pdf_path) return json({ ok: false, reason: "no_file" });

      const { data: shareRow } = await admin
        .from("pdf_partages")
        .select("entreprise_id")
        .eq("token", token)
        .maybeSingle();

      if (!shareRow || !m.entreprise_id || shareRow.entreprise_id !== m.entreprise_id) {
        return json({ ok: false, reason: "not_found" });
      }

      if (!m.pdf_path.startsWith(`${m.entreprise_id}/`)) {
        return json({ ok: false, reason: "no_file" });
      }

      const { data: signed, error: sErr } = await admin.storage
        .from("manuscrits")
        .createSignedUrl(m.pdf_path, 60 * 60);
      if (sErr || !signed) return json({ ok: false, reason: "no_file" });

      return json({
        ok: true,
        pdfUrl: signed.signedUrl,
        titre: m.titre,
        auteur: m.auteur,
        nom_lecteur: result.nom_lecteur ?? "",
        entreprise_lecteur: result.entreprise_lecteur ?? "",
        vue_actuelle: result.views_used ?? 0,
        vue_max: result.views_max ?? 0,
      });
    }

    return json({ ok: false, reason: "not_found" }, 400);
  } catch (e) {
    console.error("[lecture-share] error", e);
    return json({ ok: false, reason: "not_found" }, 500);
  }
});
