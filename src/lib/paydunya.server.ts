// PayDunya server-only helpers. NEVER import from client code.

export type PaydunyaMode = "test" | "live";

export interface PaydunyaCredentials {
  masterKey: string;
  privateKey: string;
  token: string;
  mode: PaydunyaMode;
  appUrl: string;
}

export function getPaydunyaCredentials(): PaydunyaCredentials {
  const masterKey = process.env.PAYDUNYA_MASTER_KEY;
  const privateKey = process.env.PAYDUNYA_PRIVATE_KEY;
  const token = process.env.PAYDUNYA_TOKEN;
  const modeRaw = (process.env.PAYDUNYA_MODE || "test").toLowerCase();
  const mode: PaydunyaMode = modeRaw === "live" ? "live" : "test";
  const appUrl = process.env.APP_URL || "https://example.com";

  if (!masterKey || !privateKey || !token) {
    throw new Error("PayDunya credentials missing (PAYDUNYA_MASTER_KEY / PAYDUNYA_PRIVATE_KEY / PAYDUNYA_TOKEN)");
  }
  return { masterKey, privateKey, token, mode, appUrl };
}

export function paydunyaBaseUrl(mode: PaydunyaMode): string {
  return mode === "live"
    ? "https://app.paydunya.com/api/v1"
    : "https://app.paydunya.com/sandbox-api/v1";
}

function paydunyaHeaders(creds: PaydunyaCredentials): Record<string, string> {
  return {
    "PAYDUNYA-MASTER-KEY": creds.masterKey,
    "PAYDUNYA-PRIVATE-KEY": creds.privateKey,
    "PAYDUNYA-TOKEN": creds.token,
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
}

export async function createPaydunyaInvoice(args: CreateInvoiceArgs): Promise<{
  token: string;
  checkoutUrl: string;
  raw: unknown;
}> {
  const creds = getPaydunyaCredentials();
  const base = paydunyaBaseUrl(creds.mode);

  const itemName = `Abonnement FIGDITIONS ${args.plan} - ${args.periode}`;
  const payload = {
    invoice: {
      items: {
        item_0: {
          name: itemName,
          quantity: 1,
          unit_price: args.amount,
          total_price: args.amount,
          description: `Abonnement ${args.plan} ${args.periode} FIGDITIONS`,
        },
      },
      taxes: {},
      total_amount: args.amount,
      description: `Abonnement FIGDITIONS Plan ${args.plan}`,
    },
    store: {
      name: "FIGDITIONS",
      tagline: "La plateforme éditoriale de l'Afrique de l'Ouest",
      postal_address: "Bamako, Mali",
    },
    actions: {
      cancel_url: `${creds.appUrl}/parametres?payment=cancelled`,
      return_url: `${creds.appUrl}/parametres?payment=success`,
      callback_url: `${creds.appUrl}/api/public/paydunya-webhook`,
    },
    custom_data: {
      entreprise_id: args.entrepriseId,
      entreprise_nom: args.entrepriseNom,
      plan: args.plan,
      periode: args.periode,
      user_email: args.userEmail,
      user_nom: args.userNom,
    },
  };

  const res = await fetch(`${base}/checkout-invoice/create`, {
    method: "POST",
    headers: paydunyaHeaders(creds),
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as {
    response_code?: string;
    response_text?: string;
    token?: string;
    description?: string;
  };

  if (!res.ok || data.response_code !== "00" || !data.token) {
    throw new Error(`PayDunya invoice creation failed: ${data.response_text || data.description || res.status}`);
  }

  const checkoutUrl =
    creds.mode === "live"
      ? `https://paydunya.com/checkout/invoice/${data.token}`
      : `https://paydunya.com/sandbox-checkout/invoice/${data.token}`;

  return { token: data.token, checkoutUrl, raw: data };
}

export async function confirmPaydunyaInvoice(token: string): Promise<{
  status: "completed" | "cancelled" | "pending" | "failed";
  raw: Record<string, unknown>;
  customer_email?: string;
  invoice_total?: number;
  custom_data?: Record<string, unknown>;
}> {
  const creds = getPaydunyaCredentials();
  const base = paydunyaBaseUrl(creds.mode);
  const res = await fetch(`${base}/checkout-invoice/confirm/${token}`, {
    method: "GET",
    headers: paydunyaHeaders(creds),
  });
  const data = (await res.json()) as Record<string, unknown>;
  const statusRaw = String(data.status || "pending").toLowerCase();
  let status: "completed" | "cancelled" | "pending" | "failed" = "pending";
  if (statusRaw === "completed") status = "completed";
  else if (statusRaw === "cancelled") status = "cancelled";
  else if (statusRaw === "failed") status = "failed";

  const invoice = (data.invoice as Record<string, unknown> | undefined) ?? {};
  return {
    status,
    raw: data,
    customer_email: (data.customer as Record<string, unknown> | undefined)?.email as string | undefined,
    invoice_total: Number(invoice.total_amount ?? 0),
    custom_data: (data.custom_data as Record<string, unknown> | undefined) ?? {},
  };
}

export function planPrice(plan: "pro" | "business", periode: "mensuel" | "annuel"): number {
  if (plan === "pro") return periode === "mensuel" ? 20000 : 200000;
  return periode === "mensuel" ? 50000 : 500000;
}

export function planMaxUsers(plan: "pro" | "business"): number {
  return plan === "pro" ? 3 : 999;
}

export function getPaydunyaMode(): PaydunyaMode {
  const m = (process.env.PAYDUNYA_MODE || "test").toLowerCase();
  return m === "live" ? "live" : "test";
}
