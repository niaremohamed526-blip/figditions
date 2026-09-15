import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, FileDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { generateContratProPdf, type Livre } from "@/lib/pdf-contrat-pro";
import { planFor } from "@/lib/plans";
import { LockedPage } from "@/components/locked-page";

export const Route = createFileRoute("/_authenticated/contrats/$contratId")({
  component: ContratDetailPage,
  head: () => ({ meta: [{ title: "Contrat | FIGDITIONS" }] }),
});

const STATUT_LABELS: Record<string, string> = { brouillon: "Brouillon", signe: "Signé", expire: "Expiré", resilie: "Résilié" };
const STATUT_CLS: Record<string, string> = {
  brouillon: "bg-muted/60 text-muted-foreground border-border",
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
      await generateContratProPdf({
        maison: entreprise?.nom ?? "FIGDITIONS",
        adresse_editeur: entreprise?.adresse,
        telephone_editeur: entreprise?.telephone,
        email_editeur: entreprise?.email ?? entreprise?.email_contact,
        website_editeur: entreprise?.website,
        nif: entreprise?.nif,
        rccm: entreprise?.rccm,
        nina: entreprise?.nina,
        banque: entreprise?.banque,
        compte_bancaire: entreprise?.compte_bancaire,
        nom_representant: entreprise?.nom_representant,
        qualite_representant: entreprise?.qualite_representant,
        logo_url: entreprise?.logo_url,
        cachet_url: entreprise?.cachet_url,
        auteur: auteurName,
        adresse_auteur: contrat.adresse_auteur,
        telephone_auteur: contrat.telephone_auteur ?? auteur?.telephone,
        profession_auteur: contrat.profession_auteur,
        collection: contrat.collection,
        livres,
        duree_annees: contrat.duree_annees ?? 10,
        pourcentage: Number(contrat.pourcentage_droits ?? 10),
        tirage_minimum: contrat.tirage_minimum ?? 100,
        contribution_auteur: contrat.contribution_auteur,
        format: contrat.format,
        type_couverture: contrat.type_couverture,
        reliure: contrat.reliure,
        exemplaires_auteur: contrat.exemplaires_auteur ?? 10,
        frequence_paiement: contrat.frequence_paiement ?? "annuel",
        territoire_mali: contrat.territoire_mali ?? 20,
        territoire_ci: contrat.territoire_ci ?? 30,
        territoire_senegal: contrat.territoire_senegal ?? 30,
        territoire_france: contrat.territoire_france ?? 40,
        lieu_signature: contrat.lieu_signature ?? entreprise?.ville ?? "Bamako",
        date_signature: contrat.date_signature ?? new Date().toISOString().slice(0, 10),
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
        <p className="text-muted-foreground mt-1">Contrat d'édition · {auteurName}</p>
      </header>

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
