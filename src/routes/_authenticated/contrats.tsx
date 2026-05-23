import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, FileText, Loader2, Pencil, Trash2, Eye } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/contrats")({
  component: ContratsPage,
  head: () => ({ meta: [{ title: "Contrats — FIGDITIONS" }] }),
});

interface Contrat {
  id: string;
  manuscrit_id: string;
  auteur_id: string | null;
  pourcentage_droits: number;
  duree: string;
  statut: "brouillon" | "signe" | "expire";
  notes: string | null;
  date_signature: string | null;
  created_at: string;
}
interface Manuscrit { id: string; titre: string; auteur: string; auteur_id?: string | null; }
interface Auteur { id: string; nom_complet: string; }

const STATUT_LABELS: Record<string, string> = {
  brouillon: "Brouillon",
  signe: "Signé",
  expire: "Expiré",
};
const STATUT_CLS: Record<string, string> = {
  brouillon: "bg-muted/60 text-muted-foreground border-border",
  signe: "bg-primary/15 text-primary border-primary/40 shadow-[0_0_10px_var(--color-primary)]",
  expire: "bg-destructive/15 text-destructive border-destructive/40",
};

function StatutBadge({ s }: { s: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", STATUT_CLS[s] ?? STATUT_CLS.brouillon)}>
      {STATUT_LABELS[s] ?? s}
    </span>
  );
}

function ContratsPage() {
  const { user } = useAuth();
  const { profile, entreprise, loading: pLoading } = useProfile(user?.id);

  if (pLoading) return <div className="space-y-4"><Skeleton className="h-12 w-64" /><Skeleton className="h-96 w-full" /></div>;
  const plan = planFor(entreprise?.plan);
  if (!plan.contrats) return <LockedPage feature="le générateur de contrats OHADA" requiredPlan="pro" />;
  return <ContratsInner entrepriseId={profile?.entreprise_id ?? null} />;
}

function ContratsInner({ entrepriseId }: { entrepriseId: string | null }) {
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
      supabase.from("auteurs").select("id, nom_complet"),
    ]);
    if (error) toast.error(error.message);
    setItems((c ?? []) as Contrat[]);
    setManuscrits((ms ?? []) as Manuscrit[]);
    setAuteurs((as ?? []) as Auteur[]);
  };
  useEffect(() => { if (entrepriseId) load(); }, [entrepriseId]);

  const mMap = useMemo(() => Object.fromEntries(manuscrits.map((m) => [m.id, m])), [manuscrits]);
  const aMap = useMemo(() => Object.fromEntries(auteurs.map((a) => [a.id, a.nom_complet])), [auteurs]);

  const authorName = (c: Contrat) => {
    if (c.auteur_id && aMap[c.auteur_id]) return aMap[c.auteur_id];
    const m = mMap[c.manuscrit_id];
    if (m?.auteur_id && aMap[m.auteur_id]) return aMap[m.auteur_id];
    return m?.auteur ?? "—";
  };

  const filtered = useMemo(() => {
    if (!items) return null;
    const needle = q.toLowerCase().trim();
    if (!needle) return items;
    return items.filter((c) =>
      (mMap[c.manuscrit_id]?.titre ?? "").toLowerCase().includes(needle) ||
      authorName(c).toLowerCase().includes(needle),
    );
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

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contrats</h1>
          <p className="text-muted-foreground mt-1">Centralisez vos contrats d'édition et avenants.</p>
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
                  <th className="px-4 py-3 font-medium">Livre</th>
                  <th className="px-4 py-3 font-medium">Auteur</th>
                  <th className="px-4 py-3 font-medium">% Droits</th>
                  <th className="px-4 py-3 font-medium">Durée</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Créé</th>
                  <th className="px-4 py-3 font-medium w-32 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered?.map((c) => (
                  <tr key={c.id} className="group border-t border-border hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      <Link to="/contrats/$contratId" params={{ contratId: c.id }} className="hover:text-primary">
                        {mMap[c.manuscrit_id]?.titre ?? "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{authorName(c)}</td>
                    <td className="px-4 py-3"><span className="text-[color:var(--gold)] font-semibold">{c.pourcentage_droits}%</span></td>
                    <td className="px-4 py-3 text-muted-foreground">{c.duree}</td>
                    <td className="px-4 py-3"><StatutBadge s={c.statut} /></td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{new Date(c.created_at).toLocaleDateString("fr-FR")}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link to="/contrats/$contratId" params={{ contratId: c.id }}>
                          <Button size="icon" variant="ghost" className="h-8 w-8" title="Voir"><Eye className="h-4 w-4" /></Button>
                        </Link>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(c)} title="Modifier"><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-destructive/15 hover:text-destructive" onClick={() => setToDelete(c)} title="Supprimer"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ContratSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        entrepriseId={entrepriseId}
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
      <p className="mt-1 text-sm text-muted-foreground">Créez votre premier contrat d'édition.</p>
      {!hasAny && (
        <Button onClick={onCreate} className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Nouveau contrat
        </Button>
      )}
    </div>
  );
}

