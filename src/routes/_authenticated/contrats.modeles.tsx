import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowDown, ArrowUp, Check, Copy, FileDown, FileText, Loader2, Plus, Pencil, Sparkles,
  Star, Trash2, AlertTriangle, Braces, Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { planFor } from "@/lib/plans";
import { LockedPage } from "@/components/locked-page";
import { useCloseGuard } from "@/hooks/useCloseGuard";
import { UnsavedChangesModal } from "@/components/unsaved-changes-modal";
import { ContratImportDialog } from "@/components/contrat-import-dialog";
import {
  ARTICLES_HISTORIQUES, CHAMPS, COULEURS_CONTRAT, DONNEES_EXEMPLE, MODELE_EXEMPLE, STYLES_CONTRAT, TYPES_CONTRAT,
  champsInconnus, couleurRgb, estCouleurPerso,
  type ArticleModele, type ContratModele, type CouleurContrat, type StyleContrat, type TypeContrat,
} from "@/lib/contrat-template";
import { genererPdfContrat } from "@/lib/contrat-pdf";
import type { ContratProPdfData } from "@/lib/pdf-contrat-pro";

export const Route = createFileRoute("/_authenticated/contrats/modeles")({
  component: ModelesPage,
  head: () => ({ meta: [{ title: "Mes modèles de contrat | FIGDITIONS" }] }),
});

type Brouillon = Omit<ContratModele, "id" | "entreprise_id" | "updated_at"> & { id?: string };

const VIDE: Brouillon = {
  nom: "",
  type_contrat: "edition",
  titre_document: "Contrat d'édition",
  sous_titre: "Conditions générales",
  articles: [{ titre: "Objet du contrat", texte: "" }],
  couleur: "or",
  style: "classique",
  filigrane: true,
  par_defaut: false,
  source: "manuel",
};

const SOURCE_LABEL: Record<string, string> = { manuel: "Créé ici", exemple: "Exemple FIGDITIONS", import: "Importé par Medmo" };
const hex = (c: string) => "#" + couleurRgb(c).map((n) => n.toString(16).padStart(2, "0")).join("");

function ModelesPage() {
  const { user } = useAuth();
  const { profile, entreprise: entrepriseRaw, loading } = useProfile(user?.id);
  const entreprise = entrepriseRaw as any;
  if (loading) return <div className="space-y-4"><Skeleton className="h-12 w-64" /><Skeleton className="h-96 w-full" /></div>;
  if (!planFor(entreprise?.plan).contrats) return <LockedPage feature="Contrats & Droits" requiredPlan="pro" />;
  return <ModelesInner entrepriseId={profile?.entreprise_id ?? null} entreprise={entreprise} userId={user?.id ?? null} />;
}

