import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Lock, Plus, Copy, Power, Trash2, Loader2, FileText,
  BarChart3, Eye, CloudUpload, AlertTriangle, CheckCircle2, Sparkles, RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { planFor } from "@/lib/plans";
import { UpgradeModal } from "@/components/upgrade-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { StatusStepper } from "@/components/status-stepper";

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const fmtSize = (b: number) => b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(2)} MB`;

interface PdfMeta { name: string; size: number; updated_at: string }

export const Route = createFileRoute("/_authenticated/manuscrits/$manuscritId")({
  component: ManuscritDetailPage,
  head: () => ({ meta: [{ title: "Manuscrit — FIGDITIONS" }] }),
});

interface Manuscrit {
  id: string; titre: string; auteur: string; genre: string | null;
  langue: string | null; statut: string; nombre_pages: number | null;
  pdf_path: string | null; entreprise_id: string;
}
interface Partage {
  id: string; token: string; nom_lecteur: string; email_lecteur: string | null;
  entreprise_lecteur: string | null; nombre_vues_max: number;
  nombre_vues_actuel: number; est_actif: boolean; created_at: string;
  last_viewed_at: string | null;
}

function ManuscritDetailPage() {
  const { manuscritId } = Route.useParams();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
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
    if (file.size > MAX_PDF_BYTES) { toast.error("Ce fichier dépasse la limite de 10 MB"); return; }
    setUploading(true);
    setProgress(5);
    const tick = setInterval(() => setProgress((p) => (p < 90 ? p + 5 : p)), 200);
    const path = `${profile.entreprise_id}/${m.id}/manuscript.pdf`;
    const { error: upErr } = await supabase.storage
      .from("manuscrits").upload(path, file, { upsert: true, contentType: "application/pdf" });
    clearInterval(tick);
    if (upErr) { setUploading(false); setProgress(0); toast.error("Échec de l'upload. Veuillez réessayer."); return; }
    setProgress(95);
    const { error: updErr } = await supabase
      .from("manuscrits").update({ pdf_path: path }).eq("id", m.id);
    setProgress(100);
    setTimeout(() => { setUploading(false); setProgress(0); }, 400);
    if (updErr) return toast.error(updErr.message);
    toast.success("✅ PDF uploadé avec succès");
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

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/lecture/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Lien copié");
  };
  const toggleActive = async (p: Partage) => {
    const { error } = await supabase
      .from("pdf_partages").update({ est_actif: !p.est_actif }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(p.est_actif ? "Lien désactivé" : "Lien réactivé");
    loadPartages();
  };
  const deletePartage = async (p: Partage) => {
    if (!confirm("Supprimer ce lien définitivement ?")) return;
    const { error } = await supabase.from("pdf_partages").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Lien supprimé");
    loadPartages();
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
      </div>

      {/* Progression */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold mb-4">📈 Progression éditoriale</h2>
        <StatusStepper statut={m.statut} />
      </section>



      {/* PDF Source */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="h-5 w-5" style={{ color: "#00C896" }} />
          <h2 className="font-semibold">📄 Fichier du manuscrit</h2>
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
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#00C896" }} />
              <p className="text-sm font-medium">Chargement... {progress}%</p>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        ) : m.pdf_path && pdfMeta ? (
          <div className="rounded-lg border border-border bg-background/30 p-4 flex items-center gap-4 flex-wrap">
            <div className="h-12 w-12 rounded-lg flex items-center justify-center" style={{ background: "rgba(0,200,150,0.12)" }}>
              <FileText className="h-6 w-6" style={{ color: "#00C896" }} />
            </div>
            <div className="flex-1 min-w-[180px]">
              <p className="font-medium truncate">{pdfMeta.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {fmtSize(pdfMeta.size)}
                {pdfMeta.updated_at && ` · Uploadé le ${new Date(pdfMeta.updated_at).toLocaleDateString("fr-FR")}`}
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
              border: `2px dashed #00C896`,
              background: dragOver ? "rgba(0,200,150,0.08)" : "transparent",
            }}
          >
            <CloudUpload className="h-12 w-12 mx-auto mb-3" style={{ color: "#00C896" }} />
            <p className="font-medium">Glissez votre PDF ici ou cliquez pour sélectionner</p>
            <p className="text-xs text-muted-foreground mt-1">Format accepté: PDF · Taille max: 10 MB</p>
          </div>
        )}

        {m.pdf_path && pdfMeta && !uploading && (
          <p className="mt-3 text-xs flex items-center gap-1.5" style={{ color: "#00C896" }}>
            <CheckCircle2 className="h-3.5 w-3.5" /> PDF uploadé avec succès
          </p>
        )}
      </section>

      {!m.pdf_path && (
        <div
          className="rounded-lg p-3 text-sm flex items-start gap-2"
          style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.3)", color: "#D4AF37" }}
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>⚠️ Uploadez d'abord un PDF pour pouvoir créer des liens de partage sécurisés</span>
        </div>
      )}

      {/* Secure share */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Lock className="h-5 w-5" style={{ color: "#D4AF37" }} />
            <h2 className="font-semibold">Partage Sécurisé</h2>
          </div>
          <Button
            disabled={!m.pdf_path}
            onClick={() => setSheetOpen(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Créer un lien sécurisé
          </Button>
        </div>

        {partages === null ? (
          <Skeleton className="h-32 w-full" />
        ) : partages.length === 0 ? (
          <div className="py-10 text-center">
            <Lock className="h-10 w-10 mx-auto" style={{ color: "#D4AF37" }} />
            <p className="mt-3 text-sm text-muted-foreground">
              Aucun lien partagé pour le moment.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-muted-foreground">
                <tr className="text-left">
                  <th className="px-3 py-2">Lecteur</th>
                  <th className="px-3 py-2 hidden md:table-cell">Entreprise</th>
                  <th className="px-3 py-2">Vues</th>
                  <th className="px-3 py-2">Statut</th>
                  <th className="px-3 py-2 hidden lg:table-cell">Créé</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {partages.map((p) => {
                  const exhausted = p.nombre_vues_actuel >= p.nombre_vues_max;
                  const status = !p.est_actif ? "off" : exhausted ? "exp" : "ok";
                  return (
                    <tr key={p.id} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">{p.nom_lecteur}</td>
                      <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">{p.entreprise_lecteur ?? "—"}</td>
                      <td className="px-3 py-2">{p.nombre_vues_actuel}/{p.nombre_vues_max}</td>
                      <td className="px-3 py-2">
                        {status === "ok" && <Badge className="bg-primary/15 text-primary border-0">Actif</Badge>}
                        {status === "exp" && <Badge className="bg-destructive/15 text-destructive border-0">Expiré</Badge>}
                        {status === "off" && <Badge className="bg-muted text-muted-foreground border-0">Désactivé</Badge>}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground hidden lg:table-cell">{new Date(p.created_at).toLocaleDateString("fr-FR")}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" title="Copier le lien" onClick={() => copyLink(p.token)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" title={p.est_actif ? "Désactiver" : "Réactiver"} onClick={() => toggleActive(p)}>
                            <Power className={`h-4 w-4 ${p.est_actif ? "text-destructive" : "text-primary"}`} />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" title="Supprimer" onClick={() => deletePartage(p)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
        <SheetContent side="right" className="bg-card border-border w-full sm:max-w-md">
          <SheetHeader><SheetTitle>Créer un lien sécurisé</SheetTitle></SheetHeader>
          <CreatePartageForm
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
    </div>
  );
}

function StatCard({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-background/30 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-semibold ${small ? "text-base" : "text-2xl"}`} style={{ color: "#D4AF37" }}>{value}</p>
    </div>
  );
}

function CreatePartageForm({
  manuscritId, entrepriseId, userId, onCreated,
}: { manuscritId: string; entrepriseId: string | null; userId: string | null; onCreated: () => void }) {
  const [form, setForm] = useState({
    nom_lecteur: "", email_lecteur: "", entreprise_lecteur: "", nombre_vues_max: "3",
  });
  const [loading, setLoading] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entrepriseId) return;
    setLoading(true);
    const { data, error } = await supabase.from("pdf_partages").insert({
      entreprise_id: entrepriseId,
      manuscrit_id: manuscritId,
      nom_lecteur: form.nom_lecteur,
      email_lecteur: form.email_lecteur || null,
      entreprise_lecteur: form.entreprise_lecteur || null,
      nombre_vues_max: parseInt(form.nombre_vues_max, 10),
      created_by: userId,
    }).select("token").single();
    setLoading(false);
    if (error) return toast.error(error.message);
    const url = `${window.location.origin}/lecture/${data.token}`;
    setCreatedUrl(url);
    toast.success("Lien sécurisé créé avec succès !");
  };

  if (createdUrl) {
    return (
      <div className="space-y-4 mt-6">
        <Label>Lien sécurisé généré</Label>
        <div className="flex gap-2">
          <Input readOnly value={createdUrl} className="font-mono text-xs" />
          <Button type="button" onClick={() => { navigator.clipboard.writeText(createdUrl); toast.success("Copié"); }}>
            <Copy className="h-4 w-4" /> Copier
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Partagez ce lien avec votre lecteur. Il pourra accéder au document selon les limites définies.</p>
        <Button className="w-full" onClick={onCreated}>Fermer</Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 mt-6">
      <div className="space-y-2">
        <Label>Nom du lecteur *</Label>
        <Input required value={form.nom_lecteur} placeholder="ex: Amadou Konaté"
          onChange={(e) => setForm({ ...form, nom_lecteur: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Email du lecteur</Label>
        <Input type="email" value={form.email_lecteur} placeholder="ex: amadou@editions.ml"
          onChange={(e) => setForm({ ...form, email_lecteur: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Entreprise du lecteur</Label>
        <Input value={form.entreprise_lecteur} placeholder="ex: Éditions Jamana"
          onChange={(e) => setForm({ ...form, entreprise_lecteur: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Nombre de vues maximum</Label>
        <Select value={form.nombre_vues_max} onValueChange={(v) => setForm({ ...form, nombre_vues_max: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {["1", "2", "3", "5", "10"].map((n) => <SelectItem key={n} value={n}>{n} vue{n === "1" ? "" : "s"}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Créer le lien"}
      </Button>
    </form>
  );
}
