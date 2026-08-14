import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CheckCircle2, Loader2, Store, ShoppingBag, ChevronsUpDown, AlertTriangle, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fcfa } from "@/lib/format";
import { cn } from "@/lib/utils";
import { UnsavedChangesModal } from "@/components/unsaved-changes-modal";
import { useCloseGuard } from "@/hooks/useCloseGuard";

interface Manuscrit { id: string; titre: string; auteur: string | null; auteur_id: string | null; statut: string; }
interface StockRow {
  id: string; manuscrit_id: string;
  librairie_nom: string | null;
  exemplaires_restants: number;
  exemplaires_vendus: number;
  prix_unitaire_fcfa: number | null;
  taux_commission_pct: number | null;
  applique_droits_auteur: boolean | null;
  seuil_alerte?: number | null;
}
interface StockInterneRow {
  id: string; manuscrit_id: string;
  quantite_disponible: number;
  quantite_vendue_directement: number;
  prix_vente_direct_fcfa: number | null;
  seuil_alerte: number;
}

type SaleType = "librairie" | "libre";

interface RecordSaleResult {
  titre: string;
  auteur: string;
  type: SaleType;
  librairie?: string | null;
  quantite: number;
  prixUnit: number;
  total: number;
  royalties: number;
  date: string;
}

export function RecordSaleTrigger({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <Button
      onClick={onClick}
      className={cn(
        "text-white font-semibold border-0 shadow-lg hover:shadow-xl transition-all",
        "bg-[linear-gradient(135deg,#C8922A,#A67420)] hover:brightness-110",
        "rounded-[10px] px-6 py-3 h-auto",
        className,
      )}
    >
      💰 Enregistrer une vente
    </Button>
  );
}

