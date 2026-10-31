import { useRef, useState } from "react";
import { FileUp, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ContratModele } from "@/lib/contrat-template";

type Importe = Pick<ContratModele, "nom" | "type_contrat" | "titre_document" | "sous_titre" | "articles">;

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const ACCEPT = ["application/pdf", DOCX, "image/jpeg", "image/png", "image/webp"];
const MAX = 3 * 1024 * 1024;

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Phone photos are often 4–8 MB: resize to 2200 px JPEG, plenty to read text. */
async function shrinkImage(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, 2200 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Image illisible"))), "image/jpeg", 0.85));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ContratImportDialog({ open, onOpenChange, onImported }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImported: (modele: Importe) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  const handle = async (file: File | undefined) => {
    if (!file || busy) return;
    const isDocx = file.type === DOCX || /\.docx$/i.test(file.name);
    if (/\.doc$/i.test(file.name)) return toast.error("Ancien format Word (.doc) : enregistrez-le en .docx ou en PDF.");
    if (!isDocx && !ACCEPT.includes(file.type)) return toast.error("Envoyez un PDF, un Word (.docx) ou une photo (JPG, PNG).");
    setBusy(true);
    try {
      let blob: Blob = file;
      let mediaType = isDocx ? DOCX : file.type;
      if (file.type.startsWith("image/") && file.size > 1.5 * 1024 * 1024) {
        blob = await shrinkImage(file);
        mediaType = "image/jpeg";
      }
      if (blob.size > MAX) throw new Error("Fichier trop lourd (3 Mo maximum). Pour un PDF scanné, envoyez plutôt des photos des pages.");

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Session expirée. Rechargez la page.");
      const res = await fetch("/api/contrat-import", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nom_fichier: file.name, media_type: mediaType, data: await toBase64(blob) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.erreur ?? "Medmo n'a pas pu lire ce contrat.");
      const remarques: string[] = json.remarques ?? [];
      toast.success(`${json.modele.articles.length} articles reconnus. Relisez-les avant d'enregistrer.`, {
        description: remarques.length ? remarques.join(" · ") : undefined,
        duration: remarques.length ? 12000 : 5000,
      });
      onImported(json.modele as Importe);
    } catch (e: any) {
      toast.error(e?.message ?? "Échec de l'import");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="bg-card border-border sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Importer votre contrat</DialogTitle>
          <DialogDescription>
            Medmo lit le contrat que vous utilisez déjà, reprend ses articles mot pour mot et remplace le nom de l'auteur, les titres, les pourcentages… par des champs remplis automatiquement.
          </DialogDescription>
        </DialogHeader>
        <input ref={inputRef} type="file" className="hidden" accept={[...ACCEPT, ".docx"].join(",")} onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ""; }} />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files?.[0]); }}
          className={cn(
            "w-full rounded-xl border-2 border-dashed p-8 text-center transition",
            drag ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-primary/5",
            busy && "cursor-wait",
          )}
        >
          {busy ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="font-medium">Medmo lit votre contrat…</p>
              <p className="text-xs text-muted-foreground">Environ 20 à 40 secondes</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <FileUp className="h-8 w-8 text-primary" />
              <p className="font-medium">Choisir ou déposer un fichier</p>
              <p className="text-xs text-muted-foreground">Word (.docx), PDF ou photo · 3 Mo maximum</p>
            </div>
          )}
        </button>
        <p className="text-xs text-muted-foreground">
          Rien n'est enregistré tant que vous n'avez pas relu et validé le modèle. Votre fichier n'est pas conservé.
        </p>
      </DialogContent>
    </Dialog>
  );
}
