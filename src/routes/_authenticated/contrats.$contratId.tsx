import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, FileDown, Loader2, Lock, Upload, FileCheck2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Livre } from "@/lib/pdf-contrat-pro";
import { genererPdfContrat, pdfDataFromContrat, referenceContrat } from "@/lib/contrat-pdf";
import type { ContratModele } from "@/lib/contrat-template";
import { planFor } from "@/lib/plans";
import { LockedPage } from "@/components/locked-page";

export const Route = createFileRoute("/_authenticated/contrats/$contratId")({
  component: ContratDetailPage,
  head: () => ({ meta: [{ title: "Contrat | FIGDITIONS" }] }),
});

const STATUT_LABELS: Record<string, string> = { brouillon: "Brouillon", en_attente_signature: "En attente", signe: "Signé", expire: "Expiré", resilie: "Résilié" };
const STATUT_CLS: Record<string, string> = {
  brouillon: "bg-muted/60 text-muted-foreground border-border",
  en_attente_signature: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  signe: "bg-emerald-500/15 text-emerald-500 border-emerald-500/40",
  expire: "bg-destructive/15 text-destructive border-destructive/40",
  resilie: "bg-orange-500/15 text-orange-500 border-orange-500/40",
};

function ContratDetailPage() {
  const { contratId } = Route.useParams();
  const { user } = useAuth();
  const { profile, entreprise: entrepriseRaw, loading: pLoading } = useProfile(user?.id);
  const entreprise = entrepriseRaw as any;
  const [contrat, setContrat] = useState<any>(null);
  const [manuscrit, setManuscrit] = useState<any>(null);
  const [auteur, setAuteur] = useState<any>(null);
  const [modele, setModele] = useState<ContratModele | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!profile?.entreprise_id) return;
    (async () => {
      setLoading(true);
      const { data: c, error } = await (supabase as any).from("contrats").select("*").eq("id", contratId).maybeSingle();
      if (error) toast.error(error.message);
      setContrat(c);
      if (c) {
        const { data: m } = await (supabase as any).from("manuscrits").select("*").eq("id", c.manuscrit_id).maybeSingle();
        setManuscrit(m);
        if (c.modele_id) {
          const { data: mod } = await (supabase as any).from("contrat_modeles").select("*").eq("id", c.modele_id).maybeSingle();
          setModele(mod ?? null);
        }
        const auteurId = c.auteur_id ?? m?.auteur_id;
        if (auteurId) {
          const { data: a } = await supabase.from("auteurs").select("*").eq("id", auteurId).maybeSingle();
          setAuteur(a);
        }
      }
      setLoading(false);
    })();
  }, [contratId, profile?.entreprise_id]);

  if (pLoading) return <Skeleton className="h-64 w-full" />;
  const plan = planFor(entreprise?.plan);
  if (!plan.contrats) return <LockedPage feature="Contrats & Droits" requiredPlan="pro" />;
  if (loading) return <div className="space-y-4"><Skeleton className="h-12 w-64" /><Skeleton className="h-96 w-full" /></div>;
  if (!contrat) return <div className="p-12 text-center text-muted-foreground">Contrat introuvable</div>;

  const auteurName = auteur?.nom_complet ?? manuscrit?.auteur ?? "—";
  const livres: Livre[] = Array.isArray(contrat.livres) && contrat.livres.length > 0
    ? contrat.livres
    : [{ titre: manuscrit?.titre ?? "—", manuscrit_id: contrat.manuscrit_id }];
  const firstTitle = livres[0]?.titre ?? "—";

  const onPdf = async () => {
    setGenerating(true);
    try {
      await genererPdfContrat({
        data: pdfDataFromContrat(contrat, entreprise, { nom_complet: auteurName, telephone: auteur?.telephone }, livres),
        contratId: contrat.id,
        texteFige: contrat.texte_fige,
        modele,
        notes: contrat.notes,
      });
      toast.success("PDF généré");
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur PDF");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link to="/contrats" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour aux contrats
        </Link>
        <Button onClick={onPdf} disabled={generating} className="bg-[color:var(--gold)] text-background hover:bg-[color:var(--gold)]/90">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><FileDown className="h-4 w-4" /> Générer PDF</>}
        </Button>
      </div>

      <header>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-bold tracking-tight">{firstTitle}</h1>
          {livres.length > 1 && (
            <span className="rounded-full bg-primary/15 text-primary text-xs font-semibold px-2.5 py-1">
              +{livres.length - 1} autre{livres.length > 2 ? "s" : ""}
            </span>
          )}
          <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", STATUT_CLS[contrat.statut])}>
            {STATUT_LABELS[contrat.statut]}
          </span>
        </div>
        <p className="text-muted-foreground mt-1">
          {contrat.texte_fige?.titre_document ?? modele?.titre_document ?? "Contrat d'édition"} · {auteurName} · {referenceContrat(contrat.id)}
        </p>
        <p className="text-xs text-muted-foreground mt-2 inline-flex items-center gap-1.5">
          {contrat.texte_fige
            ? <><Lock className="h-3.5 w-3.5 text-emerald-500" /> Texte figé à la signature le {new Date(contrat.texte_fige.fige_le).toLocaleDateString("fr-FR")}{contrat.texte_fige.modele_nom ? ` · modèle « ${contrat.texte_fige.modele_nom} »` : ""}</>
            : <>Modèle : {modele?.nom ?? "Texte standard FIGDITIONS"}</>}
        </p>
      </header>

      <SignedCopy contrat={contrat} entrepriseId={profile?.entreprise_id ?? null} onChange={(patch) => setContrat((c: any) => ({ ...c, ...patch }))} />

      {livres.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold mb-3">Ouvrages concernés</h3>
          <ul className="space-y-1 text-sm">
            {livres.map((l, i) => <li key={i} className="text-muted-foreground">• {l.titre}</li>)}
          </ul>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Maison d'édition" value={entreprise?.nom ?? "—"} />
        <Field label="Auteur" value={auteurName} />
        {contrat.collection && <Field label="Collection" value={contrat.collection} />}
        <Field label="Pourcentage droits" value={`${contrat.pourcentage_droits}%`} gold />
        <Field label="Durée" value={contrat.duree_annees ? `${contrat.duree_annees} ans` : contrat.duree} />
        <Field label="Tirage minimum" value={`${contrat.tirage_minimum ?? 100} exemplaires`} />
        <Field label="Exemplaires auteur" value={`${contrat.exemplaires_auteur ?? 10} gratuits`} />
        <Field label="Fréquence de paiement" value={contrat.frequence_paiement ?? "annuel"} />
        <Field label="Date de création" value={new Date(contrat.created_at).toLocaleDateString("fr-FR")} />
        <Field label="Date de signature" value={contrat.date_signature ? new Date(contrat.date_signature).toLocaleDateString("fr-FR") : "Non signé"} />
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold mb-3">Commission libraire par territoire</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><span className="text-muted-foreground">Mali:</span> <span className="font-semibold">{contrat.territoire_mali ?? 20}%</span></div>
          <div><span className="text-muted-foreground">Côte d'Ivoire:</span> <span className="font-semibold">{contrat.territoire_ci ?? 30}%</span></div>
          <div><span className="text-muted-foreground">Sénégal:</span> <span className="font-semibold">{contrat.territoire_senegal ?? 30}%</span></div>
          <div><span className="text-muted-foreground">France:</span> <span className="font-semibold">{contrat.territoire_france ?? 40}%</span></div>
        </div>
      </div>

      {contrat.notes && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold mb-2">Clauses particulières</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{contrat.notes}</p>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-lg font-semibold", gold && "text-[color:var(--gold)]")}>{value}</p>
    </div>
  );
}

