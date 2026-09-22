import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CheckCircle2, Loader2, Store, ShoppingBag, ChevronsUpDown, AlertTriangle, Save,
  Trash2, Plus, FileText, Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetch-all";
import { toast } from "sonner";
import { fcfa } from "@/lib/format";
import { cn } from "@/lib/utils";
import { UnsavedChangesModal } from "@/components/unsaved-changes-modal";
import { useCloseGuard } from "@/hooks/useCloseGuard";
import { generateFactureVentePdf, type FactureVenteData } from "@/lib/pdf-facture-vente";
import { FactureWatermarkUploader } from "@/components/facture-watermark-uploader";
import { getFactureWatermark } from "@/lib/facture-watermark";

interface Manuscrit { id: string; titre: string; auteur: string | null; auteur_id: string | null; statut: string; origine?: string | null; }
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

/** Une ligne du panier de vente libre (plusieurs livres en une transaction). */
interface CartLine {
  manuscrit_id: string;
  titre: string;
  auteur: string;
  quantite: number;
  prix_unitaire: number;
  royaltyPct: number;
  disponible: number;
}

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
  prixCatalogue?: number;
  remise?: number;
}

interface PanierResult {
  numero: string;
  date: string;
  client: string | null;
  lignes: CartLine[];
  sousTotal: number;
  remisePct: number;
  remiseFcfa: number;
  total: number;
  droits: number;
  notes: string | null;
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

/** Récupère le taux de droits d'auteur applicable (contrat signé, sinon 10%). */
async function fetchRoyaltyPct(manuscritId: string, isEtranger: boolean): Promise<number> {
  if (isEtranger) return 0;
  const { data } = await supabase
    .from("contrats")
    .select("pourcentage_droits, statut, date_signature, created_at")
    .eq("manuscrit_id", manuscritId)
    .order("date_signature", { ascending: false, nullsFirst: false } as any)
    .order("created_at", { ascending: false })
    .limit(5);
  const signed = (data ?? []).find((c: any) => c.statut === "signe");
  return signed ? Number((signed as any).pourcentage_droits ?? 10) : 10;
}

export function RecordSaleDrawer({
  open, onOpenChange, entrepriseId, onSaved,
  entrepriseNom = "Maison d'édition",
  entrepriseVille = null,
  entrepriseAdresse = null,
  entrepriseTelephone = null,
  entrepriseEmail = null,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entrepriseId: string | null;
  onSaved?: () => void;
  entrepriseNom?: string;
  entrepriseVille?: string | null;
  entrepriseAdresse?: string | null;
  entrepriseTelephone?: string | null;
  entrepriseEmail?: string | null;
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

  // vente libre : panier multi-livres
  const [cart, setCart] = useState<CartLine[]>([]);
  const [remisePct, setRemisePct] = useState<string>("");
  const [clientNom, setClientNom] = useState("");
  const [paiementRecu, setPaiementRecu] = useState(true);
  const [cartPickerOpen, setCartPickerOpen] = useState(false);
  const [addingLine, setAddingLine] = useState(false);
  const qtyRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [focusLine, setFocusLine] = useState<string | null>(null);
  const watermarkPickerActiveRef = useRef(false);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<RecordSaleResult | null>(null);
  const [panier, setPanier] = useState<PanierResult | null>(null);

  const draftKey = `figditions:vente-libre-cart:${entrepriseId ?? "anon"}`;

  const resetForm = () => {
    setManuscritId(""); setStockId("");
    setQty("1"); setPrix(""); setDateVente(new Date().toISOString().slice(0, 10));
    setNotes(""); setSuccess(null); setPanier(null);
    setCart([]); setRemisePct(""); setClientNom(""); setPaiementRecu(true);
    try { localStorage.removeItem(draftKey); } catch { /* stockage indisponible */ }
  };

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      try {
        // fetchAllRows : contourne la limite silencieuse de 1000 lignes de l'API —
        // sans elle, des dépôts entiers (ex. une librairie) n'apparaissaient jamais ici.
        const [ms, as, st, si] = await Promise.all([
          fetchAllRows<Manuscrit>(() => (supabase as any).from("manuscrits").select("id, titre, auteur, auteur_id, statut, origine").or("statut.eq.publie,origine.eq.etranger")),
          fetchAllRows<{ id: string; nom_complet: string }>(() => supabase.from("auteurs").select("id, nom_complet")),
          fetchAllRows<StockRow>(() => supabase.from("stocks").select("id, manuscrit_id, librairie_nom, exemplaires_restants, exemplaires_vendus, prix_unitaire_fcfa, taux_commission_pct, applique_droits_auteur")),
          fetchAllRows<StockInterneRow>(() => supabase.from("stock_interne").select("id, manuscrit_id, quantite_disponible, quantite_vendue_directement, prix_vente_direct_fcfa, seuil_alerte")),
        ]);
        setManuscrits(ms);
        setAuteurNames(Object.fromEntries(as.map((a) => [a.id, a.nom_complet])));
        setStocks(st);
        setInterne(si);
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  // Brouillon du panier : rien n'est perdu si on quitte par accident.
  useEffect(() => {
    if (!open || loading) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw) as { cart?: CartLine[]; remisePct?: string; clientNom?: string; dateVente?: string };
      if (d.cart?.length) {
        setCart(d.cart);
        setRemisePct(d.remisePct ?? "");
        setClientNom(d.clientNom ?? "");
        if (d.dateVente) setDateVente(d.dateVente);
        setSaleType("libre");
        toast.info("Panier précédent restauré");
      }
    } catch { /* brouillon illisible */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loading]);

  useEffect(() => {
    if (!open) return;
    try {
      if (cart.length === 0) localStorage.removeItem(draftKey);
      else localStorage.setItem(draftKey, JSON.stringify({ cart, remisePct, clientNom, dateVente }));
    } catch { /* stockage indisponible */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, remisePct, clientNom, dateVente, open]);

  // Focus automatique sur la quantité du livre venant d'être ajouté.
  useEffect(() => {
    if (!focusLine) return;
    const el = qtyRefs.current[focusLine];
    if (el) { el.focus(); el.select(); }
    setFocusLine(null);
  }, [focusLine, cart]);

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

  // contract royalty % (flux librairie)
  const [royaltyPct, setRoyaltyPct] = useState<number>(10);
  /** Livre étranger : aucun droit d'auteur ne s'applique. */
  const isEtranger = currentManuscrit?.origine === "etranger";
  useEffect(() => {
    if (!manuscritId) { setRoyaltyPct(10); return; }
    fetchRoyaltyPct(manuscritId, !!isEtranger).then(setRoyaltyPct);
  }, [manuscritId, isEtranger]);

  // auto-fill price when picking manuscrit or stock changes
  useEffect(() => {
    if (!manuscritId) return;
    if (saleType === "librairie" && currentStock?.prix_unitaire_fcfa) {
      setPrix(String(currentStock.prix_unitaire_fcfa));
    } else if (saleType === "librairie" && !stockId) {
      const anyStock = bookstoresForManuscrit.find((s) => s.prix_unitaire_fcfa);
      if (anyStock?.prix_unitaire_fcfa) setPrix(String(anyStock.prix_unitaire_fcfa));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manuscritId, saleType, stockId]);

  const availableStock = currentStock?.exemplaires_restants ?? 0;
  const qtyN = Math.max(0, Number(qty) || 0);
  const prixN = Math.max(0, Number(prix) || 0);
  const total = qtyN * prixN;
  const royalties = Math.round(total * royaltyPct / 100);
  const stockAfter = availableStock - qtyN;
  const overSell = qtyN > availableStock;

  // ───────── Panier vente libre ─────────
  const nomAuteurDe = (m: Manuscrit) =>
    (m.auteur_id && auteurNames[m.auteur_id]) || m.auteur || "—";

  const addToCart = async (m: Manuscrit) => {
    const si = interne.find((s) => s.manuscrit_id === m.id);
    if (!si) { toast.error(`Aucun stock interne pour « ${m.titre} »`); return; }
    const existing = cart.find((l) => l.manuscrit_id === m.id);
    if (existing) {
      setCart((c) => c.map((l) => l.manuscrit_id === m.id ? { ...l, quantite: l.quantite + 1 } : l));
      setFocusLine(m.id);
      return;
    }
    setAddingLine(true);
    try {
      const pct = await fetchRoyaltyPct(m.id, m.origine === "etranger");
      setCart((c) => [...c, {
        manuscrit_id: m.id,
        titre: m.titre,
        auteur: nomAuteurDe(m),
        quantite: 1,
        prix_unitaire: Number(si.prix_vente_direct_fcfa ?? 0) || 0,
        royaltyPct: pct,
        disponible: si.quantite_disponible,
      }]);
      setFocusLine(m.id);
    } finally {
      setAddingLine(false);
    }
  };

  const updateLine = (id: string, patch: Partial<CartLine>) =>
    setCart((c) => c.map((l) => l.manuscrit_id === id ? { ...l, ...patch } : l));
  const removeLine = (id: string) => setCart((c) => c.filter((l) => l.manuscrit_id !== id));

  const remisePctN = Math.max(0, Math.min(100, Number(remisePct) || 0));
  const cartSousTotal = cart.reduce((a, l) => a + Math.round(l.quantite * l.prix_unitaire), 0);
  const cartRemise = Math.round(cartSousTotal * remisePctN / 100);
  const cartTotal = cartSousTotal - cartRemise;
  const ligneMontant = (l: CartLine) =>
    Math.round(Math.round(l.quantite * l.prix_unitaire) * (1 - remisePctN / 100));
  const ligneDroits = (l: CartLine) => Math.round(ligneMontant(l) * l.royaltyPct / 100);
  const cartDroits = cart.reduce((a, l) => a + ligneDroits(l), 0);
  const cartErrors = cart
    .filter((l) => l.quantite <= 0 || l.prix_unitaire <= 0 || l.quantite > l.disponible)
    .map((l) => l.quantite > l.disponible
      ? `« ${l.titre} » : ${l.disponible} disponible(s)`
      : `« ${l.titre} » : quantité et prix requis`);

  /** Top 4 livres les plus vendus en vente libre : ajout en un clic. */
  const quickAdd = useMemo(() => {
    return [...interne]
      .filter((s) => s.quantite_disponible > 0)
      .sort((a, b) => (b.quantite_vendue_directement ?? 0) - (a.quantite_vendue_directement ?? 0))
      .slice(0, 6)
      .map((s) => manuscrits.find((m) => m.id === s.manuscrit_id))
      .filter((m): m is Manuscrit => !!m)
      .slice(0, 4);
  }, [interne, manuscrits]);

  const canSubmitLibrairie = !!entrepriseId && !!manuscritId && !!stockId && qtyN > 0 && prixN > 0 && !overSell;
  const canSubmitPanier = !!entrepriseId && cart.length > 0 && cartErrors.length === 0;

  const submitLibrairie = async () => {
    if (!canSubmitLibrairie || !currentStock) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("stocks").update({
        prix_unitaire_fcfa: prixN,
        exemplaires_vendus: (currentStock.exemplaires_vendus ?? 0) + qtyN,
        exemplaires_restants: Math.max(0, (currentStock.exemplaires_restants ?? 0) - qtyN),
      } as any).eq("id", currentStock.id);
      if (error) throw error;

      const restant = Math.max(0, (currentStock.exemplaires_restants ?? 0) - qtyN);
      if (restant <= 5) {
        toast.warning(`⚠️ Stock bas à ${currentStock.librairie_nom ?? "librairie"} : seulement ${restant} exemplaire(s) restant(s)`);
      }

      setSuccess({
        titre: currentManuscrit?.titre ?? "—",
        auteur: auteurName || "—",
        type: "librairie",
        librairie: currentStock.librairie_nom ?? null,
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

  const submitPanier = async () => {
    if (!canSubmitPanier) return;
    setSaving(true);
    try {
      // Tout-ou-rien : la fonction serveur valide chaque ligne avant toute écriture.
      const { data, error } = await (supabase as any).rpc("record_vente_libre_panier", {
        p_lignes: cart.map((l) => ({
          manuscrit_id: l.manuscrit_id,
          titre: l.titre,
          quantite: l.quantite,
          prix_unitaire: l.prix_unitaire,
        })),
        p_remise_pct: remisePctN,
        p_date: dateVente,
        p_client: clientNom.trim() || null,
        p_notes: notes.trim() || null,
        p_paiement_recu: paiementRecu,
      });
      if (error) throw error;

      const lignesSnapshot = cart;
      cart.forEach((l) => {
        const si = interne.find((s) => s.manuscrit_id === l.manuscrit_id);
        const restant = Math.max(0, l.disponible - l.quantite);
        if (si && restant <= si.seuil_alerte) {
          toast.warning(`⚠️ Stock interne bas pour « ${l.titre} » : ${restant} exemplaire(s) restant(s)`);
        }
      });

      setPanier({
        numero: (data as any)?.facture_numero ?? "FACT",
        date: dateVente,
        client: clientNom.trim() || null,
        lignes: lignesSnapshot,
        sousTotal: cartSousTotal,
        remisePct: remisePctN,
        remiseFcfa: cartRemise,
        total: cartTotal,
        droits: cartDroits,
        notes: notes.trim() || null,
      });
      setCart([]);
      try { localStorage.removeItem(draftKey); } catch { /* stockage indisponible */ }
      toast.success(`Vente enregistrée : ${lignesSnapshot.length} livre(s)`);
      onSaved?.();
    } catch (err: any) {
      toast.error(err?.message ?? "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const downloadFacture = async (p: PanierResult) => {
    const d: FactureVenteData = {
      numero: p.numero,
      dateEmission: new Date(p.date).toLocaleDateString("fr-FR"),
      maison: entrepriseNom,
      maisonAdresse: entrepriseAdresse,
      maisonVille: entrepriseVille,
      maisonTelephone: entrepriseTelephone,
      maisonEmail: entrepriseEmail,
      clientNom: p.client,
      lignes: p.lignes.map((l) => ({
        titre: l.titre,
        auteur: l.auteur,
        quantite: l.quantite,
        prix_unitaire: l.prix_unitaire,
        total: Math.round(l.quantite * l.prix_unitaire),
      })),
      sousTotal: p.sousTotal,
      remisePct: p.remisePct,
      remiseFcfa: p.remiseFcfa,
      total: p.total,
      notes: p.notes,
      watermarkLogoUrl: getFactureWatermark(),
    };
    try {
      await generateFactureVentePdf(d, "download");
    } catch (e: any) {
      toast.error(e?.message ?? "Impossible de générer la facture");
    }
  };

  const close = () => { resetForm(); onOpenChange(false); };

  // Dirty tracking : treat any user-edited field as dirty (skip success view).
  const isDirty =
    !success && !panier &&
    (cart.length > 0 || !!manuscritId || qty !== "1" || !!prix || !!notes.trim() || !!stockId || !!clientNom.trim() || !!remisePct);
  const guard = useCloseGuard(isDirty, close);

  return (
    <>
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && watermarkPickerActiveRef.current) return;
        guard.handleOpenChange(nextOpen);
      }}
    >
      <SheetContent side="right" className="bg-card border-border w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl">💰 Enregistrer une vente</SheetTitle>
          <SheetDescription>Saisissez les détails de la vente</SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : panier ? (
          <PanierSuccessView
            panier={panier}
            onFacture={() => downloadFacture(panier)}
            onAnother={() => resetForm()}
            onClose={close}
          />
        ) : success ? (
          <SuccessView result={success} onAnother={() => resetForm()} onClose={close} />
        ) : (
          <div className="space-y-5 mt-6 pb-6">
            {/* Type de vente : choisi en premier */}
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
                  desc="Plusieurs livres, remise, facture"
                />
              </div>
            </div>

            {saleType === "libre" ? (
              <>
                {/* Panier */}
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border">
                    <span className="text-sm font-semibold">📚 Livres vendus</span>
                    <span className="text-xs text-muted-foreground">{cart.length} article(s)</span>
                  </div>

                  {cart.length === 0 ? (
                    <p className="px-3 py-6 text-center text-xs italic text-muted-foreground">
                      Aucun livre. Ajoutez un titre dans la zone suivante.
                    </p>
                  ) : (
                    <div className="divide-y divide-border">
                      {cart.map((l) => {
                        const over = l.quantite > l.disponible;
                        return (
                          <div key={l.manuscrit_id} className="p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold truncate">{l.titre}</div>
                                <div className="text-xs text-muted-foreground truncate">{l.auteur}</div>
                              </div>
                              <Button
                                variant="ghost" size="icon"
                                aria-label={`Retirer ${l.titre}`}
                                onClick={() => removeLine(l.manuscrit_id)}
                                className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">Qté</Label>
                                <Input
                                  ref={(el) => { qtyRefs.current[l.manuscrit_id] = el; }}
                                  type="number" min={1} value={String(l.quantite)}
                                  onChange={(e) => updateLine(l.manuscrit_id, { quantite: Math.max(0, Number(e.target.value) || 0) })}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") { e.preventDefault(); setCartPickerOpen(true); }
                                  }}
                                  className={cn("h-9", over && "border-red-500")}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">Prix unit. (FCFA)</Label>
                                <Input
                                  type="number" min={0} value={String(l.prix_unitaire)}
                                  onChange={(e) => updateLine(l.manuscrit_id, { prix_unitaire: Math.max(0, Number(e.target.value) || 0) })}
                                  className="h-9 font-mono"
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className={cn(over ? "text-red-400" : "text-muted-foreground")}>
                                {over
                                  ? `Stock insuffisant : ${l.disponible} disponible(s)`
                                  : `${l.disponible} disponible(s) en stock interne`}
                              </span>
                              <span className="font-mono tabular-nums text-[color:var(--gold)]">
                                {fcfa(Math.round(l.quantite * l.prix_unitaire))}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="p-3 space-y-2 border-t border-border">
                    {quickAdd.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {quickAdd.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => addToCart(m)}
                            className="flex items-center gap-1 rounded-full border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 px-2.5 py-1 text-[11px] text-[color:var(--gold)] hover:brightness-125 max-w-full"
                          >
                            <Zap className="h-3 w-3 shrink-0" />
                            <span className="truncate max-w-[140px]">{m.titre}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <Popover open={cartPickerOpen} onOpenChange={setCartPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-center font-normal" disabled={addingLine}>
                          {addingLine ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                          Ajouter un livre
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] max-w-none z-[400]" align="start">
                        <Command>
                          <CommandInput placeholder="Titre ou auteur…" />
                          <CommandList>
                            <CommandEmpty>Aucun livre disponible en stock interne.</CommandEmpty>
                            {(["propre", "etranger"] as const).map((grp) => {
                              const list = manuscrits.filter((m) => {
                                const si = interne.find((s) => s.manuscrit_id === m.id);
                                if (!si || si.quantite_disponible <= 0) return false;
                                return grp === "etranger" ? m.origine === "etranger" : m.origine !== "etranger";
                              });
                              if (list.length === 0) return null;
                              return (
                                <CommandGroup key={grp} heading={grp === "etranger" ? "🌍 Livres étrangers" : "📗 Nos productions"}>
                                  {list.map((m) => {
                                    const si = interne.find((s) => s.manuscrit_id === m.id);
                                    return (
                                      <CommandItem
                                        key={m.id}
                                        value={`${m.titre} ${nomAuteurDe(m)}`}
                                        onSelect={() => { setCartPickerOpen(false); addToCart(m); }}
                                      >
                                        <div className="flex-1 min-w-0">
                                          <div className="font-semibold truncate">{m.titre}</div>
                                          <div className="text-xs text-muted-foreground truncate">{nomAuteurDe(m)}</div>
                                        </div>
                                        <span className="text-xs text-muted-foreground ml-2 tabular-nums">
                                          {si?.quantite_disponible ?? 0} ex.
                                        </span>
                                      </CommandItem>
                                    );
                                  })}
                                </CommandGroup>
                              );
                            })}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {cart.length > 0 && (
                  <>
                    {/* Remise globale */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">💸 Remise (optionnel)</Label>
                      <div className="relative">
                        <Input
                          type="number" min={0} max={100} value={remisePct}
                          onChange={(e) => setRemisePct(e.target.value)}
                          placeholder="0"
                          className="font-mono pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Appliquée proportionnellement à chaque livre. Les droits d'auteur sont calculés sur le montant remisé.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">📅 Date de la vente</Label>
                        <Input type="date" value={dateVente} onChange={(e) => setDateVente(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">🙋 Nom du client (optionnel)</Label>
                        <Input value={clientNom} onChange={(e) => setClientNom(e.target.value)} placeholder="Client comptant" />
                      </div>
                    </div>

                    <label className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={paiementRecu}
                        onChange={(e) => setPaiementRecu(e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-[color:var(--gold)]"
                      />
                      <span className="text-xs">
                        <span className="block font-semibold">💵 Paiement reçu maintenant</span>
                        <span className="block text-muted-foreground">
                          {paiementRecu
                            ? "La vente sera marquée « Encaissé »."
                            : "La vente sera marquée « À encaisser » : vous pourrez l'encaisser plus tard dans Finances."}
                        </span>
                      </span>
                    </label>

                    <div className="space-y-1.5">
                      <Label className="text-xs">📝 Notes (optionnel)</Label>
                      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Commentaire sur cette vente…" />
                    </div>

                    <FactureWatermarkUploader
                      onPickerActiveChange={(active) => {
                        watermarkPickerActiveRef.current = active;
                      }}
                    />

                    {/* Récapitulatif */}
                    <div className="rounded-xl border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/5 p-4 space-y-2">
                      <div className="text-sm font-semibold">📊 Récapitulatif</div>
                      <Row label="Total avant remise" value={fcfa(cartSousTotal)} mono />
                      {cartRemise > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Remise ({remisePctN}%)</span>
                          <span className="font-mono tabular-nums text-orange-400">− {fcfa(cartRemise)}</span>
                        </div>
                      )}
                      <div className="border-t border-border my-1" />
                      <div className="flex items-center justify-between">
                        <span className="text-sm">💰 TOTAL</span>
                        <span className="font-mono text-lg font-bold text-[color:var(--gold)] tabular-nums">{fcfa(cartTotal)}</span>
                      </div>
                      <div className="border-t border-border my-1" />
                      <div className="text-xs text-muted-foreground">Droits d'auteur estimés</div>
                      {cart.map((l) => (
                        <div key={l.manuscrit_id} className="flex items-center justify-between text-xs">
                          <span className="truncate mr-2">{l.titre} ({l.royaltyPct}%)</span>
                          <span className="font-mono tabular-nums">{fcfa(ligneDroits(l))}</span>
                        </div>
                      ))}
                      <Row label="Total droits" value={fcfa(cartDroits)} mono />
                    </div>

                    {cartErrors.length > 0 && (
                      <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300 space-y-1">
                        {cartErrors.map((e, i) => (
                          <p key={i} className="flex items-start gap-1"><AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />{e}</p>
                        ))}
                      </div>
                    )}

                    <Button
                      onClick={submitPanier}
                      disabled={!canSubmitPanier || saving}
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
              </>
            ) : (
              <>
                {/* Manuscrit : flux librairie */}
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
                          {(["propre", "etranger"] as const).map((grp) => {
                            const list = manuscrits.filter((m) =>
                              grp === "etranger" ? m.origine === "etranger" : m.origine !== "etranger",
                            );
                            if (list.length === 0) return null;
                            return (
                              <CommandGroup key={grp} heading={grp === "etranger" ? "🌍 Livres étrangers" : "📗 Nos productions"}>
                                {list.map((m) => {
                                  const aName = nomAuteurDe(m);
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
                            );
                          })}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">✍️ Auteur</Label>
                  <div className="h-10 rounded-md border border-border bg-muted/20 px-3 flex items-center text-sm text-[color:var(--gold)] font-medium">
                    {auteurName || <span className="text-muted-foreground italic">Sélectionnez un manuscrit</span>}
                  </div>
                </div>

                {manuscritId && (
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

                {manuscritId && stockId && (
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
                            Stock insuffisant : seulement {availableStock} disponibles
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">💵 Prix unitaire (FCFA)</Label>
                        <Input type="number" min={0} value={prix} onChange={(e) => setPrix(e.target.value)} className="font-mono" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">📅 Date de la vente</Label>
                      <Input type="date" value={dateVente} onChange={(e) => setDateVente(e.target.value)} />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">📝 Notes (optionnel)</Label>
                      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Commentaire sur cette vente…" rows={2} />
                    </div>

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
                      {isEtranger ? (
                        <Row label="✍️ Droits auteur" value="Non applicable (livre étranger)" />
                      ) : (
                        <Row label={`✍️ Droits auteur (${royaltyPct}%)`} value={fcfa(royalties)} mono />
                      )}
                      <div className="flex items-center justify-between text-sm">
                        <span>📦 Stock restant après vente</span>
                        <span className={cn("font-semibold tabular-nums", stockAfter < 5 ? "text-red-400" : "text-emerald-400")}>
                          {stockAfter}
                        </span>
                      </div>
                    </div>

                    <Button
                      onClick={submitLibrairie}
                      disabled={!canSubmitLibrairie || saving}
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

function PanierSuccessView({
  panier, onFacture, onAnother, onClose,
}: { panier: PanierResult; onFacture: () => void; onAnother: () => void; onClose: () => void }) {
  return (
    <div className="mt-6 space-y-5 pb-6 animate-in fade-in-50 duration-300">
      <div className="flex flex-col items-center text-center gap-2">
        <div className="h-16 w-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center animate-in zoom-in-50">
          <CheckCircle2 className="h-9 w-9 text-emerald-400" />
        </div>
        <h3 className="text-xl font-bold text-foreground">Vente enregistrée !</h3>
        <p className="text-xs text-muted-foreground">Facture n° {panier.numero}</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-sm">
        {panier.lignes.map((l) => (
          <div key={l.manuscrit_id} className="flex items-start justify-between gap-2">
            <span className="min-w-0">
              <span className="block font-semibold truncate">{l.titre}</span>
              <span className="block text-xs text-muted-foreground">{l.quantite} × {fcfa(l.prix_unitaire)}</span>
            </span>
            <span className="font-mono tabular-nums">{fcfa(Math.round(l.quantite * l.prix_unitaire))}</span>
          </div>
        ))}
        <div className="border-t border-border my-2" />
        <Row label="Total avant remise" value={fcfa(panier.sousTotal)} mono />
        {panier.remiseFcfa > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Remise ({panier.remisePct}%)</span>
            <span className="font-mono tabular-nums text-orange-400">− {fcfa(panier.remiseFcfa)}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          <span>💰 Total</span>
          <span className="font-mono text-lg font-bold text-[color:var(--gold)] tabular-nums">{fcfa(panier.total)}</span>
        </div>
        <Row label="✍️ Droits auteur" value={fcfa(panier.droits)} mono />
        <Row label="🙋 Client" value={panier.client ?? "Client comptant"} />
        <Row label="📅 Date" value={new Date(panier.date).toLocaleDateString("fr-FR")} />
      </div>

      <div className="grid gap-2">
        <Button
          onClick={onFacture}
          className="w-full text-white font-semibold border-0 bg-[linear-gradient(135deg,#C8922A,#A67420)] hover:brightness-110 rounded-[10px] h-11"
        >
          <FileText className="h-4 w-4 mr-2" /> Télécharger la facture
        </Button>
        <Button variant="outline" onClick={onAnother} className="w-full">📝 Enregistrer une autre vente</Button>
        <Button variant="ghost" onClick={onClose} className="w-full">✕ Fermer</Button>
      </div>
    </div>
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
        <Row label={result.remise ? "Prix final unitaire" : "Prix unitaire"} value={fcfa(result.prixUnit)} mono />
        {result.remise ? (
          <>
            <Row label="Prix catalogue" value={fcfa(result.prixCatalogue ?? result.prixUnit)} mono />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">🏷️ Remise accordée</span>
              <span className="font-mono tabular-nums text-orange-400">− {fcfa(result.remise)}</span>
            </div>
          </>
        ) : null}
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
