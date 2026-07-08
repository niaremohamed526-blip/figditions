import { useEffect, useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { FileText, Loader2, Calendar as CalendarIcon, Download, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { fcfa } from "@/lib/format";
import { LockedPage } from "@/components/locked-page";
import { generateBordereauPdf, type BordereauLigne } from "@/lib/pdf-bordereau";

interface StockRow {
  id: string;
  manuscrit_id: string;
  librairie_nom: string | null;
  librairie_adresse: string | null;
  exemplaires_deposes: number;
  exemplaires_vendus: number;
  exemplaires_restants: number;
  prix_unitaire_fcfa: number | null;
}

interface VenteRow {
  id: string;
  manuscrit_id: string;
  quantite_vendue: number;
  prix_unitaire_fcfa: number | null;
  montant_total_fcfa: number | null;
  date_vente: string;
}

interface Bordereau {
  id: string;
  numero: string;
  type: "depot" | "vente";
  librairie_nom: string;
  librairie_adresse: string | null;
  periode_debut: string | null;
  periode_fin: string | null;
  lignes: BordereauLigne[];
  total_exemplaires: number;
  total_fcfa: number;
  notes: string | null;
  created_at: string;
}

interface Entreprise {
  nom: string;
  ville?: string | null;
  adresse?: string | null;
  email?: string | null;
  telephone?: string | null;
  plan?: string | null;
}

export function BordereauxTab({
  entreprise,
  stocks,
  titreMap,
}: {
  entreprise: Entreprise | null;
  stocks: StockRow[];
  titreMap: Record<string, string>;
}) {
  const isBusiness = (entreprise?.plan ?? "starter") === "business";
  const [items, setItems] = useState<Bordereau[] | null>(null);
  const [genOpen, setGenOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Bordereau | null>(null);
  const [deleting, setDeleting] = useState(false);

  const librairies = useMemo(() => {
    const map = new Map<string, StockRow[]>();
    stocks.forEach((s) => {
      const key = (s.librairie_nom ?? "").trim();
      if (!key) return;
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    });
    return [...map.entries()].map(([nom, rows]) => ({
      nom,
      adresse: rows.find((r) => r.librairie_adresse)?.librairie_adresse ?? null,
      rows,
    }));
  }, [stocks]);

  const load = async () => {
    setItems(null);
    const { data, error } = await supabase
      .from("bordereaux" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems(((data ?? []) as any) as Bordereau[]);
  };

  useEffect(() => { if (isBusiness) load(); }, [isBusiness]);

  if (!isBusiness) {
    return <LockedPage feature="les bordereaux de dépôt et de vente" requiredPlan="business" />;
  }

  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const { error } = await supabase.from("bordereaux" as any).delete().eq("id", toDelete.id);
    setDeleting(false);
    if (error) return toast.error(error.message);
    toast.success("Bordereau supprimé");
    setItems((prev) => prev?.filter((b) => b.id !== toDelete.id) ?? prev);
    setToDelete(null);
  };

  const reprint = async (b: Bordereau) => {
    if (!entreprise) return;
    await generateBordereauPdf({
      numero: b.numero,
      type: b.type,
      maison: entreprise.nom,
      maisonAdresse: entreprise.adresse,
      maisonVille: entreprise.ville,
      maisonEmail: entreprise.email,
      maisonTelephone: entreprise.telephone,
      librairieNom: b.librairie_nom,
      librairieAdresse: b.librairie_adresse,
      periodeDebut: b.periode_debut ? format(new Date(b.periode_debut), "dd MMM yyyy", { locale: fr }) : null,
      periodeFin: b.periode_fin ? format(new Date(b.periode_fin), "dd MMM yyyy", { locale: fr }) : null,
      dateEmission: format(new Date(b.created_at), "dd MMM yyyy", { locale: fr }),
      lignes: b.lignes,
      totalExemplaires: b.total_exemplaires,
      totalFcfa: Number(b.total_fcfa),
      notes: b.notes,
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-5 flex items-start gap-4 flex-wrap">
        <div className="h-12 w-12 rounded-xl bg-[color:var(--gold)]/15 text-[color:var(--gold)] flex items-center justify-center flex-shrink-0">
          <FileText className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-[240px]">
          <h2 className="font-semibold text-lg">Bordereaux dépôt & vente</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Générez des documents officiels signables par vous et le libraire, avec numérotation automatique et historique.
          </p>
        </div>
        <Button
          onClick={() => setGenOpen(true)}
          disabled={librairies.length === 0}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Sparkles className="h-4 w-4 mr-2" /> Générer un bordereau
        </Button>
      </div>

      {librairies.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Ajoutez au moins un dépôt en librairie pour pouvoir générer un bordereau.
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="font-semibold">📄 Historique des bordereaux</h3>
        </div>
        {items === null ? (
          <div className="p-5 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Aucun bordereau généré pour le moment.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-muted-foreground text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">N°</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Librairie</th>
                  <th className="px-4 py-3 font-medium">Période</th>
                  <th className="px-4 py-3 font-medium text-center">Ex.</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="px-4 py-3 font-medium">Émis le</th>
                  <th className="px-4 py-3 font-medium w-24 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((b) => (
                  <tr key={b.id} className="border-t border-border hover:bg-primary/5 group">
                    <td className="px-4 py-3 font-mono text-xs">{b.numero}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "inline-flex px-2 py-0.5 rounded-full text-xs border",
                        b.type === "vente"
                          ? "bg-primary/15 text-primary border-primary/30"
                          : "bg-blue-500/15 text-blue-400 border-blue-500/30",
                      )}>
                        {b.type === "vente" ? "Vente" : "Dépôt"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{b.librairie_nom}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {b.periode_debut && b.periode_fin
                        ? `${format(new Date(b.periode_debut), "dd/MM/yy")} → ${format(new Date(b.periode_fin), "dd/MM/yy")}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">{b.total_exemplaires}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[color:var(--gold)] font-semibold">
                      {b.type === "vente" ? fcfa(Number(b.total_fcfa)) : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(new Date(b.created_at), "dd MMM yyyy", { locale: fr })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-primary/15 hover:text-primary" title="Télécharger" onClick={() => reprint(b)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-destructive/15 hover:text-destructive" title="Supprimer" onClick={() => setToDelete(b)}>
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

      <GenerateDialog
        open={genOpen}
        onOpenChange={setGenOpen}
        entreprise={entreprise}
        librairies={librairies}
        titreMap={titreMap}
        onGenerated={load}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce bordereau ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le bordereau {toDelete?.numero} sera supprimé de l'historique. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); remove(); }}
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

interface Librairie {
  nom: string;
  adresse: string | null;
  rows: StockRow[];
}

function GenerateDialog({
  open, onOpenChange, entreprise, librairies, titreMap, onGenerated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entreprise: Entreprise | null;
  librairies: Librairie[];
  titreMap: Record<string, string>;
  onGenerated: () => void;
}) {
  const [type, setType] = useState<"depot" | "vente">("vente");
  const [librairieNom, setLibrairieNom] = useState<string>("");
  const [debut, setDebut] = useState<Date>(startOfMonth(new Date()));
  const [fin, setFin] = useState<Date>(endOfMonth(new Date()));
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setType("vente");
      setLibrairieNom(librairies[0]?.nom ?? "");
      setDebut(startOfMonth(new Date()));
      setFin(endOfMonth(new Date()));
      setNotes("");
    }
  }, [open, librairies]);

  const selected = librairies.find((l) => l.nom === librairieNom);

  const submit = async () => {
    if (!entreprise) return toast.error("Entreprise non chargée");
    if (!selected) return toast.error("Sélectionnez une librairie");

    setLoading(true);
    try {
      let lignes: BordereauLigne[] = [];
      let totalEx = 0;
      let totalFcfa = 0;

      if (type === "depot") {
        lignes = selected.rows.map((r) => ({
          titre: titreMap[r.manuscrit_id] ?? "—",
          quantite: r.exemplaires_deposes,
          prix_unitaire: Number(r.prix_unitaire_fcfa ?? 0),
          total: r.exemplaires_deposes * Number(r.prix_unitaire_fcfa ?? 0),
          deposes: r.exemplaires_deposes,
          vendus: r.exemplaires_vendus,
          restants: r.exemplaires_restants,
        }));
        totalEx = lignes.reduce((s, l) => s + (l.deposes ?? 0), 0);
        totalFcfa = lignes.reduce((s, l) => s + (l.total ?? 0), 0);
      } else {
        // Vente sur période : agréger les ventes de la période pour les manuscrits en dépôt chez cette librairie.
        const manuscritIds = [...new Set(selected.rows.map((r) => r.manuscrit_id))];
        const debutStr = format(debut, "yyyy-MM-dd");
        const finStr = format(fin, "yyyy-MM-dd");
        const { data: ventes, error } = await supabase
          .from("ventes")
          .select("manuscrit_id, quantite_vendue, prix_unitaire_fcfa, montant_total_fcfa, date_vente")
          .in("manuscrit_id", manuscritIds)
          .gte("date_vente", debutStr)
          .lte("date_vente", finStr);
        if (error) throw new Error(error.message);
        const map = new Map<string, { qte: number; montant: number; prix: number }>();
        (ventes ?? []).forEach((v: any) => {
          const cur = map.get(v.manuscrit_id) ?? { qte: 0, montant: 0, prix: 0 };
          cur.qte += Number(v.quantite_vendue ?? 0);
          cur.montant += Number(v.montant_total_fcfa ?? (v.quantite_vendue ?? 0) * (v.prix_unitaire_fcfa ?? 0));
          cur.prix = Number(v.prix_unitaire_fcfa ?? cur.prix);
          map.set(v.manuscrit_id, cur);
        });
        lignes = [...map.entries()].map(([mid, val]) => ({
          titre: titreMap[mid] ?? "—",
          quantite: val.qte,
          prix_unitaire: val.prix,
          total: val.montant,
        }));
        if (lignes.length === 0) {
          setLoading(false);
          return toast.error("Aucune vente enregistrée sur cette période pour les livres déposés chez cette librairie.");
        }
        totalEx = lignes.reduce((s, l) => s + l.quantite, 0);
        totalFcfa = lignes.reduce((s, l) => s + l.total, 0);
      }

      const { data, error } = await supabase.rpc("create_bordereau" as any, {
        p_type: type,
        p_librairie_nom: selected.nom,
        p_librairie_adresse: selected.adresse,
        p_periode_debut: type === "vente" ? format(debut, "yyyy-MM-dd") : null,
        p_periode_fin: type === "vente" ? format(fin, "yyyy-MM-dd") : null,
        p_lignes: lignes as any,
        p_total_exemplaires: totalEx,
        p_total_fcfa: totalFcfa,
        p_notes: notes || null,
      });
      if (error) throw new Error(error.message);

      const numero = (data as any)?.numero ?? "BRD";

      generateBordereauPdf({
        numero,
        type,
        maison: entreprise.nom,
        maisonAdresse: entreprise.adresse,
        maisonVille: entreprise.ville,
        maisonEmail: entreprise.email,
        maisonTelephone: entreprise.telephone,
        librairieNom: selected.nom,
        librairieAdresse: selected.adresse,
        periodeDebut: type === "vente" ? format(debut, "dd MMM yyyy", { locale: fr }) : null,
        periodeFin: type === "vente" ? format(fin, "dd MMM yyyy", { locale: fr }) : null,
        dateEmission: format(new Date(), "dd MMM yyyy", { locale: fr }),
        lignes,
        totalExemplaires: totalEx,
        totalFcfa: totalFcfa,
        notes: notes || null,
      });

      toast.success(`Bordereau ${numero} généré`);
      onOpenChange(false);
      onGenerated();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de la génération");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle>Générer un bordereau</DialogTitle>
          <DialogDescription>
            Le document sera numéroté automatiquement, archivé, puis téléchargé en PDF prêt à imprimer et signer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={type === "vente" ? "default" : "outline"}
              className={type === "vente" ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}
              onClick={() => setType("vente")}
            >
              Bordereau de vente
            </Button>
            <Button
              type="button"
              variant={type === "depot" ? "default" : "outline"}
              className={type === "depot" ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}
              onClick={() => setType("depot")}
            >
              Bordereau de dépôt
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Librairie</Label>
            <Select value={librairieNom} onValueChange={setLibrairieNom}>
              <SelectTrigger><SelectValue placeholder="Choisir une librairie…" /></SelectTrigger>
              <SelectContent>
                {librairies.map((l) => (
                  <SelectItem key={l.nom} value={l.nom}>{l.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {type === "vente" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Du</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(debut, "PPP", { locale: fr })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
                    <Calendar mode="single" selected={debut} onSelect={(d) => d && setDebut(d)} locale={fr} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Au</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(fin, "PPP", { locale: fr })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
                    <Calendar mode="single" selected={fin} onSelect={(d) => d && setFin(d)} locale={fr} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Notes (optionnel)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Ex. Règlement sous 30 jours après validation." />
          </div>

          {selected && type === "depot" && (
            <p className="text-xs text-muted-foreground">
              {selected.rows.length} ligne(s) de dépôt seront listées.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Annuler</Button>
          <Button onClick={submit} disabled={loading || !librairieNom} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><FileText className="h-4 w-4 mr-2" /> Générer et télécharger</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
