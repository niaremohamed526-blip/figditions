import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  generateFinanceReport,
  reportFilename,
  type ReportLang,
  type ReportSections,
  type Vente,
  type Manuscrit,
  type Auteur,
  type Stock,
  type StockInterne,
} from "@/lib/pdf-finances";

type Preset = "mois" | "3mois" | "6mois" | "annee" | "tout" | "custom";

function isoDay(d: Date) { return d.toISOString().slice(0, 10); }

function computePreset(preset: Preset): { from: string; to: string } {
  const now = new Date();
  const to = isoDay(now);
  if (preset === "tout") return { from: "2000-01-01", to };
  if (preset === "annee") return { from: `${now.getFullYear()}-01-01`, to };
  const d = new Date(now);
  if (preset === "mois") d.setMonth(d.getMonth() - 1);
  else if (preset === "3mois") d.setMonth(d.getMonth() - 3);
  else if (preset === "6mois") d.setMonth(d.getMonth() - 6);
  return { from: isoDay(d), to };
}

export function ExportFinancesDialog({
  open,
  onOpenChange,
  entrepriseNom,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entrepriseNom: string;
}) {
  const [preset, setPreset] = useState<Preset>("6mois");
  const initial = useMemo(() => computePreset("6mois"), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [lang, setLang] = useState<ReportLang>("fr");
  const [sections, setSections] = useState<ReportSections>({
    resume: true, ventes: true, droits: true, livres: true, librairies: true, stocks: true,
  });
  const [busy, setBusy] = useState(false);

  const setP = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") {
      const r = computePreset(p);
      setFrom(r.from);
      setTo(r.to);
    }
  };

  const toggle = (k: keyof ReportSections) => setSections((s) => ({ ...s, [k]: !s[k] }));

  const generate = async () => {
    if (!from || !to) { toast.error("Sélectionnez une période"); return; }
    if (from > to) { toast.error("La date de début doit précéder la date de fin"); return; }
    setBusy(true);
    try {
      // Fetch data (RLS scopes to entreprise)
      const [{ data: v }, { data: m }, { data: a }, { data: st }, { data: si }] = await Promise.all([
        supabase.from("ventes").select("*").gte("date_vente", from).lte("date_vente", to).order("date_vente", { ascending: true }),
        (supabase as any).from("manuscrits").select("id, titre, auteur, auteur_id, genre"),
        supabase.from("auteurs").select("id, nom_complet, email, telephone, mobile_money_operateur, mobile_money_numero"),
        supabase.from("stocks").select("id, manuscrit_id, librairie_nom, librairie_adresse, exemplaires_deposes, exemplaires_vendus, exemplaires_restants, derniere_visite, prix_unitaire_fcfa"),
        supabase.from("stock_interne").select("id, manuscrit_id, quantite_imprimee, quantite_disponible, quantite_reservee, quantite_vendue_directement, prix_vente_direct_fcfa, seuil_alerte"),
      ]);

      // Comparison window (same length just before "from")
      const days = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / (86400 * 1000)));
      const prevTo = isoDay(new Date(new Date(from).getTime() - 86400 * 1000));
      const prevFrom = isoDay(new Date(new Date(prevTo).getTime() - days * 86400 * 1000));
      const { data: prevV } = await supabase.from("ventes").select("*").gte("date_vente", prevFrom).lte("date_vente", prevTo);

      const pdf = generateFinanceReport({
        lang,
        from,
        to,
        sections,
        entrepriseNom: entrepriseNom || "Maison d'édition",
        ventes: (v ?? []) as Vente[],
        manuscrits: (m ?? []) as Manuscrit[],
        auteurs: (a ?? []) as Auteur[],
        stocks: (st ?? []) as Stock[],
        stockInterne: (si ?? []) as StockInterne[],
        previousVentes: (prevV ?? []) as Vente[],
      });
      pdf.save(reportFilename(entrepriseNom, from, to));
      toast.success(lang === "fr" ? "✅ Rapport PDF téléchargé avec succès" : "✅ PDF report downloaded successfully");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de la génération du PDF");
    } finally {
      setBusy(false);
    }
  };

  const presetBtn = (id: Preset, label: string) => (
    <button
      type="button"
      onClick={() => setP(id)}
      className={cn(
        "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
        preset === id
          ? "bg-[color:var(--gold)]/20 text-[color:var(--gold)] border-[color:var(--gold)]"
          : "bg-transparent text-muted-foreground border-border hover:bg-muted/40",
      )}
    >{label}</button>
  );

  const sectionRow = (key: keyof ReportSections, title: string, desc: string) => (
    <label className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/20 cursor-pointer transition-colors">
      <Checkbox checked={sections[key]} onCheckedChange={() => toggle(key)} className="mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>📄 Exporter le rapport financier</DialogTitle>
          <DialogDescription>Choisissez les informations à inclure dans votre rapport PDF</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Période */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">📅 Période</h3>
            <div className="flex flex-wrap gap-2">
              {presetBtn("mois", "Ce mois")}
              {presetBtn("3mois", "3 mois")}
              {presetBtn("6mois", "6 mois")}
              {presetBtn("annee", "Cette année")}
              {presetBtn("tout", "Tout")}
              {presetBtn("custom", "Personnalisé")}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Date début</Label>
                <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreset("custom"); }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date fin</Label>
                <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreset("custom"); }} />
              </div>
            </div>
          </section>

          {/* Sections */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">📋 Sections à inclure</h3>
            <p className="text-xs text-muted-foreground">Cochez les sections à inclure dans le rapport</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {sectionRow("resume", "Résumé exécutif", "Vue d'ensemble des performances financières")}
              {sectionRow("ventes", "Détail des ventes", "Liste complète de toutes les transactions de vente")}
              {sectionRow("droits", "Droits d'auteur", "Royalties calculées et statut de paiement par auteur")}
              {sectionRow("livres", "Analyse par livre", "Performance détaillée de chaque titre")}
              {sectionRow("librairies", "Analyse par librairie", "Ventes et revenus par point de vente")}
              {sectionRow("stocks", "Stocks et inventaire", "État des stocks au moment de l'export")}
            </div>
          </section>

          {/* Langue */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">🌍 Langue du rapport</h3>
            <RadioGroup value={lang} onValueChange={(v) => setLang(v as ReportLang)} className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="fr" id="lang-fr" />
                <span className="text-sm">Français</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="en" id="lang-en" />
                <span className="text-sm">English</span>
              </label>
            </RadioGroup>
          </section>

          <Button
            onClick={generate}
            disabled={busy}
            className="w-full h-11 text-white font-semibold border-0 shadow-lg hover:shadow-xl transition-all bg-[linear-gradient(135deg,#C8922A,#A67420)] hover:brightness-110 rounded-[10px]"
          >
            {busy ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Génération en cours...</>
            ) : (
              <><Download className="h-4 w-4 mr-2" /> Générer le PDF</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ExportFinancesTrigger({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <Button
      onClick={onClick}
      variant="outline"
      className={cn(
        "border-[color:var(--gold)] text-[color:var(--gold)] bg-transparent",
        "hover:bg-[color:var(--gold)]/10 hover:text-[color:var(--gold)]",
        "rounded-[10px] px-6 py-3 h-auto font-semibold",
        className,
      )}
    >
      <Download className="h-4 w-4 mr-2" />
      Exporter en PDF
    </Button>
  );
}
