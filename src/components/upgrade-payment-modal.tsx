import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Loader2, Lock, Smartphone, ShieldCheck, Sparkles, Ticket, ChevronDown, CheckCircle2,
  Copy, MessageCircle, Mail, Clock, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { PLANS } from "@/lib/plans";
import { fcfa } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PromoCodeCard } from "@/components/promo-code-card";
import { useAuth, useProfile } from "@/hooks/use-auth";
import {
  PAYMENT_METHODS, createQrPaymentRequest, generatePaymentReference,
  mailtoLink, paymentMessage, whatsappLink, type PaymentMethod,
} from "@/lib/manual-payment";

type Plan = "pro" | "business";
type Periode = "mensuel" | "annuel";
type Step = "choix" | "qr" | "confirme";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  plan: Plan;
  defaultPeriode?: Periode;
}

const FEATURES: Record<Plan, string[]> = {
  pro: ["Manuscrits illimités", "Contrats & Droits & Finances", "Jusqu'à 3 utilisateurs"],
  business: ["Tout du plan Pro", "Utilisateurs illimités", "Export ePub + support prioritaire"],
};

export function UpgradePaymentModal({ open, onOpenChange, plan, defaultPeriode = "mensuel" }: Props) {
  const planDef = PLANS[plan];
  const { user } = useAuth();
  const { profile, entreprise } = useProfile(user?.id);
  const isAdmin = profile?.role === "admin";

  const [periode, setPeriode] = useState<Periode>(defaultPeriode);
  const [methode, setMethode] = useState<PaymentMethod>("orange_money");
  const [step, setStep] = useState<Step>("choix");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoApplied, setPromoApplied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPeriode(defaultPeriode);
    setMethode("orange_money");
    setStep("choix");
    setReference("");
    setLoading(false);
    setPromoOpen(false);
    setPromoApplied(false);
  }, [open, defaultPeriode]);

  const m = PAYMENT_METHODS[methode];

  const amount = periode === "mensuel" ? planDef.monthlyFcfa : planDef.yearlyFcfa;
  const annualSavings = useMemo(() => planDef.monthlyFcfa * 12 - planDef.yearlyFcfa, [planDef]);

  const message = useMemo(
    () =>
      paymentMessage({
        reference,
        plan: planDef.label,
        periode,
        montant: fcfa(amount),
        entreprise: entreprise?.nom ?? "—",
        email: user?.email ?? null,
        methode,
      }),
    [reference, planDef.label, periode, amount, entreprise?.nom, user?.email, methode],
  );

  const startPayment = async () => {
    const ref = generatePaymentReference();
    setLoading(true);
    const res = await createQrPaymentRequest({
      plan,
      periode,
      montant: amount,
      reference: ref,
      userEmail: user?.email ?? null,
      methode,
    });
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error ?? "Impossible de créer la demande de paiement");
      return;
    }
    setReference(ref);
    setStep("qr");
  };

  const copyRef = () => {
    navigator.clipboard.writeText(reference);
    toast.success("Référence copiée");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <DialogContent
        className="max-w-[520px] p-0 overflow-hidden border-[color:var(--gold)]/30 bg-card/95 backdrop-blur-xl"
        style={{ borderRadius: 16 }}
      >
        <DialogTitle className="sr-only">Passer au plan {planDef.label}</DialogTitle>
        <div className="p-6 max-h-[85vh] overflow-y-auto">
          {/* Header */}
          <div className="text-center mb-5">
            <div className={cn("mx-auto h-12 w-12 rounded-xl border flex items-center justify-center mb-3", planDef.badgeClass)}>
              <Sparkles className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold">Passer au plan {planDef.label}</h2>
            <p className="text-sm text-muted-foreground">
              {step === "choix" ? "Débloquez toutes les fonctionnalités" : `Paiement par ${m.label}`}
            </p>
          </div>

          <div
            className="mb-4 flex items-center justify-center gap-1.5 rounded-lg border p-2.5 text-xs"
            style={{ borderColor: `${m.color}55`, backgroundColor: `${m.color}1A`, color: m.color }}
          >
            <ShieldCheck className="h-4 w-4" />
            <span className="font-medium">Paiement {m.label} — validation manuelle par FIGDITIONS</span>
          </div>

          {/* ---------- Étape 1 : choix ---------- */}
          {step === "choix" && !promoApplied && (
            <>
              <div className="rounded-xl border border-border bg-background/40 p-4 mb-5">
                <div className="flex items-center justify-between mb-3">
                  <span className={cn("text-xs font-semibold border rounded-full px-2 py-0.5", planDef.badgeClass)}>{planDef.label}</span>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-[color:var(--gold)]">{fcfa(amount)}</div>
                    <div className="text-[11px] text-muted-foreground">/ {periode}</div>
                  </div>
                </div>

                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setPeriode("mensuel")}
                    className={cn(
                      "flex-1 py-2 rounded-md text-sm border transition-colors",
                      periode === "mensuel" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
                    )}
                  >
                    Mensuel
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriode("annuel")}
                    className={cn(
                      "flex-1 py-2 rounded-md text-sm border transition-colors relative",
                      periode === "annuel" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
                    )}
                  >
                    Annuel <span className="text-[10px] ml-1 opacity-80">(-2 mois)</span>
                  </button>
                </div>

                <ul className="space-y-1.5 text-sm">
                  {FEATURES[plan].map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {f}
                    </li>
                  ))}
                </ul>

                {periode === "annuel" && annualSavings > 0 && (
                  <div className="mt-3 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-2 py-1 inline-block">
                    Vous économisez {fcfa(annualSavings)} / an
                  </div>
                )}
              </div>

              {/* Méthode de paiement */}
              <div className="mb-5">
                <div className="text-sm font-medium mb-2">Méthode de paiement</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(Object.values(PAYMENT_METHODS)).map((pm) => {
                    const active = methode === pm.id;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setMethode(pm.id)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all",
                          active ? "shadow-lg" : "border-border hover:border-muted-foreground/40",
                        )}
                        style={active ? { borderColor: pm.color, backgroundColor: `${pm.color}14` } : undefined}
                      >
                        <span
                          className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: pm.color }}
                        >
                          <Smartphone className="h-5 w-5 text-white" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold truncate">{pm.label}</span>
                          <span className="block text-[11px] text-muted-foreground">{pm.phone}</span>
                        </span>
                        {active && <CheckCircle2 className="ml-auto h-4 w-4" style={{ color: pm.color }} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Promo code collapsible */}
              <div className="mb-5">
                <button
                  type="button"
                  onClick={() => setPromoOpen((v) => !v)}
                  className="flex items-center gap-1.5 text-sm font-medium hover:opacity-80 transition-opacity"
                  style={{ color: "#C8922A" }}
                >
                  <Ticket className="h-4 w-4" />
                  <span>🎟️ J'ai un code promotionnel</span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", promoOpen && "rotate-180")} />
                </button>
                {promoOpen && (
                  <div className="mt-3 animate-fade-in">
                    <PromoCodeCard
                      entrepriseId={profile?.entreprise_id}
                      isAdmin={isAdmin}
                      compact
                      onSuccess={() => {
                        setPromoApplied(true);
                        setTimeout(() => onOpenChange(false), 2500);
                      }}
                    />
                  </div>
                )}
              </div>

              <Button
                onClick={startPayment}
                disabled={loading || !isAdmin}
                className="w-full h-12 text-base font-semibold"
                style={{ backgroundColor: "#C8922A", color: "#0D0A06" }}
              >
                {loading ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Préparation...</>
                ) : (
                  <><Smartphone className="h-5 w-5" /> Payer {fcfa(amount)} par {m.id === "wave" ? "Wave" : "Orange Money"}</>
                )}
              </Button>
              {!isAdmin && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Seul un administrateur peut souscrire un plan.
                </p>
              )}
            </>
          )}

          {/* ---------- Étape 2 : QR code ---------- */}
          {step === "qr" && (
            <div className="space-y-4">
              <ol className="text-sm space-y-1.5 text-muted-foreground">
                <li>1. Scannez le QR code ci-dessous avec {m.id === "wave" ? "l'application Wave" : "Orange Money"}, ou payez au {m.phone}.</li>
                <li>2. Payez exactement <span className="text-foreground font-semibold">{fcfa(amount)}</span>.</li>
                <li>3. Envoyez-nous votre référence pour activation.</li>
              </ol>

              <div
                className="rounded-2xl border-2 bg-background/50 p-4 flex flex-col items-center"
                style={{ borderColor: `${m.color}66` }}
              >
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: m.color }}>
                  <span className="h-6 w-6 rounded-full flex items-center justify-center" style={{ backgroundColor: m.color }}>
                    <Smartphone className="h-3.5 w-3.5 text-white" />
                  </span>
                  {m.label}
                </div>
                <img
                  src={m.qr}
                  alt={`QR code ${m.label} FIGDITIONS`}
                  className="w-56 h-56 object-contain rounded-xl bg-white p-2"
                  loading="lazy"
                />
                <div className="mt-3 text-center">
                  <div className="text-2xl font-bold text-[color:var(--gold)]">{fcfa(amount)}</div>
                  <div className="text-[11px] text-muted-foreground">{planDef.label} · {periode}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{m.phone}</div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background/40 p-4">
                <div className="text-xs text-muted-foreground mb-1">Votre référence de paiement</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-base font-bold tracking-wider text-[color:var(--gold)]">{reference}</code>
                  <Button variant="outline" size="sm" onClick={copyRef} className="min-h-9">
                    <Copy className="h-4 w-4" /> Copier
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Indiquez cette référence dans le motif du paiement, puis envoyez-la nous.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button asChild className="h-11 bg-emerald-600 text-white hover:bg-emerald-600/90">
                  <a href={whatsappLink(message)} target="_blank" rel="noreferrer">
                    <MessageCircle className="h-4 w-4" /> Envoyer sur WhatsApp
                  </a>
                </Button>
                <Button asChild variant="outline" className="h-11">
                  <a href={mailtoLink(`Paiement ${reference} — FIGDITIONS`, message)}>
                    <Mail className="h-4 w-4" /> Envoyer par email
                  </a>
                </Button>
              </div>

              <Button
                onClick={() => setStep("confirme")}
                className="w-full h-12 text-base font-semibold"
                style={{ backgroundColor: "#C8922A", color: "#0D0A06" }}
              >
                <CheckCircle2 className="h-5 w-5" /> J'ai effectué le paiement
              </Button>

              <button
                type="button"
                onClick={() => setStep("choix")}
                className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" /> Revenir au choix du plan
              </button>
            </div>
          )}

          {/* ---------- Étape 3 : en attente ---------- */}
          {step === "confirme" && (
            <div className="rounded-xl border border-orange-500/40 bg-orange-500/10 p-5 text-center animate-fade-in">
              <Clock className="h-10 w-10 text-orange-400 mx-auto mb-2" />
              <div className="font-semibold text-base">Paiement en cours de vérification</div>
              <p className="text-sm text-muted-foreground mt-1">
                Votre référence <span className="text-[color:var(--gold)] font-semibold">{reference}</span> a été enregistrée.
                Votre plan sera activé après vérification (généralement sous 24h).
              </p>
              <Button variant="outline" className="mt-4" onClick={() => onOpenChange(false)}>
                Fermer
              </Button>
            </div>
          )}

          {promoApplied && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-5 text-center animate-fade-in">
              <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
              <div className="font-semibold text-base">Code appliqué — Aucun paiement requis</div>
              <p className="text-sm text-muted-foreground mt-1">Votre plan est activé gratuitement.</p>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Paiement 100% sécurisé</span>
            <span className="flex items-center gap-1"><Smartphone className="h-3 w-3" /> {m.label}</span>
          </div>
          <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3 text-emerald-400" /> Vos données bancaires ne transitent jamais par FIGDITIONS
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
