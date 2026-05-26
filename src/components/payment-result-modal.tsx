import { useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";

interface Props {
  status: "success" | "cancelled" | null;
  onClose: () => void;
  onRetry?: () => void;
}

export function PaymentResultModal({ status, onClose, onRetry }: Props) {
  // Confetti via emojis — no extra dependency
  useEffect(() => {
    if (status !== "success") return;
    const root = document.createElement("div");
    root.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;";
    document.body.appendChild(root);
    const emojis = ["🎉", "✨", "🎊", "⭐", "💚"];
    for (let i = 0; i < 30; i++) {
      const s = document.createElement("span");
      s.textContent = emojis[i % emojis.length];
      s.style.cssText = `position:absolute;left:${Math.random() * 100}%;top:-10%;font-size:${16 + Math.random() * 20}px;transition:transform 2.5s ease-out,opacity 2.5s;opacity:1;`;
      root.appendChild(s);
      requestAnimationFrame(() => {
        s.style.transform = `translateY(${110 + Math.random() * 20}vh) rotate(${Math.random() * 720}deg)`;
        s.style.opacity = "0";
      });
    }
    const t = setTimeout(() => root.remove(), 3000);
    return () => { clearTimeout(t); root.remove(); };
  }, [status]);

  const isOpen = status !== null;
  const isSuccess = status === "success";

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md bg-card border-border text-center">
        <DialogTitle className="sr-only">{isSuccess ? "Paiement réussi" : "Paiement annulé"}</DialogTitle>
        <div className="py-4">
          {isSuccess ? (
            <div className="mx-auto h-20 w-20 rounded-full bg-emerald-500/15 border-2 border-emerald-500 flex items-center justify-center animate-[scale-in_0.4s_ease-out]">
              <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            </div>
          ) : (
            <div className="mx-auto h-20 w-20 rounded-full bg-destructive/15 border-2 border-destructive flex items-center justify-center">
              <XCircle className="h-12 w-12 text-destructive" />
            </div>
          )}
          <h2 className="mt-4 text-2xl font-bold">
            {isSuccess ? "Paiement réussi ! 🎉" : "Paiement annulé"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {isSuccess
              ? "Votre plan est en cours d'activation. Les fonctionnalités seront débloquées dans quelques secondes."
              : "Votre paiement n'a pas été complété. Aucun montant n'a été débité."}
          </p>
          <div className="mt-6 flex justify-center gap-2">
            {!isSuccess && onRetry && (
              <Button variant="outline" onClick={onClose}>Annuler</Button>
            )}
            {isSuccess ? (
              <Button onClick={onClose} className="bg-primary text-primary-foreground hover:bg-primary/90">
                Commencer à utiliser
              </Button>
            ) : (
              <Button onClick={() => { onClose(); onRetry?.(); }} className="bg-primary text-primary-foreground hover:bg-primary/90">
                Réessayer
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
