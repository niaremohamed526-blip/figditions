import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, FileText, Loader2, Pencil, Trash2, Eye, FileDown, X, BookOpen, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { planFor } from "@/lib/plans";
import { LockedPage } from "@/components/locked-page";
import { generateContratProPdf, type Livre } from "@/lib/pdf-contrat-pro";
import { useCloseGuard } from "@/hooks/useCloseGuard";
import { UnsavedChangesModal } from "@/components/unsaved-changes-modal";

export const Route = createFileRoute("/_authenticated/contrats")({
  component: ContratsPage,
  head: () => ({ meta: [{ title: "Contrats & Droits — FIGDITIONS" }] }),
});

interface Contrat {
  id: string;
  manuscrit_id: string;
  auteur_id: string | null;
  pourcentage_droits: number;
  duree: string;
  statut: "brouillon" | "en_attente_signature" | "signe" | "expire" | "resilie";
  notes: string | null;
  date_signature: string | null;
  created_at: string;
  livres?: Livre[];
  duree_annees?: number;
  collection?: string | null;
  territoire_mali?: number;
  territoire_ci?: number;
  territoire_senegal?: number;
  territoire_france?: number;
}
interface Manuscrit { id: string; titre: string; auteur: string; auteur_id?: string | null }
interface Auteur { id: string; nom_complet: string; email?: string | null; telephone?: string | null; numero_mobile_money?: string | null }

const STATUT_LABELS: Record<string, string> = {
  brouillon: "Brouillon",
  signe: "Signé",
  expire: "Expiré",
  resilie: "Résilié",
};
const STATUT_CLS: Record<string, string> = {
  brouillon: "bg-muted/60 text-muted-foreground border-border",
  signe: "bg-emerald-500/15 text-emerald-500 border-emerald-500/40",
  expire: "bg-destructive/15 text-destructive border-destructive/40",
  resilie: "bg-orange-500/15 text-orange-500 border-orange-500/40",
};

function StatutBadge({ s }: { s: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", STATUT_CLS[s] ?? STATUT_CLS.brouillon)}>
      {STATUT_LABELS[s] ?? s}
    </span>
  );
}

function computeExpiry(c: Contrat): { daysLeft: number | null; expired: boolean } {
  if (!c.date_signature || !c.duree_annees) return { daysLeft: null, expired: false };
  const start = new Date(c.date_signature);
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + Number(c.duree_annees));
  const diff = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return { daysLeft: diff, expired: diff < 0 };
}

function ContratsPage() {
  const { user } = useAuth();
  const { profile, entreprise: entrepriseRaw, loading: pLoading } = useProfile(user?.id);
  const entreprise = entrepriseRaw as any;

  if (pLoading) return <div className="space-y-4"><Skeleton className="h-12 w-64" /><Skeleton className="h-96 w-full" /></div>;
  const plan = planFor(entreprise?.plan);
  if (!plan.contrats) return <LockedPage feature="le générateur de contrats OHADA" requiredPlan="pro" />;
  return <ContratsInner entrepriseId={profile?.entreprise_id ?? null} entreprise={entreprise} />;
}

