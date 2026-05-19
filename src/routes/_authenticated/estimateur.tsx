import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Calculator, Save, Loader2, Trash2, Zap, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { fcfa } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/estimateur")({
  component: EstimateurPage,
  head: () => ({ meta: [{ title: "Estimateur de coûts — FIGDITIONS" }] }),
});

// Rates (FCFA, marché de Bamako)
const RATE_PAGE = 8;
const COVER_SOFT = 500;
const COVER_HARD = 1200;
const DELESTAGE_PCT = 0.15;
const MARGE_LIBRAIRIE_PCT = 0.30;
const DROITS_AUTEUR_PCT = 0.10;

interface Manuscrit { id: string; titre: string; nombre_pages: number | null; }
interface Estimation {
  id: string; manuscrit_titre: string; nombre_exemplaires: number;
  cout_total: number; prix_vente_suggere: number; created_at: string;
}

function EstimateurPage() {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const [manuscrits, setManuscrits] = useState<Manuscrit[]>([]);
  const [history, setHistory] = useState<Estimation[] | null>(null);
  const [toDelete, setToDelete] = useState<Estimation | null>(null);

  const [manuscritId, setManuscritId] = useState<string>("");
  const [pages, setPages] = useState<number>(120);
  const [copies, setCopies] = useState<number>(500);
  const [couverture, setCouverture] = useState<"Souple" | "Rigide">("Souple");
  const [delestage, setDelestage] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);

  const loadHistory = async () => {
    setHistory(null);
    const { data, error } = await (supabase as any)
      .from("estimations_cout").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setHistory((data ?? []) as Estimation[]);
  };

  useEffect(() => {
    if (!profile?.entreprise_id) return;
    (async () => {
      const { data: ms } = await (supabase as any).from("manuscrits").select("id, titre, nombre_pages");
      setManuscrits((ms ?? []) as Manuscrit[]);
      loadHistory();
    })();
  }, [profile?.entreprise_id]);

  useEffect(() => {
    if (!manuscritId) return;
    const m = manuscrits.find((x) => x.id === manuscritId);
    if (m?.nombre_pages) setPages(m.nombre_pages);
  }, [manuscritId, manuscrits]);

  const calc = useMemo(() => {
    const coutPapier = pages * RATE_PAGE * copies;
    const coutCouverture = (couverture === "Souple" ? COVER_SOFT : COVER_HARD) * copies;
    const baseImpression = coutPapier + coutCouverture;
    const surcoutDelestage = delestage ? baseImpression * DELESTAGE_PCT : 0;
    const coutTotal = baseImpression + surcoutDelestage;
    const margeLibrairie = coutTotal * MARGE_LIBRAIRIE_PCT;
    const droitsAuteur = (coutTotal + margeLibrairie) * DROITS_AUTEUR_PCT;
    const prixVenteSuggere = coutTotal + margeLibrairie + droitsAuteur;
    const prixUnitaire = prixVenteSuggere / Math.max(copies, 1);
    return { coutPapier, coutCouverture, surcoutDelestage, coutTotal, margeLibrairie, droitsAuteur, prixVenteSuggere, prixUnitaire };
  }, [pages, copies, couverture, delestage]);

  const save = async () => {
    if (!profile?.entreprise_id) return toast.error("Profil non chargé");
    if (pages <= 0 || copies <= 0) return toast.error("Renseignez les pages et les exemplaires");
    const m = manuscrits.find((x) => x.id === manuscritId);
    setSaving(true);
    const { error } = await (supabase as any).from("estimations_cout").insert({
      entreprise_id: profile.entreprise_id,
      manuscrit_id: manuscritId || null,
      manuscrit_titre: m?.titre ?? "Sans titre",
      nombre_pages: pages,
      nombre_exemplaires: copies,
      type_couverture: couverture,
      inclure_delestage: delestage,
      cout_papier: calc.coutPapier,
      cout_couverture: calc.coutCouverture,
      surcout_delestage: calc.surcoutDelestage,
      cout_total: calc.coutTotal,
      marge_librairie: calc.margeLibrairie,
      droits_auteur: calc.droitsAuteur,
      prix_vente_suggere: calc.prixVenteSuggere,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Estimation sauvegardée");
    loadHistory();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const { error } = await (supabase as any).from("estimations_cout").delete().eq("id", toDelete.id);
    if (error) return toast.error(error.message);
    toast.success("Estimation supprimée");
    setHistory((prev) => prev?.filter((x) => x.id !== toDelete.id) ?? prev);
    setToDelete(null);
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Estimateur de coûts</h1>
        <p className="text-muted-foreground mt-1">Calculez le prix de revient et le prix de vente suggéré pour un tirage à Bamako.</p>
      </header>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Form */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 md:p-6 space-y-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calculator className="h-4 w-4 text-primary" /> Paramètres du tirage
          </div>

          <div className="space-y-2">
            <Label>Manuscrit</Label>
            <Select value={manuscritId} onValueChange={setManuscritId}>
              <SelectTrigger><SelectValue placeholder="Aucun (optionnel)" /></SelectTrigger>
              <SelectContent>
                {manuscrits.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Aucun manuscrit</div>}
                {manuscrits.map((m) => <SelectItem key={m.id} value={m.id}>{m.titre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Nombre de pages</Label>
              <Input type="number" min={1} value={pages} onChange={(e) => setPages(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Exemplaires</Label>
              <Input type="number" min={1} value={copies} onChange={(e) => setCopies(Number(e.target.value))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Type de couverture</Label>
            <Select value={couverture} onValueChange={(v) => setCouverture(v as "Souple" | "Rigide")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Souple">Souple — {fcfa(COVER_SOFT)} / ex.</SelectItem>
                <SelectItem value="Rigide">Rigide — {fcfa(COVER_HARD)} / ex.</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-4 py-3 cursor-pointer">
            <div>
              <p className="text-sm font-medium flex items-center gap-2"><Zap className="h-4 w-4 text-[color:var(--gold)]" /> Inclure le coût de groupe électrogène</p>
              <p className="text-xs text-muted-foreground mt-0.5">+15 % pour compenser les délestages</p>
            </div>
            <Switch checked={delestage} onCheckedChange={setDelestage} />
          </label>

          <Button onClick={save} disabled={saving} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Sauvegarder l'estimation</>}
          </Button>
        </div>

        {/* Results */}
        <div className="lg:col-span-3 rounded-2xl border border-border bg-gradient-to-br from-card to-background p-5 md:p-6 space-y-3 shadow-[0_0_40px_color-mix(in_oklab,var(--color-primary)_15%,transparent)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" /> Décomposition en temps réel
            </div>
            <span className="text-xs text-muted-foreground">{copies.toLocaleString("fr-FR")} ex. × {pages} p.</span>
          </div>

          <Row icon="📄" label="Coût papier" value={calc.coutPapier} />
          <Row icon="🖨️" label="Coût couverture" value={calc.coutCouverture} />
          {delestage && <Row icon="⚡" label="Surcoût délestage (15 %)" value={calc.surcoutDelestage} />}
          <Row icon="📦" label="Coût total impression" value={calc.coutTotal} strong />
          <Row icon="🏪" label="Marge librairie (30 %)" value={calc.margeLibrairie} muted />
          <Row icon="✍️" label="Droits auteur (10 %)" value={calc.droitsAuteur} muted />

          <div className="mt-4 rounded-xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/5 px-4 py-4 flex items-center justify-between shadow-[0_0_30px_color-mix(in_oklab,var(--gold)_25%,transparent)]">
            <div className="flex items-center gap-2">
              <span className="text-xl">💰</span>
              <div>
                <p className="text-xs uppercase tracking-wider text-[color:var(--gold)]/80">Prix de vente suggéré</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">≈ {fcfa(calc.prixUnitaire)} par exemplaire</p>
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-extrabold text-[color:var(--gold)]">{fcfa(calc.prixVenteSuggere)}</p>
          </div>
        </div>
      </div>

      {/* History */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Historique des estimations</h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {history === null ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center px-4">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <Calculator className="h-7 w-7" />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">Aucune estimation sauvegardée.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-muted-foreground">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-medium">Titre</th>
                    <th className="px-4 py-3 font-medium text-center">Exemplaires</th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell text-right">Coût total</th>
                    <th className="px-4 py-3 font-medium text-right">Prix suggéré</th>
                    <th className="px-4 py-3 font-medium hidden sm:table-cell">Date</th>
                    <th className="px-4 py-3 font-medium w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((e) => (
                    <tr key={e.id} className="group border-t border-border hover:bg-primary/5 transition-colors">
                      <td className="px-4 py-3 font-medium">{e.manuscrit_titre}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{e.nombre_exemplaires.toLocaleString("fr-FR")}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">{fcfa(e.cout_total)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[color:var(--gold)]">{fcfa(e.prix_vente_suggere)}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{new Date(e.created_at).toLocaleDateString("fr-FR")}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="icon" variant="ghost"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/15 hover:text-destructive"
                          onClick={() => setToDelete(e)} title="Supprimer">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette estimation ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Row({ icon, label, value, strong, muted }: { icon: string; label: string; value: number; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn(
      "flex items-center justify-between rounded-lg px-4 py-3 border",
      strong ? "border-primary/30 bg-primary/5" : "border-border bg-background/30"
    )}>
      <div className="flex items-center gap-2.5">
        <span className="text-lg">{icon}</span>
        <span className={cn("text-sm", muted && "text-muted-foreground")}>{label}</span>
      </div>
      <span className={cn(
        "font-mono tabular-nums text-sm",
        strong ? "text-primary font-bold text-base" : muted ? "text-muted-foreground" : "font-semibold"
      )}>{fcfa(value)}</span>
    </div>
  );
}
