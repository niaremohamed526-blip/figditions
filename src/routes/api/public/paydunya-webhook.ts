import { createFileRoute } from "@tanstack/react-router";
import { confirmPaydunyaInvoice, planMaxUsers } from "@/lib/paydunya.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// PayDunya posts an IPN to this endpoint. We treat the body as advisory and
// re-confirm the invoice via PayDunya's confirm API as the source of truth.
export const Route = createFileRoute("/api/public/paydunya-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // PayDunya sends form-encoded data, but custom_data may include the token.
          let token: string | undefined;
          const contentType = request.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const body = (await request.json()) as Record<string, unknown>;
            const data = (body.data as Record<string, unknown> | undefined) ?? body;
            token =
              (data.invoice_token as string | undefined) ||
              (data.token as string | undefined) ||
              ((data.invoice as Record<string, unknown> | undefined)?.token as string | undefined);
          } else {
            const fd = await request.formData();
            token =
              (fd.get("data[invoice.token]") as string | null) ||
              (fd.get("invoice_token") as string | null) ||
              (fd.get("token") as string | null) ||
              undefined;
          }

          if (!token) {
            console.error("paydunya-webhook: no token in payload");
            return new Response("Missing token", { status: 400 });
          }

          const confirmed = await confirmPaydunyaInvoice(token);

          // Find the abonnement by token
          const { data: ab, error: findErr } = await supabaseAdmin
            .from("abonnements")
            .select("id, entreprise_id, plan, periode, montant_fcfa, statut")
            .eq("paydunya_token", token)
            .maybeSingle();
          if (findErr || !ab) {
            console.error("paydunya-webhook: abonnement not found", findErr);
            return new Response("Subscription not found", { status: 404 });
          }

          // Idempotency: refuse to re-activate an already-active subscription.
          // Prevents replay attacks where a tenant member resubmits an old token
          // to extend their plan for free.
          if (ab.statut === "actif" && confirmed.status === "completed") {
            return new Response("Already processed", { status: 200 });
          }


          if (confirmed.status === "completed") {
            const now = new Date();
            const end = new Date(now);
            if (ab.periode === "annuel") end.setDate(end.getDate() + 365);
            else end.setDate(end.getDate() + 30);

            await supabaseAdmin
              .from("abonnements")
              .update({
                statut: "actif",
                date_debut: now.toISOString(),
                date_fin: end.toISOString(),
              })
              .eq("id", ab.id);

            await supabaseAdmin
              .from("paiements")
              .update({
                statut: "succes",
                paydunya_reference: String(confirmed.raw.receipt_url ?? token),
                payload: confirmed.raw as unknown as any,
              })
              .eq("paydunya_token", token);

            await supabaseAdmin
              .from("entreprises")
              .update({
                plan: ab.plan,
                max_utilisateurs: planMaxUsers(ab.plan as "pro" | "business"),
                abonnement_expire_le: end.toISOString(),
              })
              .eq("id", ab.entreprise_id);
          } else if (confirmed.status === "cancelled" || confirmed.status === "failed") {
            await supabaseAdmin
              .from("abonnements")
              .update({ statut: confirmed.status === "cancelled" ? "annule" : "echec" })
              .eq("id", ab.id);
            await supabaseAdmin
              .from("paiements")
              .update({ statut: "echec", payload: confirmed.raw as unknown as any })
              .eq("paydunya_token", token);
          }

          return new Response("ok", { status: 200 });
        } catch (err) {
          console.error("paydunya-webhook error:", err);
          return new Response("Webhook error", { status: 500 });
        }
      },
      GET: async () => new Response("PayDunya webhook endpoint", { status: 200 }),
    },
  },
});
