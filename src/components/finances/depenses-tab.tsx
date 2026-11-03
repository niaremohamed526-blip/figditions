import { useEffect, useMemo, useState } from "react";
import { pl } from "@/lib/plural";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Wallet, Pencil, Trash2, Loader2, Search, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Eyebrow, Montant, Panel, Pastille, Vide, GOLD_BUTTON, fmtMontant } from "@/components/finances/finance-ui";

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
        active ? "border-[#C8922A] bg-[#C8922A] text-white" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
import { DEPENSE_CATEGORIES, categorieLabel, type DepenseRow } from "@/lib/finance-types";
import { fcfa } from "@/lib/format";

interface ManuscritLite { id: string; titre: string; }

const CATEGORIE_COLORS: Record<string, string> = {
  impression: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  mise_en_page: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  couverture: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  livraison: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  salon_evenement: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  marketing: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  loyer: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  salaires: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  materiel: "bg-teal-500/15 text-teal-400 border-teal-500/30",
  frais_administratifs: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  autre: "bg-muted text-muted-foreground border-border",
};

interface FormState {
  categorie: string;
  libelle: string;
  montant: string;
  date: string;
  manuscrit_id: string;
  notes: string;
}

const emptyForm = (): FormState => ({
  categorie: "impression",
  libelle: "",
  montant: "",
  date: new Date().toISOString().slice(0, 10),
  manuscrit_id: "none",
  notes: "",
});

