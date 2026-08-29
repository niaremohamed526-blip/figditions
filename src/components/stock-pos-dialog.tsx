import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Loader2, Zap, Trash2, Plus, CheckCircle2, X, Store, Keyboard, AlertTriangle, Save, Warehouse } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { fcfa } from "@/lib/format";
import { UnsavedChangesModal } from "@/components/unsaved-changes-modal";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { useCloseGuard } from "@/hooks/useCloseGuard";

const DRAFT_KEY = "figeditions:pos-draft";

interface Draft {
  librairieNom: string;
  librairieAdresse: string;
  dateDepot: string;
  provenance: "interne" | "hors_stock";
  lines: Line[];
  savedAt: number;
}

interface Manuscrit { id: string; titre: string; statut: string; }

interface Line {
  id: string;
  manuscritId: string;
  titre: string;
  quantite: number;
  prix: number;
}

export function StockPosDialog({
  open, onOpenChange, entrepriseId, manuscrits, onImported,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entrepriseId: string | null;
  manuscrits: Manuscrit[];
  onImported: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [librairieNom, setLibrairieNom] = useState("");
  const [librairieAdresse, setLibrairieAdresse] = useState("");
  const [dateDepot, setDateDepot] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [provenance, setProvenance] = useState<"interne" | "hors_stock">("interne");

  const [lines, setLines] = useState<Line[]>([]);
  const [titrePickerOpen, setTitrePickerOpen] = useState(false);
  const [currentManuscrit, setCurrentManuscrit] = useState<Manuscrit | null>(null);
  const [currentQte, setCurrentQte] = useState<string>("1");
  const [currentPrix, setCurrentPrix] = useState<string>("");

  const [saving, setSaving] = useState(false);

  const qteRef = useRef<HTMLInputElement>(null);
  const prixRef = useRef<HTMLInputElement>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);

  const published = useMemo(() => manuscrits.filter((m) => m.statut === "publie"), [manuscrits]);

  const totalEx = lines.reduce((s, l) => s + l.quantite, 0);
  const totalValeur = lines.reduce((s, l) => s + l.quantite * l.prix, 0);

  const reset = () => {
    setStep(1);
    setLibrairieNom("");
    setLibrairieAdresse("");
    setDateDepot(format(new Date(), "yyyy-MM-dd"));
    setProvenance("interne");
    setLines([]);
    setCurrentManuscrit(null);
    setCurrentQte("1");
    setCurrentPrix("");
  };

  // Dirty tracking + draft
  const isDirty = useMemo(
    () => lines.length > 0 || !!librairieNom.trim() || !!librairieAdresse.trim() ||
          !!currentManuscrit || currentQte !== "1" || !!currentPrix.trim() ||
          provenance !== "interne",
    [lines, librairieNom, librairieAdresse, currentManuscrit, currentQte, currentPrix, provenance],
  );
  const { markDirty, markClean } = useUnsavedChanges({ empty: true });
  useEffect(() => { if (isDirty) markDirty({ dirty: true } as any); else markClean(); }, [isDirty, markDirty, markClean]);

  const [draftFound, setDraftFound] = useState<Draft | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const close = () => { reset(); setDraftFound(null); onOpenChange(false); };
  const guard = useCloseGuard(isDirty, close);

  // Load draft when dialog opens
  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as Draft;
      if (d?.lines?.length || d?.librairieNom) setDraftFound(d);
    } catch {}
  }, [open]);

  // Auto-save draft every 30s while dirty
  useEffect(() => {
    if (!open || !isDirty) return;
    const save = () => {
      const draft: Draft = {
        librairieNom, librairieAdresse, dateDepot, provenance, lines, savedAt: Date.now(),
      };
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); setLastSavedAt(draft.savedAt); } catch {}
    };
    const t = setInterval(save, 30_000);
    return () => clearInterval(t);
  }, [open, isDirty, librairieNom, librairieAdresse, dateDepot, provenance, lines]);

  const restoreDraft = () => {
    if (!draftFound) return;
    setLibrairieNom(draftFound.librairieNom);
    setLibrairieAdresse(draftFound.librairieAdresse);
    setDateDepot(draftFound.dateDepot);
    setProvenance(draftFound.provenance ?? "interne");
    setLines(draftFound.lines);
    if (draftFound.lines.length > 0) setStep(2);
    setDraftFound(null);
    toast.success("Brouillon restauré");
  };
  const discardDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setDraftFound(null);
  };

  // Partial-row warning: manuscrit picked but qté/prix incomplete
  const partialRow = !!currentManuscrit && (!currentQte || Number(currentQte) <= 0 || !currentPrix || Number(currentPrix) < 0);


  const startSession = () => {
    if (!librairieNom.trim()) return toast.error("Nom de la librairie requis");
    setStep(2);
    setTimeout(() => setTitrePickerOpen(true), 100);
  };

  const pickManuscrit = (m: Manuscrit) => {
    setCurrentManuscrit(m);
    setTitrePickerOpen(false);
    setTimeout(() => qteRef.current?.focus(), 50);
  };

  const addLine = () => {
    if (!currentManuscrit) { toast.error("Choisissez un titre"); return; }
    const q = Number(currentQte);
    const p = Number(currentPrix);
    if (!Number.isFinite(q) || q <= 0) { toast.error("Quantité invalide"); qteRef.current?.focus(); return; }
    if (!Number.isFinite(p) || p < 0) { toast.error("Prix invalide"); prixRef.current?.focus(); return; }

    setLines((prev) => [
      { id: crypto.randomUUID(), manuscritId: currentManuscrit.id, titre: currentManuscrit.titre, quantite: q, prix: p },
      ...prev,
    ]);
    // reset for next entry
    setCurrentManuscrit(null);
    setCurrentQte("1");
    setCurrentPrix("");
    setTimeout(() => setTitrePickerOpen(true), 50);
  };

  const removeLine = (id: string) => setLines((prev) => prev.filter((l) => l.id !== id));

  const submit = async () => {
    if (!entrepriseId) return toast.error("Profil non chargé");
    if (lines.length === 0) return toast.error("Aucun livre saisi");
    setSaving(true);
    // Chaque ligne passe par add_depot_batch : fusion avec la fiche existante
    // (livre + librairie), historisation du lot dans depot_batches, et déduction
    // de l'entrepôt uniquement si la provenance est « interne ».
    const warnings: string[] = [];
    let merged = 0;
    let done = 0;
    for (const l of lines) {
      const { data: res, error: rpcErr } = await (supabase as any).rpc("add_depot_batch", {
        p_manuscrit_id: l.manuscritId,
        p_librairie_nom: librairieNom.trim(),
        p_quantite: l.quantite,
        p_prix: l.prix || null,
        p_librairie_adresse: librairieAdresse.trim() || null,
        p_date: dateDepot || null,
        p_provenance: provenance,
        p_notes: "Saisie rapide",
      });
      if (rpcErr) { warnings.push(`${l.titre} : ${rpcErr.message}`); continue; }
      done += 1;
      if (res?.merged) merged += 1;
      if (res?.warning) warnings.push(`${l.titre} : ${res.warning}`);
    }
    setSaving(false);
    warnings.forEach((w) => toast.warning(w));
    if (done === 0) return toast.error("Aucun dépôt enregistré");
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    toast.success(
      `${done} dépôt(s) enregistré(s) chez « ${librairieNom} »` +
      (merged > 0 ? ` — ${merged} fusionné(s) avec un dépôt existant` : "") +
      (provenance === "hors_stock" ? " — sans déduction de l'entrepôt" : ""),
    );
    onImported();
    reset();
    onOpenChange(false);
  };

  // Ctrl+S save shortcut
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (lines.length > 0 && !saving) submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lines.length, saving]);

  // Enter navigation: title → qte → prix → add
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (step !== 2) return;
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (lines.length > 0) submit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [step, lines.length]);

  return (
    <>
    <Dialog open={open} onOpenChange={guard.handleOpenChange}>
      <DialogContent className="bg-card border-border max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Saisie rapide — Mode caisse
            {isDirty && (
              <span
                title="Modifications non sauvegardées"
                className="inline-block h-2 w-2 rounded-full bg-orange-400 animate-pulse"
              />
            )}
          </DialogTitle>
          <DialogDescription>
            Sélectionnez la librairie une seule fois, puis enchaînez les livres sans rechargement.
          </DialogDescription>
        </DialogHeader>

        {/* Draft restore banner */}
        {draftFound && (
          <div
            className="rounded-lg border p-3 flex flex-wrap items-center gap-2 text-sm"
            style={{ background: "rgba(200,146,42,0.08)", border: "1px solid rgba(200,146,42,0.3)" }}
          >
            <span className="flex-1">
              📋 Un brouillon non sauvegardé a été trouvé
              {draftFound.savedAt && (
                <span className="text-muted-foreground"> (sauvegardé à {new Date(draftFound.savedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })})</span>
              )}
            </span>
            <Button size="sm" variant="outline" onClick={discardDraft}>Nouvelle saisie</Button>
            <Button size="sm" onClick={restoreDraft} className="bg-primary text-primary-foreground hover:bg-primary/90">
              Restaurer le brouillon
            </Button>
          </div>
        )}

        {/* Progress indicator */}
        {step === 2 && (lines.length > 0 || isDirty) && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-[color:var(--gold)] font-semibold">
              📝 {lines.length} ligne(s) saisie(s) — Non sauvegardé
            </span>
            {lastSavedAt && (
              <span className="text-muted-foreground">
                💾 Brouillon sauvegardé à {new Date(lastSavedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        )}


        {step === 1 ? (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-primary" />
                <h4 className="font-semibold text-sm">Librairie destinataire</h4>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nom de la librairie *</Label>
                <Input value={librairieNom} onChange={(e) => setLibrairieNom(e.target.value)} placeholder="Ex. Librairie Renaissance" autoFocus />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Adresse (optionnel)</Label>
                  <Input value={librairieAdresse} onChange={(e) => setLibrairieAdresse(e.target.value)} placeholder="Ex. ACI 2000, Bamako" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Date de dépôt</Label>
                  <Input type="date" value={dateDepot} onChange={(e) => setDateDepot(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Provenance des livres */}
            <div className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Warehouse className="h-4 w-4 text-primary" />
                <h4 className="font-semibold text-sm">Provenance des livres</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { v: "interne", icon: "🏭", t: "Depuis le stock interne", d: "Déduit les exemplaires de l'entrepôt" },
                  { v: "hors_stock", icon: "📤", t: "Hors stock interne", d: "Livres déjà dehors — aucune déduction de l'entrepôt" },
                ].map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setProvenance(o.v as "interne" | "hors_stock")}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-colors",
                      provenance === o.v
                        ? "border-[color:var(--gold)]/60 bg-[color:var(--gold)]/10"
                        : "border-border bg-background/40 hover:border-[color:var(--gold)]/30",
                    )}
                  >
                    <p className="text-sm font-semibold text-foreground">{o.icon} {o.t}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{o.d}</p>
                  </button>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={guard.requestClose}>Annuler</Button>
              <Button onClick={startSession} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Zap className="h-4 w-4 mr-2" /> Démarrer la saisie
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Session header */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <Store className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="font-semibold truncate">{librairieNom}</span>
                {librairieAdresse && <span className="text-muted-foreground truncate">— {librairieAdresse}</span>}
                {provenance === "hors_stock" && (
                  <span className="flex-shrink-0 rounded-full border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 px-2 py-0.5 text-[10px] font-semibold text-[color:var(--gold)]">
                    📤 Hors stock interne
                  </span>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="h-7">Changer</Button>
            </div>

            {/* Quick entry row */}
            <div className="rounded-xl border border-border p-3 space-y-3 bg-muted/20">
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-12 sm:col-span-6 space-y-1.5">
                  <Label className="text-xs">Titre</Label>
                  <Popover open={titrePickerOpen} onOpenChange={setTitrePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal", !currentManuscrit && "text-muted-foreground")}>
                        <span className="truncate">{currentManuscrit?.titre ?? "Choisir un titre…"}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[--radix-popover-trigger-width] max-w-none" align="start">
                      <Command>
                        <CommandInput placeholder="Rechercher un titre…" autoFocus />
                        <CommandList>
                          <CommandEmpty>Aucun manuscrit publié.</CommandEmpty>
                          <CommandGroup>
                            {published.map((m) => (
                              <CommandItem key={m.id} value={m.titre} onSelect={() => pickManuscrit(m)}>
                                {m.titre}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="col-span-4 sm:col-span-2 space-y-1.5">
                  <Label className="text-xs">Quantité</Label>
                  <Input
                    ref={qteRef}
                    type="number"
                    min={1}
                    value={currentQte}
                    onChange={(e) => setCurrentQte(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); prixRef.current?.focus(); prixRef.current?.select(); } }}
                  />
                </div>
                <div className="col-span-5 sm:col-span-3 space-y-1.5">
                  <Label className="text-xs">Prix FCFA</Label>
                  <Input
                    ref={prixRef}
                    type="number"
                    min={0}
                    value={currentPrix}
                    onChange={(e) => setCurrentPrix(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLine(); } }}
                    placeholder="5000"
                  />
                </div>
                <div className="col-span-3 sm:col-span-1">
                  <Button ref={addBtnRef} onClick={addLine} className="w-full bg-primary text-primary-foreground hover:bg-primary/90" title="Ajouter (Entrée)">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Keyboard className="h-3 w-3" />
                <span>Astuce&nbsp;: <kbd className="px-1 rounded bg-muted">Entrée</kbd> pour passer au champ suivant · <kbd className="px-1 rounded bg-muted">Ctrl</kbd>+<kbd className="px-1 rounded bg-muted">Entrée</kbd> pour valider tout</span>
              </div>
              {partialRow && (
                <div
                  className="rounded-md px-3 py-2 text-xs flex items-center gap-2"
                  style={{ background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.4)", color: "#fb923c" }}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Ligne incomplète — complétez la quantité et le prix, ou effacez le titre avant de continuer.
                </div>
              )}
            </div>

            {/* Session totals */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <Chip label="Lignes" value={String(lines.length)} />
              <Chip label="Total ex." value={String(totalEx)} tone="success" />
              <Chip label="Valeur" value={fcfa(totalValeur)} tone="gold" />
            </div>

            {/* Lines list */}
            <div className="max-h-72 overflow-auto rounded-lg border border-border">
              {lines.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Aucun livre saisi pour le moment. Commencez par choisir un titre ci-dessus.
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr className="text-left">
                      <th className="px-2 py-1.5">Titre</th>
                      <th className="px-2 py-1.5 text-center w-16">Qté</th>
                      <th className="px-2 py-1.5 text-right w-24">Prix</th>
                      <th className="px-2 py-1.5 text-right w-28">Sous-total</th>
                      <th className="px-2 py-1.5 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.id} className="border-t border-border">
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                            <span className="truncate max-w-[220px]" title={l.titre}>{l.titre}</span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-center tabular-nums">{l.quantite}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{fcfa(l.prix)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-[color:var(--gold)]">{fcfa(l.quantite * l.prix)}</td>
                        <td className="px-2 py-1.5 text-right">
                          <Button variant="ghost" size="sm" onClick={() => removeLine(l.id)} className="h-6 w-6 p-0 hover:text-destructive">
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={guard.requestClose} disabled={saving}>Annuler</Button>
              <Button
                onClick={submit}
                disabled={saving || lines.length === 0}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {saving
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enregistrement…</>
                  : <>Enregistrer {lines.length} dépôt(s)</>}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
    <UnsavedChangesModal
      open={guard.showModal}
      onContinue={guard.cancelClose}
      onDiscard={() => { try { localStorage.removeItem(DRAFT_KEY); } catch {} guard.confirmDiscard(); }}
    />
    </>
  );
}

function Chip({ label, value, tone }: { label: string; value: string; tone?: "success" | "gold" }) {
  const cls =
    tone === "success" ? "text-primary bg-primary/10 border-primary/20"
    : tone === "gold" ? "text-[color:var(--gold)] bg-[color:var(--gold)]/10 border-[color:var(--gold)]/20"
    : "text-foreground bg-muted/40 border-border";
  return (
    <div className={cn("rounded-lg border px-2 py-1.5", cls)}>
      <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="font-bold text-sm tabular-nums truncate">{value}</div>
    </div>
  );
}
