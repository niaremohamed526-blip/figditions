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
            {isSuccess ? "Paiement réussi !" : "Paiement annulé"}
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
