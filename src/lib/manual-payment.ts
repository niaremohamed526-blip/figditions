// Manual QR-code payment (Orange Money / Wave) helpers : client-safe.
import { supabase } from "@/integrations/supabase/client";

/** Orange Money QR code (stored in the `logos` bucket). */
export const ORANGE_MONEY_QR_URL =
  "https://diklslghxbwbyqyzvygn.supabase.co/storage/v1/object/public/logos/payments%2Forange-money-qr.jpeg";

/** Wave QR code (stored in the `logos` bucket). */
export const WAVE_QR_URL =
  "https://diklslghxbwbyqyzvygn.supabase.co/storage/v1/object/public/logos/payments%2Fwave-qr.png";

export type PaymentMethod = "orange_money" | "wave";

export interface PaymentMethodDef {
  id: PaymentMethod;
  label: string;
  color: string;
  qr: string;
  phone: string;
}

export const PAYMENT_METHODS: Record<PaymentMethod, PaymentMethodDef> = {
  orange_money: {
    id: "orange_money",
    label: "Orange Money Mali",
    color: "#FF6600",
    qr: ORANGE_MONEY_QR_URL,
    phone: "+223 82 87 65 46",
  },
  wave: {
    id: "wave",
    label: "Wave Mali",
    color: "#1DC8FF",
    qr: WAVE_QR_URL,
    phone: "+223 82 87 65 46",
  },
};

/** Numéro WhatsApp FIGDITIONS pour les notifications de paiement (Mali). */
export const FIGDITIONS_WHATSAPP = "22382876546";
export const FIGDITIONS_EMAIL = "figditions@gmail.com";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Référence unique de 10 caractères : FIG-XXXXXX + horodatage court. */
export function generatePaymentReference(): string {
  const rnd = Array.from({ length: 6 }, () =>
    ALPHABET[Math.floor(Math.random() * ALPHABET.length)],
  ).join("");
  const stamp = Date.now().toString(36).slice(-4).toUpperCase();
  return `FIG-${rnd}${stamp}`;
}

export interface QrPaymentInput {
  plan: "pro" | "business";
  periode: "mensuel" | "annuel";
  montant: number;
  reference: string;
  userEmail: string | null;
  methode: PaymentMethod;
}

interface RpcResult {
  ok: boolean;
  error?: string;
  id?: string;
  reference?: string;
}

const rpc = supabase.rpc.bind(supabase) as unknown as (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

export async function createQrPaymentRequest(input: QrPaymentInput): Promise<RpcResult> {
  const { data, error } = await rpc("create_qr_payment_request", {
    p_plan: input.plan,
    p_periode: input.periode,
    p_montant: input.montant,
    p_reference: input.reference,
    p_user_email: input.userEmail,
    p_methode: input.methode,
  });
  if (error) return { ok: false, error: error.message };
  return (data as RpcResult) ?? { ok: false, error: "Réponse invalide" };
}

export interface PendingQrPayment {
  id: string;
  reference_paiement: string;
  plan_demande: string;
  periode: string;
  montant_fcfa: number;
  created_at: string;
}

export async function fetchMyPendingQrPayment(): Promise<PendingQrPayment | null> {
  const { data, error } = await rpc("my_pending_qr_payment");
  if (error) return null;
  return (data as PendingQrPayment | null) ?? null;
}

export interface AdminPaiementRow {
  id: string;
  created_at: string;
  entreprise_id: string;
  entreprise_nom: string | null;
  entreprise_plan: string | null;
  user_email: string | null;
  plan_demande: string | null;
  periode: string | null;
  montant_fcfa: number;
  reference_paiement: string | null;
  methode_paiement: string | null;
  statut: string;
  raison_rejet: string | null;
  confirme_le: string | null;
}

export async function adminListPaiements(statut?: string): Promise<AdminPaiementRow[]> {
  const { data, error } = await rpc("admin_list_paiements", { p_statut: statut ?? null });
  if (error) throw new Error(error.message);
  return (data as AdminPaiementRow[]) ?? [];
}

export interface AdminStats {
  pending: number;
  confirmed_month: number;
  revenue_month: number;
  active_subs: number;
}

export async function adminPaiementsStats(): Promise<AdminStats> {
  const { data, error } = await rpc("admin_paiements_stats");
  if (error) throw new Error(error.message);
  return data as AdminStats;
}

export async function adminConfirmPaiement(id: string): Promise<RpcResult> {
  const { data, error } = await rpc("admin_confirm_paiement", { p_id: id });
  if (error) return { ok: false, error: error.message };
  return (data as RpcResult) ?? { ok: false, error: "Réponse invalide" };
}

export async function adminRejectPaiement(id: string, raison: string): Promise<RpcResult> {
  const { data, error } = await rpc("admin_reject_paiement", { p_id: id, p_raison: raison });
  if (error) return { ok: false, error: error.message };
  return (data as RpcResult) ?? { ok: false, error: "Réponse invalide" };
}

/** Message prérempli envoyé à FIGDITIONS après le paiement. */
export function paymentMessage(args: {
  reference: string;
  plan: string;
  periode: string;
  montant: string;
  entreprise: string;
  email: string | null;
  methode: PaymentMethod;
}): string {
  const methode = PAYMENT_METHODS[args.methode];
  return [
    "Bonjour FIGDITIONS,",
    "",
    `Je viens d'effectuer un paiement par ${methode.label}.`,
    `Méthode : ${args.methode === "wave" ? "Wave" : "Orange Money"}`,
    `Référence : ${args.reference}`,
    `Maison d'édition : ${args.entreprise}`,
    `Plan : ${args.plan} (${args.periode})`,
    `Montant : ${args.montant}`,
    args.email ? `Email du compte : ${args.email}` : "",
    "",
    "Merci d'activer mon abonnement.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function whatsappLink(message: string): string {
  return `https://wa.me/${FIGDITIONS_WHATSAPP}?text=${encodeURIComponent(message)}`;
}

export function mailtoLink(subject: string, message: string): string {
  return `mailto:${FIGDITIONS_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
}
