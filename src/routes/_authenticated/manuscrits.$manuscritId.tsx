import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Lock, Trash2, Loader2, FileText,
  BarChart3, Eye, CloudUpload, AlertTriangle, CheckCircle2, Sparkles, RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { planFor } from "@/lib/plans";
import { UpgradeModal } from "@/components/upgrade-modal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { StatusStepper } from "@/components/status-stepper";
import { CreatePartageForm, PartagesSection, type Partage } from "@/components/partage-securise";

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const fmtSize = (b: number) => b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} Ko` : `${(b / 1024 / 1024).toFixed(2)} Mo`;

interface PdfMeta { name: string; size: number; updated_at: string }

export const Route = createFileRoute("/_authenticated/manuscrits/$manuscritId")({
  component: ManuscritDetailPage,
  head: () => ({ meta: [{ title: "Manuscrit | FIGDITIONS" }] }),
});

interface Manuscrit {
  id: string; titre: string; auteur: string; genre: string | null;
  langue: string | null; statut: string; nombre_pages: number | null;
  pdf_path: string | null; entreprise_id: string;
  origine?: string | null; editeur_origine?: string | null;
}
function ManuscritDetailPage() {
  const { manuscritId } = Route.useParams();
  const { user } = useAuth();
  const { profile, entreprise } = useProfile(user?.id);
  const plan = planFor(entreprise?.plan);
  const [shareUpgradeOpen, setShareUpgradeOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [m, setM] = useState<Manuscrit | null>(null);
  const [loading, setLoading] = useState(true);
  const [partages, setPartages] = useState<Partage[] | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pdfMeta, setPdfMeta] = useState<PdfMeta | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadManuscrit = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("manuscrits").select("*").eq("id", manuscritId).maybeSingle();
    if (error) toast.error(error.message);
    setM(data as any);
    setLoading(false);
  };
  const loadPartages = async () => {
    const { data, error } = await supabase
      .from("pdf_partages").select("*")
      .eq("manuscrit_id", manuscritId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setPartages((data ?? []) as any);
  };

  useEffect(() => { loadManuscrit(); loadPartages(); }, [manuscritId]);

  useEffect(() => {
    const fetchMeta = async () => {
      if (!m?.pdf_path) { setPdfMeta(null); return; }
      const folder = m.pdf_path.substring(0, m.pdf_path.lastIndexOf("/"));
      const name = m.pdf_path.substring(m.pdf_path.lastIndexOf("/") + 1);
      const { data } = await supabase.storage.from("manuscrits").list(folder);
      const f = data?.find((x) => x.name === name);
      if (f) setPdfMeta({
        name,
        size: (f.metadata as any)?.size ?? 0,
        updated_at: (f as any).updated_at ?? (f as any).created_at ?? "",
      });
    };
    fetchMeta();
  }, [m?.pdf_path]);

  const doUpload = async (file: File) => {
    if (!m || !profile?.entreprise_id) return;
    if (file.type !== "application/pdf") { toast.error("Seuls les fichiers PDF sont acceptés"); return; }
    if (file.size > MAX_PDF_BYTES) { toast.error("Ce fichier dépasse la limite de 10 Mo"); return; }
    setUploading(true);
    setProgress(5);
    const tick = setInterval(() => setProgress((p) => (p < 90 ? p + 5 : p)), 200);
    const path = `${profile.entreprise_id}/${m.id}/manuscript.pdf`;
    const { error: upErr } = await supabase.storage
      .from("manuscrits").upload(path, file, { upsert: true, contentType: "application/pdf" });
    clearInterval(tick);
    if (upErr) { setUploading(false); setProgress(0); toast.error("L'envoi du PDF a échoué. Veuillez réessayer."); return; }
    setProgress(95);
    const { error: updErr } = await supabase
      .from("manuscrits").update({ pdf_path: path }).eq("id", m.id);
    setProgress(100);
    setTimeout(() => { setUploading(false); setProgress(0); }, 400);
    if (updErr) return toast.error(updErr.message);
    toast.success("PDF enregistré");
    loadManuscrit();
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) doUpload(f);
    e.target.value = "";
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) doUpload(f);
  };

  const deletePdf = async () => {
    if (!m?.pdf_path) return;
    const { error: rmErr } = await supabase.storage.from("manuscrits").remove([m.pdf_path]);
    if (rmErr) return toast.error(rmErr.message);
    const { error } = await supabase.from("manuscrits").update({ pdf_path: null }).eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("PDF supprimé");
    setConfirmDelete(false);
    loadManuscrit();
  };

  const stats = useMemo(() => {
    const list = partages ?? [];
    const totalVues = list.reduce((s, p) => s + p.nombre_vues_actuel, 0);
    const last = list.reduce<string | null>(
      (acc, p) => (p.last_viewed_at && (!acc || p.last_viewed_at > acc) ? p.last_viewed_at : acc),
      null,
    );
    return { liens: list.length, vues: totalVues, derniere: last };
  }, [partages]);

  if (loading) return <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!m) return <p className="text-muted-foreground">Manuscrit introuvable.</p>;

  return (
    <div className="space-y-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
          <Link to="/manuscrits"><ArrowLeft className="h-4 w-4" /> Retour</Link>
        </Button>
        <h1 className="text-3xl font-bold">{m.titre}</h1>
        <p className="text-muted-foreground mt-1">{m.auteur}{m.genre ? ` · ${m.genre}` : ""}{m.langue ? ` · ${m.langue}` : ""}</p>
        {m.origine === "etranger" && (
          <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-[#C08A55]/40 bg-[#C08A55]/10 px-2.5 py-0.5 text-xs font-medium text-[#C08A55]">
            Livre étranger{m.editeur_origine ? ` · ${m.editeur_origine}` : ""}
          </span>
        )}
      </div>

      {/* Progression */}
      {m.origine !== "etranger" && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold mb-4">Progression éditoriale</h2>
          <StatusStepper statut={m.statut} />
        </section>
      )}


      {/* Quick convert to ebook */}
      {m.pdf_path && (
        <section
          className="rounded-xl border p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
          style={{
            borderColor: "rgba(232,184,75,0.35)",
            background:
              "linear-gradient(135deg, rgba(232,184,75,0.08), rgba(200,146,42,0.06))",
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="h-11 w-11 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "rgba(232,184,75,0.15)" }}
            >
              <Sparkles className="h-5 w-5" style={{ color: "var(--gold)" }} />
            </div>
            <div>
              <h2 className="font-semibold flex items-center gap-2">
                Convertir en ebook (ePub / MOBI)
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    background: "rgba(232,184,75,0.15)",
                    color: "var(--gold)",
                    border: "1px solid rgba(232,184,75,0.35)",
                  }}
                >
                  Pro
                </span>
              </h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                Transformez ce manuscrit en ebook prêt pour Amazon Kindle, Apple Books et Google Play Books.
              </p>
            </div>
          </div>
          {plan.conversions ? (
            <Button asChild className="bg-[color:var(--gold)] text-background hover:bg-[color:var(--gold)]/90">
              <Link to="/conversions">
                <RefreshCw className="h-4 w-4" /> Convertir maintenant
              </Link>
            </Button>
          ) : (
            <Button
              onClick={() => setUpgradeOpen(true)}
              variant="outline"
              className="border-[color:var(--gold)]/60 text-[color:var(--gold)] hover:bg-[color:var(--gold)]/10"
            >
              <Lock className="h-4 w-4" /> Débloquer (Business)
            </Button>
          )}
        </section>
      )}


      {/* PDF Source */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="h-5 w-5" style={{ color: "var(--primary)" }} />
          <h2 className="font-semibold">Fichier du manuscrit</h2>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={onFileInput}
        />

        {uploading ? (
          <div className="rounded-lg border border-border bg-background/30 p-6">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--primary)" }} />
              <p className="text-sm font-medium">Chargement... {progress}%</p>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        ) : m.pdf_path && pdfMeta ? (
          <div className="rounded-lg border border-border bg-background/30 p-4 flex items-center gap-4 flex-wrap">
            <div className="h-12 w-12 rounded-lg flex items-center justify-center" style={{ background: "rgba(200,146,42,0.12)" }}>
              <FileText className="h-6 w-6" style={{ color: "var(--primary)" }} />
            </div>
            <div className="flex-1 min-w-[180px]">
              <p className="font-medium truncate">{pdfMeta.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {fmtSize(pdfMeta.size)}
                {pdfMeta.updated_at && ` · Ajouté le ${new Date(pdfMeta.updated_at).toLocaleDateString("fr-FR")}`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                <CloudUpload className="h-4 w-4" /> Remplacer le PDF
              </Button>
              <Button variant="outline" size="sm" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4" /> Supprimer le PDF
              </Button>
            </div>
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className="rounded-lg p-10 text-center cursor-pointer transition-colors"
            style={{
              border: `2px dashed #C8922A`,
              background: dragOver ? "rgba(200,146,42,0.08)" : "transparent",
            }}
          >
            <CloudUpload className="h-12 w-12 mx-auto mb-3" style={{ color: "var(--primary)" }} />
            <p className="font-medium">Glissez votre PDF ici ou cliquez pour sélectionner</p>
            <p className="text-xs text-muted-foreground mt-1">Format accepté : PDF · Taille max : 10 Mo</p>
          </div>
        )}

        {m.pdf_path && pdfMeta && !uploading && (
          <p className="mt-3 text-xs flex items-center gap-1.5" style={{ color: "var(--primary)" }}>
            <CheckCircle2 className="h-3.5 w-3.5" /> PDF prêt à être partagé
          </p>
        )}
      </section>

      {!m.pdf_path && (
        <div
          className="rounded-lg p-3 text-sm flex items-start gap-2"
          style={{ background: "rgba(232,184,75,0.1)", border: "1px solid rgba(232,184,75,0.3)", color: "var(--gold)" }}
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Ajoutez d'abord le PDF pour créer des liens de partage sécurisés</span>
        </div>
      )}

      {/* Secure share */}
      <PartagesSection
        partages={partages}
        pdfPresent={!!m.pdf_path}
        peutCreer={plan.partagesParMois > 0}
        onCreer={() => (plan.partagesParMois > 0 ? setSheetOpen(true) : setShareUpgradeOpen(true))}
        onChange={loadPartages}
      />

      {/* Analytics */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Statistiques de lecture</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <StatCard label="Liens créés" value={stats.liens} />
          <StatCard label="Vues totales" value={stats.vues} />
          <StatCard label="Dernière vue" value={stats.derniere ? new Date(stats.derniere).toLocaleString("fr-FR") : "—"} small />
        </div>
        <h3 className="text-sm font-medium mb-2 flex items-center gap-2"><Eye className="h-4 w-4" /> Qui a lu ce manuscrit ?</h3>
        {(partages ?? []).filter((p) => p.nombre_vues_actuel > 0).length === 0 ? (
          <p className="text-sm text-muted-foreground">Personne n'a encore consulté ce document.</p>
        ) : (
          <ul className="divide-y divide-border">
            {(partages ?? []).filter((p) => p.nombre_vues_actuel > 0).map((p) => (
              <li key={p.id} className="py-2 flex items-center justify-between text-sm">
                <span>
                  <span className="font-medium">{p.nom_lecteur}</span>
                  {p.entreprise_lecteur && <span className="text-muted-foreground"> · {p.entreprise_lecteur}</span>}
                </span>
                <span className="text-muted-foreground">
                  {p.nombre_vues_actuel}/{p.nombre_vues_max} · {p.last_viewed_at ? new Date(p.last_viewed_at).toLocaleDateString("fr-FR") : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="bg-card border-border w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Créer un lien sécurisé</SheetTitle>
            <SheetDescription>Le lecteur recevra un exemplaire marqué à son nom, lisible uniquement en ligne.</SheetDescription>
          </SheetHeader>
          <CreatePartageForm
            maxParMois={plan.partagesParMois}
            manuscritId={manuscritId}
            entrepriseId={profile?.entreprise_id ?? null}
            userId={user?.id ?? null}
            onCreated={() => { setSheetOpen(false); loadPartages(); }}
          />
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le PDF ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le fichier sera retiré du stockage et les liens existants ne fonctionneront plus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={deletePdf} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        title="Conversion ebook disponible à partir du plan Pro"
        description="Convertissez vos manuscrits en ePub et MOBI prêts pour Amazon Kindle, Apple Books et Google Play Books. Passez au plan Pro pour débloquer."
      />
      <UpgradeModal
        open={shareUpgradeOpen}
        onOpenChange={setShareUpgradeOpen}
        title="Partage sécurisé disponible à partir du plan Pro"
        description="Envoyez votre manuscrit à un lecteur, un jury ou un imprimeur avec un lien protégé : nombre de vues limité, pas de téléchargement. Passez au plan Pro pour débloquer."
      />
    </div>
  );
}

function StatCard({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-background/30 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-semibold ${small ? "text-base" : "text-2xl"}`} style={{ color: "var(--gold)" }}>{value}</p>
    </div>
  );
}
