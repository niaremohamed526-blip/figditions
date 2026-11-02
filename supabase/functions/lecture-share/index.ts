// Edge function sécurisée pour l'accès aux PDF partagés via token.
// Renforcements : liaison d'identité, journal d'audit, rate-limit, CORS restreint,
// date d'expiration, exemplaire marqué au nom du lecteur dans le fichier même
// (le fichier d'origine ne quitte jamais le serveur), journal des actions suspectes.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { marquerExemplaire, nouveauCode } from "./filigrane.ts";

const ALLOWED_ORIGINS = [
  "https://figditions.xyz",
  "https://www.figditions.xyz",
  "https://figditions.vercel.app",
  "https://id-preview--1d465579-2959-44ce-9ae1-cef3f8cf4dae.lovable.app",
  "https://1d465579-2959-44ce-9ae1-cef3f8cf4dae.lovableproject.com",
];

const RATE_LIMIT_WINDOW_MIN = 10;
const RATE_LIMIT_MAX_FAILURES = 10;
// Actions suspectes que la page de lecture signale.
const EVENEMENTS = new Set(["capture", "fenetre_quittee", "outils_dev", "impression", "copie"]);
const EVENEMENTS_MAX_PAR_MINUTE = 20;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const corsFor = (origin: string | null) => {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Expose-Headers": "x-lecture",
  };
};

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const expire = (e: string | null | undefined) => !!e && new Date(e).getTime() <= Date.now();

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = corsFor(origin);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ ok: false, reason: "not_found" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    null;
  const ua = req.headers.get("user-agent")?.slice(0, 500) ?? null;
  const pays = (req.headers.get("cf-ipcountry") || req.headers.get("x-country") || "").slice(0, 2).toUpperCase() || null;

  const logAttempt = async (
    token: string,
    partage_id: string | null,
    entreprise_id: string | null,
    resultat: "success" | "denied" | "event",
    raison: string | null,
    nom_saisi: string | null,
    code_exemplaire: string | null = null,
  ) => {
    try {
      await admin.from("pdf_partages_acces_log").insert({
        partage_id,
        token,
        entreprise_id,
        resultat,
        raison,
        ip_addr: ip,
        user_agent: ua,
        nom_saisi,
        code_exemplaire,
        pays,
      });
    } catch (_) { /* best-effort */ }
  };

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action as string | undefined;
    const token = body?.token as string | undefined;

    if (!token || typeof token !== "string" || !UUID_RE.test(token)) {
      return json({ ok: false, reason: "not_found" }, 400);
    }

    if (action === "info") {
      const { data: share, error } = await admin
        .from("pdf_partages")
        .select("email_lecteur, nombre_vues_max, nombre_vues_actuel, est_actif, expire_le, manuscrit_id")
        .eq("token", token)
        .maybeSingle();

      if (error || !share) return json({ ok: false, reason: "not_found" });
      if (!share.est_actif) return json({ ok: false, reason: "disabled" });
      if (expire(share.expire_le)) return json({ ok: false, reason: "expired" });
      if (share.nombre_vues_actuel >= share.nombre_vues_max)
        return json({ ok: false, reason: "exhausted" });

      const { data: m } = await admin
        .from("manuscrits")
        .select("titre, auteur")
        .eq("id", share.manuscrit_id)
        .maybeSingle();

      // On ne renvoie PAS le nom/email pré-rempli : sinon un attaquant qui possède
      // le token connaîtrait l'identité attendue et pourrait la re-saisir.
      // Le formulaire redemande une saisie et on vérifie côté serveur.
      return json({
        ok: true,
        share: {
          nom_lecteur: null,
          email_lecteur: null,
          entreprise_lecteur: null,
          nombre_vues_max: share.nombre_vues_max,
          nombre_vues_actuel: share.nombre_vues_actuel,
          expire_le: share.expire_le,
          email_demande: !!share.email_lecteur,
        },
        manuscrit: { titre: m?.titre ?? "Document", auteur: m?.auteur ?? "" },
      });
    }

    if (action === "open") {
      const nom_confirme = String(body?.nom_confirme ?? "").trim().slice(0, 200);
      const email_confirme = String(body?.email_confirme ?? "").trim().toLowerCase().slice(0, 200);

      if (nom_confirme.length < 2) {
        return json({ ok: false, reason: "identity_mismatch" });
      }

      // Rate-limit : max N échecs sur ce token dans la fenêtre glissante.
      const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MIN * 60 * 1000).toISOString();
      const { count: failCount } = await admin
        .from("pdf_partages_acces_log")
        .select("id", { count: "exact", head: true })
        .eq("token", token)
        .eq("resultat", "denied")
        .gte("created_at", windowStart);

      if ((failCount ?? 0) >= RATE_LIMIT_MAX_FAILURES) {
        await logAttempt(token, null, null, "denied", "rate_limited", nom_confirme);
        return json({ ok: false, reason: "rate_limited" }, 429);
      }

      // Récupère l'enregistrement pour vérifier l'identité AVANT d'incrémenter.
      const { data: share } = await admin
        .from("pdf_partages")
        .select("id, entreprise_id, manuscrit_id, nom_lecteur, email_lecteur, entreprise_lecteur, est_actif, expire_le, nombre_vues_actuel, nombre_vues_max")
        .eq("token", token)
        .maybeSingle();

      if (!share) {
        await logAttempt(token, null, null, "denied", "not_found", nom_confirme);
        return json({ ok: false, reason: "not_found" });
      }
      if (!share.est_actif) {
        await logAttempt(token, share.id, share.entreprise_id, "denied", "disabled", nom_confirme);
        return json({ ok: false, reason: "disabled" });
      }
      if (expire(share.expire_le)) {
        await logAttempt(token, share.id, share.entreprise_id, "denied", "expired", nom_confirme);
        return json({ ok: false, reason: "expired" });
      }
      if (share.nombre_vues_actuel >= share.nombre_vues_max) {
        await logAttempt(token, share.id, share.entreprise_id, "denied", "exhausted", nom_confirme);
        return json({ ok: false, reason: "exhausted" });
      }

      // Liaison d'identité : le nom saisi doit correspondre au nom pré-enregistré.
      if (share.nom_lecteur && normalize(share.nom_lecteur) !== normalize(nom_confirme)) {
        await logAttempt(token, share.id, share.entreprise_id, "denied", "identity_mismatch", nom_confirme);
        return json({ ok: false, reason: "identity_mismatch" });
      }
      // Si un email a été pré-enregistré, il doit correspondre.
      if (share.email_lecteur && share.email_lecteur.trim().toLowerCase() !== email_confirme) {
        await logAttempt(token, share.id, share.entreprise_id, "denied", "identity_mismatch", nom_confirme);
        return json({ ok: false, reason: "identity_mismatch" });
      }

      // Le fichier doit exister avant de consommer une vue.
      const { data: m } = await admin
        .from("manuscrits")
        .select("titre, auteur, pdf_path, entreprise_id")
        .eq("id", share.manuscrit_id)
        .maybeSingle();

      if (!m?.pdf_path || !m.entreprise_id || m.entreprise_id !== share.entreprise_id) {
        await logAttempt(token, share.id, share.entreprise_id, "denied", "tenant_mismatch", nom_confirme);
        return json({ ok: false, reason: "no_file" });
      }
      if (!m.pdf_path.startsWith(`${m.entreprise_id}/`)) {
        await logAttempt(token, share.id, share.entreprise_id, "denied", "path_injection", nom_confirme);
        return json({ ok: false, reason: "no_file" });
      }

      // The original file never leaves the server: the reader receives a copy
      // marked with their name and a unique code on every page.
      const { data: fichier, error: dErr } = await admin.storage.from("manuscrits").download(m.pdf_path);
      if (dErr || !fichier) {
        await logAttempt(token, share.id, share.entreprise_id, "denied", "download_failed", nom_confirme);
        return json({ ok: false, reason: "no_file" });
      }
      const code = nouveauCode();
      let exemplaire: Uint8Array;
      try {
        exemplaire = await marquerExemplaire(new Uint8Array(await fichier.arrayBuffer()), {
          nom: share.nom_lecteur || nom_confirme,
          email: share.email_lecteur,
          entreprise: share.entreprise_lecteur,
          code,
          date: new Date(),
          titre: m.titre ?? "Document",
        });
      } catch (err) {
        console.error("[lecture-share] watermark failed", err);
        await logAttempt(token, share.id, share.entreprise_id, "denied", "watermark_failed", nom_confirme);
        return json({ ok: false, reason: "no_file" });
      }

      // Incrément atomique du compteur (respecte est_actif, expiration & cap).
      const { data: rpcData, error: rpcError } = await admin.rpc("increment_pdf_view", {
        p_token: token,
      });
      if (rpcError || !rpcData) {
        await logAttempt(token, share.id, share.entreprise_id, "denied", "rpc_failed", nom_confirme);
        return json({ ok: false, reason: "not_found" });
      }
      const result = rpcData as {
        success: boolean;
        error: "not_found" | "disabled" | "exhausted" | "expired" | null;
        views_used?: number;
        views_max?: number;
        nom_lecteur?: string | null;
        entreprise_lecteur?: string | null;
      };
      if (!result.success) {
        await logAttempt(token, share.id, share.entreprise_id, "denied", result.error ?? "not_found", nom_confirme);
        return json({ ok: false, reason: result.error ?? "not_found" });
      }

      await logAttempt(token, share.id, share.entreprise_id, "success", null, nom_confirme, code);

      const infos = {
        titre: m.titre,
        auteur: m.auteur,
        nom_lecteur: result.nom_lecteur ?? "",
        email_lecteur: share.email_lecteur ?? null,
        entreprise_lecteur: result.entreprise_lecteur ?? "",
        vue_actuelle: result.views_used ?? 0,
        vue_max: result.views_max ?? 0,
        code_exemplaire: code,
      };
      return new Response(new Blob([exemplaire as BlobPart], { type: "application/pdf" }), {
        status: 200,
        headers: {
          ...cors,
          "Content-Type": "application/pdf",
          "Cache-Control": "no-store",
          "x-lecture": encodeURIComponent(JSON.stringify(infos)),
        },
      });
    }

    if (action === "event") {
      const type = String(body?.type ?? "");
      if (!EVENEMENTS.has(type)) return json({ ok: false }, 400);
      const { data: share } = await admin
        .from("pdf_partages")
        .select("id, entreprise_id")
        .eq("token", token)
        .maybeSingle();
      if (!share) return json({ ok: false });
      const depuis = new Date(Date.now() - 60 * 1000).toISOString();
      const { count } = await admin
        .from("pdf_partages_acces_log")
        .select("id", { count: "exact", head: true })
        .eq("token", token)
        .eq("resultat", "event")
        .gte("created_at", depuis);
      if ((count ?? 0) >= EVENEMENTS_MAX_PAR_MINUTE) return json({ ok: true });
      const code = String(body?.code ?? "").slice(0, 12) || null;
      const nom = String(body?.nom ?? "").slice(0, 200) || null;
      await logAttempt(token, share.id, share.entreprise_id, "event", type, nom, code);
      return json({ ok: true });
    }

    return json({ ok: false, reason: "not_found" }, 400);
  } catch (e) {
    console.error("[lecture-share] error", e);
    return json({ ok: false, reason: "not_found" }, 500);
  }
});
