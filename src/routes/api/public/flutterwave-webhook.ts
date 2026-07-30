import { createFileRoute } from "@tanstack/react-router";
import {
  getFlutterwaveCredentials,
  planMaxUsers,
  verifyFlutterwaveByReference,
} from "@/lib/flutterwave.server";

// Flutterwave posts a webhook here. The body is advisory only: we re-verify the
// transaction through Flutterwave's API as the source of truth.
export const Route = createFileRoute("/api/public/flutterwave-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        try {
          const creds = getFlutterwaveCredentials();

          // Verify the shared secret hash Flutterwave sends on every webhook.
          const signature = request.headers.get("verif-hash");
          if (!creds.secretHash || signature !== creds.secretHash) {
            console.error("flutterwave-webhook: invalid verif-hash");
            return new Response("Invalid signature", { status: 401 });
          }

          const body = (await request.json()) as Record<string, any>;
          const payload = (body.data as Record<string, any> | undefined) ?? body;
          const txRef: string | undefined = payload?.tx_ref || payload?.txRef;

          if (!txRef) {
            console.error("flutterwave-webhook: no tx_ref in payload");
            return new Response("Missing tx_ref", { status: 400 });
          }

          const confirmed = await verifyFlutterwaveByReference(txRef);

          const { data: ab, error: findErr } = await supabaseAdmin
            .from("abonnements")
            .select("id, entreprise_id, plan, periode, montant_fcfa, statut")
            .eq("payment_ref", txRef)
            .maybeSingle();
          if (findErr || !ab) {
            console.error("flutterwave-webhook: abonnement not found", findErr);
            // Generic 200 to avoid leaking which references are valid.
            return new Response("ok", { status: 200 });
          }

          // Idempotency: never re-activate an already-active subscription.
          if (ab.statut === "actif" && confirmed.status === "completed") {
            return new Response("Already processed", { status: 200 });
          }

          // Amount guard: the verified amount must cover the expected price.
          const amountOk =
            confirmed.currency.toUpperCase() === "XOF" &&
            confirmed.amount >= Number(ab.montant_fcfa);

          if (confirmed.status === "completed" && amountOk) {
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
                payment_reference: String(confirmed.reference ?? txRef),
                payload: confirmed.raw as unknown as any,
              })
              .eq("payment_ref", txRef);

            await supabaseAdmin
              .from("entreprises")
              .update({
                plan: ab.plan,
                max_utilisateurs: planMaxUsers(ab.plan as "pro" | "business"),
                abonnement_expire_le: end.toISOString(),
              })
              .eq("id", ab.entreprise_id);
          } else if (
            confirmed.status === "cancelled" ||
            confirmed.status === "failed" ||
            (confirmed.status === "completed" && !amountOk)
          ) {
            await supabaseAdmin
              .from("abonnements")
              .update({ statut: confirmed.status === "cancelled" ? "annule" : "echec" })
              .eq("id", ab.id);
            await supabaseAdmin
              .from("paiements")
              .update({ statut: "echec", payload: confirmed.raw as unknown as any })
              .eq("payment_ref", txRef);
          }

          return new Response("ok", { status: 200 });
        } catch (err) {
          console.error("flutterwave-webhook error:", err);
          return new Response("Webhook error", { status: 500 });
        }
      },
      GET: async () => new Response("Flutterwave webhook endpoint", { status: 200 }),
    },
  },
});
