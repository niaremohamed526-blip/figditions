import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Daily cron: scans contrats / ventes / abonnements and inserts notifications
// for expiring contracts, overdue royalties, and ending subscriptions.

function parseDureeToDays(duree: string | null): number | null {
  if (!duree) return null;
  const m = duree.toLowerCase().match(/(\d+)\s*(an|ans|mois|jour|jours)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (m[2].startsWith("an")) return n * 365;
  if (m[2].startsWith("mois")) return n * 30;
  return n;
}

export const Route = createFileRoute("/api/public/hooks/check-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        if (!apikey || apikey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }

        const now = new Date();
        const in7d = new Date(now.getTime() + 7 * 86400_000);
        const in30d = new Date(now.getTime() + 30 * 86400_000);
        const ago30d = new Date(now.getTime() - 30 * 86400_000);
        let created = 0;

        // 1) Contrats expirant sous 30j (date_signature + duree)
        const { data: contrats } = await supabaseAdmin
          .from("contrats")
          .select("id, entreprise_id, manuscrit_id, duree, date_signature, statut")
          .eq("statut", "signe")
          .not("date_signature", "is", null);

        for (const c of contrats ?? []) {
          const days = parseDureeToDays((c as any).duree);
          if (!days || !(c as any).date_signature) continue;
          const fin = new Date((c as any).date_signature);
          fin.setDate(fin.getDate() + days);
          if (fin > now && fin <= in30d) {
            // Dedupe: skip if already notified in last 7 days for this contrat
            const { data: existing } = await supabaseAdmin
              .from("notifications")
              .select("id")
              .eq("entreprise_id", (c as any).entreprise_id)
              .eq("type", "contrat_expiration")
              .gte("created_at", new Date(now.getTime() - 7 * 86400_000).toISOString())
              .contains("metadata", { contrat_id: (c as any).id })
              .limit(1);
            if (existing && existing.length > 0) continue;

            const { data: m } = await supabaseAdmin
              .from("manuscrits").select("titre").eq("id", (c as any).manuscrit_id).maybeSingle();
            await supabaseAdmin.rpc("fn_notify", {
              p_entreprise: (c as any).entreprise_id,
              p_type: "contrat_expiration",
              p_titre: "📜 Contrat bientôt expiré",
              p_message: `Le contrat « ${(m as any)?.titre ?? "manuscrit"} » expire le ${fin.toLocaleDateString("fr-FR")}.`,
              p_lien: "/contrats",
              p_metadata: { contrat_id: (c as any).id, manuscrit_id: (c as any).manuscrit_id, date_fin: fin.toISOString() },
            });
            created++;
          }
        }

        // 2) Royalties en attente depuis > 30j
        const { data: ventes } = await supabaseAdmin
          .from("ventes")
          .select("id, entreprise_id, auteur_id, droits_auteur_fcfa, date_vente")
          .eq("statut_paiement", "en_attente")
          .gt("droits_auteur_fcfa", 0)
          .lte("date_vente", ago30d.toISOString().slice(0, 10));

        // Agrégat par auteur/entreprise
        const byAuteur = new Map<string, { ent: string; auteur: string | null; total: number }>();
        for (const v of ventes ?? []) {
          const key = `${(v as any).entreprise_id}::${(v as any).auteur_id ?? "null"}`;
          const cur = byAuteur.get(key) ?? { ent: (v as any).entreprise_id, auteur: (v as any).auteur_id, total: 0 };
          cur.total += Number((v as any).droits_auteur_fcfa) || 0;
          byAuteur.set(key, cur);
        }
        for (const [key, agg] of byAuteur) {
          const { data: existing } = await supabaseAdmin
            .from("notifications")
            .select("id")
            .eq("entreprise_id", agg.ent)
            .eq("type", "royalty_retard")
            .gte("created_at", new Date(now.getTime() - 7 * 86400_000).toISOString())
            .contains("metadata", { auteur_key: key })
            .limit(1);
          if (existing && existing.length > 0) continue;

          let auteurNom = "Auteur inconnu";
          if (agg.auteur) {
            const { data: a } = await supabaseAdmin.from("auteurs").select("nom_complet").eq("id", agg.auteur).maybeSingle();
            auteurNom = (a as any)?.nom_complet ?? auteurNom;
          }
          await supabaseAdmin.rpc("fn_notify", {
            p_entreprise: agg.ent,
            p_type: "royalty_retard",
            p_titre: "⏰ Royalties en retard",
            p_message: `${auteurNom} : ${Math.round(agg.total).toLocaleString("fr-FR")} FCFA dus depuis plus de 30 jours.`,
            p_lien: "/auteurs",
            p_metadata: { auteur_key: key, total: agg.total },
          });
          created++;
        }

        // 3) Abonnement expirant sous 7j
        const { data: ents } = await supabaseAdmin
          .from("entreprises")
          .select("id, nom, abonnement_expire_le, plan")
          .not("abonnement_expire_le", "is", null)
          .gte("abonnement_expire_le", now.toISOString())
          .lte("abonnement_expire_le", in7d.toISOString());

        for (const e of ents ?? []) {
          const { data: existing } = await supabaseAdmin
            .from("notifications")
            .select("id")
            .eq("entreprise_id", (e as any).id)
            .eq("type", "abonnement_expiration")
            .gte("created_at", new Date(now.getTime() - 3 * 86400_000).toISOString())
            .limit(1);
          if (existing && existing.length > 0) continue;

          const fin = new Date((e as any).abonnement_expire_le);
          await supabaseAdmin.rpc("fn_notify", {
            p_entreprise: (e as any).id,
            p_type: "abonnement_expiration",
            p_titre: "💳 Abonnement bientôt expiré",
            p_message: `Votre plan ${(e as any).plan} expire le ${fin.toLocaleDateString("fr-FR")}. Renouvelez pour conserver vos accès.`,
            p_lien: "/parametres",
            p_metadata: { plan: (e as any).plan, expire_le: fin.toISOString() },
          });
          created++;
        }

        return new Response(JSON.stringify({ ok: true, created }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
