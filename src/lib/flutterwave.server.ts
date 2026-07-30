// Flutterwave server-only helpers. NEVER import from client code.

export type FlutterwaveMode = "test" | "live";

export interface FlutterwaveCredentials {
  secretKey: string;
  secretHash: string | null;
  mode: FlutterwaveMode;
  appUrl: string;
}

const FLW_BASE = "https://api.flutterwave.com/v3";

export function getFlutterwaveCredentials(): FlutterwaveCredentials {
  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
  const secretHash = process.env.FLUTTERWAVE_SECRET_HASH || null;
  const appUrl = process.env.APP_URL || "https://example.com";

  if (!secretKey) {
    throw new Error("Clé Flutterwave manquante (FLUTTERWAVE_SECRET_KEY)");
  }

  // Flutterwave keys are prefixed FLWSECK_TEST- in test mode.
  const mode: FlutterwaveMode = secretKey.toUpperCase().includes("_TEST") ? "test" : "live";

  return { secretKey, secretHash, mode, appUrl };
}

function flwHeaders(creds: FlutterwaveCredentials): Record<string, string> {
  return {
    Authorization: `Bearer ${creds.secretKey}`,
    "Content-Type": "application/json",
  };
}

export interface CreateInvoiceArgs {
  plan: "pro" | "business";
  periode: "mensuel" | "annuel";
  amount: number;
  entrepriseId: string;
  entrepriseNom: string;
  userEmail: string;
  userNom: string;
  telephone?: string | null;
  methode: "orange_money" | "carte_bancaire";
}

/** Maps our UI method to Flutterwave payment_options. */
function paymentOptions(methode: CreateInvoiceArgs["methode"]): string {
  return methode === "orange_money"
    ? "mobilemoneyfranco,card"
    : "card,mobilemoneyfranco";
}

export async function createFlutterwavePayment(args: CreateInvoiceArgs): Promise<{
  txRef: string;
  checkoutUrl: string;
  raw: unknown;
}> {
  const creds = getFlutterwaveCredentials();
  const txRef = `FIG-${args.entrepriseId.slice(0, 8)}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const payload = {
    tx_ref: txRef,
    amount: args.amount,
    currency: "XOF",
    redirect_url: `${creds.appUrl}/parametres?payment=return`,
    payment_options: paymentOptions(args.methode),
    customer: {
      email: args.userEmail,
      name: args.userNom,
      phonenumber: args.telephone || undefined,
    },
    customizations: {
      title: "FIGDITIONS",
      description: `Abonnement FIGDITIONS ${args.plan} - ${args.periode}`,
    },
    meta: {
      entreprise_id: args.entrepriseId,
      entreprise_nom: args.entrepriseNom,
      plan: args.plan,
      periode: args.periode,
      user_email: args.userEmail,
    },
  };

  const res = await fetch(`${FLW_BASE}/payments`, {
    method: "POST",
    headers: flwHeaders(creds),
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as {
    status?: string;
    message?: string;
    data?: { link?: string };
  };

  if (!res.ok || data.status !== "success" || !data.data?.link) {
    throw new Error(
      `Création du paiement Flutterwave échouée: ${data.message || res.status}`,
    );
  }

  return { txRef, checkoutUrl: data.data.link, raw: data };
}

export interface VerifiedTransaction {
  status: "completed" | "cancelled" | "pending" | "failed";
  raw: Record<string, unknown>;
  amount: number;
  currency: string;
  customer_email?: string;
  reference?: string;
  meta?: Record<string, unknown>;
}

/** Source of truth: re-verify a transaction against Flutterwave by our tx_ref. */
export async function verifyFlutterwaveByReference(txRef: string): Promise<VerifiedTransaction> {
  const creds = getFlutterwaveCredentials();
  const res = await fetch(
    `${FLW_BASE}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
    { method: "GET", headers: flwHeaders(creds) },
  );
  const body = (await res.json()) as {
    status?: string;
    message?: string;
    data?: Record<string, unknown>;
  };

  const tx = body.data ?? {};
  const rawStatus = String(tx.status ?? "pending").toLowerCase();
  let status: VerifiedTransaction["status"] = "pending";
  if (rawStatus === "successful") status = "completed";
  else if (rawStatus === "cancelled") status = "cancelled";
  else if (rawStatus === "failed") status = "failed";

  return {
    status,
    raw: body as unknown as Record<string, unknown>,
    amount: Number(tx.amount ?? 0),
    currency: String(tx.currency ?? "XOF"),
    customer_email: (tx.customer as Record<string, unknown> | undefined)?.email as
      | string
      | undefined,
    reference: (tx.flw_ref as string | undefined) ?? (tx.id ? String(tx.id) : undefined),
    meta: (tx.meta as Record<string, unknown> | undefined) ?? {},
  };
}

export function planPrice(plan: "pro" | "business", periode: "mensuel" | "annuel"): number {
  if (plan === "pro") return periode === "mensuel" ? 20000 : 200000;
  return periode === "mensuel" ? 50000 : 500000;
}

export function planMaxUsers(plan: "pro" | "business"): number {
  return plan === "pro" ? 3 : 999;
}

export function getFlutterwaveMode(): FlutterwaveMode {
  const key = process.env.FLUTTERWAVE_SECRET_KEY || "";
  return key.toUpperCase().includes("_TEST") || !key ? "test" : "live";
}
