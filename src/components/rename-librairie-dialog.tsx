import { useEffect, useState } from "react";
import { Loader2, Store } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { pl } from "@/lib/plural";

/** Rename a bookshop (and fix its address) across deposits, sales and bordereaux. */
export function RenameLibrairieDialog({
  open, onOpenChange, librairieNom, adresse, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  librairieNom: string;
  adresse: string | null;
  onDone: (nouveauNom: string) => void;
}) {
  const [nom, setNom] = useState(librairieNom);
  const [adr, setAdr] = useState(adresse ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNom(librairieNom);
    setAdr(adresse ?? "");
  }, [open, librairieNom, adresse]);

  const unchanged = nom.trim() === librairieNom.trim() && adr.trim() === (adresse ?? "").trim();

  const save = async () => {
    if (!nom.trim()) return toast.error("Le nom de la librairie ne peut pas être vide");
    setSaving(true);
    const { data, error } = await (supabase as any).rpc("renommer_librairie", {
      p_ancien: librairieNom,
      p_nouveau: nom.trim(),
      p_adresse: adr.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    const ventes = Number(data?.ventes ?? 0);
    toast.success(
      nom.trim() === librairieNom.trim()
        ? "Adresse mise à jour"
        : `« ${librairieNom} » s'appelle maintenant « ${nom.trim()} »` + (ventes > 0 ? ` (${pl(ventes, "vente mise", "ventes mises")} à jour)` : ""),
    );
    onDone(nom.trim());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-[color:var(--gold)]" />
            Modifier la librairie
          </DialogTitle>
          <DialogDescription>
            Le nouveau nom remplace l'ancien partout : dépôts, ventes, Finances et bordereaux.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs">Nom de la librairie *</Label>
            <Input value={nom} onChange={(e) => setNom(e.target.value)} autoFocus className="bg-input" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Adresse</Label>
            <Input value={adr} onChange={(e) => setAdr(e.target.value)} placeholder="Ex. ACI 2000, Bamako" className="bg-input" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button>
          <Button onClick={save} disabled={saving || unchanged} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
