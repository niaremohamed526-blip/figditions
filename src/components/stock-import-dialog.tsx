import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { Loader2, Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { fcfa } from "@/lib/format";
import { UnsavedChangesModal } from "@/components/unsaved-changes-modal";
import { useCloseGuard } from "@/hooks/useCloseGuard";

interface Manuscrit { id: string; titre: string; statut: string; }

interface ParsedRow {
  rowNumber: number;
  titre: string;
  quantite: number;
  prix: number;
  dateDepot: string | null; // yyyy-MM-dd
  manuscritId: string | null;
  error: string | null;
}

export function StockImportDialog({
  open, onOpenChange, entrepriseId, manuscrits, onImported,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entrepriseId: string | null;
  manuscrits: Manuscrit[];
  onImported: () => void;
}) {
  const [librairieNom, setLibrairieNom] = useState("");
  const [librairieAdresse, setLibrairieAdresse] = useState("");
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const published = useMemo(() => manuscrits.filter((m) => m.statut === "publie"), [manuscrits]);

  const titleIndex = useMemo(() => {
    const map = new Map<string, string>();
    published.forEach((m) => map.set(m.titre.trim().toLowerCase(), m.id));
    return map;
  }, [published]);

  const validCount = rows?.filter((r) => !r.error).length ?? 0;
  const errorCount = rows?.filter((r) => r.error).length ?? 0;
  const totalEx = rows?.reduce((s, r) => s + (r.error ? 0 : r.quantite), 0) ?? 0;
  const totalValeur = rows?.reduce((s, r) => s + (r.error ? 0 : r.quantite * r.prix), 0) ?? 0;

  const reset = () => {
    setRows(null);
    setFileName(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const close = () => {
    setLibrairieNom("");
    setLibrairieAdresse("");
    reset();
    onOpenChange(false);
  };

  const downloadTemplate = () => {
    const sampleTitre = published[0]?.titre ?? "Titre exact du manuscrit publié";
    const data = [
      ["Titre du livre", "Quantité déposée", "Prix unitaire (FCFA)", "Date de dépôt (JJ/MM/AAAA)"],
      [sampleTitre, 20, 5000, format(new Date(), "dd/MM/yyyy")],
      [published[1]?.titre ?? "Autre titre", 15, 7500, ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 40 }, { wch: 18 }, { wch: 20 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dépôts");

    // Sheet 2 : catalogue référence
    const catalog = [["Titres disponibles dans votre catalogue publié"], ...published.map((m) => [m.titre])];
    const ws2 = XLSX.utils.aoa_to_sheet(catalog);
    ws2["!cols"] = [{ wch: 50 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Catalogue");

    XLSX.writeFile(wb, "modele-depots-librairie.xlsx");
    toast.success("Modèle téléchargé");
  };

  const parseDate = (v: any): string | null => {
    if (v === null || v === undefined || v === "") return null;
    if (v instanceof Date && !isNaN(v.getTime())) return format(v, "yyyy-MM-dd");
    if (typeof v === "number") {
      // Excel serial date
      const d = XLSX.SSF?.parse_date_code?.(v);
      if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    }
    const s = String(v).trim();
    // JJ/MM/AAAA or JJ-MM-AAAA
    const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (m) {
      const [, d, mo, y] = m;
      const yy = y.length === 2 ? `20${y}` : y;
      return `${yy}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    // ISO
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    return null;
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false, dateNF: "yyyy-mm-dd" });
      if (raw.length < 2) {
        toast.error("Fichier vide ou sans données");
        return;
      }
      const parsed: ParsedRow[] = [];
      for (let i = 1; i < raw.length; i++) {
        const r = raw[i];
        if (!r || r.every((c) => c === "" || c === null || c === undefined)) continue;
        const titre = String(r[0] ?? "").trim();
        const qte = Number(String(r[1] ?? "").toString().replace(/\s/g, "").replace(",", "."));
        const prix = Number(String(r[2] ?? "").toString().replace(/\s/g, "").replace(",", "."));
        const dateDepot = parseDate(r[3]);

        let error: string | null = null;
        let manuscritId: string | null = null;

        if (!titre) error = "Titre manquant";
        else {
          manuscritId = titleIndex.get(titre.toLowerCase()) ?? null;
          if (!manuscritId) error = "Titre introuvable dans le catalogue publié";
        }
        if (!error && (!Number.isFinite(qte) || qte <= 0)) error = "Quantité invalide";
        if (!error && (!Number.isFinite(prix) || prix < 0)) error = "Prix invalide";

        parsed.push({
          rowNumber: i + 1,
          titre,
          quantite: Number.isFinite(qte) ? qte : 0,
          prix: Number.isFinite(prix) ? prix : 0,
          dateDepot,
          manuscritId,
          error,
        });
      }
      if (parsed.length === 0) {
        toast.error("Aucune ligne de données trouvée");
        return;
      }
      setRows(parsed);
      const ok = parsed.filter((p) => !p.error).length;
      toast.success(`${parsed.length} ligne(s) analysée(s) — ${ok} valide(s)`);
    } catch (e: any) {
      toast.error("Impossible de lire le fichier : " + (e?.message ?? "format invalide"));
      reset();
    }
  };

  const submit = async () => {
    if (!entrepriseId) return toast.error("Profil non chargé");
    if (!librairieNom.trim()) return toast.error("Nom de la librairie requis");
    if (!rows || validCount === 0) return toast.error("Aucune ligne valide à importer");

    setImporting(true);
    const valid = rows.filter((r) => !r.error && r.manuscritId);
    const payload = valid.map((r) => ({
      entreprise_id: entrepriseId,
      manuscrit_id: r.manuscritId!,
      librairie_nom: librairieNom.trim(),
      librairie_adresse: librairieAdresse.trim() || null,
      exemplaires_deposes: r.quantite,
      exemplaires_vendus: 0,
      exemplaires_restants: r.quantite,
      exemplaires_total: r.quantite,
      prix_unitaire_fcfa: r.prix,
      derniere_visite: r.dateDepot,
    }));

    const { error } = await supabase.from("stocks").insert(payload as any);
    setImporting(false);
    if (error) return toast.error(error.message);
    toast.success(`${valid.length} dépôt(s) importé(s) chez « ${librairieNom} »`);
    onImported();
    close();
  };

  const isDirty = !!librairieNom || !!librairieAdresse || (rows?.length ?? 0) > 0;
  const guard = useCloseGuard(isDirty, close);

  return (
    <>
    <Dialog open={open} onOpenChange={guard.handleOpenChange}>
      <DialogContent className="bg-card border-border max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importer plusieurs dépôts en une fois
          </DialogTitle>
          <DialogDescription>
            Téléchargez le modèle Excel, remplissez-le avec vos livres, puis chargez-le ici. Idéal pour ajouter des dizaines de titres d'un coup dans une librairie.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Étape 1 */}
          <div className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">1</span>
              <h4 className="font-semibold text-sm">Téléchargez le modèle</h4>
            </div>
            <p className="text-xs text-muted-foreground">
              Le fichier contient les colonnes attendues et la liste de vos manuscrits publiés (onglet « Catalogue »).
            </p>
            <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" /> Télécharger le modèle Excel
            </Button>
          </div>

          {/* Étape 2 */}
          <div className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">2</span>
              <h4 className="font-semibold text-sm">Librairie destinataire</h4>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nom de la librairie *</Label>
                <Input value={librairieNom} onChange={(e) => setLibrairieNom(e.target.value)} placeholder="Ex. Librairie Renaissance" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Adresse (optionnel)</Label>
                <Input value={librairieAdresse} onChange={(e) => setLibrairieAdresse(e.target.value)} placeholder="Ex. ACI 2000, Bamako" />
              </div>
            </div>
          </div>

          {/* Étape 3 */}
          <div className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">3</span>
              <h4 className="font-semibold text-sm">Chargez le fichier rempli</h4>
            </div>
            {!rows ? (
              <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-8 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm font-medium">Cliquez pour choisir un fichier .xlsx ou .csv</span>
                <span className="text-xs text-muted-foreground">Glissez-déposez également accepté</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                />
              </label>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileSpreadsheet className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="truncate">{fileName}</span>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={reset}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <StatChip label="Lignes" value={rows.length} />
                  <StatChip label="Valides" value={validCount} tone="success" />
                  <StatChip label="Erreurs" value={errorCount} tone={errorCount ? "error" : "muted"} />
                  <StatChip label="Total ex." value={totalEx} />
                </div>
                <div className="text-xs text-muted-foreground">
                  Valeur cumulée du dépôt : <span className="font-semibold text-[color:var(--gold)]">{fcfa(totalValeur)}</span>
                </div>

                <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 sticky top-0">
                      <tr className="text-left">
                        <th className="px-2 py-1.5 w-10">#</th>
                        <th className="px-2 py-1.5">Titre</th>
                        <th className="px-2 py-1.5 text-center w-14">Qté</th>
                        <th className="px-2 py-1.5 text-right w-24">Prix</th>
                        <th className="px-2 py-1.5 w-24">Date</th>
                        <th className="px-2 py-1.5 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.rowNumber} className={cn("border-t border-border", r.error && "bg-destructive/5")}>
                          <td className="px-2 py-1.5 text-muted-foreground">{r.rowNumber}</td>
                          <td className="px-2 py-1.5">
                            <div className="truncate max-w-[220px]" title={r.titre}>{r.titre || "—"}</div>
                            {r.error && <div className="text-destructive text-[10px] mt-0.5">{r.error}</div>}
                          </td>
                          <td className="px-2 py-1.5 text-center tabular-nums">{r.quantite || "—"}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{r.prix ? fcfa(r.prix) : "—"}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">{r.dateDepot ?? "—"}</td>
                          <td className="px-2 py-1.5">
                            {r.error
                              ? <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                              : <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {errorCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Les lignes en erreur seront ignorées. Corrigez votre fichier et rechargez-le pour les importer.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={importing}>Annuler</Button>
          <Button
            onClick={submit}
            disabled={importing || !rows || validCount === 0 || !librairieNom.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {importing
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Import en cours…</>
              : <>Importer {validCount > 0 ? `${validCount} dépôt(s)` : ""}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <UnsavedChangesModal
      open={guard.showModal}
      onContinue={guard.cancelClose}
      onDiscard={guard.confirmDiscard}
    />
    </>
  );
}

function StatChip({ label, value, tone }: { label: string; value: number; tone?: "success" | "error" | "muted" }) {
  const cls =
    tone === "success" ? "text-primary bg-primary/10 border-primary/20"
    : tone === "error" ? "text-destructive bg-destructive/10 border-destructive/20"
    : tone === "muted" ? "text-muted-foreground bg-muted/40 border-border"
    : "text-foreground bg-muted/40 border-border";
  return (
    <div className={cn("rounded-lg border px-2 py-1.5", cls)}>
      <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="font-bold text-sm tabular-nums">{value}</div>
    </div>
  );
}
