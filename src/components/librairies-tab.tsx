import { useMemo, useState } from "react";
import { Store, Search, Eye, FileText, BookOpen, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fcfa } from "@/lib/format";
import { generateBordereauPdf, type BordereauLigne } from "@/lib/pdf-bordereau";
import { EmptyState } from "@/components/empty-state";

export interface ExterneStockRow {
  id: string;
  manuscrit_id: string;
  librairie_nom: string | null;
  librairie_adresse: string | null;
  derniere_visite: string | null;
  exemplaires_deposes: number;
  exemplaires_vendus: number;
  exemplaires_restants: number;
  prix_unitaire_fcfa: number | null;
  created_at?: string | null;
}

export interface LibrairieGroup {
  nom: string;
  adresse: string | null;
  derniereVisite: string | null;
  titres: number;
  deposes: number;
  vendus: number;
  restants: number;
  ca: number;
  rows: ExterneStockRow[];
}

/** Regroupe les dépôts par librairie et calcule les agrégats. */
export function groupByLibrairie(rows: ExterneStockRow[]): LibrairieGroup[] {
  const map = new Map<string, LibrairieGroup>();
  rows.forEach((r) => {
    const nom = (r.librairie_nom ?? "").trim() || "Sans librairie";
    let g = map.get(nom);
    if (!g) {
      g = { nom, adresse: null, derniereVisite: null, titres: 0, deposes: 0, vendus: 0, restants: 0, ca: 0, rows: [] };
      map.set(nom, g);
    }
    if (!g.adresse && r.librairie_adresse) g.adresse = r.librairie_adresse;
    if (r.derniere_visite && (!g.derniereVisite || r.derniere_visite > g.derniereVisite)) g.derniereVisite = r.derniere_visite;
    g.deposes += r.exemplaires_deposes ?? 0;
    g.vendus += r.exemplaires_vendus ?? 0;
    g.restants += r.exemplaires_restants ?? 0;
    g.ca += (r.exemplaires_vendus ?? 0) * Number(r.prix_unitaire_fcfa ?? 0);
    g.rows.push(r);
  });
  return [...map.values()].map((g) => ({
    ...g,
    titres: new Set(g.rows.map((r) => r.manuscrit_id)).size,
  }));
}

export function stockStatus(restants: number, deposes: number) {
  const pct = deposes > 0 ? (restants / deposes) * 100 : 0;
  if (restants === 0) return { key: "epuise", label: "Épuisé", pct: 0, badge: "bg-red-900/40 text-red-300 border-red-800/50", bar: "bg-red-900", text: "text-red-300" };
  if (pct < 10) return { key: "critique", label: "Critique", pct, badge: "bg-red-500/15 text-red-400 border-red-500/30 animate-pulse", bar: "bg-red-500", text: "text-red-400" };
  if (pct <= 20) return { key: "bas", label: "Stock bas", pct, badge: "bg-orange-500/15 text-orange-400 border-orange-500/30", bar: "bg-orange-400", text: "text-orange-400" };
  return { key: "bon", label: "Bon stock", pct, badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", bar: "bg-emerald-500", text: "text-emerald-400" };
}

const fdate = (d: string | null | undefined) => {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy"); } catch { return "—"; }
};

type SortKey = "nom" | "bas" | "ca" | "visite";
const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: "nom", label: "Nom A→Z" },
  { key: "bas", label: "Stock bas en premier" },
  { key: "ca", label: "CA généré" },
  { key: "visite", label: "Dernière visite" },
];

