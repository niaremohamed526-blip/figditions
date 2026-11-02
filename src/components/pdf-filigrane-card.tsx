import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, RotateCcw, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { notifyEntrepriseUpdated } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FIGDITIONS_SITE_LOGO_GOLD_URL } from "@/lib/brand-assets";
import { toast } from "sonner";

const MAX_MO = 10;

/**
 * Every PDF carries the FIGDITIONS logo at the top; the house chooses its own
 * filigrane here (its logo by default, or another image), or switches it off.
 */
export function PdfFiligraneCard({ entreprise }: { entreprise: any }) {
  const [actif, setActif] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!entreprise) return;
    setActif(entreprise.pdf_filigrane !== false);
    setImageUrl(entreprise.filigrane_url ?? null);
  }, [entreprise]);

  const logoUrl: string | null = entreprise?.logo_url ?? null;
  const apercu = imageUrl || logoUrl;

  const enregistrer = async (patch: { pdf_filigrane?: boolean; filigrane_url?: string | null }) => {
    if (!entreprise?.id) return false;
    const { error } = await supabase.from("entreprises").update(patch as any).eq("id", entreprise.id);
    if (error) {
      // Before the v2.14 SQL runs, the columns do not exist yet.
      const manque = /filigrane/.test(error.message) || error.code === "PGRST204" || error.code === "42703";
      toast.error(manque ? "Ce réglage sera disponible après la mise à jour de la base de données." : error.message);
      return false;
    }
    notifyEntrepriseUpdated();
    return true;
  };

  const basculer = async (v: boolean) => {
    const avant = actif;
    setActif(v);
    setBusy(true);
    const ok = await enregistrer({ pdf_filigrane: v });
    setBusy(false);
    if (!ok) setActif(avant);
    else toast.success(v ? "Filigrane activé sur vos PDF" : "Filigrane retiré de vos PDF");
  };

  const choisirImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !entreprise?.id) return;
    if (!file.type.startsWith("image/")) { toast.error("Choisissez une image (PNG ou JPG)."); return; }
    if (file.size > MAX_MO * 1024 * 1024) { toast.error(`Image trop lourde : ${MAX_MO} Mo maximum.`); return; }
    setBusy(true);
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${entreprise.id}/filigrane-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
    if (upErr) { setBusy(false); toast.error(upErr.message); return; }
    const url = supabase.storage.from("logos").getPublicUrl(path).data.publicUrl;
    const ok = await enregistrer({ filigrane_url: url, pdf_filigrane: true });
    setBusy(false);
    if (ok) {
      setImageUrl(url);
      setActif(true);
      toast.success("Image du filigrane mise à jour");
    }
  };

  const revenirAuLogo = async () => {
    setBusy(true);
    const ok = await enregistrer({ filigrane_url: null });
    setBusy(false);
    if (ok) { setImageUrl(null); toast.success("Votre logo sert de nouveau de filigrane"); }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2">
          <FileText className="h-5 w-5 shrink-0 text-primary mt-1" />
          <div>
            <h2 className="text-lg font-semibold">Vos documents PDF</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Factures, reçus, quittances, relevés, bordereaux et rapports portent le logo FIGDITIONS en haut.
              Votre logo peut apparaître en filigrane, très léger, au centre de chaque page.
            </p>
          </div>
        </div>
        <Switch className="mt-1 shrink-0" checked={actif} onCheckedChange={basculer} disabled={busy} aria-label="Filigrane sur mes PDF" />
      </div>

      <div className="grid gap-5 sm:grid-cols-[180px_1fr] sm:items-center">
        {/* Mini page: what a PDF looks like with this setting. */}
        <div className="relative mx-auto aspect-[1/1.414] w-40 overflow-hidden rounded-md border border-border bg-white shadow-sm">
          <div className="h-1 bg-[#C8922A]" />
          <img src={FIGDITIONS_SITE_LOGO_GOLD_URL} alt="" className="ml-3 mt-2 h-5 w-auto object-contain" />
          <div className="mx-3 mt-2 h-px bg-[#C8922A]/60" />
          <div className="mx-3 mt-3 space-y-1.5">
            {[90, 70, 80, 60, 85, 50].map((w, i) => (
              <div key={i} className="h-1 rounded bg-neutral-200" style={{ width: `${w}%` }} />
            ))}
          </div>
          {actif && apercu && (
            <img src={apercu} alt="" className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.12]" />
          )}
          <div className="absolute inset-x-0 bottom-0 h-1 bg-[#C8922A]" />
        </div>

        <div className="space-y-3 text-sm">
          {!actif ? (
            <p className="text-muted-foreground">Pas de filigrane : vos PDF n'affichent que le logo FIGDITIONS.</p>
          ) : apercu ? (
            <p className="text-muted-foreground">
              Filigrane utilisé : <span className="font-medium text-foreground">{imageUrl ? "votre image personnalisée" : "le logo de votre maison"}</span>.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Ajoutez le logo de votre maison ci-dessus, ou choisissez une image ici, pour l'afficher en filigrane.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={choisirImage} />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {imageUrl ? "Changer l'image" : "Utiliser une autre image"}
            </Button>
            {imageUrl && logoUrl && (
              <Button variant="ghost" onClick={revenirAuLogo} disabled={busy}>
                <RotateCcw className="h-4 w-4" /> Revenir à mon logo
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Conseil : une image PNG à fond transparent donne le plus beau rendu. {MAX_MO} Mo maximum.</p>
        </div>
      </div>
    </div>
  );
}