function ModelesInner({ entrepriseId, entreprise, userId }: { entrepriseId: string | null; entreprise: any; userId: string | null }) {
  const [items, setItems] = useState<ContratModele[] | null>(null);
  const [editing, setEditing] = useState<Brouillon | null>(null);
  const [toDelete, setToDelete] = useState<ContratModele | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const load = async () => {
    const { data, error } = await (supabase as any).from("contrat_modeles").select("*").order("created_at");
    if (error) { toast.error(error.message); setItems([]); return; }
    setItems((data ?? []) as ContratModele[]);
  };
  useEffect(() => { if (entrepriseId) load(); }, [entrepriseId]);

  const nouveau = (from: "exemple" | "standard" | "vide") => {
    if (from === "exemple") setEditing({ ...VIDE, ...structuredClone(MODELE_EXEMPLE), source: "exemple", par_defaut: !items?.length });
    else if (from === "standard") setEditing({ ...VIDE, nom: "Contrat d'édition (texte actuel)", articles: structuredClone(ARTICLES_HISTORIQUES), par_defaut: !items?.length });
    else setEditing({ ...VIDE, par_defaut: !items?.length });
  };

  const dupliquer = (m: ContratModele) => {
    const { id: _id, entreprise_id: _e, updated_at: _u, ...rest } = m;
    setEditing({ ...structuredClone(rest), nom: `${m.nom} (copie)`, par_defaut: false, source: "manuel" });
  };

  const parDefaut = async (m: ContratModele) => {
    // Clear the old default first: one default per house (unique index).
    const { error: e1 } = await (supabase as any).from("contrat_modeles").update({ par_defaut: false }).eq("par_defaut", true).neq("id", m.id);
    const { error: e2 } = e1 ? { error: e1 } : await (supabase as any).from("contrat_modeles").update({ par_defaut: true }).eq("id", m.id);
    if (e2) return toast.error(e2.message);
    toast.success(`« ${m.nom} » est le modèle par défaut`);
    load();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const { error } = await (supabase as any).from("contrat_modeles").delete().eq("id", toDelete.id);
    setDeleting(false);
    if (error) return toast.error(error.message);
    toast.success("Modèle supprimé");
    setToDelete(null);
    load();
  };

  return (
    <div className="space-y-6">
      <Link to="/contrats" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour aux contrats
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mes modèles de contrat</h1>
          <p className="text-muted-foreground mt-1">Votre texte, vos articles, vos couleurs. Chaque nouveau contrat part du modèle choisi.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Sparkles className="h-4 w-4" /> Importer mon contrat
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" /> Nouveau modèle</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuItem onClick={() => nouveau("exemple")}>
                <div><p className="font-medium">Partir de l'exemple FIGDITIONS</p><p className="text-xs text-muted-foreground">14 articles génériques à adapter</p></div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => nouveau("standard")}>
                <div><p className="font-medium">Partir du texte actuel</p><p className="text-xs text-muted-foreground">Le texte utilisé jusqu'ici par vos contrats</p></div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => nouveau("vide")}>
                <div><p className="font-medium">Page blanche</p><p className="text-xs text-muted-foreground">Écrivez vos articles vous-même</p></div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {items === null ? (
        <div className="grid sm:grid-cols-2 gap-4">{[0, 1].map((i) => <Skeleton key={i} className="h-40 w-full" />)}</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center"><FileText className="h-7 w-7" /></div>
          <h3 className="mt-4 font-semibold">Aucun modèle pour l'instant</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
            Vos contrats utilisent le texte standard FIGDITIONS. Importez votre propre contrat (Word, PDF ou photo) et Medmo le transforme en modèle, ou partez de notre exemple.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" /> Importer mon contrat</Button>
            <Button variant="outline" onClick={() => nouveau("exemple")}>Partir de l'exemple</Button>
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((m) => (
            <div key={m.id} className="group rounded-xl border border-border bg-card overflow-hidden flex flex-col">
              <MiniPage modele={m} maison={entreprise?.nom} />
              <div className="p-4 flex-1 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold leading-tight">{m.nom}</p>
                  {m.par_defaut && (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary text-[10px] font-semibold px-2 py-0.5">
                      <Star className="h-3 w-3" /> Par défaut
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {TYPES_CONTRAT.find((t) => t.value === m.type_contrat)?.label} · {m.articles?.length ?? 0} articles · {STYLES_CONTRAT.find((s) => s.value === m.style)?.label ?? "Classique"} · {SOURCE_LABEL[m.source]}
                </p>
                <div className="mt-auto pt-2 flex flex-wrap gap-1">
                  <Button size="sm" variant="outline" onClick={() => setEditing(structuredClone(m))}><Pencil className="h-3.5 w-3.5" /> Modifier</Button>
                  <Button size="sm" variant="ghost" onClick={() => dupliquer(m)} title="Dupliquer"><Copy className="h-3.5 w-3.5" /></Button>
                  {!m.par_defaut && <Button size="sm" variant="ghost" onClick={() => parDefaut(m)} title="Utiliser par défaut"><Star className="h-3.5 w-3.5" /></Button>}
                  <Button size="sm" variant="ghost" className="hover:bg-destructive/15 hover:text-destructive" onClick={() => setToDelete(m)} title="Supprimer"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ModeleEditor
        value={editing}
        onClose={() => setEditing(null)}
        entrepriseId={entrepriseId}
        entreprise={entreprise}
        userId={userId}
        onSaved={() => { setEditing(null); load(); }}
      />

      <ContratImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={(m) => { setImportOpen(false); setEditing({ ...VIDE, ...m, source: "import", par_defaut: !items?.length }); }}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {toDelete?.nom} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les contrats signés gardent leur texte. Les contrats non signés qui utilisent ce modèle repasseront au texte standard FIGDITIONS.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Small paper preview of a template's look on its card. */
function MiniPage({ modele, maison }: { modele: Pick<ContratModele, "couleur" | "style" | "titre_document">; maison?: string }) {
  const c = hex(modele.couleur);
  const style = modele.style ?? "classique";
  return (
    <div className="h-28 bg-muted/40 flex items-center justify-center border-b border-border">
      <div className="relative h-24 w-[72px] bg-white rounded-[3px] shadow-md overflow-hidden" style={{ fontFamily: style === "moderne" ? "Helvetica, Arial, sans-serif" : "Georgia, 'Times New Roman', serif" }}>
        {style === "moderne" && <div className="h-4" style={{ background: c }} />}
        <div className={cn("px-1.5 text-center", style === "moderne" ? "pt-1.5" : "pt-2")}>
          {style !== "moderne" && <div className="text-[4px] tracking-[0.15em] font-bold text-neutral-800 truncate">{(maison ?? "MAISON").toUpperCase()}</div>}
          {style !== "moderne" && <div className="mt-0.5 h-px" style={{ background: style === "epure" ? "#333" : c }} />}
          <div className="mt-1.5 text-[5px] font-bold tracking-[0.12em] text-neutral-900 truncate">{(modele.titre_document || "CONTRAT").toUpperCase()}</div>
          <div className="mx-auto mt-0.5 h-[1.5px] w-5" style={{ background: style === "epure" ? "#333" : c }} />
          <div className="mt-1.5 grid grid-cols-2 gap-0.5">
            {[0, 1].map((i) => (
              <div key={i} className="h-3 rounded-[1px]" style={style === "epure" ? { border: "0.5px solid #bbb" } : { background: `${c}1f`, borderLeft: style === "classique" ? `1px solid ${c}` : undefined, borderTop: style === "moderne" ? `1px solid ${c}` : undefined }} />
            ))}
          </div>
          <div className="mt-1 space-y-[2px]">
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-[1.5px] bg-neutral-300" style={{ width: i === 4 ? "60%" : "100%" }} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function ModeleEditor({ value, onClose, entrepriseId, entreprise, userId, onSaved }: {
  value: Brouillon | null;
  onClose: () => void;
  entrepriseId: string | null;
  entreprise: any;
  userId: string | null;
  onSaved: () => void;
}) {
  const open = !!value;
  const [m, setM] = useState<Brouillon>(VIDE);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const initial = useRef("");
  const areas = useRef<(HTMLTextAreaElement | null)[]>([]);
  const [focusIdx, setFocusIdx] = useState(0);

  useEffect(() => {
    if (!value) return;
    setM(value);
    initial.current = JSON.stringify(value);
  }, [value]);

  const dirty = open && JSON.stringify(m) !== initial.current;
  const { showModal, cancelClose, confirmDiscard, handleOpenChange } = useCloseGuard(dirty, onClose);

  const upd = <K extends keyof Brouillon>(k: K, v: Brouillon[K]) => setM((x) => ({ ...x, [k]: v }));
  const setArticle = (i: number, patch: Partial<ArticleModele>) =>
    setM((x) => ({ ...x, articles: x.articles.map((a, j) => (j === i ? { ...a, ...patch } : a)) }));
  const move = (i: number, d: -1 | 1) => setM((x) => {
    const a = [...x.articles];
    const j = i + d;
    if (j < 0 || j >= a.length) return x;
    [a[i], a[j]] = [a[j], a[i]];
    return { ...x, articles: a };
  });
  const removeArticle = (i: number) => setM((x) => ({ ...x, articles: x.articles.filter((_, j) => j !== i) }));
  const addArticle = () => {
    setM((x) => ({ ...x, articles: [...x.articles, { titre: "", texte: "" }] }));
    setTimeout(() => { const el = areas.current[m.articles.length]; el?.focus(); el?.scrollIntoView({ block: "center", behavior: "smooth" }); }, 50);
  };

  /** Insert {cle} where the cursor is in the last focused article. */
  const insertChamp = (cle: string) => {
    const i = Math.min(focusIdx, m.articles.length - 1);
    if (i < 0) return;
    const el = areas.current[i];
    const t = m.articles[i].texte;
    const start = el?.selectionStart ?? t.length;
    const end = el?.selectionEnd ?? t.length;
    const token = `{${cle}}`;
    setArticle(i, { texte: t.slice(0, start) + token + t.slice(end) });
    setTimeout(() => { el?.focus(); el?.setSelectionRange(start + token.length, start + token.length); }, 0);
  };

  const inconnus = useMemo(() => m.articles.map((a) => champsInconnus(`${a.titre} ${a.texte}`)), [m.articles]);
  const groupes = useMemo(() => [...new Set(CHAMPS.map((c) => c.groupe))], []);

  // Preview with the house's real details and a sample author/books.
  const apercu = async () => {
    setPreviewing(true);
    try {
      const data: ContratProPdfData = {
        ...(DONNEES_EXEMPLE as ContratProPdfData),
        maison: entreprise?.nom || DONNEES_EXEMPLE.maison,
        ville_maison: entreprise?.ville ?? DONNEES_EXEMPLE.ville_maison,
        adresse_editeur: entreprise?.adresse,
        telephone_editeur: entreprise?.telephone,
        email_editeur: entreprise?.email ?? entreprise?.email_contact,
        website_editeur: entreprise?.website,
        nif: entreprise?.nif, rccm: entreprise?.rccm, nina: entreprise?.nina,
        banque: entreprise?.banque, compte_bancaire: entreprise?.compte_bancaire,
        nom_representant: entreprise?.nom_representant || DONNEES_EXEMPLE.nom_representant,
        qualite_representant: entreprise?.qualite_representant || DONNEES_EXEMPLE.qualite_representant,
        logo_url: entreprise?.logo_url, cachet_url: entreprise?.cachet_url,
        lieu_signature: entreprise?.ville || DONNEES_EXEMPLE.lieu_signature,
      };
      await genererPdfContrat({ data, modele: m as ContratModele, apercu: true });
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur PDF");
    } finally {
      setPreviewing(false);
    }
  };

  const save = async () => {
    if (!entrepriseId) return;
    if (!m.nom.trim()) return toast.error("Donnez un nom au modèle");
    const articles = m.articles.map((a) => ({ titre: a.titre.trim(), texte: a.texte.trim() })).filter((a) => a.titre || a.texte);
    if (articles.length === 0) return toast.error("Ajoutez au moins un article");
    setSaving(true);
    try {
      if (m.par_defaut) {
        let q = (supabase as any).from("contrat_modeles").update({ par_defaut: false }).eq("par_defaut", true);
        if (m.id) q = q.neq("id", m.id);
        const { error } = await q;
        if (error) throw error;
      }
      const row = {
        nom: m.nom.trim(),
        type_contrat: m.type_contrat,
        titre_document: m.titre_document.trim() || "Contrat",
        sous_titre: m.sous_titre?.trim() || null,
        articles,
        couleur: m.couleur,
        style: m.style,
        filigrane: m.filigrane,
        par_defaut: m.par_defaut,
        source: m.source,
      };
      const { error } = m.id
        ? await (supabase as any).from("contrat_modeles").update(row).eq("id", m.id)
        : await (supabase as any).from("contrat_modeles").insert({ ...row, entreprise_id: entrepriseId, created_by: userId });
      if (error) throw error;
      toast.success(m.id ? "Modèle enregistré" : "Modèle créé");
      initial.current = JSON.stringify(m);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const perso = estCouleurPerso(m.couleur);

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="bg-card border-border w-full sm:max-w-3xl overflow-y-auto p-0">
          <SheetHeader className="px-6 pt-6">
            <SheetTitle>{m.id ? "Modifier le modèle" : "Nouveau modèle de contrat"}</SheetTitle>
          </SheetHeader>

          <div className="px-6 pb-6 mt-4 space-y-8">
            {(m.source === "exemple" || m.source === "import") && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p>
                  {m.source === "exemple"
                    ? "Texte d'exemple fourni par FIGDITIONS : adaptez-le à votre maison et faites-le valider par votre juriste avant de l'utiliser."
                    : "Texte reconnu par Medmo à partir de votre document : relisez chaque article, vérifiez les champs entre accolades, puis enregistrez."}
                </p>
              </div>
            )}

            <section className="space-y-3">
              <h3 className="font-semibold">Informations</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Nom du modèle *</Label>
                  <Input value={m.nom} onChange={(e) => upd("nom", e.target.value)} placeholder="ex : Contrat d'édition jeunesse" />
                </div>
                <div className="space-y-2">
                  <Label>Type de contrat</Label>
                  <Select value={m.type_contrat} onValueChange={(v) => {
                    const t = TYPES_CONTRAT.find((x) => x.value === v);
                    setM((x) => ({
                      ...x,
                      type_contrat: v as TypeContrat,
                      // Follow the type's title unless the house typed its own.
                      titre_document: TYPES_CONTRAT.some((y) => y.titre === x.titre_document) ? (t?.titre ?? x.titre_document) : x.titre_document,
                    }));
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[400]">
                      {TYPES_CONTRAT.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Titre du document</Label>
                  <Input value={m.titre_document} onChange={(e) => upd("titre_document", e.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Sous-titre (optionnel)</Label>
                  <Input value={m.sous_titre ?? ""} onChange={(e) => upd("sous_titre", e.target.value)} placeholder="ex : Conditions générales" />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="font-semibold">Thème de la feuille</h3>
              <div className="space-y-2">
                <Label>Couleur</Label>
                <div className="flex flex-wrap items-center gap-2">
                  {COULEURS_CONTRAT.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      title={c.label}
                      onClick={() => upd("couleur", c.value)}
                      className={cn("h-9 w-9 rounded-full border-2 flex items-center justify-center transition", m.couleur === c.value ? "border-foreground scale-110" : "border-transparent")}
                      style={{ background: `rgb(${c.rgb.join(",")})` }}
                    >
                      {m.couleur === c.value && <Check className="h-4 w-4 text-white" />}
                    </button>
                  ))}
                  <label
                    title="Couleur de votre marque"
                    className={cn("relative h-9 rounded-full border-2 px-3 flex items-center gap-2 cursor-pointer text-xs", perso ? "border-foreground" : "border-border")}
                  >
                    <span className="h-5 w-5 rounded-full border border-border" style={{ background: perso ? m.couleur : "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }} />
                    {perso ? m.couleur.toUpperCase() : "Ma couleur"}
                    <input
                      type="color"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      value={hex(m.couleur)}
                      onChange={(e) => upd("couleur", e.target.value as CouleurContrat)}
                    />
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Style</Label>
                <div className="grid sm:grid-cols-3 gap-3">
                  {STYLES_CONTRAT.map((st) => (
                    <button
                      key={st.value}
                      type="button"
                      onClick={() => upd("style", st.value as StyleContrat)}
                      className={cn("rounded-xl border text-left overflow-hidden transition", m.style === st.value ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/50")}
                    >
                      <MiniPage modele={{ couleur: m.couleur, style: st.value, titre_document: m.titre_document }} maison={entreprise?.nom} />
                      <div className="p-3">
                        <p className="font-medium text-sm">{st.label}</p>
                        <p className="text-xs text-muted-foreground">{st.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">Logo en filigrane</p>
                    <p className="text-xs text-muted-foreground">{entreprise?.logo_url ? "Votre logo, très clair, au centre de chaque page" : "Sans logo : le nom de la maison en diagonale"}</p>
                  </div>
                  <Switch checked={m.filigrane} onCheckedChange={(v) => upd("filigrane", v)} />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">Modèle par défaut</p>
                    <p className="text-xs text-muted-foreground">Proposé pour chaque nouveau contrat</p>
                  </div>
                  <Switch checked={m.par_defaut} onCheckedChange={(v) => upd("par_defaut", v)} />
                </label>
              </div>
              {!entreprise?.logo_url && (
                <p className="text-xs text-muted-foreground">
                  Ajoutez votre logo dans <Link to="/parametres" className="text-primary hover:underline">Paramètres → Maison d'édition</Link> pour l'afficher en tête et en filigrane.
                </p>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="font-semibold">Articles ({m.articles.length})</h3>
                  <p className="text-xs text-muted-foreground max-w-lg">
                    Les champs entre accolades, comme <code className="text-primary">{"{auteur}"}</code>, sont remplacés par les informations du contrat.
                    Une phrase écrite <code className="text-primary">{"[[contribution_auteur: …]]"}</code> n'apparaît que si le champ est rempli.
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" size="sm" variant="outline"><Braces className="h-4 w-4" /> Insérer un champ</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto w-64 z-[400]">
                    {groupes.map((g, gi) => (
                      <div key={g}>
                        {gi > 0 && <DropdownMenuSeparator />}
                        <DropdownMenuLabel className="text-xs text-muted-foreground">{g}</DropdownMenuLabel>
                        {CHAMPS.filter((c) => c.groupe === g).map((c) => (
                          <DropdownMenuItem key={c.cle} onClick={() => insertChamp(c.cle)}>
                            <span className="flex-1">{c.label}</span>
                            <code className="text-[10px] text-muted-foreground">{c.cle}</code>
                          </DropdownMenuItem>
                        ))}
                      </div>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="space-y-3">
                {m.articles.map((a, i) => (
                  <div key={i} className={cn("rounded-xl border bg-background/40 p-3 space-y-2", focusIdx === i ? "border-primary/50" : "border-border")}>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold tracking-widest text-primary shrink-0">ARTICLE {i + 1}</span>
                      <Input
                        value={a.titre}
                        onChange={(e) => setArticle(i, { titre: e.target.value })}
                        onFocus={() => setFocusIdx(i)}
                        placeholder="Titre de l'article"
                        className="h-8"
                      />
                      <div className="flex shrink-0">
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(i, -1)} disabled={i === 0} title="Monter"><ArrowUp className="h-4 w-4" /></Button>
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(i, 1)} disabled={i === m.articles.length - 1} title="Descendre"><ArrowDown className="h-4 w-4" /></Button>
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 hover:bg-destructive/15 hover:text-destructive" onClick={() => removeArticle(i)} title="Retirer"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <Textarea
                      ref={(el) => { areas.current[i] = el; }}
                      value={a.texte}
                      onChange={(e) => setArticle(i, { texte: e.target.value })}
                      onFocus={() => setFocusIdx(i)}
                      rows={Math.min(10, Math.max(3, Math.ceil(a.texte.length / 90)))}
                      placeholder="Texte de l'article…"
                      className="text-sm leading-relaxed"
                    />
                    {inconnus[i].length > 0 && (
                      <p className="text-xs text-amber-500 flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Champ inconnu : {inconnus[i].map((k) => `{${k}}`).join(", ")}. Il restera vide dans le contrat ; choisissez-en un dans « Insérer un champ ».
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" onClick={addArticle} className="w-full border-dashed">
                <Plus className="h-4 w-4" /> Ajouter un article
              </Button>
            </section>
          </div>

          <div className="sticky bottom-0 z-10 border-t border-border bg-card/95 backdrop-blur px-6 py-3 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={apercu} disabled={previewing}>
              {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><FileDown className="h-4 w-4" /> Aperçu PDF</>}
            </Button>
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>Annuler</Button>
            <Button type="button" onClick={save} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer le modèle"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      <UnsavedChangesModal open={showModal} onContinue={cancelClose} onDiscard={confirmDiscard} />
    </>
  );
}
