import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, BookOpen, Loader2, Pencil, Trash2, FileSpreadsheet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { differenceInDays, format, startOfMonth, subMonths, startOfYear } from "date-fns";
import { fr } from "date-fns/locale";
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
import { AnalyticsSection, defaultRange, inRange, EmptyChart, type DateRange } from "@/components/analytics-section";
import { ManuscritImportDialog } from "@/components/manuscrit-import-dialog";

export const Route = createFileRoute("/_authenticated/manuscrits/")({
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
  const [importOpen, setImportOpen] = useState(false);

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
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Importer Excel
          </Button>
          <Button onClick={openNew} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" /> Nouveau manuscrit
          </Button>
        </div>
      </header>

      <EditorialAnalytics items={items} />

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
                          asChild title="Ouvrir"
                        >
                          <a href={`/manuscrits/${m.id}`}>
                            <BookOpen className="h-4 w-4" />
                          </a>
                        </Button>
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

      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        title="Limite atteinte"
        description={`Vous avez atteint la limite de ${plan.maxManuscrits} manuscrits du plan ${plan.label}. Passez au plan Pro pour ajouter des manuscrits illimités.`}
      />

      <ManuscritImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        entrepriseId={profile?.entreprise_id ?? null}
        existingTitles={(items ?? []).map((m) => m.titre)}
        maxManuscrits={plan.maxManuscrits}
        currentCount={items?.length ?? 0}
        onImported={load}
      />
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

import { STATUT_PROGRESSION as STAGE_ORDER, STATUT_LABEL as STAGE_LABEL } from "@/components/status-badge";

function EditorialAnalytics({ items }: { items: Manuscrit[] | null }) {
  const [range, setRange] = useState<DateRange>(defaultRange());

  const filtered = useMemo(() => (items ?? []).filter((m) => inRange(m.created_at, range)), [items, range]);

  const stageAvg = useMemo(() => {
    // approx: time spent in each stage based on created_at -> now for non-published
    // We don't have history; approximate using same created_at delta distribution by current statut
    const groups: Record<string, number[]> = {};
    (items ?? []).forEach((m) => {
      const days = differenceInDays(new Date(), new Date(m.created_at));
      groups[m.statut] = groups[m.statut] ?? [];
      groups[m.statut].push(days);
    });
    return STAGE_ORDER.map((s) => {
      const arr = groups[s] ?? [];
      const avg = arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
      return { stage: STAGE_LABEL[s], days: avg };
    });
  }, [items]);

  const lectureAvg = stageAvg.find((s) => s.stage === "Relecture")?.days ?? 0;
  const correctionAvg = stageAvg.find((s) => s.stage === "Épreuve 1")?.days ?? 0;

  const now = new Date();
  const monthStart = startOfMonth(now);
  const yearStart = startOfYear(now);
  const publishedThisMonth = (items ?? []).filter((m) => m.statut === "publie" && new Date(m.created_at) >= monthStart).length;
  const publishedThisYear = (items ?? []).filter((m) => m.statut === "publie" && new Date(m.created_at) >= yearStart).length;

  const perMonth = useMemo(() => {
    const buckets: { label: string; key: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = startOfMonth(subMonths(new Date(), i));
      buckets.push({ key: format(d, "yyyy-MM"), label: format(d, "MMM", { locale: fr }), count: 0 });
    }
    const map = new Map(buckets.map((b) => [b.key, b]));
    filtered.forEach((m) => {
      const b = map.get(m.created_at.slice(0, 7));
      if (b) b.count += 1;
    });
    return buckets;
  }, [filtered]);

  if (!items) return <Skeleton className="h-24 w-full" />;

  return (
    <AnalyticsSection title="📊 Analytiques éditoriales" range={range} setRange={setRange}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniCard label="Relecture (moy.)" value={`${lectureAvg} j`} />
        <MiniCard label="Épreuve 1 (moy.)" value={`${correctionAvg} j`} />
        <MiniCard label="Publiés ce mois" value={String(publishedThisMonth)} />
        <MiniCard label="Publiés cette année" value={String(publishedThisYear)} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-background/40 p-5">
          <h3 className="font-semibold mb-3">⏱️ Temps moyen par étape éditoriale</h3>
          <div className="h-64">
            {stageAvg.every((s) => s.days === 0) ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageAvg} layout="vertical" margin={{ left: 20 }}>
                  <defs>
                    <linearGradient id="stageGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#C8922A" />
                      <stop offset="100%" stopColor="#E8B84B" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" />
                  <XAxis type="number" stroke="#94A3B8" fontSize={12} />
                  <YAxis type="category" dataKey="stage" stroke="#94A3B8" fontSize={12} width={90} />
                  <Tooltip contentStyle={{ background: "#1A1208", border: "1px solid #1E3A5F", borderRadius: 8 }} formatter={(v: number) => `${v} jours`} />
                  <Bar dataKey="days" fill="url(#stageGrad)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-5">
          <h3 className="font-semibold mb-3">📅 Manuscrits ajoutés par mois</h3>
          <div className="h-64">
            {perMonth.every((b) => b.count === 0) ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" />
                  <XAxis dataKey="label" stroke="#94A3B8" fontSize={12} />
                  <YAxis stroke="#94A3B8" fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#1A1208", border: "1px solid #1E3A5F", borderRadius: 8 }} />
                  <Bar dataKey="count" fill="#C8922A" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </AnalyticsSection>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