const SIGNED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/** The scanned, signed contract (private bucket, opened through a short-lived link). */
function SignedCopy({ contrat, entrepriseId, onChange }: {
  contrat: any;
  entrepriseId: string | null;
  onChange: (patch: { fichier_signe_path: string; fichier_signe_nom: string }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [opening, setOpening] = useState(false);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !entrepriseId) return;
    if (!SIGNED_TYPES.includes(file.type)) return toast.error("Format accepté : PDF, JPG, PNG ou WebP");
    if (file.size > 15 * 1024 * 1024) return toast.error("Fichier trop lourd (15 Mo maximum)");
    setUploading(true);
    try {
      const safe = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-");
      // A replaced copy stays in storage: nothing signed is ever lost.
      const path = `${entrepriseId}/${contrat.id}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from("contrats").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const patch = { fichier_signe_path: path, fichier_signe_nom: file.name };
      const { error } = await (supabase as any).from("contrats").update(patch).eq("id", contrat.id);
      if (error) throw error;
      onChange(patch);
      toast.success("Exemplaire signé enregistré");
    } catch (err: any) {
      toast.error(err?.message ?? "Échec de l'envoi");
    } finally {
      setUploading(false);
    }
  };

  const open = async () => {
    setOpening(true);
    const { data, error } = await supabase.storage.from("contrats").createSignedUrl(contrat.fichier_signe_path, 300);
    setOpening(false);
    if (error || !data?.signedUrl) return toast.error(error?.message ?? "Lien indisponible");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const has = !!contrat.fichier_signe_path;
  return (
    <div className={cn("rounded-xl border p-5 flex flex-wrap items-center gap-4", has ? "border-emerald-500/40 bg-emerald-500/5" : "border-dashed border-border bg-card")}>
      <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center", has ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground")}>
        {has ? <FileCheck2 className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
      </div>
      <div className="flex-1 min-w-[200px]">
        <p className="font-semibold">Exemplaire signé</p>
        <p className="text-sm text-muted-foreground truncate">
          {has ? contrat.fichier_signe_nom : "Scannez ou photographiez le contrat signé par les deux parties et gardez-le ici."}
        </p>
      </div>
      <input ref={inputRef} type="file" accept={SIGNED_TYPES.join(",")} className="hidden" onChange={onFile} />
      <div className="flex gap-2">
        {has && (
          <Button variant="outline" onClick={open} disabled={opening}>
            {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ExternalLink className="h-4 w-4" /> Ouvrir</>}
          </Button>
        )}
        <Button variant={has ? "ghost" : "default"} onClick={() => inputRef.current?.click()} disabled={uploading || !entrepriseId}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4" /> {has ? "Remplacer" : "Importer le scan"}</>}
        </Button>
      </div>
    </div>
  );
}