function ContratsInner({ entrepriseId, entreprise }: { entrepriseId: string | null; entreprise: any }) {
  const [items, setItems] = useState<Contrat[] | null>(null);
  const [manuscrits, setManuscrits] = useState<Manuscrit[]>([]);
  const [auteurs, setAuteurs] = useState<Auteur[]>([]);
  const [q, setQ] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Contrat | null>(null);
  const [toDelete, setToDelete] = useState<Contrat | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setItems(null);
    const [{ data: c, error }, { data: ms }, { data: as }] = await Promise.all([
      (supabase as any).from("contrats").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("manuscrits").select("id, titre, auteur, auteur_id"),
      supabase.from("auteurs").select("id, nom_complet, email, telephone"),
    ]);
    if (error) toast.error(error.message);
    setItems((c ?? []) as Contrat[]);
    setManuscrits((ms ?? []) as Manuscrit[]);
    setAuteurs((as ?? []) as Auteur[]);
  };
  useEffect(() => { if (entrepriseId) load(); }, [entrepriseId]);

  const mMap = useMemo(() => Object.fromEntries(manuscrits.map((m) => [m.id, m])), [manuscrits]);
  const aMap = useMemo(() => Object.fromEntries(auteurs.map((a) => [a.id, a])), [auteurs]);

  const authorName = (c: Contrat) => {
    if (c.auteur_id && aMap[c.auteur_id]) return aMap[c.auteur_id].nom_complet;
    const m = mMap[c.manuscrit_id];
    if (m?.auteur_id && aMap[m.auteur_id]) return aMap[m.auteur_id].nom_complet;
    return m?.auteur ?? "—";
  };

  const filtered = useMemo(() => {
    if (!items) return null;
    const needle = q.toLowerCase().trim();
    if (!needle) return items;
    return items.filter((c) => {
      const titres = (Array.isArray(c.livres) && c.livres.length > 0 ? c.livres.map((l) => l.titre) : [mMap[c.manuscrit_id]?.titre ?? ""]).join(" ");
      return titres.toLowerCase().includes(needle) || authorName(c).toLowerCase().includes(needle);
    });
  }, [items, q, mMap, aMap]);

  const openCreate = () => { setEditing(null); setSheetOpen(true); };
  const openEdit = (c: Contrat) => { setEditing(c); setSheetOpen(true); };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const { error } = await (supabase as any).from("contrats").delete().eq("id", toDelete.id);
    setDeleting(false);
    if (error) return toast.error(error.message);
    toast.success("Contrat supprimé");
    setItems((prev) => prev?.filter((x) => x.id !== toDelete.id) ?? prev);
    setToDelete(null);
  };

  const downloadPdf = async (c: Contrat) => {
    const livres: Livre[] = Array.isArray(c.livres) && c.livres.length > 0
      ? c.livres
      : [{ titre: mMap[c.manuscrit_id]?.titre ?? "—", manuscrit_id: c.manuscrit_id }];
    const a = c.auteur_id ? aMap[c.auteur_id] : null;
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
        auteur: a?.nom_complet ?? authorName(c),
        adresse_auteur: (c as any).adresse_auteur,
        telephone_auteur: (c as any).telephone_auteur ?? a?.telephone,
        profession_auteur: (c as any).profession_auteur,
        collection: c.collection,
        livres,
        duree_annees: c.duree_annees ?? 10,
        pourcentage: Number(c.pourcentage_droits ?? 10),
        tirage_minimum: (c as any).tirage_minimum ?? 100,
        contribution_auteur: (c as any).contribution_auteur,
        format: (c as any).format,
        type_couverture: (c as any).type_couverture,
        reliure: (c as any).reliure,
        exemplaires_auteur: (c as any).exemplaires_auteur ?? 10,
        frequence_paiement: (c as any).frequence_paiement ?? "annuel",
        territoire_mali: c.territoire_mali ?? 20,
        territoire_ci: c.territoire_ci ?? 30,
        territoire_senegal: c.territoire_senegal ?? 30,
        territoire_france: c.territoire_france ?? 40,
        lieu_signature: (c as any).lieu_signature ?? entreprise?.ville ?? "Bamako",
        date_signature: c.date_signature ?? new Date().toISOString().slice(0, 10),
      });
      toast.success("PDF généré");
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur PDF");
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contrats</h1>
          <p className="text-muted-foreground mt-1">Contrats d'édition professionnels au format Malien.</p>
        </div>
        <Button onClick={openCreate} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Nouveau contrat
        </Button>
      </header>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher par titre ou auteur…" className="pl-9" />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {items === null ? (
          <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : filtered && filtered.length === 0 ? (
          <EmptyState onCreate={openCreate} hasAny={items.length > 0} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Livre(s)</th>
                  <th className="px-4 py-3 font-medium">Auteur</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">% Droits</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Territoires</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Durée</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium w-40 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered?.map((c) => {
                  const books = Array.isArray(c.livres) && c.livres.length > 0
                    ? c.livres
                    : [{ titre: mMap[c.manuscrit_id]?.titre ?? "—" }];
                  const firstTitle = books[0]?.titre ?? "—";
                  const { daysLeft, expired } = computeExpiry(c);
                  const warn = daysLeft !== null && daysLeft <= 90 && daysLeft >= 0 && c.statut === "signe";
                  return (
                    <tr key={c.id} className="group border-t border-border hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        <Link to="/contrats/$contratId" params={{ contratId: c.id }} className="hover:text-primary inline-flex items-center gap-2">
                          <span className="truncate max-w-[220px]">{firstTitle}</span>
                          {books.length > 1 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary text-[10px] font-semibold px-2 py-0.5">
                              <BookOpen className="h-3 w-3" /> +{books.length - 1}
                            </span>
                          )}
                        </Link>
                        {warn && (
                          <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-orange-500">
                            <AlertTriangle className="h-3 w-3" /> Expire dans {daysLeft} jour(s)
                          </div>
                        )}
                        {expired && c.statut === "signe" && (
                          <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-destructive">
                            <AlertTriangle className="h-3 w-3" /> Contrat expiré
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{authorName(c)}</td>
                      <td className="px-4 py-3 hidden sm:table-cell"><span className="text-[color:var(--gold)] font-semibold">{c.pourcentage_droits}%</span></td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">
                        ML {c.territoire_mali ?? 20}% · CI {c.territoire_ci ?? 30}% · SN {c.territoire_senegal ?? 30}% · FR {c.territoire_france ?? 40}%
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{c.duree_annees ? `${c.duree_annees} ans` : c.duree}</td>
                      <td className="px-4 py-3"><StatutBadge s={c.statut} /></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => downloadPdf(c)} title="PDF"><FileDown className="h-4 w-4" /></Button>
                          <Link to="/contrats/$contratId" params={{ contratId: c.id }}>
                            <Button size="icon" variant="ghost" className="h-8 w-8" title="Voir"><Eye className="h-4 w-4" /></Button>
                          </Link>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(c)} title="Modifier"><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-destructive/15 hover:text-destructive" onClick={() => setToDelete(c)} title="Supprimer"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ContratSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        entrepriseId={entrepriseId}
        entreprise={entreprise}
        editing={editing}
        manuscrits={manuscrits}
        auteurs={auteurs}
        onSaved={load}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce contrat ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
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

function EmptyState({ onCreate, hasAny }: { onCreate: () => void; hasAny: boolean }) {
  return (
    <div className="p-12 text-center">
      <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
        <FileText className="h-8 w-8" />
      </div>
      <h3 className="mt-4 font-semibold">{hasAny ? "Aucun contrat ne correspond" : "Aucun contrat pour l'instant"}</h3>
      <p className="mt-1 text-sm text-muted-foreground">Créez votre premier contrat d'édition professionnel.</p>
      {!hasAny && (
        <Button onClick={onCreate} className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Nouveau contrat
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// CONTRACT FORM SHEET
// ============================================================================

interface FormState {
  auteur_id: string;
  adresse_auteur: string;
  telephone_auteur: string;
  profession_auteur: string;
  collection: string;
  livres: Livre[];
  duree_annees: number;
  pourcentage_droits: number;
  tirage_minimum: number;
  contribution_auteur: string;
  format: string;
  type_couverture: string;
  reliure: string;
  exemplaires_auteur: number;
  frequence_paiement: string;
  territoire_mali: number;
  territoire_ci: number;
  territoire_senegal: number;
  territoire_france: number;
  lieu_signature: string;
  date_signature: string;
  statut: "brouillon" | "signe" | "expire" | "resilie";
  notes: string;
}

const defaultForm = (entreprise: any): FormState => ({
  auteur_id: "",
  adresse_auteur: "",
  telephone_auteur: "",
  profession_auteur: "",
  collection: "",
  livres: [{ titre: "" }],
  duree_annees: 10,
  pourcentage_droits: 10,
  tirage_minimum: 100,
  contribution_auteur: "",
  format: "24/26, 170gr",
  type_couverture: "Quadrichromie cartonnée",
  reliure: "Dos carré-collé",
  exemplaires_auteur: 10,
  frequence_paiement: "annuel",
  territoire_mali: 20,
  territoire_ci: 30,
  territoire_senegal: 30,
  territoire_france: 40,
  lieu_signature: entreprise?.ville ?? "Bamako",
  date_signature: new Date().toISOString().slice(0, 10),
  statut: "brouillon",
  notes: "",
});

const DRAFT_KEY = "figditions:contrat:draft";

function ContratSheet({
  open, onOpenChange, entrepriseId, entreprise, editing, manuscrits, auteurs, onSaved,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  entrepriseId: string | null;
  entreprise: any;
  editing: Contrat | null;
  manuscrits: Manuscrit[];
  auteurs: Auteur[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(defaultForm(entreprise));
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const initialRef = useRef<string>("");

  const upd = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  };

  // Init form on open / editing change
  useEffect(() => {
    if (!open) return;
    let next: FormState;
    if (editing) {
      next = {
        auteur_id: editing.auteur_id ?? "",
        adresse_auteur: (editing as any).adresse_auteur ?? "",
        telephone_auteur: (editing as any).telephone_auteur ?? "",
        profession_auteur: (editing as any).profession_auteur ?? "",
        collection: editing.collection ?? "",
        livres: Array.isArray(editing.livres) && editing.livres.length > 0
          ? editing.livres
          : [{ titre: manuscrits.find((m) => m.id === editing.manuscrit_id)?.titre ?? "", manuscrit_id: editing.manuscrit_id }],
        duree_annees: editing.duree_annees ?? 10,
        pourcentage_droits: Number(editing.pourcentage_droits ?? 10),
        tirage_minimum: (editing as any).tirage_minimum ?? 100,
        contribution_auteur: (editing as any).contribution_auteur ?? "",
        format: (editing as any).format ?? "24/26, 170gr",
        type_couverture: (editing as any).type_couverture ?? "Quadrichromie cartonnée",
        reliure: (editing as any).reliure ?? "Dos carré-collé",
        exemplaires_auteur: (editing as any).exemplaires_auteur ?? 10,
        frequence_paiement: (editing as any).frequence_paiement ?? "annuel",
        territoire_mali: editing.territoire_mali ?? 20,
        territoire_ci: editing.territoire_ci ?? 30,
        territoire_senegal: editing.territoire_senegal ?? 30,
        territoire_france: editing.territoire_france ?? 40,
        lieu_signature: (editing as any).lieu_signature ?? entreprise?.ville ?? "Bamako",
        date_signature: editing.date_signature ?? new Date().toISOString().slice(0, 10),
        statut: editing.statut,
        notes: editing.notes ?? "",
      };
    } else {
      // Try to load draft
      const raw = typeof window !== "undefined" ? localStorage.getItem(DRAFT_KEY) : null;
      if (raw) {
        try { next = { ...defaultForm(entreprise), ...JSON.parse(raw) }; }
        catch { next = defaultForm(entreprise); }
      } else {
        next = defaultForm(entreprise);
      }
    }
    setForm(next);
    initialRef.current = JSON.stringify(next);
    setDirty(false);
  }, [open, editing, entreprise, manuscrits]);

  // Track dirty
  useEffect(() => {
    if (!open) return;
    setDirty(JSON.stringify(form) !== initialRef.current);
  }, [form, open]);

  // Auto-save draft every 30s (create mode only)
  useEffect(() => {
    if (!open || editing) return;
    const id = setInterval(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(form)); } catch { /* noop */ }
    }, 30000);
    return () => clearInterval(id);
  }, [open, editing, form]);

  // Auto-fill author info when auteur_id changes
  useEffect(() => {
    const a = auteurs.find((x) => x.id === form.auteur_id);
    if (a && !form.telephone_auteur && a.telephone) {
      setForm((f) => ({ ...f, telephone_auteur: a.telephone ?? "" }));
    }
  }, [form.auteur_id, auteurs]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeSheet = () => onOpenChange(false);
  const { showModal, cancelClose, confirmDiscard, handleOpenChange } = useCloseGuard(dirty, closeSheet);

  const buildPdfPayload = () => {
    const a = auteurs.find((x) => x.id === form.auteur_id);
    return {
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
      auteur: a?.nom_complet ?? "L'AUTEUR",
      adresse_auteur: form.adresse_auteur,
      telephone_auteur: form.telephone_auteur,
      profession_auteur: form.profession_auteur,
      collection: form.collection,
      livres: form.livres.filter((l) => l.titre.trim()),
      duree_annees: form.duree_annees,
      pourcentage: form.pourcentage_droits,
      tirage_minimum: form.tirage_minimum,
      contribution_auteur: form.contribution_auteur,
      format: form.format,
      type_couverture: form.type_couverture,
      reliure: form.reliure,
      exemplaires_auteur: form.exemplaires_auteur,
      frequence_paiement: form.frequence_paiement,
      territoire_mali: form.territoire_mali,
      territoire_ci: form.territoire_ci,
      territoire_senegal: form.territoire_senegal,
      territoire_france: form.territoire_france,
      lieu_signature: form.lieu_signature,
      date_signature: form.date_signature,
    };
  };

  const preview = async () => {
    const validLivres = form.livres.filter((l) => l.titre.trim());
    if (validLivres.length === 0) return toast.error("Ajoutez au moins un livre");
    if (!form.auteur_id) return toast.error("Sélectionnez un auteur");
    setPreviewing(true);
    try { await generateContratProPdf(buildPdfPayload()); toast.success("Aperçu généré"); }
    catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    finally { setPreviewing(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entrepriseId) return;
    const validLivres = form.livres.filter((l) => l.titre.trim());
    if (validLivres.length === 0) return toast.error("Ajoutez au moins un livre");
    if (!form.auteur_id) return toast.error("Sélectionnez un auteur");

    // Ensure manuscrit_id (FK required). Use first livre's manuscrit_id or first available manuscript.
    let manuscritId = validLivres[0].manuscrit_id ?? null;
    if (!manuscritId) {
      manuscritId = manuscrits[0]?.id ?? null;
    }
    if (!manuscritId) return toast.error("Créez d'abord au moins un manuscrit dans le catalogue");

    setSaving(true);
    const payload: any = {
      entreprise_id: entrepriseId,
      manuscrit_id: manuscritId,
      auteur_id: form.auteur_id || null,
      pourcentage_droits: form.pourcentage_droits,
      duree: `${form.duree_annees} ans`,
      duree_annees: form.duree_annees,
      statut: form.statut,
      notes: form.notes || null,
      date_signature: form.statut === "signe" ? form.date_signature : (editing?.date_signature ?? null),
      livres: validLivres,
      collection: form.collection || null,
      adresse_auteur: form.adresse_auteur || null,
      telephone_auteur: form.telephone_auteur || null,
      profession_auteur: form.profession_auteur || null,
      tirage_minimum: form.tirage_minimum,
      contribution_auteur: form.contribution_auteur || null,
      format: form.format || null,
      type_couverture: form.type_couverture || null,
      reliure: form.reliure || null,
      exemplaires_auteur: form.exemplaires_auteur,
      frequence_paiement: form.frequence_paiement,
      territoire_mali: form.territoire_mali,
      territoire_ci: form.territoire_ci,
      territoire_senegal: form.territoire_senegal,
      territoire_france: form.territoire_france,
      lieu_signature: form.lieu_signature,
      // Snapshot legal fields from entreprise so contract stays consistent
      nif_editeur: entreprise?.nif ?? null,
      rccm_editeur: entreprise?.rccm ?? null,
      nina_editeur: entreprise?.nina ?? null,
      banque: entreprise?.banque ?? null,
      compte_bancaire: entreprise?.compte_bancaire ?? null,
      nom_representant_editeur: entreprise?.nom_representant ?? null,
      qualite_representant: entreprise?.qualite_representant ?? null,
      cachet_url: entreprise?.cachet_url ?? null,
    };
    const { error } = editing
      ? await (supabase as any).from("contrats").update(payload).eq("id", editing.id)
      : await (supabase as any).from("contrats").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Contrat mis à jour" : "Contrat créé");
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* noop */ }
    initialRef.current = JSON.stringify(form);
    setDirty(false);
    onOpenChange(false);
    onSaved();
  };

  const addLivre = () => {
    if (form.livres.length >= 10) return toast.error("Maximum 10 livres");
    setForm((f) => ({ ...f, livres: [...f.livres, { titre: "" }] }));
  };
  const removeLivre = (i: number) => {
    setForm((f) => ({ ...f, livres: f.livres.filter((_, idx) => idx !== i) }));
  };
  const setLivre = (i: number, patch: Partial<Livre>) => {
    setForm((f) => ({ ...f, livres: f.livres.map((l, idx) => idx === i ? { ...l, ...patch } : l) }));
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="bg-card border-border w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? "Modifier le contrat" : "Nouveau contrat d'édition"}</SheetTitle>
          </SheetHeader>
          <form onSubmit={submit} className="space-y-8 mt-6 px-4 pb-6">
            {/* SECTION 1: PARTIES */}
            <Section title="1. Parties du contrat" subtitle="L'éditeur est repris depuis vos paramètres.">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-1 text-sm">
                <p className="font-semibold">{entreprise?.nom ?? "—"}</p>
                <p className="text-xs text-muted-foreground">
                  {[entreprise?.nif && `NIF ${(entreprise as any)?.nif}`, entreprise?.rccm && `RCCM ${(entreprise as any)?.rccm}`, entreprise?.nina && `NINA ${(entreprise as any)?.nina}`].filter(Boolean).join(" · ") || "Renseignez vos identifiants légaux dans Paramètres."}
                </p>
                <p className="text-xs text-muted-foreground">
                  {entreprise?.nom_representant ? `Représenté par ${(entreprise as any)?.nom_representant}${entreprise?.qualite_representant ? ` (${(entreprise as any)?.qualite_representant})` : ""}` : "Représentant non défini"}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Auteur *</Label>
                <Select value={form.auteur_id} onValueChange={(v) => upd("auteur_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Choisir un auteur" /></SelectTrigger>
                  <SelectContent>
                    {auteurs.map((a) => <SelectItem key={a.id} value={a.id}>{a.nom_complet}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Adresse de l'auteur</Label>
                  <Input value={form.adresse_auteur} onChange={(e) => upd("adresse_auteur", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input value={form.telephone_auteur} onChange={(e) => upd("telephone_auteur", e.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Profession de l'auteur</Label>
                  <Input value={form.profession_auteur} onChange={(e) => upd("profession_auteur", e.target.value)} placeholder="Ex: Enseignant, Écrivain…" />
                </div>
              </div>
            </Section>

            {/* SECTION 2: OBJET */}
            <Section title="2. Objet du contrat" subtitle="Collection et livres concernés.">
              <div className="space-y-2">
                <Label>Nom de la collection</Label>
                <Input value={form.collection} onChange={(e) => upd("collection", e.target.value)} placeholder="ex: Contes et Légendes d'Afrique" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Livres ({form.livres.length}/10)</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addLivre} disabled={form.livres.length >= 10}>
                    <Plus className="h-4 w-4" /> Ajouter
                  </Button>
                </div>
                <div className="space-y-2">
                  {form.livres.map((l, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-1">
                        <Select value={l.manuscrit_id ?? "_manual"} onValueChange={(v) => {
                          if (v === "_manual") {
                            setLivre(i, { manuscrit_id: null });
                          } else {
                            const m = manuscrits.find((x) => x.id === v);
                            setLivre(i, { manuscrit_id: v, titre: m?.titre ?? l.titre });
                          }
                        }}>
                          <SelectTrigger><SelectValue placeholder="Depuis le catalogue" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_manual">✍️ Saisie manuelle</SelectItem>
                            {manuscrits.map((m) => <SelectItem key={m.id} value={m.id}>{m.titre}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input
                          value={l.titre}
                          onChange={(e) => setLivre(i, { titre: e.target.value })}
                          placeholder="Titre de l'ouvrage"
                        />
                      </div>
                      {form.livres.length > 1 && (
                        <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => removeLivre(i)}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {form.livres.some((l) => l.titre.trim()) && (
                  <p className="text-xs text-muted-foreground italic mt-2">
                    Aperçu: {form.livres.filter((l) => l.titre.trim()).map((l) => `« ${l.titre} »`).join(" et ")}
                  </p>
                )}
              </div>
            </Section>

            {/* SECTION 3: CONDITIONS */}
            <Section title="3. Conditions générales" subtitle="Durée, droits, technique et paiement.">
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Durée (années)</Label>
                  <Input type="number" min={1} max={99} value={form.duree_annees} onChange={(e) => upd("duree_annees", Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>% Droits d'auteur</Label>
                  <Input type="number" min={0} max={100} step={0.5} value={form.pourcentage_droits} onChange={(e) => upd("pourcentage_droits", Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Tirage minimum</Label>
                  <Input type="number" min={0} value={form.tirage_minimum} onChange={(e) => upd("tirage_minimum", Number(e.target.value))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Contribution financière de l'auteur (optionnel)</Label>
                <Textarea rows={2} value={form.contribution_auteur} onChange={(e) => upd("contribution_auteur", e.target.value)} placeholder="ex: L'auteur contribuera aux frais d'illustrations" />
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Format</Label>
                  <Input value={form.format} onChange={(e) => upd("format", e.target.value)} placeholder="24/26, 170gr" />
                </div>
                <div className="space-y-2">
                  <Label>Couverture</Label>
                  <Select value={form.type_couverture} onValueChange={(v) => upd("type_couverture", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Quadrichromie cartonnée">Quadrichromie cartonnée</SelectItem>
                      <SelectItem value="Souple pelliculée brillante">Souple pelliculée brillante</SelectItem>
                      <SelectItem value="Souple matte">Souple matte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Reliure</Label>
                  <Select value={form.reliure} onValueChange={(v) => upd("reliure", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Dos carré-collé">Dos carré-collé</SelectItem>
                      <SelectItem value="Piqué à cheval">Piqué à cheval</SelectItem>
                      <SelectItem value="Spirale">Spirale</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Exemplaires auteur</Label>
                  <Input type="number" min={0} value={form.exemplaires_auteur} onChange={(e) => upd("exemplaires_auteur", Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Fréquence de paiement</Label>
                  <Select value={form.frequence_paiement} onValueChange={(v) => upd("frequence_paiement", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="annuel">Une fois par an (décembre)</SelectItem>
                      <SelectItem value="semestriel">Deux fois par an</SelectItem>
                      <SelectItem value="trimestriel">Trimestriel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="pt-2">
                <Label className="text-sm text-muted-foreground uppercase tracking-wider">Commission libraire par territoire</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Mali (%)</Label>
                    <Input type="number" min={0} max={100} value={form.territoire_mali} onChange={(e) => upd("territoire_mali", Number(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Côte d'Ivoire (%)</Label>
                    <Input type="number" min={0} max={100} value={form.territoire_ci} onChange={(e) => upd("territoire_ci", Number(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Sénégal (%)</Label>
                    <Input type="number" min={0} max={100} value={form.territoire_senegal} onChange={(e) => upd("territoire_senegal", Number(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">France (%)</Label>
                    <Input type="number" min={0} max={100} value={form.territoire_france} onChange={(e) => upd("territoire_france", Number(e.target.value))} />
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 pt-2">
                <div className="space-y-2">
                  <Label>Lieu de signature</Label>
                  <Input value={form.lieu_signature} onChange={(e) => upd("lieu_signature", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Date de signature</Label>
                  <Input type="date" value={form.date_signature} onChange={(e) => upd("date_signature", e.target.value)} />
                </div>
              </div>
            </Section>

            {/* SECTION 4: STATUS */}
            <Section title="4. Statut">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select value={form.statut} onValueChange={(v) => upd("statut", v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="brouillon">Brouillon</SelectItem>
                      <SelectItem value="signe">Signé</SelectItem>
                      <SelectItem value="expire">Expiré</SelectItem>
                      <SelectItem value="resilie">Résilié</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes / clauses particulières</Label>
                <Textarea value={form.notes} onChange={(e) => upd("notes", e.target.value)} rows={3} />
              </div>
            </Section>

            <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-border sticky bottom-0 bg-card">
              <Button type="button" variant="outline" onClick={preview} disabled={previewing}>
                {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><FileDown className="h-4 w-4" /> Aperçu PDF</>}
              </Button>
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>Annuler</Button>
              <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <UnsavedChangesModal open={showModal} onContinue={cancelClose} onDiscard={confirmDiscard} />
    </>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="font-semibold text-base">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div className="space-y-3 pl-1">{children}</div>
    </section>
  );
}