export function RecordSaleDrawer({
  open, onOpenChange, entrepriseId, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entrepriseId: string | null;
  onSaved?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [manuscrits, setManuscrits] = useState<Manuscrit[]>([]);
  const [auteurNames, setAuteurNames] = useState<Record<string, string>>({});
  const [stocks, setStocks] = useState<StockRow[]>([]);
  const [interne, setInterne] = useState<StockInterneRow[]>([]);

  // form state
  const [manuscritId, setManuscritId] = useState("");
  const [saleType, setSaleType] = useState<SaleType>("libre");
  const [stockId, setStockId] = useState("");
  const [qty, setQty] = useState<string>("1");
  const [prix, setPrix] = useState<string>("");
  const [dateVente, setDateVente] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<RecordSaleResult | null>(null);

  const resetForm = () => {
    setManuscritId(""); setSaleType("libre"); setStockId("");
    setQty("1"); setPrix(""); setDateVente(new Date().toISOString().slice(0, 10));
    setNotes(""); setSuccess(null);
  };

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const [{ data: ms }, { data: as }, { data: st }, { data: si }] = await Promise.all([
        (supabase as any).from("manuscrits").select("id, titre, auteur, auteur_id, statut").eq("statut", "publie"),
        supabase.from("auteurs").select("id, nom_complet"),
        supabase.from("stocks").select("id, manuscrit_id, librairie_nom, exemplaires_restants, exemplaires_vendus, prix_unitaire_fcfa, taux_commission_pct, applique_droits_auteur"),
        supabase.from("stock_interne").select("id, manuscrit_id, quantite_disponible, quantite_vendue_directement, prix_vente_direct_fcfa, seuil_alerte"),
      ]);
      setManuscrits((ms ?? []) as Manuscrit[]);
      setAuteurNames(Object.fromEntries(((as ?? []) as any[]).map((a) => [a.id, a.nom_complet])));
      setStocks((st ?? []) as StockRow[]);
      setInterne((si ?? []) as StockInterneRow[]);
      setLoading(false);
    })();
  }, [open]);

  const currentManuscrit = manuscrits.find((m) => m.id === manuscritId);
  const auteurName = currentManuscrit
    ? (currentManuscrit.auteur_id && auteurNames[currentManuscrit.auteur_id]) || currentManuscrit.auteur || "—"
    : "";

  const currentInterne = interne.find((s) => s.manuscrit_id === manuscritId);
  const bookstoresForManuscrit = useMemo(
    () => stocks.filter((s) => s.manuscrit_id === manuscritId),
    [stocks, manuscritId],
  );
  const currentStock = stocks.find((s) => s.id === stockId);

  // contract royalty %
  const [royaltyPct, setRoyaltyPct] = useState<number>(10);
  useEffect(() => {
    if (!manuscritId) { setRoyaltyPct(10); return; }
    (async () => {
      const { data } = await supabase
        .from("contrats")
        .select("pourcentage_droits, statut, date_signature, created_at, auteur_id")
        .eq("manuscrit_id", manuscritId)
        .order("date_signature", { ascending: false, nullsFirst: false } as any)
        .order("created_at", { ascending: false })
        .limit(5);
      const signed = (data ?? []).find((c: any) => c.statut === "signe");
      setRoyaltyPct(signed ? Number(signed.pourcentage_droits ?? 10) : 10);
    })();
  }, [manuscritId]);

  // auto-fill price when picking manuscrit or stock changes
  useEffect(() => {
    if (!manuscritId) return;
    if (saleType === "libre" && currentInterne?.prix_vente_direct_fcfa) {
      setPrix(String(currentInterne.prix_vente_direct_fcfa));
    } else if (saleType === "librairie" && currentStock?.prix_unitaire_fcfa) {
      setPrix(String(currentStock.prix_unitaire_fcfa));
    } else if (saleType === "librairie" && !stockId) {
      const anyStock = bookstoresForManuscrit.find((s) => s.prix_unitaire_fcfa);
      if (anyStock?.prix_unitaire_fcfa) setPrix(String(anyStock.prix_unitaire_fcfa));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manuscritId, saleType, stockId]);

  const availableStock = saleType === "librairie"
    ? (currentStock?.exemplaires_restants ?? 0)
    : (currentInterne?.quantite_disponible ?? 0);

  const qtyN = Math.max(0, Number(qty) || 0);
  const prixN = Math.max(0, Number(prix) || 0);
  const total = qtyN * prixN;
  const royalties = Math.round(total * royaltyPct / 100);
  const stockAfter = availableStock - qtyN;
  const overSell = qtyN > availableStock;

  const canSubmit = !!entrepriseId && !!manuscritId && qtyN > 0 && prixN > 0
    && !overSell && (saleType === "libre" ? !!currentInterne : !!stockId);

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      if (saleType === "librairie" && currentStock) {
        // update stocks — trigger auto-creates vente with contract royalty %
        const { error } = await supabase.from("stocks").update({
          prix_unitaire_fcfa: prixN,
          exemplaires_vendus: (currentStock.exemplaires_vendus ?? 0) + qtyN,
          exemplaires_restants: Math.max(0, (currentStock.exemplaires_restants ?? 0) - qtyN),
        } as any).eq("id", currentStock.id);
        if (error) throw error;
      } else if (saleType === "libre" && currentInterne) {
        // Mise à jour atomique côté serveur : stock_interne + mouvement + vente
        const { error } = await (supabase as any).rpc("record_stock_mouvement", {
          p_manuscrit_id: manuscritId,
          p_type: "vente_directe",
          p_quantite: qtyN,
          p_notes: notes.trim() || null,
          p_date: dateVente,
          p_prix_unitaire: prixN,
        });
        if (error) throw error;
      }


      // low-stock warnings
      if (saleType === "librairie" && currentStock) {
        const restant = Math.max(0, (currentStock.exemplaires_restants ?? 0) - qtyN);
        if (restant <= 5) {
          toast.warning(`⚠️ Stock bas à ${currentStock.librairie_nom ?? "librairie"} : seulement ${restant} exemplaire(s) restant(s)`);
        }
      } else if (saleType === "libre" && currentInterne) {
        const restant = Math.max(0, currentInterne.quantite_disponible - qtyN);
        if (restant <= currentInterne.seuil_alerte) {
          toast.warning(`⚠️ Stock interne bas pour « ${currentManuscrit?.titre ?? ""} » : seulement ${restant} exemplaire(s) restant(s)`);
        }
      }

      setSuccess({
        titre: currentManuscrit?.titre ?? "—",
        auteur: auteurName || "—",
        type: saleType,
        librairie: saleType === "librairie" ? currentStock?.librairie_nom ?? null : null,
        quantite: qtyN,
        prixUnit: prixN,
        total,
        royalties,
        date: dateVente,
      });
      toast.success("Vente enregistrée avec succès");
      onSaved?.();
    } catch (err: any) {
      toast.error(err?.message ?? "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const close = () => { resetForm(); onOpenChange(false); };

  // Dirty tracking — treat any user-edited field as dirty (skip success view).
  const isDirty =
    !success &&
    (!!manuscritId || saleType !== "libre" || qty !== "1" || !!prix || !!notes.trim() || !!stockId);
  const guard = useCloseGuard(isDirty, close);

  return (
    <>
    <Sheet open={open} onOpenChange={guard.handleOpenChange}>
      <SheetContent side="right" className="bg-card border-border w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl">💰 Enregistrer une vente</SheetTitle>
          <SheetDescription>Saisissez les détails de la vente</SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : success ? (
          <SuccessView
            result={success}
            onAnother={() => resetForm()}
            onClose={close}
          />
        ) : (
          <div className="space-y-5 mt-6 pb-6">
            {/* Manuscrit */}
            <div className="space-y-1.5">
              <Label className="text-xs">📚 Manuscrit</Label>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal", !manuscritId && "text-muted-foreground")}>
                    <span className="truncate">{currentManuscrit?.titre ?? "Rechercher un titre ou auteur…"}</span>
                    <ChevronsUpDown className="h-4 w-4 opacity-50 flex-shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width] max-w-none z-[400]" align="start">
                  <Command>
                    <CommandInput placeholder="Titre ou auteur…" />
                    <CommandList>
                      <CommandEmpty>Aucun manuscrit publié.</CommandEmpty>
                      <CommandGroup>
                        {manuscrits.map((m) => {
                          const aName = (m.auteur_id && auteurNames[m.auteur_id]) || m.auteur || "—";
                          const si = interne.find((s) => s.manuscrit_id === m.id);
                          const stockExtSum = stocks.filter((s) => s.manuscrit_id === m.id).reduce((a, x) => a + x.exemplaires_restants, 0);
                          const stockTotal = (si?.quantite_disponible ?? 0) + stockExtSum;
                          return (
                            <CommandItem key={m.id} value={`${m.titre} ${aName}`} onSelect={() => { setManuscritId(m.id); setStockId(""); setPickerOpen(false); }}>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold truncate">{m.titre}</div>
                                <div className="text-xs text-muted-foreground truncate">{aName}</div>
                              </div>
                              <span className="text-xs text-muted-foreground ml-2 tabular-nums">{stockTotal} ex.</span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Auteur (readonly) */}
            <div className="space-y-1.5">
              <Label className="text-xs">✍️ Auteur</Label>
              <div className="h-10 rounded-md border border-border bg-muted/20 px-3 flex items-center text-sm text-[color:var(--gold)] font-medium">
                {auteurName || <span className="text-muted-foreground italic">Sélectionnez un manuscrit</span>}
              </div>
            </div>

            {/* Sale type */}
            {manuscritId && (
              <div className="space-y-2">
                <Label className="text-xs">Type de vente</Label>
                <div className="grid grid-cols-2 gap-3">
                  <SaleTypeCard
                    active={saleType === "librairie"}
                    onClick={() => setSaleType("librairie")}
                    icon={<Store className="h-5 w-5" />}
                    title="Vente en Librairie"
                    desc="Depuis une librairie partenaire"
                  />
                  <SaleTypeCard
                    active={saleType === "libre"}
                    onClick={() => setSaleType("libre")}
                    icon={<ShoppingBag className="h-5 w-5" />}
                    title="Vente Libre"
                    desc="Événement, particulier, en ligne…"
                  />
                </div>
              </div>
            )}

            {/* Librairie selector */}
            {manuscritId && saleType === "librairie" && (
              <div className="space-y-1.5">
                <Label className="text-xs">🏪 Librairie</Label>
                {bookstoresForManuscrit.length === 0 ? (
                  <div className="rounded-md border border-orange-500/30 bg-orange-500/10 text-orange-300 text-xs px-3 py-2">
                    Aucun dépôt en librairie pour ce titre. Utilisez « Vente Libre » ou créez un dépôt.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    {bookstoresForManuscrit.map((s) => {
                      const empty = s.exemplaires_restants <= 0;
                      const selected = s.id === stockId;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          disabled={empty}
                          onClick={() => setStockId(s.id)}
                          className={cn(
                            "w-full flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors",
                            selected ? "border-primary bg-primary/10" : "border-border hover:bg-muted/30",
                            empty && "opacity-60 cursor-not-allowed",
                          )}
                        >
                          <span className="truncate">{s.librairie_nom ?? "Librairie"}</span>
                          <span className={cn("text-xs tabular-nums", empty ? "text-red-400 font-semibold" : "text-muted-foreground")}>
                            {empty ? "Stock épuisé" : `${s.exemplaires_restants} ex. disponibles`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {manuscritId && saleType === "libre" && (
              <div className="rounded-md border px-3 py-2 text-xs" style={{ background: "rgba(200,146,42,0.12)", borderColor: "#C8922A" }}>
                📦 Sera déduit du stock interne
                {currentInterne && (
                  <span className="ml-2 text-muted-foreground">— {currentInterne.quantite_disponible} exemplaires disponibles</span>
                )}
              </div>
            )}

            {/* Details */}
            {manuscritId && (saleType === "libre" || stockId) && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">📦 Quantité vendue</Label>
                    <Input
                      type="number" min={1} value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      className={cn(overSell && "border-red-500")}
                    />
                    {overSell && (
                      <p className="text-xs text-red-400 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Stock insuffisant — seulement {availableStock} disponibles
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">💵 Prix unitaire (FCFA)</Label>
                    <Input
                      type="number" min={0} value={prix}
                      onChange={(e) => setPrix(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">📅 Date de la vente</Label>
                  <Input type="date" value={dateVente} onChange={(e) => setDateVente(e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">📝 Notes (optionnel)</Label>
                  <Textarea
                    value={notes} onChange={(e) => setNotes(e.target.value)}
                    placeholder="Commentaire sur cette vente…" rows={2}
                  />
                </div>

                {/* Récapitulatif */}
                <div className="rounded-xl border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/5 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">📊 Récapitulatif</div>
                  <Row label="Quantité" value={`${qtyN} exemplaire(s)`} />
                  <Row label="Prix unitaire" value={fcfa(prixN)} mono />
                  <div className="border-t border-border my-1" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm">💰 Montant total</span>
                    <span className="font-mono text-lg font-bold text-[color:var(--gold)] tabular-nums">{fcfa(total)}</span>
                  </div>
                  <div className="border-t border-border my-1" />
                  <Row label={`✍️ Droits auteur (${royaltyPct}%)`} value={fcfa(royalties)} mono />
                  <div className="flex items-center justify-between text-sm">
                    <span>📦 Stock restant après vente</span>
                    <span className={cn("font-semibold tabular-nums", stockAfter < 5 ? "text-red-400" : "text-emerald-400")}>
                      {stockAfter}
                    </span>
                  </div>
                </div>

                <Button
                  onClick={submit}
                  disabled={!canSubmit || saving}
                  className="w-full text-white font-semibold border-0 bg-[linear-gradient(135deg,#C8922A,#A67420)] hover:brightness-110 rounded-[10px] h-12"
                >
                  {saving ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enregistrement…</>
                  ) : (
                    <><Save className="h-4 w-4 mr-2" /> Enregistrer la vente</>
                  )}
                </Button>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
    <UnsavedChangesModal
      open={guard.showModal}
      onContinue={guard.cancelClose}
      onDiscard={guard.confirmDiscard}
    />
    </>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums", mono && "font-mono")}>{value}</span>
    </div>
  );
}

function SaleTypeCard({
  active, onClick, icon, title, desc,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left rounded-xl border p-3 transition-all",
        active
          ? "border-[color:var(--gold)] bg-[color:var(--gold)]/10 shadow-[0_0_0_3px_rgba(200,146,42,0.15)]"
          : "border-border hover:border-primary/40 hover:bg-primary/5",
      )}
    >
      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center mb-2",
        active ? "bg-[color:var(--gold)]/20 text-[color:var(--gold)]" : "bg-muted text-muted-foreground")}>
        {icon}
      </div>
      <div className="font-semibold text-sm">{title}</div>
      <div className="text-xs text-muted-foreground leading-snug mt-0.5">{desc}</div>
    </button>
  );
}

function SuccessView({
  result, onAnother, onClose,
}: { result: RecordSaleResult; onAnother: () => void; onClose: () => void }) {
  return (
    <div className="mt-6 space-y-5 pb-6 animate-in fade-in-50 duration-300">
      <div className="flex flex-col items-center text-center gap-2">
        <div className="h-16 w-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center animate-in zoom-in-50">
          <CheckCircle2 className="h-9 w-9 text-emerald-400" />
        </div>
        <h3 className="text-xl font-bold text-foreground">Vente enregistrée avec succès !</h3>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-sm">
        <div className="font-semibold">📚 {result.titre}</div>
        <div className="text-muted-foreground">✍️ {result.auteur}</div>
        <div className="border-t border-border my-2" />
        <Row label="Type" value={result.type === "librairie" ? "Vente en librairie" : "Vente libre"} />
        {result.librairie && <Row label="Librairie" value={result.librairie} />}
        <Row label="Quantité" value={`${result.quantite} exemplaire(s)`} />
        <Row label="Prix unitaire" value={fcfa(result.prixUnit)} mono />
        <div className="flex items-center justify-between pt-1">
          <span>💰 Total</span>
          <span className="font-mono text-lg font-bold text-[color:var(--gold)] tabular-nums">{fcfa(result.total)}</span>
        </div>
        <Row label="✍️ Droits auteur" value={fcfa(result.royalties)} mono />
        <Row label="📅 Date" value={new Date(result.date).toLocaleDateString("fr-FR")} />
      </div>

      <div className="grid gap-2">
        <Button
          onClick={onAnother}
          className="w-full text-white font-semibold border-0 bg-[linear-gradient(135deg,#C8922A,#A67420)] hover:brightness-110 rounded-[10px] h-11"
        >
          📝 Enregistrer une autre vente
        </Button>
        <Button variant="outline" onClick={onClose} className="w-full">✕ Fermer</Button>
      </div>
    </div>
  );
}
