import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Loader2, Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { STATUT_OPTIONS } from "@/components/status-badge";
import { UnsavedChangesModal } from "@/components/unsaved-changes-modal";
import { useCloseGuard } from "@/hooks/useCloseGuard";

interface ParsedRow {
  rowNumber: number;
  titre: string;
  auteur: string;
  genre: string | null;
  langue: string;
  statut: string;
  nombrePages: number | null;
  error: string | null;
}

const STATUT_BY_LABEL = new Map<string, string>(
  STATUT_OPTIONS.flatMap((o) => [
    [o.label.toLowerCase(), o.value] as [string, string],
    [o.value.toLowerCase(), o.value] as [string, string],
  ]),
);

export function ManuscritImportDialog({
  open, onOpenChange, entrepriseId, existingTitles, maxManuscrits, currentCount, onImported,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entrepriseId: string | null;
  existingTitles: string[];
  maxManuscrits: number;
  currentCount: number;
  onImported: () => void;
}) {
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const existing = useMemo(
    () => new Set(existingTitles.map((t) => t.trim().toLowerCase())),
    [existingTitles],
  );

  const validRows = rows?.filter((r) => !r.error) ?? [];
  const validCount = validRows.length;
  const errorCount = rows?.filter((r) => r.error).length ?? 0;
  const overLimit = currentCount + validCount > maxManuscrits;

  const reset = () => {
    setRows(null);
    setFileName(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const close = () => { reset(); onOpenChange(false); };

  const downloadTemplate = () => {
    const data = [
      ["Titre", "Auteur", "Genre", "Langue", "Statut", "Nombre de pages"],
      ["Le Silence du Fleuve", "Amadou Traoré", "Roman", "Français", "Reçu", 180],
      ["Contes du Sahel", "Fatoumata Diallo", "Jeunesse", "Bambara", "Relecture", 96],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 36 }, { wch: 26 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Manuscrits");

    const statuts = [["Statuts acceptés"], ...STATUT_OPTIONS.map((o) => [o.label])];
    const ws2 = XLSX.utils.aoa_to_sheet(statuts);
    ws2["!cols"] = [{ wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Statuts");

    XLSX.writeFile(wb, "modele-manuscrits.xlsx");
    toast.success("Modèle téléchargé");
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
      if (raw.length < 2) { toast.error("Fichier vide ou sans données"); return; }

      const seen = new Set<string>();
      const parsed: ParsedRow[] = [];
      for (let i = 1; i < raw.length; i++) {
        const r = raw[i];
        if (!r || r.every((c) => c === "" || c === null || c === undefined)) continue;
        const titre = String(r[0] ?? "").trim();
        const auteur = String(r[1] ?? "").trim();
        const genre = String(r[2] ?? "").trim();
        const langue = String(r[3] ?? "").trim() || "Français";
        const statutRaw = String(r[4] ?? "").trim();
        const pagesRaw = String(r[5] ?? "").replace(/\s/g, "");

        let error: string | null = null;
        const statut = statutRaw ? STATUT_BY_LABEL.get(statutRaw.toLowerCase()) ?? null : "recu";

        if (!titre) error = "Titre manquant";
        else if (!auteur) error = "Auteur manquant";
        else if (existing.has(titre.toLowerCase())) error = "Titre déjà présent dans le catalogue";
        else if (seen.has(titre.toLowerCase())) error = "Titre en doublon dans le fichier";
        else if (!statut) error = `Statut inconnu : « ${statutRaw} »`;

        if (!error) seen.add(titre.toLowerCase());

        const pages = pagesRaw ? Number(pagesRaw) : null;

        parsed.push({
          rowNumber: i + 1,
          titre,
          auteur,
          genre: genre || null,
          langue,
          statut: statut ?? "recu",
          nombrePages: pages !== null && Number.isFinite(pages) && pages > 0 ? Math.round(pages) : null,
          error,
        });
      }
      if (parsed.length === 0) { toast.error("Aucune ligne de données trouvée"); return; }
      setRows(parsed);
      toast.success(`${parsed.length} ligne(s) analysée(s) — ${parsed.filter((p) => !p.error).length} valide(s)`);
    } catch (e: any) {
      toast.error("Impossible de lire le fichier : " + (e?.message ?? "format invalide"));
      reset();
    }
  };

  const submit = async () => {
    if (!entrepriseId) return toast.error("Profil non chargé");
    if (validCount === 0) return toast.error("Aucune ligne valide à importer");
    if (overLimit) {
      return toast.error(`Limite du plan atteinte : ${maxManuscrits} manuscrits maximum.`);
    }
    setImporting(true);
    const payload = validRows.map((r) => ({
      entreprise_id: entrepriseId,
      titre: r.titre,
      auteur: r.auteur,
      genre: r.genre,
      langue: r.langue,
      statut: r.statut as any,
      nombre_pages: r.nombrePages,
    }));
    const { error } = await supabase.from("manuscrits").insert(payload as any);
    setImporting(false);
    if (error) return toast.error(error.message);
    toast.success(`${payload.length} manuscrit(s) importé(s)`);
    onImported();
    close();
  };

  const guard = useCloseGuard((rows?.length ?? 0) > 0, close);

  return (
    <>
      <Dialog open={open} onOpenChange={guard.handleOpenChange}>
        <DialogContent className="bg-card border-border max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Importer des manuscrits depuis Excel
            </DialogTitle>
            <DialogDescription>
              Téléchargez le modèle, remplissez-le avec vos ouvrages, puis chargez-le ici pour créer plusieurs manuscrits d'un coup.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">1</span>
                <h4 className="font-semibold text-sm">Téléchargez le modèle</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                Colonnes : Titre, Auteur, Genre, Langue, Statut, Nombre de pages. L'onglet « Statuts » liste les valeurs acceptées.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" /> Télécharger le modèle Excel
              </Button>
            </div>

            <div className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">2</span>
                <h4 className="font-semibold text-sm">Chargez le fichier rempli</h4>
              </div>
              {!rows ? (
                <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-8 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <span className="text-sm font-medium">Cliquez pour choisir un fichier .xlsx ou .csv</span>
                  <span className="text-xs text-muted-foreground">Vous pouvez aussi glisser puis déposer le fichier</span>
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

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <StatChip label="Lignes" value={rows.length} />
                    <StatChip label="Valides" value={validCount} tone="success" />
                    <StatChip label="Erreurs" value={errorCount} tone={errorCount ? "error" : "muted"} />
                  </div>

                  <div className="max-h-64 overflow-auto rounded-lg border border-border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40 sticky top-0">
                        <tr className="text-left">
                          <th className="px-2 py-1.5 w-10">#</th>
                          <th className="px-2 py-1.5">Titre</th>
                          <th className="px-2 py-1.5">Auteur</th>
                          <th className="px-2 py-1.5 hidden sm:table-cell">Genre</th>
                          <th className="px-2 py-1.5">Statut</th>
                          <th className="px-2 py-1.5 text-center w-14">Pages</th>
                          <th className="px-2 py-1.5 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.rowNumber} className={cn("border-t border-border", r.error && "bg-destructive/5")}>
                            <td className="px-2 py-1.5 text-muted-foreground">{r.rowNumber}</td>
                            <td className="px-2 py-1.5">
                              <div className="truncate max-w-[180px]" title={r.titre}>{r.titre || "—"}</div>
                              {r.error && <div className="text-destructive text-[10px] mt-0.5">{r.error}</div>}
                            </td>
                            <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[120px]">{r.auteur || "—"}</td>
                            <td className="px-2 py-1.5 text-muted-foreground hidden sm:table-cell">{r.genre ?? "—"}</td>
                            <td className="px-2 py-1.5 text-muted-foreground">{r.statut}</td>
                            <td className="px-2 py-1.5 text-center tabular-nums">{r.nombrePages ?? "—"}</td>
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
                  {overLimit && (
                    <p className="text-xs text-destructive">
                      Votre plan autorise {maxManuscrits} manuscrits ({currentCount} déjà enregistrés). Réduisez le fichier ou passez au plan supérieur.
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
              disabled={importing || validCount === 0 || overLimit}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {importing
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Import en cours…</>
                : <>Importer {validCount > 0 ? `${validCount} manuscrit(s)` : ""}</>}
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
