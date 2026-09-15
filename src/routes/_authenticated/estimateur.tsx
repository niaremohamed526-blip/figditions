import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  Calculator, Save, Loader2, Trash2, Printer, Sparkles,
  BookOpen, Settings2, Palette, ChevronDown, Info, Zap, Check, PackagePlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { fcfa } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BookCombobox } from "@/components/book-combobox";


const searchSchema = z.object({ manuscrit: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/estimateur")({
  component: EstimateurPage,
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Estimateur de coûts — FIGDITIONS" }] }),
});


// --- Tarifs Bamako ---
const PAPER_RATES: Record<string, number> = {
  "Standard local (60g)": 6,
  "Standard importé (80g)": 9,
  "Premium importé (90g)": 13,
};
const COVER_RATES: Record<string, number> = {
  "Matte": 600,
  "Brillante / Glacée": 800,
  "Laminée": 1000,
  "Rigide (couverture dure)": 2500,
};
const BINDING_RATES: Record<string, number> = {
  "Dos carré-collé": 350,
  "Piqué à cheval": 150,
  "Spirale / Wire-O": 500,
  "Rigide": 0,
};
const OFFSET_SETUP_BW = 200_000;
const OFFSET_SETUP_COLOR = 450_000;
const DIGITAL_BW_PER_PAGE = 25;
const DIGITAL_COLOR_PER_PAGE = 85;
const TRIM_PER_COPY = 15;
const PACKAGING_PER_COPY = 8;
const PRINTER_MARGIN_PCT = 0.30;
const BOOKSTORE_MARGIN_PCT = 0.30;
const ROYALTIES_PCT = 0.10;
const LANG_NATIONAL_SURCHARGE_PCT = 0.30;
const GENERATOR_SURCHARGE_PCT = 0.15;
const DELIVERY: Record<string, number> = {
  "Bamako centre": 0,
  "Bamako périphérie": 5_000,
  "Régions du Mali": 25_000,
};

const NATIONAL_LANGS = ["Bamanankan", "Fulfulde", "Songhay", "Soninke", "Français + Langue nationale (bilingue)"];

interface Manuscrit { id: string; titre: string; nombre_pages: number | null; }
interface Estimation {
  id: string; nom_estimation: string; manuscrit_id: string | null;
  tirage: number; methode_impression: string;
  cout_total_fcfa: number; prix_vente_suggere_fcfa: number;
  created_at: string;
}

