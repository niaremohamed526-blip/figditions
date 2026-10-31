import { createFileRoute } from "@tanstack/react-router";
import { isCronAuthorized } from "@/lib/cron-auth.server";

// Daily cron (08:05 Bamako): one short "brief du jour" notification per
// maison d'édition, listing what needs action today. Notifications reach every
// member of the company (in-app and push), so the brief names to-dos only and
// never revenue figures. Nothing is sent when there is nothing to report.
// POST {"dry": true} returns the briefs without creating notifications.

const BRIEF_TYPE = "brief_quotidien";
const DEPOT_BAS = 5;

const n = (v: unknown) => Number(v ?? 0);
const plural = (count: number, one: string, many: string) => `${count} ${count > 1 ? many : one}`;

/** "A, B et 3 autres" — keeps the push short. */
function listNoms(noms: string[], { quote = true, max = 2 } = {}): string {
  const uniques = [...new Set(noms)];
  const shown = uniques.slice(0, max).map((t) => (quote ? `« ${t} »` : t));
  const rest = uniques.length - shown.length;
  return rest > 0 ? `${shown.join(", ")} et ${plural(rest, "autre", "autres")}` : shown.join(" et ");
}

export const Route = createFileRoute("/api/public/hooks/morning-brief")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isCronAuthorized(request)) {
          return new Response("Unauthorized", { status: 401 });
        }
        let body: { dry?: boolean } = {};
        try { body = await request.json(); } catch { /* empty */ }
        const dry = body.dry === true;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const now = new Date();
        const today = now.toISOString().slice(0, 10);
        const yesterday = new Date(now.getTime() - 86400_000).toISOString().slice(0, 10);
        const in30d = now.getTime() + 30 * 86400_000;

        const { data: entreprises } = await supabaseAdmin.from("entreprises").select("id, nom");
        const results: { entreprise: string; sent: boolean; message: string | null }[] = [];

        for (const e of entreprises ?? []) {
          const eid = (e as any).id as string;

          const { data: existing } = await supabaseAdmin
            .from("notifications")
            .select("id")
            .eq("entreprise_id", eid)
            .eq("type", BRIEF_TYPE)
            .gte("created_at", `${today}T00:00:00Z`)
            .limit(1);
          if (existing && existing.length > 0) {
            results.push({ entreprise: (e as any).nom, sent: false, message: "déjà envoyé aujourd'hui" });
            continue;
          }

          const [{ data: manuscrits }, { data: interne }, { data: depots }, { data: ventesHier }, { data: enAttente }, { data: contrats }] =
            await Promise.all([
              supabaseAdmin.from("manuscrits").select("id, titre").eq("entreprise_id", eid),
              supabaseAdmin.from("stock_interne").select("manuscrit_id, quantite_disponible, seuil_alerte").eq("entreprise_id", eid),
              supabaseAdmin.from("stocks").select("manuscrit_id, librairie_nom, exemplaires_restants").eq("entreprise_id", eid).lte("exemplaires_restants", DEPOT_BAS),
              supabaseAdmin.from("ventes").select("quantite_vendue").eq("entreprise_id", eid).eq("statut_annulation", "active").neq("statut_paiement", "annule").eq("date_vente", yesterday),
              supabaseAdmin.from("ventes").select("id").eq("entreprise_id", eid).eq("statut_annulation", "active").eq("statut_paiement", "en_attente"),
              supabaseAdmin.from("contrats").select("livres, date_signature, duree_annees").eq("entreprise_id", eid).eq("statut", "signe").not("date_signature", "is", null),
            ]);

          const titres = Object.fromEntries((manuscrits ?? []).map((m: any) => [m.id, m.titre as string]));
          const parts: string[] = [];

          const ventes = ventesHier ?? [];
          if (ventes.length > 0) {
            const exemplaires = ventes.reduce((a, v: any) => a + n(v.quantite_vendue), 0);
            parts.push(`Hier : ${plural(ventes.length, "vente", "ventes")} (${plural(exemplaires, "exemplaire", "exemplaires")})`);
          }

          const aReimprimer = (interne ?? [])
            .filter((s: any) => n(s.quantite_disponible) <= n(s.seuil_alerte))
            .map((s: any) => titres[s.manuscrit_id])
            .filter(Boolean);
          if (aReimprimer.length > 0) parts.push(`Stock faible : ${listNoms(aReimprimer)}`);

          const depotsBas = (depots ?? []).map((d: any) => d.librairie_nom as string).filter(Boolean);
          if (depotsBas.length > 0) parts.push(`Dépôts presque vides chez ${listNoms(depotsBas, { quote: false })}`);

          const attente = (enAttente ?? []).length;
          if (attente > 0) parts.push(`${plural(attente, "vente attend", "ventes attendent")} leur paiement`);

          const expirants = (contrats ?? []).filter((c: any) => {
            const fin = new Date(c.date_signature);
            fin.setFullYear(fin.getFullYear() + n(c.duree_annees));
            return fin.getTime() > now.getTime() && fin.getTime() <= in30d;
          });
          if (expirants.length > 0) parts.push(`${plural(expirants.length, "contrat expire", "contrats expirent")} dans moins de 30 jours`);

          // Yesterday's sales alone are not worth a push; send only when there is a to-do.
          const hasTodo = parts.length > (ventes.length > 0 ? 1 : 0);
          if (!hasTodo) {
            results.push({ entreprise: (e as any).nom, sent: false, message: null });
            continue;
          }

          const message = `${parts.join(" · ")}.`;
          if (!dry) {
            await supabaseAdmin.rpc("fn_notify", {
              p_entreprise: eid,
              p_type: BRIEF_TYPE,
              p_titre: "☀️ Votre brief du jour",
              p_message: message,
              p_lien: "/dashboard",
              p_metadata: { date: today },
            });
          }
          results.push({ entreprise: (e as any).nom, sent: !dry, message });
        }

        return new Response(JSON.stringify({ ok: true, dry, results }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