export function DepensesTab({
  depenses,
  manuscrits,
  entrepriseId,
  userId,
  onChanged,
  autoOpen = false,
  onAutoOpened,
}: {
  depenses: DepenseRow[];
  manuscrits: ManuscritLite[];
  entrepriseId: string;
  userId: string;
  onChanged: () => void;
  /** Demandé depuis la Vue d'ensemble : ouvre directement « Nouvelle dépense ». */
  autoOpen?: boolean;
  onAutoOpened?: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DepenseRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<DepenseRow | null>(null);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");

  const manuscritMap = useMemo(() => new Map(manuscrits.map((m) => [m.id, m.titre])), [manuscrits]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return depenses
      .filter((d) => (catFilter === "all" || d.categorie === catFilter))
      .filter((d) => !q || `${d.libelle} ${d.notes ?? ""} ${manuscritMap.get(d.manuscrit_id ?? "") ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => b.date_depense.localeCompare(a.date_depense));
  }, [depenses, search, catFilter, manuscritMap]);

  const totalFiltered = filtered.reduce((a, d) => a + Number(d.montant_fcfa || 0), 0);

  const totaux = useMemo(() => {
    const now = new Date();
    const y = String(now.getFullYear());
    const m = `${y}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const sum = (p: string) => depenses.filter((d) => d.date_depense.startsWith(p)).reduce((a, d) => a + Number(d.montant_fcfa || 0), 0);
    return { mois: sum(m), annee: sum(y) };
  }, [depenses]);

  /** Total par catégorie (les plus lourdes d'abord) : sert de filtre en un clic. */
  const parCategorie = useMemo(() => {
    const map = new Map<string, number>();
    depenses.forEach((d) => map.set(d.categorie, (map.get(d.categorie) ?? 0) + Number(d.montant_fcfa || 0)));
    return [...map.entries()]
      .map(([value, total]) => ({ value, label: categorieLabel(value), total }))
      .sort((x, y) => y.total - x.total);
  }, [depenses]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  useEffect(() => {
    if (autoOpen) { openCreate(); onAutoOpened?.(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen]);

  /** Même dépense, datée d'aujourd'hui : loyer, salaires, abonnements… */
  const openDuplicate = (d: DepenseRow) => {
    setEditing(null);
    setForm({
      categorie: d.categorie,
      libelle: d.libelle,
      montant: String(d.montant_fcfa),
      date: new Date().toISOString().slice(0, 10),
      manuscrit_id: d.manuscrit_id ?? "none",
      notes: "",
    });
    setDialogOpen(true);
  };

  const openEdit = (d: DepenseRow) => {
    setEditing(d);
    setForm({
      categorie: d.categorie,
      libelle: d.libelle,
      montant: String(d.montant_fcfa),
      date: d.date_depense,
      manuscrit_id: d.manuscrit_id ?? "none",
      notes: d.notes ?? "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    const montant = Number(form.montant);
    if (!form.libelle.trim()) { toast.error("Le libellé est requis"); return; }
    if (!montant || montant <= 0) { toast.error("Montant invalide"); return; }
    if (!form.date) { toast.error("Date requise"); return; }
    setBusy(true);
    try {
      const payload = {
        categorie: form.categorie,
        libelle: form.libelle.trim(),
        montant_fcfa: montant,
        date_depense: form.date,
        manuscrit_id: form.manuscrit_id === "none" ? null : form.manuscrit_id,
        notes: form.notes.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from("depenses").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Dépense modifiée");
      } else {
        const { error } = await supabase
          .from("depenses")
          .insert({ ...payload, entreprise_id: entrepriseId, created_by: userId });
        if (error) throw error;
        toast.success("Dépense enregistrée");
      }
      setDialogOpen(false);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de l'enregistrement");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("depenses").delete().eq("id", toDelete.id);
      if (error) throw error;
      toast.success("Dépense supprimée");
      setToDelete(null);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de la suppression");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Panel accent className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Eyebrow>{catFilter === "all" && !search ? "Toutes vos dépenses" : "Dépenses affichées"}</Eyebrow>
            <Montant value={totalFiltered} size="xl" className="mt-2" />
            <p className="mt-3 text-sm text-muted-foreground">
              Ce mois <span className="tabular-nums text-foreground">{fmtMontant(totaux.mois)}</span>
              <span className="mx-2 text-border">|</span>
              Cette année <span className="tabular-nums text-foreground">{fmtMontant(totaux.annee)}</span>
            </p>
          </div>
          <Button onClick={openCreate} className={GOLD_BUTTON}>
            <Plus className="h-4 w-4" /> Ajouter une dépense
          </Button>
        </div>
      </Panel>

      <Panel>
        <div className="space-y-3 p-5 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une dépense…" className="pl-9" />
          </div>
          {parCategorie.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <Chip active={catFilter === "all"} onClick={() => setCatFilter("all")}>Toutes</Chip>
              {parCategorie.map((c) => (
                <Chip key={c.value} active={catFilter === c.value} onClick={() => setCatFilter(catFilter === c.value ? "all" : c.value)}>
                  {c.label} <span className="tabular-nums opacity-70">{fmtMontant(c.total)}</span>
                </Chip>
              ))}
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          <Vide>
            {depenses.length === 0
              ? "Aucune dépense pour l'instant. Ajoutez vos impressions, livraisons, salons…"
              : "Aucune dépense ne correspond à cette recherche."}
          </Vide>
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {filtered.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                <Pastille className={cn("border", CATEGORIE_COLORS[d.categorie] ?? CATEGORIE_COLORS.autre)}>
                  {categorieLabel(d.categorie).charAt(0)}
                </Pastille>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{d.libelle}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {new Date(d.date_depense).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                    {" · "}{categorieLabel(d.categorie)}
                    {" · "}{d.manuscrit_id ? (manuscritMap.get(d.manuscrit_id) ?? "Livre") : "Charge globale"}
                    {d.notes ? ` · ${d.notes}` : ""}
                  </p>
                </div>
                <p className="shrink-0 text-right font-semibold tabular-nums">
                  {fmtMontant(Number(d.montant_fcfa))}
                  <span className="block text-[11px] font-normal text-muted-foreground">FCFA</span>
                </p>
                <div className="flex shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openDuplicate(d)} title="Refaire cette dépense aujourd'hui" aria-label="Refaire cette dépense aujourd'hui">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(d)} title="Modifier" aria-label="Modifier">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-400" onClick={() => setToDelete(d)} title="Supprimer" aria-label="Supprimer">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Dialog création/édition */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier la dépense" : "Nouvelle dépense"}</DialogTitle>
            <DialogDescription>Chaque dépense est journalisée dans l'audit financier.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <Select value={form.categorie} onValueChange={(v) => setForm((f) => ({ ...f, categorie: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Libellé *</Label>
              <Input
                value={form.libelle}
                onChange={(e) => setForm((f) => ({ ...f, libelle: e.target.value }))}
                placeholder="Ex : Impression 500 ex. : L'ivresse du sommeil"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Montant (FCFA) *</Label>
              <Input type="number" min={1} value={form.montant} onChange={(e) => setForm((f) => ({ ...f, montant: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Livre concerné (optionnel)</Label>
              <Select value={form.manuscrit_id} onValueChange={(v) => setForm((f) => ({ ...f, manuscrit_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Charge globale" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Charge globale (non affectée)</SelectItem>
                  {manuscrits.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.titre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Référence facture, fournisseur…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={busy}>Annuler</Button>
            <Button onClick={save} disabled={busy} className={GOLD_BUTTON}>
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation suppression */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette dépense ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {toDelete?.libelle} » : {fcfa(toDelete?.montant_fcfa ?? 0)}. La suppression sera consignée dans le journal d'audit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={remove} disabled={busy} className="bg-red-600 text-white hover:bg-red-500">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
