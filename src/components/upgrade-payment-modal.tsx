import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, Smartphone, CreditCard, ShieldCheck, RotateCcw, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { createPaymentInvoice, getPaydunyaModeFn } from "@/lib/paiements.functions";
import { toast } from "sonner";
import { PLANS } from "@/lib/plans";
import { fcfa } from "@/lib/format";
import { cn } from "@/lib/utils";

type Plan = "pro" | "business";
type Periode = "mensuel" | "annuel";
type Methode = "orange_money" | "carte_bancaire";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  plan: Plan;
  defaultPeriode?: Periode;
}

const FEATURES: Record<Plan, string[]> = {
  pro: [
    "Manuscrits illimités",
    "Contrats OHADA & Finances",
    "Jusqu'à 3 utilisateurs",
  ],
  business: [
    "Tout du plan Pro",
    "Utilisateurs illimités",
    "Export ePub + support prioritaire",
  ],
};

export function UpgradePaymentModal({ open, onOpenChange, plan, defaultPeriode = "mensuel" }: Props) {
  const planDef = PLANS[plan];
  const [periode, setPeriode] = useState<Periode>(defaultPeriode);
  const [methode, setMethode] = useState<Methode>("orange_money");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const createInvoice = useServerFn(createPaymentInvoice);

  useEffect(() => {
    if (!open) return;
    setPeriode(defaultPeriode);
    setMethode("orange_money");
    setPhone("");
  }, [open, defaultPeriode]);

  const amount = periode === "mensuel" ? planDef.monthlyFcfa : planDef.yearlyFcfa;
  const annualSavings = useMemo(() => planDef.monthlyFcfa * 12 - planDef.yearlyFcfa, [planDef]);

  const onPay = async () => {
    if (methode === "orange_money") {
      const cleaned = phone.replace(/\s+/g, "");
      if (!/^\+?\d{8,15}$/.test(cleaned)) {
        toast.error("Numéro de téléphone invalide");
        return;
      }
    }
    setLoading(true);
    try {
      const res = await createInvoice({ data: { plan, periode, methode, telephone: phone || null } });
      if (!res?.checkout_url) throw new Error("Lien de paiement invalide");
      window.location.href = res.checkout_url;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur lors de la création du paiement";
      toast.error(msg);
      setLoading(false);
    }
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
            <p className="text-sm text-muted-foreground">Débloquez toutes les fonctionnalités</p>
          </div>

          <div className="mb-4 flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-300">
            <ShieldCheck className="h-4 w-4" />
            <span className="font-medium">Paiement sécurisé par PayDunya</span>
          </div>



          {/* Plan summary */}
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

          {/* Payment method */}
          <div className="mb-5">
            <h3 className="text-sm font-semibold mb-2">Choisir votre moyen de paiement</h3>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => setMethode("orange_money")}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                  methode === "orange_money"
                    ? "border-orange-500 bg-orange-500/10 shadow-[0_0_0_3px_rgba(249,115,22,0.15)]"
                    : "border-border bg-background/30 hover:border-border/80",
                )}
              >
                <div className="h-10 w-10 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">Orange Money Mali</div>
                  <div className="text-xs text-muted-foreground">Paiement via votre compte Orange Money</div>
                </div>
              </button>
              {methode === "orange_money" && (
                <div className="px-1">
                  <Label className="text-xs">Numéro Orange Money</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+223 XX XX XX XX"
                    className="mt-1"
                    inputMode="tel"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() => setMethode("carte_bancaire")}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                  methode === "carte_bancaire"
                    ? "border-blue-500 bg-blue-500/10 shadow-[0_0_0_3px_rgba(59,130,246,0.15)]"
                    : "border-border bg-background/30 hover:border-border/80",
                )}
              >
                <div className="h-10 w-10 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">Carte Bancaire</div>
                  <div className="text-xs text-muted-foreground">Visa, Mastercard acceptées</div>
                </div>
              </button>
            </div>
          </div>

          {/* Order summary */}
          <div className="rounded-xl border border-border bg-background/40 p-4 mb-4 text-sm space-y-1.5">
            <div className="flex justify-between text-muted-foreground"><span>Plan</span><span className="text-foreground">{planDef.label}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Période</span><span className="text-foreground capitalize">{periode}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Montant</span><span className="text-foreground">{fcfa(amount)}</span></div>
            <div className="border-t border-border my-2" />
            <div className="flex justify-between items-center font-bold">
              <span>Total</span><span className="text-[color:var(--gold)] text-lg">{fcfa(amount)}</span>
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 pt-1">
              <Lock className="h-3 w-3" /> Paiement sécurisé par PayDunya
            </p>
          </div>

          {/* Pay button */}
          <Button
            onClick={onPay}
            disabled={loading}
            className="w-full h-12 text-base font-semibold"
            style={{ backgroundColor: "#00C896", color: "#0A1628" }}
          >
            {loading ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Traitement en cours...</>
            ) : (
              <>Payer {fcfa(amount)}</>
            )}
          </Button>

          {/* Security badges */}
          <div className="mt-4 grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Paiement 100% sécurisé</span>
            <span className="flex items-center gap-1"><Smartphone className="h-3 w-3" /> Orange Money Mali</span>
            <span className="flex items-center gap-1"><CreditCard className="h-3 w-3" /> Carte Bancaire</span>
            <span className="flex items-center gap-1"><RotateCcw className="h-3 w-3" /> Annulez à tout moment</span>
          </div>
          <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3 text-emerald-400" /> Vos données bancaires ne transitent jamais par FIGDITIONS
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
