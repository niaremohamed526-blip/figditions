import { useEffect, useState } from "react";
import { Loader2, Ban } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const MIN = 10;

/**
 * Boîte de dialogue d'annulation traçable : résumé de l'opération + motif obligatoire.
 * Remplace les window.prompt() pour rester cohérent avec le reste de l'interface.
 */
export function CancelReasonDialog({
  open,
  onOpenChange,
  title = "Annuler cette opération ?",
  description = "Cette action est définitive et sera enregistrée dans l'historique.",
  summary,
  confirmLabel = "Confirmer l'annulation",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title?: string;
  description?: string;
  summary?: React.ReactNode;
  confirmLabel?: string;
  onConfirm: (raison: string) => Promise<void> | void;
}) {
  const [raison, setRaison] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setRaison(""); setBusy(false); } }, [open]);

  const tooShort = raison.trim().length < MIN;

  const submit = async () => {
    if (tooShort) return;
    setBusy(true);
    try {
      await onConfirm(raison.trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-4 w-4 text-red-400" /> {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {summary && (
          <div className="rounded-lg border border-border bg-background/40 p-3 text-sm space-y-1">
            {summary}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="cancel-reason">Motif de l'annulation *</Label>
          <Textarea
            id="cancel-reason"
            value={raison}
            onChange={(e) => setRaison(e.target.value)}
            rows={3}
            placeholder="Ex. : erreur de saisie sur la quantité déposée"
          />
          <p className="text-xs text-muted-foreground">
            {tooShort
              ? `Encore ${MIN - raison.trim().length} caractère(s) minimum.`
              : "Motif enregistré avec votre nom et la date."}
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Retour
          </Button>
          <Button
            onClick={submit}
            disabled={busy || tooShort}
            className="bg-red-600 hover:bg-red-700 text-white border-0"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Ban className="h-4 w-4 mr-2" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
