import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  clearFactureWatermark,
  fileToWatermarkDataUrl,
  getFactureWatermark,
  setFactureWatermark,
} from "@/lib/facture-watermark";

/** Choix d'un logo utilisé en filigrane sur les factures générées. */
export function FactureWatermarkUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState<string | null>(() => getFactureWatermark());

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await fileToWatermarkDataUrl(file);
      setFactureWatermark(dataUrl);
      setLogo(dataUrl);
      toast.success("Logo du filigrane enregistré");
    } catch (e: any) {
      toast.error(e?.message ?? "Impossible d'utiliser cette image");
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs">🖼️ Logo en filigrane sur la facture (optionnel)</Label>
      <div className="flex items-center gap-3 rounded-xl border border-border p-3">
        {logo ? (
          <img
            src={logo}
            alt="Aperçu du logo en filigrane"
            className="h-12 w-12 rounded-md object-contain bg-muted/30"
          />
        ) : (
          <div className="h-12 w-12 rounded-md bg-muted/30 flex items-center justify-center text-muted-foreground">
            <ImagePlus className="h-5 w-5" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">
            {logo ? "Ce logo apparaîtra en filigrane au centre de la facture." : "Ajoutez votre logo pour l'imprimer en filigrane."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            {logo ? "Changer" : "Choisir"}
          </Button>
          {logo && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Retirer le logo du filigrane"
              onClick={() => {
                clearFactureWatermark();
                setLogo(null);
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}
