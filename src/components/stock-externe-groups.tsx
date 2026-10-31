import { useEffect, useMemo, useRef, useState } from "react";
import { pl } from "@/lib/plural";
import { Store, ChevronDown, Plus, BookOpen, Pencil, Trash2, Wallet, Package, XCircle, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fcfa } from "@/lib/format";
import { groupByLibrairie, stockStatus, type ExterneStockRow } from "@/components/librairies-tab";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CancelReasonDialog } from "@/components/cancel-reason-dialog";
import { BulkDepotDateDialog } from "@/components/bulk-depot-date-dialog";
import { RenameLibrairieDialog } from "@/components/rename-librairie-dialog";


interface DepotBatch {
  id: string;
  manuscrit_id: string;
  librairie_nom: string;
  quantite_deposee: number;
  date_depot: string;
  provenance: string;
  notes: string | null;
  statut_annulation?: string | null;
  raison_annulation?: string | null;
}

/** Badge « N dépôts » + historique des lots pour un livre dans une librairie. */
function BatchHistoryBadge({
  manuscritId, librairieNom, onChanged,
}: { manuscritId: string; librairieNom: string; onChanged?: () => void }) {
  const [batches, setBatches] = useState<DepotBatch[] | null>(null);
  const [open, setOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<DepotBatch | null>(null);

  const fetchBatches = async () => {
    const { data } = await supabase
      .from("depot_batches")
      .select("id, manuscrit_id, librairie_nom, quantite_deposee, date_depot, provenance, notes, statut_annulation, raison_annulation")
      .eq("manuscrit_id", manuscritId)
      .ilike("librairie_nom", librairieNom)
      .order("date_depot", { ascending: false });
    setBatches((data as DepotBatch[]) ?? []);
  };

  useEffect(() => {
    if (!open || batches) return;
    void fetchBatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, batches, manuscritId, librairieNom]);

  const cancelBatch = async (b: DepotBatch, raison: string) => {
    try {
      const { data, error } = await (supabase as any).rpc("annuler_depot_batch", {
        p_batch_id: b.id,
        p_raison: raison,
      });
      if (error) throw error;
      toast.success(
        data?.remis_en_stock_interne
          ? `Dépôt annulé : ${data.quantite_reversee} ex. remis en stock interne`
          : `Dépôt annulé : ${data?.quantite_reversee ?? b.quantite_deposee} ex. retirés du dépôt`,
      );
      setCancelTarget(null);
      await fetchBatches();
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de l'annulation du dépôt");
    }
  };


  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Historique des dépôts"
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/10 px-2 py-px text-[10px] font-semibold text-[color:var(--gold)] hover:bg-[color:var(--gold)]/20"
        >
          📦 Dépôts
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 border-border bg-card p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[1px] text-[color:var(--gold)]">
          Historique des dépôts
        </p>
        {batches === null ? (
          <Skeleton className="h-16 w-full rounded-lg" />
        ) : batches.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucun lot enregistré.</p>
        ) : (
          <ul className="space-y-1.5">
            {batches.map((b) => {
              const annule = b.statut_annulation === "annulee";
              return (
                <li key={b.id} className="flex items-start justify-between gap-2 border-b border-border/60 pb-1.5 last:border-0 last:pb-0">
                  <span className={cn("text-xs text-muted-foreground", annule && "line-through opacity-60")}>
                    {fdate(b.date_depot)}
                    {b.provenance === "hors_stock" && <span className="ml-1 opacity-70">📤</span>}
                    {b.notes && <span className="block text-[10px] opacity-70">{b.notes}</span>}
                    {annule && (
                      <span className="block text-[10px] text-red-400 no-underline">
                        Annulé{b.raison_annulation ? ` : ${b.raison_annulation}` : ""}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className={cn("text-xs font-semibold tabular-nums text-[color:var(--gold)]", annule && "line-through opacity-60")}>
                      + {b.quantite_deposee}
                    </span>
                    {!annule && (
                      <button
                        type="button"
                        title="Annuler ce dépôt"
                        onClick={() => setCancelTarget(b)}

                        className="rounded p-0.5 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
            <li className="flex items-center justify-between pt-1 text-xs font-bold">
              <span>Total déposé (actif)</span>
              <span className="tabular-nums text-primary">
                {batches.filter((b) => b.statut_annulation !== "annulee").reduce((s, b) => s + (b.quantite_deposee ?? 0), 0)}
              </span>
            </li>
          </ul>
        )}
      </PopoverContent>

      <CancelReasonDialog
        open={!!cancelTarget}
        onOpenChange={(o) => !o && setCancelTarget(null)}
        title="Annuler ce dépôt ?"
        description="Les exemplaires seront retirés du dépôt (et remis en stock interne si le lot venait de l'entrepôt)."
        summary={cancelTarget ? (
          <>
            <p><span className="text-muted-foreground">Librairie :</span> {cancelTarget.librairie_nom}</p>
            <p><span className="text-muted-foreground">Date du dépôt :</span> {fdate(cancelTarget.date_depot)}</p>
            <p><span className="text-muted-foreground">Quantité :</span> {cancelTarget.quantite_deposee} exemplaire(s)</p>
          </>
        ) : undefined}
        onConfirm={(raison) => cancelTarget ? cancelBatch(cancelTarget, raison) : undefined}
      />
    </Popover>
  );
}


const LS_KEY = "figditions:externe:collapsed";

const fdate = (d: string | null | undefined) => {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy"); } catch { return "—"; }
};

/** Barre de statistiques rapides du stock externe. */
export function ExterneQuickStats({
  librairies, titres, deposes, vendus, restants, ca, horsStock = 0,
}: { librairies: number; titres: number; deposes: number; vendus: number; restants: number; ca: number; horsStock?: number }) {
  const Stat = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span aria-hidden>{icon}</span>
      <span className="font-semibold text-[color:var(--gold)] tabular-nums">{value}</span>
      <span>{label}</span>
    </span>
  );
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-xl border border-[color:var(--gold)]/10 bg-[color:var(--gold)]/[0.05] px-4 py-3">
      <Stat icon="🏪" label="librairies" value={String(librairies)} />
      <Stat icon="📚" label="titres" value={String(titres)} />
      <Stat icon="📦" label="déposés" value={String(deposes)} />
      <Stat icon="✅" label="vendus" value={String(vendus)} />
      <Stat icon="📊" label="restants" value={String(restants)} />
      {horsStock > 0 && <Stat icon="📤" label="hors stock interne" value={String(horsStock)} />}
      <Stat icon="💰" label="" value={fcfa(ca)} />
    </div>
  );
}

export function StockExterneGroups({
  stocks,
  titreMap,
  authorMap,
  onAdd,
  onEdit,
  onDelete,
  onSale,
  librairieFilter,
  onLibrairieFilter,
  onChanged,
}: {
  stocks: ExterneStockRow[] | null;
  titreMap: Record<string, string>;
  authorMap: Record<string, string>;
  onAdd: () => void;
  onEdit: (s: ExterneStockRow) => void;
  onDelete: (s: ExterneStockRow) => void;
  onSale: (r?: ExterneStockRow) => void;
  librairieFilter: string | null;
  onLibrairieFilter: (v: string | null) => void;
  onChanged?: () => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [glow, setGlow] = useState<string | null>(null);
  const refs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setCollapsed(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const toggle = (nom: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [nom]: !prev[nom] };
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const allGroups = useMemo(() => (stocks ? groupByLibrairie(stocks).sort((a, b) => a.nom.localeCompare(b.nom)) : null), [stocks]);
  const groups = useMemo(
    () => (allGroups && librairieFilter ? allGroups.filter((g) => g.nom === librairieFilter) : allGroups),
    [allGroups, librairieFilter],
  );

  const totals = useMemo(() => {
    const list = groups ?? [];
    return {
      librairies: list.length,
      titres: new Set(list.flatMap((g) => g.rows.map((r) => r.manuscrit_id))).size,
      deposes: list.reduce((s, g) => s + g.deposes, 0),
      vendus: list.reduce((s, g) => s + g.vendus, 0),
      restants: list.reduce((s, g) => s + g.restants, 0),
      ca: list.reduce((s, g) => s + g.ca, 0),
      horsStock: list.reduce(
        (s, g) => s + g.rows.reduce((x, r) => x + (r.provenance === "hors_stock" ? (r.exemplaires_deposes ?? 0) : 0), 0),
        0,
      ),
    };
  }, [groups]);

  // Latest active deposit date per book + bookshop, for the « Dépôt du » headings.
  const [depotDates, setDepotDates] = useState<Record<string, string>>({});
  const [bulkFor, setBulkFor] = useState<string | null>(null);
  const [renameFor, setRenameFor] = useState<string | null>(null);
  useEffect(() => {
    if (!stocks) return;
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("depot_batches")
        .select("manuscrit_id, librairie_nom, date_depot, statut_annulation");
      if (!alive) return;
      const map: Record<string, string> = {};
      for (const b of data ?? []) {
        if (b.statut_annulation === "annulee" || !b.date_depot) continue;
        const k = `${b.manuscrit_id}|${b.librairie_nom.trim().toLowerCase()}`;
        if (!map[k] || b.date_depot > map[k]) map[k] = b.date_depot;
      }
      setDepotDates(map);
    })();
    return () => { alive = false; };
  }, [stocks]);
  const depotDate = (r: ExterneStockRow, nom: string) =>
    depotDates[`${r.manuscrit_id}|${nom.trim().toLowerCase()}`] ?? ((r.created_at ?? "").split("T")[0] || "—");
  const renameGroup = renameFor ? allGroups?.find((g) => g.nom === renameFor) ?? null : null;
  const bulkGroup = bulkFor ? allGroups?.find((g) => g.nom === bulkFor) ?? null : null;

  const scrollTo = (nom: string) => {
    const el = refs.current[nom];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setGlow(nom);
    setTimeout(() => setGlow((g) => (g === nom ? null : g)), 1600);
  };

  if (groups === null || allGroups === null) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}
      </div>
    );
  }

  if (allGroups.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card py-14 text-center px-4">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <Package className="h-8 w-8" />
        </div>
        <h3 className="mt-4 font-semibold">Aucun dépôt</h3>
        <p className="mt-1 text-sm text-muted-foreground">Enregistrez votre premier dépôt en librairie.</p>
        <Button onClick={onAdd} className="mt-4"><Plus className="h-4 w-4 mr-2" /> Ajouter un dépôt</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ExterneQuickStats {...totals} />

      {/* Filtre par librairie */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          onClick={() => onLibrairieFilter(null)}
          className={cn(
            "shrink-0 rounded-full border px-3.5 py-1.5 text-xs transition-colors",
            !librairieFilter
              ? "border-[color:var(--gold)] bg-[color:var(--gold)] font-semibold text-background"
              : "border-[color:var(--gold)]/30 bg-primary/[0.05] text-muted-foreground hover:text-foreground",
          )}
        >
          Toutes
        </button>
        {allGroups.map((g) => (
          <button
            key={g.nom}
            type="button"
            onClick={() => { onLibrairieFilter(null); setTimeout(() => scrollTo(g.nom), 60); }}
            className="shrink-0 rounded-full border border-[color:var(--gold)]/30 bg-primary/[0.05] px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {g.nom}
          </button>
        ))}
      </div>

      {librairieFilter && (
        <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 px-3 py-1.5 text-xs text-[color:var(--gold)]">
          Filtré : <span className="font-semibold">{librairieFilter}</span>
          <button type="button" aria-label="Effacer le filtre" onClick={() => onLibrairieFilter(null)} className="hover:text-foreground">✕</button>
        </div>
      )}

      {groups.map((g) => {
        const st = stockStatus(g.restants, g.deposes);
        const isCollapsed = !!collapsed[g.nom];
        const byDate = new Map<string, ExterneStockRow[]>();
        [...g.rows]
          .sort((a, b) => depotDate(a, g.nom).localeCompare(depotDate(b, g.nom)))
          .forEach((r) => {
            const d = depotDate(r, g.nom);
            byDate.set(d, [...(byDate.get(d) ?? []), r]);
          });

        return (
          <section
            key={g.nom}
            ref={(el) => { refs.current[g.nom] = el; }}
            className={cn(
              "rounded-xl border border-[color:var(--gold)]/20 transition-shadow duration-500",
              glow === g.nom && "shadow-[0_0_0_2px_rgba(200,146,42,0.55),0_0_24px_rgba(200,146,42,0.35)]",
            )}
          >
            <header className="rounded-t-xl bg-[color:var(--gold)]/[0.08] px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <button type="button" onClick={() => toggle(g.nom)} className="min-w-0 flex-1 text-left">
                  <h3 className="flex items-center gap-2 text-[15px] font-bold text-foreground">
                    <Store className="h-4 w-4 shrink-0 text-[color:var(--gold)]" />
                    <span className="truncate">{g.nom}</span>
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {g.adresse ?? "Adresse non renseignée"}
                    <span className="mx-1.5 opacity-50">·</span>
                    <span className="text-[color:var(--gold)]">Dernière visite : {fdate(g.derniereVisite)}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                    {pl(g.titres, "titre")} <span className="opacity-50">·</span> {pl(g.deposes, "déposé")} <span className="opacity-50">·</span> {pl(g.restants, "restant")}
                  </p>
                </button>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className={cn("hidden sm:inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold", st.badge)}>{st.label}</span>
                  <button
                    type="button"
                    onClick={() => setRenameFor(g.nom)}
                    title="Modifier le nom ou l'adresse de la librairie"
                    aria-label="Modifier la librairie"
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-[color:var(--gold)]/30 text-[color:var(--gold)] hover:bg-[color:var(--gold)]/10"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkFor(g.nom)}
                    title="Changer la date du dépôt de plusieurs livres"
                    aria-label="Changer la date du dépôt"
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-[color:var(--gold)]/30 text-[color:var(--gold)] hover:bg-[color:var(--gold)]/10"
                  >
                    <CalendarDays className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={onAdd}
                    aria-label="Ajouter un dépôt"
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-[color:var(--gold)]/30 text-[color:var(--gold)] hover:bg-[color:var(--gold)]/10"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggle(g.nom)}
                    aria-label={isCollapsed ? "Développer" : "Réduire"}
                    aria-expanded={!isCollapsed}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
                  >
                    <ChevronDown className={cn("h-4 w-4 transition-transform duration-300", !isCollapsed && "rotate-180")} />
                  </button>
                </div>
              </div>
            </header>

            {!isCollapsed && (
              <div className="space-y-3 rounded-b-xl bg-card p-3 animate-fade-in">
                {[...byDate.entries()].map(([date, rows]) => (
                  <div key={date} className="ml-2 border-l-[3px] border-[color:var(--gold)]/20 bg-[color:var(--gold)]/[0.03] px-3 py-2">
                    <p className="mb-2 text-[12px] uppercase tracking-[1px] text-[color:var(--gold)]">
                      📅 Dépôt du {date === "—" ? "—" : fdate(date)}
                    </p>
                    <div className="space-y-1.5">
                      {rows.map((r) => {
                        const dep = r.exemplaires_deposes ?? 0;
                        const vendus = r.exemplaires_vendus ?? 0;
                        const rest = r.exemplaires_restants ?? 0;
                        const ca = vendus * Number(r.prix_unitaire_fcfa ?? 0);
                        const rs = stockStatus(rest, dep);
                        return (
                          <div
                            key={r.id}
                            className="flex flex-col gap-2 rounded-lg border border-[color:var(--gold)]/[0.08] bg-background/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex min-w-0 items-center gap-2.5 sm:flex-1">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[color:var(--gold)]/20 bg-[color:var(--gold)]/10">
                                <BookOpen className="h-4 w-4 text-[color:var(--gold)]" />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">
                                  {titreMap[r.manuscrit_id] ?? "—"}
                                  {r.provenance === "hors_stock" && (
                                    <span className="ml-1.5 inline-flex items-center rounded-full border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 px-1.5 py-px align-middle text-[10px] font-semibold text-[color:var(--gold)]">
                                      📤 Hors stock interne
                                    </span>
                                  )}
                                </p>
                                <div className="mt-1 flex items-center gap-1.5">
                                  <BatchHistoryBadge key={depotDate(r, g.nom)} manuscritId={r.manuscrit_id} librairieNom={g.nom} onChanged={onChanged} />
                                </div>
                                {authorMap[r.manuscrit_id] && (
                                  <p className="truncate text-[11px] text-muted-foreground">{authorMap[r.manuscrit_id]}</p>
                                )}
                              </div>
                            </div>

                            <div className="text-xs text-muted-foreground tabular-nums sm:w-52 sm:shrink-0">
                              {dep} déposés <span className="opacity-50">·</span> {vendus} vendus <span className="opacity-50">·</span>{" "}
                              <span className={cn("font-semibold", rs.text)}>{rest} rest.</span>
                            </div>

                            <div className="flex items-center justify-between gap-3 sm:justify-end">
                              <div className="text-xs tabular-nums">
                                <span className="text-muted-foreground">Prix : {r.prix_unitaire_fcfa ? fcfa(r.prix_unitaire_fcfa) : "—"}</span>
                                <span className="mx-1.5 opacity-40">|</span>
                                <span className="font-mono font-semibold text-[color:var(--gold)]">CA : {fcfa(ca)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button onClick={() => onEdit(r)} title="Modifier" aria-label="Modifier" className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary">
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button onClick={() => onSale(r)} title="Enregistrer une vente" aria-label="Vente" className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-[color:var(--gold)]/10 hover:text-[color:var(--gold)]">
                                  <Wallet className="h-4 w-4" />
                                </button>
                                <button onClick={() => onDelete(r)} title="Supprimer" aria-label="Supprimer" className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}

      {renameGroup && (
        <RenameLibrairieDialog
          open={!!renameGroup}
          onOpenChange={(o) => { if (!o) setRenameFor(null); }}
          librairieNom={renameGroup.nom}
          adresse={renameGroup.adresse}
          onDone={(nouveau) => {
            if (librairieFilter === renameGroup.nom) onLibrairieFilter(nouveau);
            onChanged?.();
          }}
        />
      )}

      {bulkGroup && (
        <BulkDepotDateDialog
          open={!!bulkGroup}
          onOpenChange={(o) => { if (!o) setBulkFor(null); }}
          librairieNom={bulkGroup.nom}
          rows={bulkGroup.rows}
          titreMap={titreMap}
          onDone={() => onChanged?.()}
        />
      )}
    </div>
  );
}
