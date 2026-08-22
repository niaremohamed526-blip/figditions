import { useMemo, useState } from "react";
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
import { Plus, Wallet, Pencil, Trash2, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DEPENSE_CATEGORIES, categorieLabel, fmtFCFA, type DepenseRow } from "@/lib/finance-types";

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
}: {
  depenses: DepenseRow[];
  manuscrits: ManuscritLite[];
  entrepriseId: string;
  userId: string;
  onChanged: () => void;
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

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
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
        const { error } = await (supabase as any).from("depenses").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("✅ Dépense modifiée");
      } else {
        const { error } = await (supabase as any)
          .from("depenses")
          .insert({ ...payload, entreprise_id: entrepriseId, created_by: userId });
        if (error) throw error;
        toast.success("✅ Dépense enregistrée");
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
      const { error } = await (supabase as any).from("depenses").delete().eq("id", toDelete.id);
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
      <Card className="bg-card/70">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wallet className="h-5 w-5 text-[color:var(--gold)]" />
                Dépenses
              </CardTitle>
              <CardDescription>
                {filtered.length} dépense(s) — total {fmtFCFA(totalFiltered)}. Rattachez une dépense à un livre pour alimenter sa rentabilité.
              </CardDescription>
            </div>
            <Button
              onClick={openCreate}
              className="bg-[linear-gradient(135deg,#C8922A,#A67420)] text-white border-0 rounded-[10px] font-semibold"
            >
              <Plus className="h-4 w-4 mr-2" /> Ajouter une dépense
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative sm:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une dépense…" className="pl-9" />
            </div>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger><SelectValue placeholder="Catégorie" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {DEPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground text-sm">
              Aucune dépense enregistrée. Ajoutez vos impressions, livraisons, salons, etc.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Catégorie</th>
                    <th className="py-2 pr-3">Libellé</th>
                    <th className="py-2 pr-3">Livre lié</th>
                    <th className="py-2 pr-3 text-right">Montant</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => (
                    <tr key={d.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="py-2.5 pr-3 whitespace-nowrap">{new Date(d.date_depense).toLocaleDateString("fr-FR")}</td>
                      <td className="py-2.5 pr-3">
                        <Badge variant="outline" className={cn("text-[10px]", CATEGORIE_COLORS[d.categorie] ?? CATEGORIE_COLORS.autre)}>
                          {categorieLabel(d.categorie)}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3">
                        <p className="font-medium">{d.libelle}</p>
                        {d.notes && <p className="text-[11px] text-muted-foreground">{d.notes}</p>}
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground">
                        {d.manuscrit_id ? (manuscritMap.get(d.manuscrit_id) ?? "—") : <span className="text-[11px]">Charge globale</span>}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-semibold text-red-400">{fmtFCFA(d.montant_fcfa)}</td>
                      <td className="py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(d)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-300" onClick={() => setToDelete(d)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog création/édition */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "✏️ Modifier la dépense" : "💸 Nouvelle dépense"}</DialogTitle>
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
                placeholder="Ex : Impression 500 ex. — L'ivresse du sommeil"
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
            <Button onClick={save} disabled={busy} className="bg-[linear-gradient(135deg,#C8922A,#A67420)] text-white border-0">
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
              « {toDelete?.libelle} » — {fmtFCFA(toDelete?.montant_fcfa ?? 0)}. La suppression sera consignée dans le journal d'audit.
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