function EstimateurPage() {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const { manuscrit: prefillManuscritId } = Route.useSearch();

  const [manuscrits, setManuscrits] = useState<Manuscrit[]>([]);
  const [history, setHistory] = useState<Estimation[] | null>(null);
  const [toDelete, setToDelete] = useState<Estimation | null>(null);
  const [toApply, setToApply] = useState<Estimation | null>(null);
  const [applying, setApplying] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);


  // Form state
  const [nom, setNom] = useState("");
  const [manuscritId, setManuscritId] = useState<string>("none");
  const [typeLivre, setTypeLivre] = useState("Roman / Littérature générale");
  const [langue, setLangue] = useState("Français");
  const [pages, setPages] = useState(120);
  const [format, setFormat] = useState("A5 (14.8 × 21 cm)");
  const [couleur, setCouleur] = useState(false);
  const [papier, setPapier] = useState("Standard importé (80g)");
  const [reliure, setReliure] = useState("Dos carré-collé");
  const [finition, setFinition] = useState("Matte");
  const [tirage, setTirage] = useState(500);
  const [depotLegal, setDepotLegal] = useState(true);
  const [delestage, setDelestage] = useState(false);
  const [livraison, setLivraison] = useState("Bamako centre");
  const [miseEnPage, setMiseEnPage] = useState(100_000);
  const [conception, setConception] = useState(150_000);
  const [isbn, setIsbn] = useState(15_000);

  // Collapse state
  const [openGroups, setOpenGroups] = useState({ g1: true, g2: true, g3: true, g4: false });

  const loadAll = async () => {
    const [{ data: ms }, { data: est }] = await Promise.all([
      (supabase as any).from("manuscrits").select("id, titre, nombre_pages"),
      (supabase as any).from("estimations_cout").select("id, nom_estimation, manuscrit_id, tirage, methode_impression, cout_total_fcfa, prix_vente_suggere_fcfa, created_at").order("created_at", { ascending: false }),
    ]);
    setManuscrits((ms ?? []) as Manuscrit[]);
    setHistory((est ?? []) as Estimation[]);
  };

  useEffect(() => { if (profile?.entreprise_id) loadAll(); }, [profile?.entreprise_id]);

  // Prefill depuis ?manuscrit=<id> (depuis Stock interne "Commander une impression")
  useEffect(() => {
    if (prefillManuscritId && manuscrits.length > 0) {
      const exists = manuscrits.find((m) => m.id === prefillManuscritId);
      if (exists) {
        setManuscritId(prefillManuscritId);
        toast.info(`📚 Pré-rempli pour « ${exists.titre} »`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillManuscritId, manuscrits.length]);

  useEffect(() => {
    if (manuscritId === "none") return;
    const m = manuscrits.find((x) => x.id === manuscritId);
    if (m?.nombre_pages) setPages(m.nombre_pages);
    if (m && !nom) setNom(`Estimation - ${m.titre}`);
  }, [manuscritId, manuscrits]);


  // ------- CALCULATIONS -------
  const calc = useMemo(() => {
    const isNational = NATIONAL_LANGS.includes(langue);
    const tirageFinal = tirage + (depotLegal ? 4 : 0);

    // Pré-presse
    const supplementLang = isNational ? (miseEnPage + conception + isbn) * LANG_NATIONAL_SURCHARGE_PCT : 0;
    const sousTotalPrepress = miseEnPage + conception + isbn + supplementLang;

    // Production
    const paperRate = PAPER_RATES[papier] * (couleur ? 3.5 : 1);
    const coutPapier = paperRate * pages * tirageFinal;
    const coutEncre = 0; // included in paper rate for digital; setup covers offset
    const coutCouverture = (COVER_RATES[finition === "Matte" ? "Matte" : finition] || COVER_RATES["Matte"]) * tirageFinal;
    const coutReliure = (BINDING_RATES[reliure] ?? 0) * tirageFinal;

    // Method recommendation
    let methode: "numerique" | "offset" = tirageFinal < 700 ? "numerique" : "offset";
    const setupOffset = methode === "offset" ? (couleur ? OFFSET_SETUP_COLOR : OFFSET_SETUP_BW) : 0;
    // Digital alt path uses per-page rate instead of paper rate
    const digitalCost = (couleur ? DIGITAL_COLOR_PER_PAGE : DIGITAL_BW_PER_PAGE) * pages * tirageFinal;

    const productionBase = methode === "offset"
      ? coutPapier + coutEncre + coutCouverture + coutReliure + setupOffset
      : digitalCost + coutCouverture + coutReliure;
    const generatorSurcharge = delestage ? productionBase * GENERATOR_SURCHARGE_PCT : 0;
    const sousTotalProduction = productionBase + generatorSurcharge;

    // Post-presse
    const coutDecoupe = TRIM_PER_COPY * tirageFinal;
    const coutEmballage = PACKAGING_PER_COPY * tirageFinal;
    const coutLivraison = DELIVERY[livraison] ?? 0;
    const sousTotalPostpress = coutDecoupe + coutEmballage + coutLivraison;

    const sousTotalAvantMarge = sousTotalPrepress + sousTotalProduction + sousTotalPostpress;
    const margeImprimeur = sousTotalAvantMarge * PRINTER_MARGIN_PCT;
    const coutTotal = sousTotalAvantMarge + margeImprimeur;

    const coutUnitaire = coutTotal / Math.max(tirageFinal, 1);
    const margeLibrairie = coutTotal * BOOKSTORE_MARGIN_PCT;
    const droitsAuteur = (coutTotal + margeLibrairie) * ROYALTIES_PCT;
    const prixVenteSuggere = coutTotal + margeLibrairie + droitsAuteur;
    const prixUnitaire = prixVenteSuggere / Math.max(tirageFinal, 1);
    const margePct = ((prixVenteSuggere - coutTotal) / Math.max(prixVenteSuggere, 1)) * 100;

    return {
      isNational, tirageFinal, methode,
      coutMiseEnPage: miseEnPage, coutConception: conception, coutIsbn: isbn,
      supplementLang, sousTotalPrepress,
      coutPapier: methode === "offset" ? coutPapier : digitalCost,
      coutEncre, coutCouverture, coutReliure, setupOffset,
      generatorSurcharge, sousTotalProduction,
      coutDecoupe, coutEmballage, coutLivraison, sousTotalPostpress,
      margeImprimeur, coutTotal,
      coutUnitaire, margeLibrairie, droitsAuteur, prixVenteSuggere, prixUnitaire, margePct,
    };
  }, [pages, tirage, couleur, papier, finition, reliure, delestage, livraison, miseEnPage, conception, isbn, langue, depotLegal]);

  // ------- SAVE -------
  const save = async () => {
    if (!profile?.entreprise_id) return toast.error("Profil non chargé");
    if (!nom.trim()) return toast.error("Donnez un nom à l'estimation");
    setSaving(true);
    const { error } = await (supabase as any).from("estimations_cout").insert({
      entreprise_id: profile.entreprise_id,
      manuscrit_id: manuscritId === "none" ? null : manuscritId,
      nom_estimation: nom,
      type_livre: typeLivre, langue,
      nombre_pages: pages, tirage, format,
      interieur_couleur: couleur,
      type_reliure: reliure, finition_couverture: finition,
      qualite_papier: papier, depot_legal: depotLegal,
      cout_mise_en_page_fcfa: miseEnPage,
      cout_conception_couverture_fcfa: conception,
      cout_isbn_fcfa: isbn,
      supplement_langue_nationale_fcfa: calc.supplementLang,
      cout_papier_fcfa: calc.coutPapier,
      cout_encre_fcfa: calc.coutEncre,
      cout_couverture_fcfa: calc.coutCouverture,
      cout_reliure_fcfa: calc.coutReliure,
      cout_setup_offset_fcfa: calc.setupOffset,
      cout_decoupe_fcfa: calc.coutDecoupe,
      cout_emballage_fcfa: calc.coutEmballage,
      cout_livraison_fcfa: calc.coutLivraison,
      cout_groupe_electrogene_fcfa: calc.generatorSurcharge,
      sous_total_prepress_fcfa: calc.sousTotalPrepress,
      sous_total_production_fcfa: calc.sousTotalProduction,
      sous_total_postpress_fcfa: calc.sousTotalPostpress,
      marge_imprimeur_fcfa: calc.margeImprimeur,
      cout_total_fcfa: calc.coutTotal,
      methode_impression: calc.methode,
      prix_vente_suggere_fcfa: calc.prixVenteSuggere,
      marge_librairie_fcfa: calc.margeLibrairie,
      droits_auteur_fcfa: calc.droitsAuteur,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Estimation sauvegardée !");
    loadAll();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const { error } = await (supabase as any).from("estimations_cout").delete().eq("id", toDelete.id);
    if (error) return toast.error(error.message);
    toast.success("Estimation supprimée");
    setHistory((h) => h?.filter((x) => x.id !== toDelete.id) ?? null);
    setCompareIds((c) => c.filter((id) => id !== toDelete.id));
    setToDelete(null);
  };

  const confirmApply = async () => {
    if (!toApply || !profile?.entreprise_id) return;
    setApplying(true);
    const mid = toApply.manuscrit_id!;
    const tirage = Number(toApply.tirage) || 0;
    const coutUnitaire = tirage > 0 ? toApply.cout_total_fcfa / tirage : 0;
    const prixUnitaire = tirage > 0 ? toApply.prix_vente_suggere_fcfa / tirage : 0;

    const { data: existing } = await (supabase as any)
      .from("stock_interne").select("*").eq("manuscrit_id", mid).maybeSingle();

    let error: any;
    if (existing) {
      ({ error } = await (supabase as any).from("stock_interne").update({
        quantite_imprimee: (existing.quantite_imprimee ?? 0) + tirage,
        quantite_disponible: (existing.quantite_disponible ?? 0) + tirage,
        cout_unitaire_impression_fcfa: coutUnitaire,
        prix_vente_direct_fcfa: prixUnitaire || existing.prix_vente_direct_fcfa,
        date_impression: new Date().toISOString().slice(0, 10),
      }).eq("id", existing.id));
    } else {
      ({ error } = await (supabase as any).from("stock_interne").insert({
        entreprise_id: profile.entreprise_id,
        manuscrit_id: mid,
        quantite_imprimee: tirage,
        quantite_disponible: tirage,
        quantite_reservee: 0,
        quantite_transferee_librairies: 0,
        quantite_vendue_directement: 0,
        quantite_exposee_evenements: 0,
        seuil_alerte: 10,
        cout_unitaire_impression_fcfa: coutUnitaire,
        prix_vente_direct_fcfa: prixUnitaire,
        date_impression: new Date().toISOString().slice(0, 10),
      }));
    }
    // Trace du mouvement (impression reçue)
    if (!error) {
      await (supabase as any).from("mouvements_stock").insert({
        entreprise_id: profile.entreprise_id,
        manuscrit_id: mid,
        type_mouvement: "ajustement",
        quantite: tirage,
        notes: `Impression issue de l'estimation « ${toApply.nom_estimation} »`,
        effectue_par: user?.id ?? null,
        date_mouvement: new Date().toISOString().slice(0, 10),
      });
    }
    setApplying(false);
    if (error) return toast.error(error.message);
    toast.success(`✅ Stock interne mis à jour (+${tirage} ex.)`);
    setToApply(null);
  };



  const tirageRec = tirage < 500
    ? { color: "bg-blue-500/15 text-blue-300 border-blue-500/30", text: "💡 Impression numérique recommandée" }
    : tirage <= 1000
      ? { color: "bg-orange-500/15 text-orange-300 border-orange-500/30", text: "⚖️ Comparer offset et numérique" }
      : { color: "bg-primary/15 text-primary border-primary/30", text: "💡 Impression offset recommandée" };

  const comparedRows = (history ?? []).filter((h) => compareIds.includes(h.id));
  const cheapestId = comparedRows.length > 1
    ? comparedRows.reduce((min, r) => (r.cout_total_fcfa < min.cout_total_fcfa ? r : min), comparedRows[0]).id
    : null;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Estimateur de coûts d'impression</h1>
        <p className="text-muted-foreground mt-1">Calculez le coût exact d'un tirage à Bamako et comparez vos scénarios.</p>
      </header>

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* FORM */}
        <div className="lg:col-span-3 space-y-4">
          <Group title="Informations du livre" icon={<BookOpen className="h-4 w-4" />} open={openGroups.g1}
            onToggle={() => setOpenGroups((o) => ({ ...o, g1: !o.g1 }))}>
            <Field label="Lier à un manuscrit">
              <BookCombobox
                items={manuscrits}
                value={manuscritId === "none" ? "" : manuscritId}
                onChange={(v) => setManuscritId(v || "none")}
                placeholder="Rechercher un manuscrit… (optionnel)"
                extraOption={{ value: "none", label: "Aucun" }}
                emptyLabel="Aucun manuscrit"
              />

            </Field>
            <Field label="Nom de l'estimation *">
              <Input value={nom} onChange={(e) => setNom(e.target.value)}
                placeholder="ex. Estimation impression 500 ex, Roman" />
            </Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Type de livre">
                <Select value={typeLivre} onValueChange={setTypeLivre}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Roman / Littérature générale","Manuel scolaire","Livre jeunesse / bilingue","Poésie / Essai","Texte religieux","Document officiel","Autre"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Langue">
                <Select value={langue} onValueChange={setLangue}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Français","Bamanankan","Fulfulde","Songhay","Soninke","Français + Langue nationale (bilingue)"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {calc.isNational && (
              <Badge tone="orange" icon={<Info className="h-3.5 w-3.5" />}>
                Supplément typographie langue nationale : +30% sur les coûts de préparation
              </Badge>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Nombre de pages">
                <Input type="number" min={8} value={pages} onChange={(e) => setPages(Math.max(8, Number(e.target.value)))} />
              </Field>
              <Field label="Format">
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["A5 (14.8 × 21 cm)","A4 (21 × 29.7 cm)","14 × 21 cm (standard Mali)","Personnalisé"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Intérieur">
              <RadioGroup value={couleur ? "color" : "bw"} onValueChange={(v) => setCouleur(v === "color")} className="grid grid-cols-2 gap-2">
                <label className={cn("flex items-center gap-2 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors",
                  !couleur ? "border-primary bg-primary/10" : "border-border")}>
                  <RadioGroupItem value="bw" id="bw" /><span className="text-sm">⬛ Noir & Blanc (standard)</span>
                </label>
                <label className={cn("flex items-center gap-2 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors",
                  couleur ? "border-primary bg-primary/10" : "border-border")}>
                  <RadioGroupItem value="color" id="color" /><span className="text-sm">🎨 Couleur (premium)</span>
                </label>
              </RadioGroup>
            </Field>
          </Group>

          <Group title="Impression & Reliure" icon={<Printer className="h-4 w-4" />} open={openGroups.g2}
            onToggle={() => setOpenGroups((o) => ({ ...o, g2: !o.g2 }))}>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Qualité du papier">
                <Select value={papier} onValueChange={setPapier}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.keys(PAPER_RATES).map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Type de reliure">
                <Select value={reliure} onValueChange={setReliure}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.keys(BINDING_RATES).map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Finition couverture">
              <Select value={finition} onValueChange={setFinition}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Matte","Brillante / Glacée","Laminée","Rigide (couverture dure)"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Tirage / Nombre d'exemplaires">
              <Input type="number" min={1} value={tirage} onChange={(e) => setTirage(Math.max(1, Number(e.target.value)))} />
              <div className={cn("mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold border", tirageRec.color)}>
                {tirageRec.text}
              </div>
            </Field>
          </Group>

          <Group title="Options spéciales Mali" icon={<Settings2 className="h-4 w-4" />} open={openGroups.g3}
            onToggle={() => setOpenGroups((o) => ({ ...o, g3: !o.g3 }))}>
            <Toggle label="Dépôt légal requis ?" description="Ajoute automatiquement 4 exemplaires pour la Bibliothèque Nationale"
              checked={depotLegal} onChange={setDepotLegal} />
            {depotLegal && <Badge tone="primary" icon={<Check className="h-3.5 w-3.5" />}>4 exemplaires supplémentaires ajoutés au tirage</Badge>}
            <Toggle label="Surcoût groupe électrogène ?" description="Fréquent à Bamako en cas de délestage électrique (+15% production)"
              icon={<Zap className="h-4 w-4 text-[color:var(--gold)]" />} checked={delestage} onChange={setDelestage} />
            <Field label="Livraison">
              <Select value={livraison} onValueChange={setLivraison}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DELIVERY).map(([k, v]) => <SelectItem key={k} value={k}>{k} {v > 0 ? `(+${fcfa(v)})` : "(gratuit)"}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </Group>

          <Group title="Préparation (optionnel)" icon={<Palette className="h-4 w-4" />} open={openGroups.g4}
            onToggle={() => setOpenGroups((o) => ({ ...o, g4: !o.g4 }))}>
            <p className="text-xs text-muted-foreground">Ces coûts sont estimatifs. Laissez à 0 si vous gérez ces services en interne.</p>
            <Slider label="Mise en page / Layout" value={miseEnPage} onChange={setMiseEnPage} min={50_000} max={200_000} step={5_000} />
            <Slider label="Conception couverture" value={conception} onChange={setConception} min={75_000} max={400_000} step={5_000} />
            <Slider label="Enregistrement ISBN" value={isbn} onChange={setIsbn} min={10_000} max={25_000} step={1_000} />
          </Group>

          <Button onClick={save} disabled={saving} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 text-base">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Sauvegarder cette estimation</>}
          </Button>
        </div>

        {/* RESULTS PANEL */}
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-6 space-y-4">
            {/* Method recommendation */}
            <div className={cn(
              "rounded-2xl border p-5 flex items-center gap-4",
              calc.methode === "offset"
                ? "border-primary/40 bg-primary/10 shadow-[0_0_30px_color-mix(in_oklab,var(--color-primary)_25%,transparent)]"
                : "border-blue-500/40 bg-blue-500/10"
            )}>
              <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center",
                calc.methode === "offset" ? "bg-primary text-primary-foreground" : "bg-blue-500 text-white")}>
                <Printer className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Méthode recommandée</p>
                <p className="font-bold text-lg leading-tight">
                  Impression {calc.methode === "offset" ? "Offset" : "Numérique"}
                </p>
                <p className="text-xs text-muted-foreground">pour {calc.tirageFinal.toLocaleString("fr-FR")} exemplaires</p>
              </div>
            </div>

            {/* Breakdown */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <Section title="📋 Préparation">
                <CostRow label="Mise en page" value={calc.coutMiseEnPage} />
                <CostRow label="Conception couverture" value={calc.coutConception} />
                <CostRow label="ISBN" value={calc.coutIsbn} />
                {calc.supplementLang > 0 && <CostRow label="Supplément langue nationale (+30%)" value={calc.supplementLang} accent />}
                <Subtotal label="Total de la préparation" value={calc.sousTotalPrepress} />
              </Section>

              <Section title={`🖨️ Production (${calc.tirageFinal.toLocaleString("fr-FR")} ex.)`}>
                <CostRow label={calc.methode === "offset" ? `Papier (${pages} p.)` : `Impression numérique (${pages} p.)`} value={calc.coutPapier} />
                <CostRow label="Couverture" value={calc.coutCouverture} />
                <CostRow label="Reliure" value={calc.coutReliure} />
                {calc.setupOffset > 0 && <CostRow label="Setup offset" value={calc.setupOffset} />}
                {calc.generatorSurcharge > 0 && <CostRow label="Surcoût groupe électrogène (+15%)" value={calc.generatorSurcharge} accent />}
                <Subtotal label="Total de la production" value={calc.sousTotalProduction} />
              </Section>

              <Section title="📦 Finition">
                <CostRow label="Découpe et finition" value={calc.coutDecoupe} />
                <CostRow label="Emballage" value={calc.coutEmballage} />
                <CostRow label="Livraison" value={calc.coutLivraison} />
                <Subtotal label="Total de la finition" value={calc.sousTotalPostpress} />
              </Section>

              <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-muted/30">
                <span className="text-sm">💼 Marge imprimeur (30%)</span>
                <span className="font-mono font-semibold">{fcfa(calc.margeImprimeur)}</span>
              </div>

              <div className="rounded-xl border-2 border-primary/40 bg-primary/10 px-4 py-4 flex items-center justify-between shadow-[0_0_30px_color-mix(in_oklab,var(--color-primary)_30%,transparent)]">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-primary/80">Coût total impression</p>
                  <p className="text-[10px] text-muted-foreground">≈ {fcfa(calc.coutUnitaire)} / ex.</p>
                </div>
                <p className="text-2xl font-extrabold text-primary">{fcfa(calc.coutTotal)}</p>
              </div>

              <Section title="📊 Analyse commerciale">
                <CostRow label="Coût unitaire" value={calc.coutUnitaire} />
                <CostRow label="Marge librairie (30%)" value={calc.margeLibrairie} />
                <CostRow label="Droits auteur (10%)" value={calc.droitsAuteur} />
              </Section>

              <div className="rounded-xl border-2 border-[color:var(--gold)]/50 bg-[color:var(--gold)]/10 px-4 py-4 flex items-center justify-between shadow-[0_0_30px_color-mix(in_oklab,var(--gold)_30%,transparent)]">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[color:var(--gold)]/80">Prix de vente suggéré</p>
                  <p className="text-[10px] text-muted-foreground">≈ {fcfa(calc.prixUnitaire)} / ex. · marge {calc.margePct.toFixed(0)}%</p>
                </div>
                <p className="text-2xl font-extrabold text-[color:var(--gold)]">{fcfa(calc.prixVenteSuggere)}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 grid grid-cols-3 gap-3 text-center">
              <Stat label="Revient unitaire" value={fcfa(calc.coutUnitaire)} />
              <Stat label="Prix min. conseillé" value={fcfa(calc.prixUnitaire)} accent />
              <Stat label="Marge estimée" value={`${calc.margePct.toFixed(0)}%`} />
            </div>
          </div>
        </div>
      </div>

      {/* COMPARISON */}
      {compareIds.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Comparer mes estimations</h2>
            <Button variant="outline" size="sm" onClick={() => setCompareIds([])}>Effacer la comparaison</Button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Nom</th>
                  <th className="px-4 py-3 font-medium text-center">Tirage</th>
                  <th className="px-4 py-3 font-medium">Méthode</th>
                  <th className="px-4 py-3 font-medium text-right">Coût total</th>
                  <th className="px-4 py-3 font-medium text-right">Prix suggéré</th>
                </tr>
              </thead>
              <tbody>
                {comparedRows.map((r) => (
                  <tr key={r.id} className={cn("border-t border-border", r.id === cheapestId && "bg-primary/10")}>
                    <td className="px-4 py-3 font-medium">
                      {r.nom_estimation}
                      {r.id === cheapestId && <span className="ml-2 text-xs text-primary font-bold">★ Le moins cher</span>}
                    </td>
                    <td className="px-4 py-3 text-center">{r.tirage.toLocaleString("fr-FR")}</td>
                    <td className="px-4 py-3 capitalize">{r.methode_impression}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{fcfa(r.cout_total_fcfa)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-[color:var(--gold)]">{fcfa(r.prix_vente_suggere_fcfa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* HISTORY */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Historique des estimations</h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {history === null ? (
            <div className="p-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center px-4">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <Calculator className="h-7 w-7" />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">Aucune estimation sauvegardée pour l'instant.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-muted-foreground">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-medium w-10"></th>
                    <th className="px-4 py-3 font-medium">Nom</th>
                    <th className="px-4 py-3 font-medium text-center">Tirage</th>
                    <th className="px-4 py-3 font-medium">Méthode</th>
                    <th className="px-4 py-3 font-medium text-right">Coût total</th>
                    <th className="px-4 py-3 font-medium text-right">Prix suggéré</th>
                    <th className="px-4 py-3 font-medium hidden sm:table-cell">Date</th>
                    <th className="px-4 py-3 font-medium w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((e) => {
                    const checked = compareIds.includes(e.id);
                    return (
                      <tr key={e.id} className="group border-t border-border hover:bg-primary/5 transition-colors">
                        <td className="px-4 py-3">
                          <Checkbox checked={checked}
                            disabled={!checked && compareIds.length >= 3}
                            onCheckedChange={(v) => setCompareIds((c) => v ? [...c, e.id] : c.filter((id) => id !== e.id))} />
                        </td>
                        <td className="px-4 py-3 font-medium">{e.nom_estimation}</td>
                        <td className="px-4 py-3 text-center text-muted-foreground">{e.tirage?.toLocaleString("fr-FR")}</td>
                        <td className="px-4 py-3 capitalize text-muted-foreground">{e.methode_impression}</td>
                        <td className="px-4 py-3 text-right font-mono">{fcfa(e.cout_total_fcfa)}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-[color:var(--gold)]">{fcfa(e.prix_vente_suggere_fcfa)}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{new Date(e.created_at).toLocaleDateString("fr-FR")}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {e.manuscrit_id && (
                              <Button size="sm" variant="outline" className="h-8 gap-1.5"
                                onClick={() => setToApply(e)} title="Utiliser cette estimation pour le stock interne">
                                <PackagePlus className="h-3.5 w-3.5" />
                                <span className="hidden md:inline">Utiliser</span>
                              </Button>
                            )}
                            <Button size="icon" variant="ghost"
                              className="h-8 w-8 hover:bg-destructive/15 hover:text-destructive"
                              onClick={() => setToDelete(e)} title="Supprimer">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>

                      </tr>
                    );
                  })}
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!toApply} onOpenChange={(o) => !o && setToApply(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Utiliser cette estimation ?</AlertDialogTitle>
            <AlertDialogDescription>
              {toApply && (
                <>
                  <strong>{toApply.tirage?.toLocaleString("fr-FR")} exemplaires</strong> seront ajoutés au stock interne du manuscrit lié,
                  avec un coût unitaire de <strong>{fcfa(toApply.tirage ? toApply.cout_total_fcfa / toApply.tirage : 0)}</strong>
                  {" "}et un prix de vente direct suggéré de <strong>{fcfa(toApply.tirage ? toApply.prix_vente_suggere_fcfa / toApply.tirage : 0)}</strong>.
                  Une trace sera ajoutée dans l'historique des mouvements.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applying}>Annuler</AlertDialogCancel>
            <AlertDialogAction disabled={applying} onClick={(e) => { e.preventDefault(); confirmApply(); }}
              className="bg-primary text-primary-foreground hover:bg-primary/90">
              {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ajouter au stock"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


// ---------- helpers ----------
function Group({ title, icon, open, onToggle, children }: { title: string; icon: React.ReactNode; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button type="button" onClick={onToggle} className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/20 transition-colors">
        <div className="flex items-center gap-2.5">
          <span className="h-8 w-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center">{icon}</span>
          <span className="font-semibold">{title}</span>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      <div className={cn("grid transition-all duration-300", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          <div className="px-5 pb-5 space-y-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function Toggle({ label, description, checked, onChange, icon }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; icon?: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between rounded-lg border border-border bg-background/30 px-4 py-3 cursor-pointer">
      <div>
        <p className="text-sm font-medium flex items-center gap-2">{icon}{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function Slider({ label, value, onChange, min, max, step }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number; step: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        <span className="text-sm font-semibold text-primary">{fcfa(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[color:var(--color-primary)]" />
      <div className="flex justify-between text-[10px] text-muted-foreground"><span>{fcfa(min)}</span><span>{fcfa(max)}</span></div>
    </div>
  );
}

function Badge({ tone, icon, children }: { tone: "orange" | "primary" | "blue"; icon?: React.ReactNode; children: React.ReactNode }) {
  const cls = tone === "orange" ? "bg-orange-500/15 text-orange-300 border-orange-500/30"
    : tone === "primary" ? "bg-primary/15 text-primary border-primary/30"
    : "bg-blue-500/15 text-blue-300 border-blue-500/30";
  return <div className={cn("flex items-start gap-2 rounded-lg px-3 py-2 text-xs border", cls)}>{icon}<span>{children}</span></div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">{title}</p>
      {children}
    </div>
  );
}

function CostRow({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <span className={cn("text-muted-foreground", accent && "text-orange-300")}>├── {label}</span>
      <span className="font-mono tabular-nums">{fcfa(value)}</span>
    </div>
  );
}

function Subtotal({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm pt-1 pl-4 border-t border-border/50 mt-1">
      <span className="font-semibold">{label}</span>
      <span className="font-mono font-bold">{fcfa(value)}</span>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("text-base font-bold mt-1", accent ? "text-[color:var(--gold)]" : "text-foreground")}>{value}</p>
    </div>
  );
}
