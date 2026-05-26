import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Lock, Plus, Copy, Power, Trash2, Loader2, FileText,
  BarChart3, Eye, CloudUpload, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "@/hooks/use-auth";
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

      {/* PDF Source */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-3 mb-3">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Fichier PDF</h2>
        </div>
        {m.pdf_path ? (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground">PDF téléversé. Vous pouvez le remplacer à tout moment.</p>
            <label className="inline-flex">
              <input type="file" accept="application/pdf" className="hidden" onChange={onUpload} />
              <Button asChild variant="outline" size="sm" disabled={uploading}>
                <span>{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Remplacer</span>
              </Button>
            </label>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground">Aucun PDF. Téléversez-en un pour activer le partage sécurisé.</p>
            <label className="inline-flex">
              <input type="file" accept="application/pdf" className="hidden" onChange={onUpload} />
              <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={uploading}>
                <span>{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Téléverser un PDF</span>
              </Button>
            </label>
          </div>
        )}
      </section>

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
