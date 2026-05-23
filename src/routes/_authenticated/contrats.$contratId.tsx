import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, FileDown, Loader2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { generateContratPdf } from "@/lib/pdf-contrat";
import { planFor } from "@/lib/plans";
import { LockedPage } from "@/components/locked-page";

export const Route = createFileRoute("/_authenticated/contrats/$contratId")({
  component: ContratDetailPage,
  head: () => ({ meta: [{ title: "Contrat — FIGDITIONS" }] }),
});

const STATUT_LABELS: Record<string, string> = { brouillon: "Brouillon", signe: "Signé", expire: "Expiré" };
const STATUT_CLS: Record<string, string> = {
  brouillon: "bg-muted/60 text-muted-foreground border-border",
  signe: "bg-primary/15 text-primary border-primary/40",
  expire: "bg-destructive/15 text-destructive border-destructive/40",
};

function ContratDetailPage() {
  const { contratId } = Route.useParams();
  const { user } = useAuth();
  const { profile, entreprise, loading: pLoading } = useProfile(user?.id);
  const navigate = useNavigate();
  const [contrat, setContrat] = useState<any>(null);
  const [manuscrit, setManuscrit] = useState<any>(null);
  const [auteur, setAuteur] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
  if (!plan.contrats) return <LockedPage feature="le générateur de contrats OHADA" requiredPlan="pro" />;
  if (loading) return <div className="space-y-4"><Skeleton className="h-12 w-64" /><Skeleton className="h-96 w-full" /></div>;
  if (!contrat) return <div className="p-12 text-center text-muted-foreground">Contrat introuvable</div>;

  const auteurName = auteur?.nom_complet ?? manuscrit?.auteur ?? "—";
  const titre = manuscrit?.titre ?? "—";

  const onPdf = () => {
    generateContratPdf({
      maison: entreprise?.nom ?? "FIGDITIONS",
      ville: entreprise?.ville,
      adresse: (entreprise as any)?.adresse,
      email: (entreprise as any)?.email,
      telephone: (entreprise as any)?.telephone,
      titre, auteur: auteurName,
      pourcentage: Number(contrat.pourcentage_droits),
      duree: contrat.duree,
      statut: contrat.statut,
      dateCreation: new Date(contrat.created_at).toLocaleDateString("fr-FR"),
      dateSignature: contrat.date_signature ? new Date(contrat.date_signature).toLocaleDateString("fr-FR") : null,
      notes: contrat.notes,
    });
    toast.success("PDF généré");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link to="/contrats" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour aux contrats
        </Link>
        <Button onClick={onPdf} className="bg-[color:var(--gold)] text-background hover:bg-[color:var(--gold)]/90">
          <FileDown className="h-4 w-4" /> Générer PDF
        </Button>
      </div>

      <header>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{titre}</h1>
          <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", STATUT_CLS[contrat.statut])}>
            {STATUT_LABELS[contrat.statut]}
          </span>
        </div>
        <p className="text-muted-foreground mt-1">Contrat d'édition · {auteurName}</p>
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Maison d'édition" value={entreprise?.nom ?? "—"} />
        <Field label="Auteur" value={auteurName} />
        <Field label="Œuvre" value={titre} />
        <Field label="Pourcentage droits d'auteur" value={`${contrat.pourcentage_droits}%`} gold />
        <Field label="Durée" value={contrat.duree} />
        <Field label="Date de création" value={new Date(contrat.created_at).toLocaleDateString("fr-FR")} />
        <Field label="Date de signature" value={contrat.date_signature ? new Date(contrat.date_signature).toLocaleDateString("fr-FR") : "Non signé"} />
        <Field label="Statut" value={STATUT_LABELS[contrat.statut]} />
      </div>

      {contrat.notes && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold mb-2">Clauses particulières</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{contrat.notes}</p>
        </div>
      )}

      <div className="rounded-xl border border-[color:var(--gold)]/30 bg-card p-6">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Filigrane</p>
        <p className="text-lg font-semibold text-[color:var(--gold)] mt-1">Document officiel — {entreprise?.nom}</p>
      </div>
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