function ContratSheet({
  open, onOpenChange, entrepriseId, editing, manuscrits, auteurs, onSaved,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  entrepriseId: string | null;
  editing: Contrat | null;
  manuscrits: Manuscrit[];
  auteurs: Auteur[];
  onSaved: () => void;
}) {
  const [manuscritId, setManuscritId] = useState("");
  const [auteurId, setAuteurId] = useState<string>("");
  const [pourcentage, setPourcentage] = useState(10);
  const [duree, setDuree] = useState("3 ans");
  const [statut, setStatut] = useState<"brouillon" | "signe" | "expire">("brouillon");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setManuscritId(editing.manuscrit_id);
      setAuteurId(editing.auteur_id ?? "");
      setPourcentage(Number(editing.pourcentage_droits));
      setDuree(editing.duree);
      setStatut(editing.statut);
      setNotes(editing.notes ?? "");
    } else {
      setManuscritId(""); setAuteurId(""); setPourcentage(10); setDuree("3 ans"); setStatut("brouillon"); setNotes("");
    }
  }, [editing, open]);

  // auto-fill author from manuscript
  useEffect(() => {
    if (!manuscritId) return;
    const m = manuscrits.find((x) => x.id === manuscritId);
    if (m?.auteur_id) setAuteurId(m.auteur_id);
  }, [manuscritId, manuscrits]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entrepriseId) return;
    if (!manuscritId) return toast.error("Sélectionnez un manuscrit");
    setSaving(true);
    const payload: any = {
      entreprise_id: entrepriseId,
      manuscrit_id: manuscritId,
      auteur_id: auteurId || null,
      pourcentage_droits: pourcentage,
      duree,
      statut,
      notes: notes || null,
      date_signature: statut === "signe" ? new Date().toISOString().slice(0, 10) : null,
    };
    const { error } = editing
      ? await (supabase as any).from("contrats").update(payload).eq("id", editing.id)
      : await (supabase as any).from("contrats").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Contrat mis à jour" : "Contrat créé");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-card border-border w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editing ? "Modifier le contrat" : "Nouveau contrat"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={submit} className="space-y-4 mt-6 px-4 pb-6">
          <div className="space-y-2">
            <Label>Manuscrit *</Label>
            <Select value={manuscritId} onValueChange={setManuscritId}>
              <SelectTrigger><SelectValue placeholder="Choisir un manuscrit" /></SelectTrigger>
              <SelectContent>
                {manuscrits.map((m) => <SelectItem key={m.id} value={m.id}>{m.titre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Auteur</Label>
            <Select value={auteurId} onValueChange={setAuteurId}>
              <SelectTrigger><SelectValue placeholder="Auto-rempli depuis le manuscrit" /></SelectTrigger>
              <SelectContent>
                {auteurs.map((a) => <SelectItem key={a.id} value={a.id}>{a.nom_complet}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Pourcentage droits (%)</Label>
              <Input type="number" min={0} max={100} step={0.5} value={pourcentage} onChange={(e) => setPourcentage(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Durée</Label>
              <Input value={duree} onChange={(e) => setDuree(e.target.value)} placeholder="3 ans" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Statut</Label>
            <Select value={statut} onValueChange={(v) => setStatut(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="brouillon">Brouillon</SelectItem>
                <SelectItem value="signe">Signé</SelectItem>
                <SelectItem value="expire">Expiré</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Notes / clauses particulières</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