export function LibrairiesTab({
  stocks,
  titreMap,
  entreprise,
  onVoirLivres,
}: {
  stocks: ExterneStockRow[] | null;
  titreMap: Record<string, string>;
  entreprise: { nom?: string | null; ville?: string | null; adresse?: string | null; email?: string | null; telephone?: string | null; logo_url?: string | null } | null;
  onVoirLivres: (librairie: string) => void;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("nom");
  const [busy, setBusy] = useState<string | null>(null);

  const groups = useMemo(() => {
    if (!stocks) return null;
    const needle = q.trim().toLowerCase();
    const list = groupByLibrairie(stocks).filter((g) => !needle || g.nom.toLowerCase().includes(needle));
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sort === "nom") return a.nom.localeCompare(b.nom);
      if (sort === "ca") return b.ca - a.ca;
      if (sort === "visite") return (b.derniereVisite ?? "").localeCompare(a.derniereVisite ?? "");
      const pa = a.deposes > 0 ? a.restants / a.deposes : 0;
      const pb = b.deposes > 0 ? b.restants / b.deposes : 0;
      return pa - pb;
    });
    return sorted;
  }, [stocks, q, sort]);

  const bordereau = async (g: LibrairieGroup) => {
    setBusy(g.nom);
    try {
      const lignes: BordereauLigne[] = g.rows.map((r) => ({
        titre: titreMap[r.manuscrit_id] ?? "—",
        quantite: r.exemplaires_deposes ?? 0,
        prix_unitaire: Number(r.prix_unitaire_fcfa ?? 0),
        total: (r.exemplaires_deposes ?? 0) * Number(r.prix_unitaire_fcfa ?? 0),
        deposes: r.exemplaires_deposes ?? 0,
        vendus: r.exemplaires_vendus ?? 0,
        restants: r.exemplaires_restants ?? 0,
      }));
      await generateBordereauPdf({
        numero: `BD-${format(new Date(), "yyyyMMdd-HHmm")}`,
        type: "depot",
        maison: entreprise?.nom ?? "FIGDITIONS",
        maisonAdresse: entreprise?.adresse ?? null,
        maisonVille: entreprise?.ville ?? null,
        maisonEmail: entreprise?.email ?? null,
        maisonTelephone: entreprise?.telephone ?? null,
        librairieNom: g.nom,
        librairieAdresse: g.adresse,
        dateEmission: format(new Date(), "dd/MM/yyyy"),
        lignes,
        totalExemplaires: lignes.reduce((s, l) => s + l.quantite, 0),
        totalFcfa: lignes.reduce((s, l) => s + l.total, 0),
        watermarkLogoUrl: entreprise?.logo_url ?? null,
      });
      toast.success("Bordereau généré");
    } catch (e: any) {
      toast.error(e?.message ?? "Échec de génération du bordereau");
    } finally {
      setBusy(null);
    }
  };

  if (groups === null) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-56 w-full rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher une librairie…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9 h-11 bg-card"
        />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <span className="text-xs text-muted-foreground shrink-0">Trier par :</span>
        {SORTS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSort(s.key)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs transition-colors",
              sort === s.key
                ? "border-[color:var(--gold)] bg-[color:var(--gold)]/15 text-[color:var(--gold)] font-semibold"
                : "border-primary/20 bg-primary/[0.05] text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={Store}
          title="Aucune librairie"
          description="Ajoutez un dépôt en librairie pour voir apparaître ici le suivi par point de vente."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {groups.map((g) => {
            const st = stockStatus(g.restants, g.deposes);
            return (
              <article key={g.nom} className="rounded-2xl border border-[color:var(--gold)]/15 bg-card overflow-hidden">
                <header className="flex items-start justify-between gap-3 p-4 bg-[color:var(--gold)]/[0.06] border-b border-[color:var(--gold)]/10">
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-2 font-bold text-[16px] text-foreground truncate">
                      <Store className="h-4 w-4 text-[color:var(--gold)] shrink-0" />
                      <span className="truncate">{g.nom}</span>
                    </h3>
                    <p className="text-[13px] text-muted-foreground truncate mt-0.5">{g.adresse ?? "Adresse non renseignée"}</p>
                    <p className="text-[12px] text-[color:var(--gold)] mt-0.5">Dernière visite : {fdate(g.derniereVisite)}</p>
                  </div>
                  <span className={cn("shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold", st.badge)}>{st.label}</span>
                </header>

                <div className="p-4 space-y-4">
                  <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-primary" /> {g.titres} titre(s) déposé(s)
                  </p>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg border border-border bg-background/40 p-2.5">
                      <p className="text-[11px] text-muted-foreground">Déposés</p>
                      <p className="font-bold tabular-nums text-blue-400">{g.deposes}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background/40 p-2.5">
                      <p className="text-[11px] text-muted-foreground">Vendus</p>
                      <p className="font-bold tabular-nums text-emerald-400">{g.vendus}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background/40 p-2.5">
                      <p className="text-[11px] text-muted-foreground">Restants</p>
                      <p className={cn("font-bold tabular-nums", st.text)}>{g.restants}</p>
                    </div>
                  </div>

                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs text-muted-foreground">CA généré</span>
                    <span className="font-mono font-bold text-[color:var(--gold)] tabular-nums">{fcfa(g.ca)}</span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all duration-500", st.bar)} style={{ width: `${Math.min(100, Math.round(st.pct))}%` }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground">{Math.round(st.pct)}% restant</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button variant="outline" className="h-10 border-primary/30" onClick={() => onVoirLivres(g.nom)}>
                      <Eye className="h-4 w-4 mr-1.5 text-primary" /> Voir les livres
                    </Button>
                    <Button
                      variant="outline"
                      className="h-10 border-[color:var(--gold)]/40 text-[color:var(--gold)] hover:bg-[color:var(--gold)]/10 hover:text-[color:var(--gold)]"
                      disabled={busy === g.nom}
                      onClick={() => bordereau(g)}
                    >
                      {busy === g.nom ? <Loader2 className="h-4 w-4 animate-spin" /> : <><FileText className="h-4 w-4 mr-1.5" /> Bordereau</>}
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
