import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, BookOpen, Loader2, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, STATUT_OPTIONS } from "@/components/status-badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { planFor } from "@/lib/plans";
import { UpgradeModal } from "@/components/upgrade-modal";

export const Route = createFileRoute("/_authenticated/manuscrits")({
  component: ManuscritsPage,
  head: () => ({ meta: [{ title: "Manuscrits — FIGDITIONS" }] }),
});

interface Manuscrit {
  id: string; titre: string; auteur: string; genre: string | null; langue: string | null;
  statut: string; created_at: string;
}

function ManuscritsPage() {
  const { user } = useAuth();
  const { profile, entreprise } = useProfile(user?.id);
  const plan = planFor(entreprise?.plan);
  const [items, setItems] = useState<Manuscrit[] | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Manuscrit | null>(null);
  const [toDelete, setToDelete] = useState<Manuscrit | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const load = async () => {
    setItems(null);
    const { data, error } = await supabase
      .from("manuscrits")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data ?? []) as Manuscrit[]);
  };

  useEffect(() => { if (profile?.entreprise_id) load(); }, [profile?.entreprise_id]);

  const filtered = useMemo(() => {
    if (!items) return null;
    return items.filter((m) =>
      (filter === "all" || m.statut === filter) &&
      (q.trim() === "" || `${m.titre} ${m.auteur} ${m.genre ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    );
  }, [items, q, filter]);

  const openNew = () => {
    if ((items?.length ?? 0) >= plan.maxManuscrits) { setUpgradeOpen(true); return; }
    setEditing(null); setSheetOpen(true);
  };
  const openEdit = (m: Manuscrit) => { setEditing(m); setSheetOpen(true); };

  const updateStatut = async (m: Manuscrit, statut: string) => {
    if (m.statut === statut) return;
    // optimistic
    setItems((prev) => prev?.map((x) => x.id === m.id ? { ...x, statut } : x) ?? prev);
    const { error } = await supabase.from("manuscrits").update({ statut: statut as any }).eq("id", m.id);
    if (error) {
      toast.error(error.message);
      setItems((prev) => prev?.map((x) => x.id === m.id ? { ...x, statut: m.statut } : x) ?? prev);
      return;
    }
    toast.success("Statut mis à jour");
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const { error } = await supabase.from("manuscrits").delete().eq("id", toDelete.id);
    setDeleting(false);
    if (error) return toast.error(error.message);
    toast.success("Manuscrit supprimé");
    setItems((prev) => prev?.filter((x) => x.id !== toDelete.id) ?? prev);
    setToDelete(null);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manuscrits</h1>
          <p className="text-muted-foreground mt-1">Suivez l'avancement de chaque ouvrage.</p>
        </div>
        <Button onClick={openNew} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" /> Nouveau manuscrit
        </Button>
      </header>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher par titre, auteur, genre…" value={q}
            onChange={(e) => setQ(e.target.value)} className="pl-9 bg-card" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-full sm:w-48 bg-card"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {STATUT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {filtered === null ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasItems={(items?.length ?? 0) > 0} onAdd={openNew} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Titre</th>
                  <th className="px-4 py-3 font-medium">Auteur</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Genre</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">Langue</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Ajouté</th>
                  <th className="px-4 py-3 font-medium w-20 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} className="group border-t border-border hover:bg-primary/5 transition-colors">
                    <td className="px-4 py-3 font-medium">{m.titre}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.auteur}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{m.genre ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{m.langue ?? "—"}</td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="transition-all duration-300 hover:scale-105 cursor-pointer"
                            title="Changer le statut"
                          >
                            <StatusBadge statut={m.statut} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="bg-card border-border">
                          {STATUT_OPTIONS.map((o) => (
                            <DropdownMenuItem
                              key={o.value}
                              onClick={() => updateStatut(m, o.value)}
                              className="cursor-pointer"
                            >
                              <StatusBadge statut={o.value} />
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {new Date(m.created_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <Button
                          size="icon" variant="ghost"
                          className="h-8 w-8 hover:bg-primary/15 hover:text-primary"
                          onClick={() => openEdit(m)}
                          title="Modifier"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon" variant="ghost"
                          className="h-8 w-8 hover:bg-destructive/15 hover:text-destructive"
                          onClick={() => setToDelete(m)}
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="bg-card border-border w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing ? "Modifier le manuscrit" : "Ajouter un manuscrit"}</SheetTitle>
          </SheetHeader>
          <ManuscritForm
            key={editing?.id ?? "new"}
            entrepriseId={profile?.entreprise_id ?? null}
            existing={editing}
            onSaved={() => { setSheetOpen(false); load(); }}
          />
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce manuscrit ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce manuscrit&nbsp;? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyState({ hasItems, onAdd }: { hasItems: boolean; onAdd: () => void }) {
  return (
    <div className="py-16 text-center px-4">
      <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
        <BookOpen className="h-8 w-8" />
      </div>
      <h3 className="mt-4 font-semibold">
        {hasItems ? "Aucun résultat" : "Aucun manuscrit"}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {hasItems ? "Essayez d'ajuster vos filtres." : "Ajoutez votre premier manuscrit pour commencer."}
      </p>
      {!hasItems && (
        <Button onClick={onAdd} className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" /> Ajouter un manuscrit
        </Button>
      )}
    </div>
  );
}

function ManuscritForm({
  entrepriseId, existing, onSaved,
}: {
  entrepriseId: string | null;
  existing: Manuscrit | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    titre: existing?.titre ?? "",
    auteur: existing?.auteur ?? "",
    genre: existing?.genre ?? "",
    langue: existing?.langue ?? "Français",
    statut: existing?.statut ?? "recu",
  });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entrepriseId) return toast.error("Profil non chargé");
    setLoading(true);
    const payload = {
      titre: form.titre,
      auteur: form.auteur,
      genre: form.genre || null,
      langue: form.langue,
      statut: form.statut as any,
    };
    const { error } = existing
      ? await supabase.from("manuscrits").update(payload).eq("id", existing.id)
      : await supabase.from("manuscrits").insert({ ...payload, entreprise_id: entrepriseId });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(existing ? "Manuscrit mis à jour avec succès" : "Manuscrit ajouté");
    onSaved();
  };

  return (
    <form onSubmit={submit} className="space-y-4 mt-6">
      <div className="space-y-2">
        <Label>Titre</Label>
        <Input required value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Auteur</Label>
        <Input required value={form.auteur} onChange={(e) => setForm({ ...form, auteur: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Genre</Label>
          <Input value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Langue</Label>
          <Input value={form.langue} onChange={(e) => setForm({ ...form, langue: e.target.value })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Statut</Label>
        <Select value={form.statut} onValueChange={(v) => setForm({ ...form, statut: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (existing ? "Enregistrer les modifications" : "Enregistrer")}
      </Button>
    </form>
  );
}
