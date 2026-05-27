import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  RefreshCw, Upload, FileText, BookOpen, Download, Trash2, CheckCircle2, XCircle, Loader2, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { LockedPage } from "@/components/locked-page";
import { planFor } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  createAndStartConversion,
  deleteConversion,
  getConversionDownloadUrl,
  getSourceUploadUrl,
  listConversions,
  pollConversion,
} from "@/lib/conversions.functions";

export const Route = createFileRoute("/_authenticated/conversions")({
  component: ConversionsPage,
});

type Conversion = Awaited<ReturnType<typeof listConversions>>[number];

const MAX_SIZE_MB = 50;

function ConversionsPage() {
  const { user } = useAuth();
  const { entreprise } = useProfile(user?.id);
  const plan = planFor(entreprise?.plan);

  if (plan.key !== "business") {
    return <LockedPage feature="Conversion ePub & MOBI" requiredPlan="business" />;
  }

  return <ConversionsInner />;
}

function ConversionsInner() {
  const qc = useQueryClient();
  const list = useServerFn(listConversions);
  const { data: rows, isLoading } = useQuery({
    queryKey: ["conversions"],
    queryFn: () => list(),
    refetchInterval: (q) => {
      const data = q.state.data as Conversion[] | undefined;
      return data?.some((r) => r.statut === "en_cours" || r.statut === "en_attente") ? 4000 : false;
    },
  });

  // Auto-poll any in-progress conversions
  const poll = useServerFn(pollConversion);
  useEffect(() => {
    if (!rows) return;
    const active = rows.filter((r) => r.statut === "en_cours" && r.cloudconvert_job_id);
    if (active.length === 0) return;
    const t = setTimeout(() => {
      Promise.allSettled(active.map((r) => poll({ data: { id: r.id } }))).then(() => {
        qc.invalidateQueries({ queryKey: ["conversions"] });
      });
    }, 3000);
    return () => clearTimeout(t);
  }, [rows, poll, qc]);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-8">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
          <RefreshCw className="h-7 w-7 text-primary" /> Conversions ePub & MOBI
        </h1>
        <p className="text-muted-foreground mt-1">
          Transformez vos manuscrits en ebooks professionnels prêts pour Kindle, Apple Books et Kobo.
        </p>
      </header>

      <NewConversionForm onCreated={() => qc.invalidateQueries({ queryKey: ["conversions"] })} />

      <HistorySection rows={rows ?? []} isLoading={isLoading} />
    </div>
  );
}

