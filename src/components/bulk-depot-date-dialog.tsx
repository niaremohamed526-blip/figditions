import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarDays, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { pl } from "@/lib/plural";
import type { ExterneStockRow } from "@/components/librairies-tab";

/**
 * Change the deposit date of several books of one bookshop at once.
 * For each ticked book: its latest active deposit batch (history, bordereau,
 * "Dépôt du" heading) and its "Dernière visite" take the new date.
 */
export function BulkDepotDateDialog({
  open, onOpenChange, librairieNom, rows, titreMap, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  librairieNom: string;
  rows: ExterneStockRow[];
  titreMap: Record<string, string>;
  onDone: () => void;
}) {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(format(new Date(), "yyyy-MM-dd"));
    setChecked(Object.fromEntries(rows.map((r) => [r.id, true])));
  }, [open, rows]);

  const selected = rows.filter((r) => checked[r.id]);
  const allOn = selected.length === rows.length;

  const save = async () => {
    if (!date) return toast.error("Choisissez une date");
    if (selected.length === 0) return toast.error("Cochez au moins un livre");
    setSaving(true);
    try {
      const ids = selected.map((r) => r.id);
      const { error: stErr } = await supabase.from("stocks").update({ derniere_visite: date }).in("id", ids);
      if (stErr) throw stErr;

      // Latest active batch per book in this bookshop.
      const { data: batches, error: bErr } = await supabase
        .from("depot_batches")
        .select("id, manuscrit_id, date_depot, created_at, statut_annulation")
        .ilike("librairie_nom", librairieNom)
        .in("manuscrit_id", selected.map((r) => r.manuscrit_id))
        .order("date_depot", { ascending: false })
        .order("created_at", { ascending: false });
      if (bErr) throw bErr;
      const latest = new Map<string, string>();
      for (const b of batches ?? []) {
        if (b.statut_annulation === "annulee" || latest.has(b.manuscrit_id)) continue;
        latest.set(b.manuscrit_id, b.id);
      }
      if (latest.size > 0) {
        const { error: upErr } = await supabase
          .from("depot_batches").update({ date_depot: date }).in("id", [...latest.values()]);
        if (upErr) throw upErr;
      }

      toast.success(`Date du dépôt changée pour ${pl(selected.length, "livre")} chez « ${librairieNom} »`);
      onDone();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "La date n'a pas pu être changée");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-[color:var(--gold)]" />
            Changer la date du dépôt
          </DialogTitle>
          <DialogDescription>
            {librairieNom} : la date choisie remplace la date du dépôt et la dernière visite des livres cochés.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs">Nouvelle date du dépôt</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-input" />
          </div>

          <div className="rounded-xl border border-border">
            <label className="flex items-center gap-3 border-b border-border px-3 py-2.5 text-sm font-semibold cursor-pointer">
              <Checkbox
                checked={allOn}
                onCheckedChange={(v) => setChecked(Object.fromEntries(rows.map((r) => [r.id, !!v])))}
              />
              Tous les livres ({rows.length})
            </label>
            <div className="max-h-64 overflow-y-auto">
              {rows.map((r) => (
                <label key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-muted/30">
                  <Checkbox
                    checked={!!checked[r.id]}
                    onCheckedChange={(v) => setChecked((c) => ({ ...c, [r.id]: !!v }))}
                  />
                  <span className="min-w-0 flex-1 truncate">{titreMap[r.manuscrit_id] ?? "—"}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{pl(r.exemplaires_deposes ?? 0, "déposé")}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button>
          <Button onClick={save} disabled={saving || selected.length === 0} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CalendarDays className="h-4 w-4 mr-2" />}
            Appliquer à {pl(selected.length, "livre")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
