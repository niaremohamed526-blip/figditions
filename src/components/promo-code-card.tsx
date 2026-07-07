import { useState } from "react";
import confetti from "canvas-confetti";
import { Loader2, CheckCircle2, Ticket, Sparkles, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { notifyEntrepriseUpdated } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface Props {
  entrepriseId: string | null | undefined;
  isAdmin: boolean;
  compact?: boolean;
  onSuccess?: (result: { plan: string; periode: string }) => void;
}

function fireConfetti() {
  const colors = ["#C8922A", "#E8B84B", "#FFFFFF", "#A67420"];
  const end = Date.now() + 1500;
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 65, origin: { x: 0, y: 0.6 }, colors });
    confetti({ particleCount: 4, angle: 120, spread: 65, origin: { x: 1, y: 0.6 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

export function PromoCodeCard({ entrepriseId, isAdmin, compact = false, onSuccess }: Props) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ plan: string } | null>(null);

  const apply = async () => {
    setError(null);
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Veuillez entrer un code");
      return;
    }
    if (!entrepriseId) {
      setError("Entreprise introuvable");
      return;
    }
    if (!isAdmin) {
      setError("Seul un admin peut utiliser un code promotionnel");
      return;
    }
    setLoading(true);
    const { data, error: rpcErr } = await supabase.rpc("redeem_promo_code", {
      p_code: trimmed,
      p_entreprise_id: entrepriseId,
    });
    setLoading(false);

    if (rpcErr) {
      setError(rpcErr.message || "Erreur lors de la validation");
      return;
    }
    const result = data as { success: boolean; error?: string; plan?: string; periode?: string };
    if (!result?.success) {
      setError(result?.error || "Code invalide");
      return;
    }
    const planLabel = (result.plan ?? "business").charAt(0).toUpperCase() + (result.plan ?? "business").slice(1);
    setSuccess({ plan: planLabel });
    fireConfetti();
    notifyEntrepriseUpdated();
    toast.success(`🎉 Bienvenue dans le plan ${planLabel} !`, {
      description: "Toutes les fonctionnalités sont débloquées.",
      duration: 5000,
      style: { borderLeft: "4px solid #C8922A" },
    });
    onSuccess?.({ plan: result.plan ?? "business", periode: result.periode ?? "a_vie" });
  };

  if (success) {
    return (
      <div
        className="rounded-2xl border p-6 animate-fade-in"
        style={{
          background: "linear-gradient(135deg, rgba(200,146,42,0.15), rgba(16,185,129,0.1))",
          border: "1px solid rgba(200,146,42,0.4)",
        }}
      >
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-[color:var(--gold)]/20 text-[color:var(--gold)] flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <div className="font-semibold text-base">Code appliqué avec succès !</div>
            <p className="text-sm text-muted-foreground mt-1">
              Votre plan <span className="text-[color:var(--gold)] font-medium">{success.plan}</span> est
              maintenant actif. Profitez de toutes les fonctionnalités !
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("rounded-2xl", compact ? "" : "border p-6")}
      style={
        compact
          ? undefined
          : {
              background: "rgba(26,18,8,0.6)",
              border: "1px solid rgba(200,146,42,0.2)",
            }
      }
    >
      {!compact && (
        <>
          <div className="flex items-center gap-2 mb-1">
            <Ticket className="h-5 w-5 text-[color:var(--gold)]" />
            <h3 className="text-base font-semibold text-white">Code Promotionnel</h3>
          </div>
          <p className="text-[13px] mb-5" style={{ color: "#B8A898" }}>
            Entrez un code pour activer un plan ou obtenir un accès spécial
          </p>
        </>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && apply()}
          placeholder="Entrez votre code promo"
          disabled={loading}
          style={{
            background: "rgba(200,146,42,0.05)",
            border: "1px solid rgba(200,146,42,0.2)",
            borderRadius: "10px",
            padding: "12px 16px",
            color: "white",
            fontSize: "14px",
            letterSpacing: "2px",
            textTransform: "uppercase",
            flex: 1,
            outline: "none",
          }}
          className="focus:border-[color:var(--gold)]/60 placeholder:normal-case placeholder:tracking-normal placeholder:text-white/40"
        />
        <button
          type="button"
          onClick={apply}
          disabled={loading || !code.trim()}
          style={{
            background: "linear-gradient(135deg, #C8922A, #A67420)",
            borderRadius: "10px",
            padding: "12px 24px",
            color: "white",
            fontWeight: 600,
            fontSize: "14px",
            whiteSpace: "nowrap",
            opacity: loading || !code.trim() ? 0.6 : 1,
            cursor: loading || !code.trim() ? "not-allowed" : "pointer",
          }}
          className="inline-flex items-center justify-center gap-2"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Vérification...</>
          ) : (
            <><Sparkles className="h-4 w-4" /> Appliquer</>
          )}
        </button>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-sm text-destructive animate-fade-in">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
