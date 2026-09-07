import { useEffect, useMemo, useState } from "react";
import {
  Plus, Search, Globe, Loader2, Pencil, Trash2, BookOpen, BadgeCheck, Coins,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetch-all";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { fcfa } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DistributionBadge, DISTRIBUTION_OPTIONS, ETRANGER_ACCENT } from "./distribution-badge";

export interface LivreEtranger {
  id: string;
  titre: string;
  auteur: string;
  editeur_origine: string | null;
  statut_distribution: string | null;
  prix_vente_fcfa: number | null;
  notes: string | null;
  created_at: string;
}

interface VenteLite { manuscrit_id: string; quantite_vendue: number; montant_total_fcfa: number }

export function EtrangersTab({
  items,
  entrepriseId,
  onChanged,
}: {
  items: LivreEtranger[] | null;
  entrepriseId: string | null;
  onChanged: () => void;
}) {
  const [q, setQ] = useState("");
  const [statutFilter, setStatutFilter] = useState("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<LivreEtranger | null>(null);
  const [toDelete, setToDelete] = useState<LivreEtranger | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [ventes, setVentes] = useState<VenteLite[]>([]);

  useEffect(() => {
    if (!entrepriseId) return;
    fetchAllRows<VenteLite>(() =>
      supabase.from("ventes")
        .select("manuscrit_id, quantite_vendue, montant_total_fcfa")
        .eq("statut_annulation", "active"),
    ).then(setVentes).catch(() => setVentes([]));
  }, [entrepriseId, items]);

  const statsParLivre = useMemo(() => {
    const map = new Map<string, { qte: number; ca: number }>();
    ventes.forEach((v) => {
      const e = map.get(v.manuscrit_id) ?? { qte: 0, ca: 0 };
      e.qte += Number(v.quantite_vendue || 0);
      e.ca += Number(v.montant_total_fcfa || 0);
      map.set(v.manuscrit_id, e);
    });
    return map;
  }, [ventes]);

  const totaux = useMemo(() => {
    const list = items ?? [];
    return {
      total: list.length,
      disponibles: list.filter((m) => (m.statut_distribution ?? "disponible") === "disponible").length,
      ca: list.reduce((a, m) => a + (statsParLivre.get(m.id)?.ca ?? 0), 0),
    };
  }, [items, statsParLivre]);

  const filtered = useMemo(() => {
    if (!items) return null;
    const needle = q.trim().toLowerCase();
    return items.filter((m) =>
      (statutFilter === "all" || (m.statut_distribution ?? "disponible") === statutFilter) &&
      (needle === "" || `${m.titre} ${m.auteur ?? ""} ${m.editeur_origine ?? ""}`.toLowerCase().includes(needle)),
    );
  }, [items, q, statutFilter]);

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const { error } = await supabase.from("manuscrits").delete().eq("id", toDelete.id);
    setDeleting(false);
    if (error) return toast.error(error.message);
    toast.success("Livre étranger retiré");
    setToDelete(null);
    onChanged();
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="h-6 w-6" style={{ color: ETRANGER_ACCENT }} />
            Livres Étrangers
          </h2>
          <p className="text-muted-foreground mt-1 text-sm max-w-2xl">
            Livres distribués pour d'autres maisons d'édition — sans droits d'auteur ni workflow éditorial.
          </p>
        </div>
        <Button
          onClick={() => { setEditing(null); setSheetOpen(true); }}
          className="text-white font-semibold border-0 bg-[linear-gradient(135deg,#C8922A,#A67420)] hover:brightness-110"
        >
          <Plus className="h-4 w-4 mr-2" /> Ajouter un livre étranger
        </Button>
      </header>

      {/* Cartes de synthèse */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard icon={BookOpen} label="📚 Total" value={`${totaux.total} titre(s)`} />
        <SummaryCard icon={BadgeCheck} label="✅ Disponibles" value={`${totaux.disponibles} titre(s)`} />
        <SummaryCard icon={Coins} label="💰 CA généré" value={fcfa(totaux.ca)} />
      </div>

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un titre, auteur ou éditeur…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>
        <Select value={statutFilter} onValueChange={setStatutFilter}>
          <SelectTrigger className="w-full sm:w-64 bg-card"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {DISTRIBUTION_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grille de cartes */}
      {filtered === null ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-xl border py-16 text-center px-4"
          style={{ borderColor: `${ETRANGER_ACCENT}40`, background: `${ETRANGER_ACCENT}0D` }}
        >
          <div
            className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center"
            style={{ background: `${ETRANGER_ACCENT}26`, color: ETRANGER_ACCENT }}
          >
            <Globe className="h-8 w-8" />
          </div>
          <h3 className="mt-4 font-semibold">
            {(items?.length ?? 0) > 0 ? "Aucun résultat" : "Aucun livre étranger"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {(items?.length ?? 0) > 0
              ? "Essayez d'ajuster votre recherche."
              : "Ajoutez les livres que vous distribuez pour d'autres maisons d'édition."}
          </p>
          {(items?.length ?? 0) === 0 && (
            <Button
              onClick={() => { setEditing(null); setSheetOpen(true); }}
              className="mt-4 text-white font-semibold border-0 bg-[linear-gradient(135deg,#C8922A,#A67420)]"
            >
              <Plus className="h-4 w-4 mr-2" /> Ajouter un livre étranger
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((m) => {
            const s = statsParLivre.get(m.id) ?? { qte: 0, ca: 0 };
            return (
              <div
                key={m.id}
                className="rounded-xl border bg-card p-4 flex flex-col gap-3 transition-colors"
                style={{ borderColor: `${ETRANGER_ACCENT}33` }}
              >
                <div className="min-w-0">
                  <p className="font-semibold leading-snug break-words">📖 {m.titre}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Auteur : {m.auteur?.trim() ? m.auteur : "— (non applicable)"}
                  </p>
                  {m.editeur_origine && (
                    <p className="text-xs text-muted-foreground">Éditeur : {m.editeur_origine}</p>
                  )}
                  <p className="text-sm font-medium mt-1" style={{ color: ETRANGER_ACCENT }}>
                    Prix : {fcfa(Number(m.prix_vente_fcfa || 0))}
                  </p>
                </div>

                <DistributionBadge statut={m.statut_distribution} className="self-start" />

                <div className="flex items-center gap-3 text-xs text-muted-foreground border-t border-border pt-2">
                  <span>Vendus : <strong className="text-foreground">{s.qte}</strong></span>
                  <span>·</span>
                  <span>CA : <strong className="text-foreground">{fcfa(s.ca)}</strong></span>
                </div>
                {m.notes && <p className="text-xs text-muted-foreground italic">{m.notes}</p>}

                <div className="flex gap-2 mt-auto">
                  <Button
                    size="sm" variant="outline" className="flex-1"
                    onClick={() => { setEditing(m); setSheetOpen(true); }}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1.5" /> Modifier
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    className="flex-1 border-red-500/40 text-red-400 hover:bg-red-500/10"
                    onClick={() => setToDelete(m)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Retirer
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="bg-card border-border w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? "Modifier le livre étranger" : "Ajouter un livre étranger"}</SheetTitle>
            <SheetDescription>
              Aucun workflow éditorial, aucun droit d'auteur — uniquement la distribution.
            </SheetDescription>
          </SheetHeader>
          <EtrangerForm
            key={editing?.id ?? "new"}
            entrepriseId={entrepriseId}
            existing={editing}
            onSaved={() => { setSheetOpen(false); onChanged(); }}
          />
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer ce livre étranger ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {toDelete?.titre} » sera supprimé du catalogue de distribution. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Retirer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div
      className="rounded-xl border bg-card p-4 flex items-center gap-3"
      style={{ borderColor: `${ETRANGER_ACCENT}33` }}
    >
      <div
        className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${ETRANGER_ACCENT}26`, color: ETRANGER_ACCENT }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-lg font-bold mt-0.5 truncate">{value}</p>
      </div>
    </div>
  );
}

function EtrangerForm({
  entrepriseId, existing, onSaved,
}: {
  entrepriseId: string | null;
  existing: LivreEtranger | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    titre: existing?.titre ?? "",
    auteur: existing?.auteur ?? "",
    editeur_origine: existing?.editeur_origine ?? "",
    prix: existing?.prix_vente_fcfa != null ? String(existing.prix_vente_fcfa) : "",
    statut_distribution: existing?.statut_distribution ?? "disponible",
    notes: existing?.notes ?? "",
  });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entrepriseId) return toast.error("Profil non chargé");
    const prix = Number(form.prix);
    if (!form.titre.trim()) return toast.error("Le titre est obligatoire");
    if (!prix || prix <= 0) return toast.error("Indiquez un prix unitaire de vente");
    setLoading(true);
    const payload: any = {
      titre: form.titre.trim(),
      auteur: form.auteur.trim() || "—",
      editeur_origine: form.editeur_origine.trim() || null,
      prix_vente_fcfa: prix,
      statut_distribution: form.statut_distribution,
      notes: form.notes.trim() || null,
      origine: "etranger",
      statut: "publie",
    };
    const { error } = existing
      ? await (supabase as any).from("manuscrits").update(payload).eq("id", existing.id)
      : await (supabase as any).from("manuscrits").insert({ ...payload, entreprise_id: entrepriseId });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(existing ? "Livre étranger mis à jour" : "Livre étranger ajouté");
    onSaved();
  };

  return (
    <form onSubmit={submit} className="space-y-4 mt-6 pb-6">
      <div className="space-y-2">
        <Label>Titre *</Label>
        <Input required value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} placeholder="Ex. DRAGONBALL 1" />
      </div>
      <div className="space-y-2">
        <Label>Auteur (optionnel)</Label>
        <Input value={form.auteur} onChange={(e) => setForm({ ...form, auteur: e.target.value })} placeholder="Non suivi pour les droits d'auteur" />
      </div>
      <div className="space-y-2">
        <Label>Éditeur d'origine (optionnel)</Label>
        <Input value={form.editeur_origine} onChange={(e) => setForm({ ...form, editeur_origine: e.target.value })} placeholder="Ex. Glénat, Hatier…" />
      </div>
      <div className="space-y-2">
        <Label>Prix unitaire de vente (FCFA) *</Label>
        <Input
          type="number" min={1} required inputMode="numeric"
          value={form.prix}
          onChange={(e) => setForm({ ...form, prix: e.target.value })}
          className="font-mono"
          placeholder="Ex. 10000"
        />
      </div>
      <div className="space-y-2">
        <Label>Statut de distribution</Label>
        <Select value={form.statut_distribution} onValueChange={(v) => setForm({ ...form, statut_distribution: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {DISTRIBUTION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Notes (optionnel)</Label>
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
      </div>
      <div
        className="rounded-lg border p-3 text-xs"
        style={{ borderColor: `${ETRANGER_ACCENT}55`, background: `${ETRANGER_ACCENT}14` }}
      >
        Ce livre ne génère aucun droit d'auteur. Seule la commission librairie s'applique lors des ventes.
      </div>
      <Button
        type="submit" disabled={loading}
        className={cn("w-full text-white font-semibold border-0 bg-[linear-gradient(135deg,#C8922A,#A67420)] hover:brightness-110")}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (existing ? "Enregistrer les modifications" : "Enregistrer")}
      </Button>
    </form>
  );
}
