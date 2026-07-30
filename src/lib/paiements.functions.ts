import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createFlutterwavePayment,
  getFlutterwaveMode,
  planPrice,
} from "./flutterwave.server";

const createInvoiceSchema = z.object({
  plan: z.enum(["pro", "business"]),
  periode: z.enum(["mensuel", "annuel"]),
  methode: z.enum(["orange_money", "carte_bancaire"]),
  telephone: z.string().trim().max(40).optional().nullable(),
});

export const createPaymentInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createInvoiceSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch profile + entreprise via authenticated client (RLS scoped)
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("id, full_name, entreprise_id, role")
      .eq("id", userId)
      .maybeSingle();
    if (pErr || !profile?.entreprise_id) {
      throw new Error("Profil ou entreprise introuvable");
    }
    if (profile.role !== "admin") {
      throw new Error("Seul un admin peut souscrire un plan");
    }

    const { data: ent, error: eErr } = await supabase
      .from("entreprises")
      .select("id, nom, email")
      .eq("id", profile.entreprise_id)
      .maybeSingle();
    if (eErr || !ent) throw new Error("Entreprise introuvable");

    // Get email from auth
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userEmail = user?.email ?? ent.email ?? "client@figditions.app";

    const amount = planPrice(data.plan, data.periode);

    const payment = await createFlutterwavePayment({
      plan: data.plan,
      periode: data.periode,
      amount,
      entrepriseId: ent.id,
      entrepriseNom: ent.nom,
      userEmail,
      userNom: profile.full_name ?? "Client",
      telephone: data.telephone,
      methode: data.methode,
    });

    // Persist via admin (no user UPDATE policy on abonnements)
    const { data: ab, error: abErr } = await supabaseAdmin
      .from("abonnements")
      .insert({
        entreprise_id: ent.id,
        plan: data.plan,
        periode: data.periode,
        montant_fcfa: amount,
        statut: "en_attente",
        provider: "flutterwave",
        payment_ref: payment.txRef,
        checkout_url: payment.checkoutUrl,
        created_by: userId,
      })
      .select("id")
      .single();
    if (abErr || !ab) throw new Error(`Erreur enregistrement abonnement: ${abErr?.message}`);

    await supabaseAdmin.from("paiements").insert({
      abonnement_id: ab.id,
      entreprise_id: ent.id,
      montant_fcfa: amount,
      methode: data.methode,
      statut: "en_attente",
      provider: "flutterwave",
      payment_ref: payment.txRef,
    });

    return {
      token: payment.txRef,
      checkout_url: payment.checkoutUrl,
      mode: getFlutterwaveMode(),
      abonnement_id: ab.id,
    };
  });

export const getPaymentModeFn = createServerFn({ method: "GET" }).handler(async () => {
  return { mode: getFlutterwaveMode() };
});