function NewConversionForm({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const { entreprise } = useProfile(user?.id);

  const [tab, setTab] = useState<"manuscrit" | "upload">("upload");
  const [manuscritId, setManuscritId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sourcePath, setSourcePath] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const [formats, setFormats] = useState<{ epub: boolean; mobi: boolean }>({ epub: true, mobi: false });
  const [titre, setTitre] = useState("");
  const [auteur, setAuteur] = useState("");
  const [description, setDescription] = useState("");
  const [isbn, setIsbn] = useState("");
  const [langue, setLangue] = useState("français");
  const [editeur, setEditeur] = useState(entreprise?.nom ?? "");
  const [annee, setAnnee] = useState<number | "">(new Date().getFullYear());

  useEffect(() => {
    if (entreprise?.nom && !editeur) setEditeur(entreprise.nom);
  }, [entreprise?.nom, editeur]);

  // Manuscrits list
  const { data: manuscrits } = useQuery({
    queryKey: ["manuscrits-for-conv", entreprise?.id],
    enabled: !!entreprise?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manuscrits")
        .select("id,titre,auteur,statut,pdf_path,nombre_pages")
        .eq("entreprise_id", entreprise!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const selectedManuscrit = useMemo(
    () => manuscrits?.find((m) => m.id === manuscritId) ?? null,
    [manuscrits, manuscritId],
  );

  useEffect(() => {
    if (tab === "manuscrit" && selectedManuscrit) {
      setTitre(selectedManuscrit.titre);
      setAuteur(selectedManuscrit.auteur);
    }
  }, [tab, selectedManuscrit]);

  const getUploadUrl = useServerFn(getSourceUploadUrl);
  const createConv = useServerFn(createAndStartConversion);

  const fileInput = useRef<HTMLInputElement>(null);

  const detectFormat = (name: string): "pdf" | "docx" | "txt" | null => {
    const lower = name.toLowerCase();
    if (lower.endsWith(".pdf")) return "pdf";
    if (lower.endsWith(".docx")) return "docx";
    if (lower.endsWith(".txt")) return "txt";
    return null;
  };

  async function handleFile(f: File) {
    const fmt = detectFormat(f.name);
    if (!fmt) return toast.error("Format non supporté (PDF, DOCX, TXT uniquement)");
    if (f.size > MAX_SIZE_MB * 1024 * 1024) return toast.error(`Fichier trop volumineux (max ${MAX_SIZE_MB} Mo)`);
    setFile(f);
    setSourcePath(null);
    setUploading(true);
    setUploadProgress(10);
    try {
      const { path, token } = await getUploadUrl({ data: { extension: fmt } });
      setUploadProgress(30);
      const { error } = await supabase.storage
        .from("conversions")
        .uploadToSignedUrl(path, token, f, { contentType: f.type || undefined, upsert: false });
      if (error) throw error;
      setUploadProgress(100);
      setSourcePath(path);
      if (!titre) setTitre(f.name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload échoué");
    } finally {
      setUploading(false);
    }
  }

  async function handleConvert() {
    if (!titre.trim() || !auteur.trim()) return toast.error("Titre et auteur requis");
    if (!formats.epub && !formats.mobi) return toast.error("Sélectionnez au moins un format");

    let path = sourcePath;
    let format_source: "pdf" | "docx" | "txt" | null = file ? detectFormat(file.name) : null;
    let taille_source_kb = file ? Math.round(file.size / 1024) : 0;

    // If user picked an existing manuscrit with a PDF: copy it across into our bucket? simpler — require upload tab for now.
    if (tab === "manuscrit") {
      if (!selectedManuscrit?.pdf_path) {
        return toast.error("Ce manuscrit n'a pas de PDF. Uploadez le fichier dans l'onglet « Uploader ».");
      }
      // Download from manuscrits bucket then re-upload to conversions bucket via signed URL flow.
      try {
        setUploading(true);
        setUploadProgress(20);
        const { data: dl, error: dlErr } = await supabase.storage
          .from("manuscrits")
          .download(selectedManuscrit.pdf_path);
        if (dlErr || !dl) throw dlErr ?? new Error("Téléchargement manuscrit échoué");
        const { path: dest, token } = await getUploadUrl({ data: { extension: "pdf" } });
        setUploadProgress(60);
        const { error: upErr } = await supabase.storage
          .from("conversions")
          .uploadToSignedUrl(dest, token, dl, { contentType: "application/pdf" });
        if (upErr) throw upErr;
        path = dest;
        format_source = "pdf";
        taille_source_kb = Math.round(dl.size / 1024);
        setUploadProgress(100);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Préparation échouée");
        return;
      } finally {
        setUploading(false);
      }
    }

    if (!path || !format_source) return toast.error("Aucun fichier source");

    const targets: ("epub" | "mobi")[] = [];
    if (formats.epub) targets.push("epub");
    if (formats.mobi) targets.push("mobi");

    try {
      await createConv({
        data: {
          manuscrit_id: tab === "manuscrit" ? manuscritId : null,
          format_source,
          fichier_source_path: path,
          taille_source_kb,
          formats_cibles: targets,
          metadata: {
            titre: titre.trim(),
            auteur: auteur.trim(),
            description: description.trim() || null,
            isbn: isbn.trim() || null,
            langue,
            editeur: editeur.trim() || null,
            annee_publication: typeof annee === "number" ? annee : null,
          },
        },
      });
      toast.success("Conversion lancée — suivez la progression dans l'historique");
      onCreated();
      // reset partial
      setFile(null);
      setSourcePath(null);
      setUploadProgress(0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors du lancement");
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 md:p-7">
      <h2 className="text-lg md:text-xl font-semibold flex items-center gap-2 mb-5">
        <Sparkles className="h-5 w-5 text-primary" /> Nouvelle conversion
      </h2>

      <div className="grid md:grid-cols-2 gap-6">
        {/* LEFT: source + formats */}
        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold mb-2">📁 Fichier source</h3>
            <Tabs value={tab} onValueChange={(v) => setTab(v as "manuscrit" | "upload")}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="upload">Uploader un fichier</TabsTrigger>
                <TabsTrigger value="manuscrit">Depuis un manuscrit</TabsTrigger>
              </TabsList>
              <TabsContent value="upload" className="mt-3">
                <div
                  onClick={() => fileInput.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) handleFile(f);
                  }}
                  className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors bg-background/30"
                >
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium">Glissez-déposez votre fichier</p>
                  <p className="text-xs text-muted-foreground">PDF, DOCX ou TXT — max {MAX_SIZE_MB} Mo</p>
                  <input
                    ref={fileInput}
                    type="file"
                    hidden
                    accept=".pdf,.docx,.txt"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />
                </div>
                {file && (
                  <div className="mt-3 text-sm space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="font-medium truncate">{file.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {(file.size / 1024 / 1024).toFixed(2)} Mo
                      </span>
                    </div>
                    {uploading && (
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    )}
                    {sourcePath && (
                      <p className="text-xs text-primary flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Prêt à convertir
                      </p>
                    )}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="manuscrit" className="mt-3">
                <Select value={manuscritId ?? ""} onValueChange={(v) => setManuscritId(v || null)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un manuscrit" />
                  </SelectTrigger>
                  <SelectContent>
                    {(manuscrits ?? []).map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.titre} — {m.auteur}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedManuscrit && !selectedManuscrit.pdf_path && (
                  <p className="text-xs text-destructive mt-2">
                    Ce manuscrit n'a pas de PDF attaché. Utilisez l'onglet « Uploader » à la place.
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2">📤 Format(s) de sortie</h3>
            <div className="grid grid-cols-2 gap-3">
              <FormatCard
                title="ePub 3.0"
                desc="Apple Books, Kobo, Google Play, Fnac"
                badge="Recommandé"
                badgeClass="bg-primary/15 text-primary border-primary/30"
                active={formats.epub}
                onClick={() => setFormats((s) => ({ ...s, epub: !s.epub }))}
              />
              <FormatCard
                title="MOBI / KF8"
                desc="Amazon Kindle, Kindle App"
                badge="Populaire"
                badgeClass="bg-blue-500/15 text-blue-400 border-blue-500/30"
                active={formats.mobi}
                onClick={() => setFormats((s) => ({ ...s, mobi: !s.mobi }))}
              />
            </div>
          </div>
        </div>

        {/* RIGHT: metadata */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">📋 Métadonnées du livre</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Titre*" full><Input value={titre} onChange={(e) => setTitre(e.target.value)} /></Field>
            <Field label="Auteur*" full><Input value={auteur} onChange={(e) => setAuteur(e.target.value)} /></Field>
            <Field label="Description / Synopsis" full>
              <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Résumé du livre..." />
            </Field>
            <Field label="ISBN"><Input value={isbn} onChange={(e) => setIsbn(e.target.value)} placeholder="978-X-XXXXX-XXX-X" /></Field>
            <Field label="Langue">
              <Select value={langue} onValueChange={setLangue}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="français">Français</SelectItem>
                  <SelectItem value="bamanankan">Bamanankan</SelectItem>
                  <SelectItem value="anglais">Anglais</SelectItem>
                  <SelectItem value="autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Éditeur"><Input value={editeur} onChange={(e) => setEditeur(e.target.value)} /></Field>
            <Field label="Année">
              <Input type="number" value={annee} onChange={(e) => setAnnee(e.target.value ? Number(e.target.value) : "")} />
            </Field>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <Button
          size="lg"
          className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-semibold"
          disabled={uploading || (!sourcePath && tab !== "manuscrit") || (tab === "manuscrit" && !selectedManuscrit?.pdf_path)}
          onClick={handleConvert}
        >
          {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Préparation...</> : <><RefreshCw className="h-4 w-4" /> Lancer la conversion</>}
        </Button>
      </div>
    </section>
  );
}

function FormatCard({
  title, desc, badge, badgeClass, active, onClick,
}: {
  title: string; desc: string; badge: string; badgeClass: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left p-4 rounded-xl border-2 transition-all",
        active ? "border-primary bg-primary/5" : "border-border bg-background/30 hover:border-border/80",
      )}
    >
      <div className="flex items-start justify-between">
        <BookOpen className={cn("h-6 w-6", active ? "text-primary" : "text-muted-foreground")} />
        <span className={cn("text-[10px] px-2 py-0.5 rounded-full border", badgeClass)}>{badge}</span>
      </div>
      <p className="mt-2 font-semibold text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 leading-tight">{desc}</p>
    </button>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={cn("space-y-1.5", full && "col-span-2")}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function HistorySection({ rows, isLoading }: { rows: Conversion[]; isLoading: boolean }) {
  const qc = useQueryClient();
  const getUrl = useServerFn(getConversionDownloadUrl);
  const del = useServerFn(deleteConversion);

  async function download(path: string) {
    try {
      const { url } = await getUrl({ data: { path } });
      window.open(url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Téléchargement impossible");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette conversion et ses fichiers ?")) return;
    try {
      await del({ data: { id } });
      toast.success("Conversion supprimée");
      qc.invalidateQueries({ queryKey: ["conversions"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suppression échouée");
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 md:p-7">
      <h2 className="text-lg md:text-xl font-semibold mb-4">📚 Historique des conversions</h2>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <RefreshCw className="h-10 w-10 mx-auto opacity-30" />
          <p className="mt-3">Aucune conversion pour le moment.</p>
          <p className="text-sm">Convertissez votre premier manuscrit en ebook !</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-xs">
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 font-medium">Livre</th>
                <th className="text-left py-2 px-2 font-medium">Formats</th>
                <th className="text-left py-2 px-2 font-medium">Statut</th>
                <th className="text-left py-2 px-2 font-medium">Taille</th>
                <th className="text-left py-2 px-2 font-medium">Date</th>
                <th className="text-right py-2 px-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="py-3 px-2">
                    <div className="font-medium truncate max-w-[220px]">{r.titre}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.auteur} · source {r.format_source.toUpperCase()}
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex gap-1 flex-wrap">
                      {(r.formats_cibles ?? []).map((f) => (
                        <span key={f} className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded border",
                          f === "epub"
                            ? "bg-primary/10 text-primary border-primary/30"
                            : "bg-blue-500/10 text-blue-400 border-blue-500/30",
                        )}>{f.toUpperCase()}</span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-2"><StatusBadge statut={r.statut} message={r.erreur_message} /></td>
                  <td className="py-3 px-2 text-xs text-muted-foreground">
                    {r.taille_epub_kb ? `ePub ${r.taille_epub_kb} Ko` : ""}
                    {r.taille_epub_kb && r.taille_mobi_kb ? " · " : ""}
                    {r.taille_mobi_kb ? `MOBI ${r.taille_mobi_kb} Ko` : ""}
                    {!r.taille_epub_kb && !r.taille_mobi_kb ? "—" : ""}
                  </td>
                  <td className="py-3 px-2 text-xs text-muted-foreground">
                    {new Date(r.created_at as string).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="py-3 px-2 text-right">
                    <div className="inline-flex gap-1">
                      {r.epub_path && (
                        <Button size="sm" variant="outline" onClick={() => download(r.epub_path!)} className="h-8">
                          <Download className="h-3 w-3" /> ePub
                        </Button>
                      )}
                      {r.mobi_path && (
                        <Button size="sm" variant="outline" onClick={() => download(r.mobi_path!)} className="h-8">
                          <Download className="h-3 w-3" /> MOBI
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(r.id)} className="h-8 text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StatusBadge({ statut, message }: { statut: string; message: string | null }) {
  if (statut === "termine")
    return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30"><CheckCircle2 className="h-3 w-3" /> Terminé</span>;
  if (statut === "echec")
    return <span title={message ?? ""} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30"><XCircle className="h-3 w-3" /> Échec</span>;
  if (statut === "en_cours")
    return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30"><Loader2 className="h-3 w-3 animate-spin" /> En cours</span>;
  return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">En attente</span>;
}
