import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type StockLevelFilter = "tous" | "bon" | "bas" | "epuise";
export type StockSort =
  | "titre_asc" | "titre_desc"
  | "dispo_asc" | "dispo_desc"
  | "date_desc" | "date_asc";

/** Supprime les accents et met en minuscules (recherche insensible aux accents). */
export const norm = (s: string) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** Surligne en or les portions du texte qui correspondent au terme recherché. */
export function Highlight({ text, term }: { text: string; term: string }) {
  const t = norm(term).trim();
  if (!t) return <>{text}</>;
  const hay = norm(text);
  const parts: Array<{ s: string; hit: boolean }> = [];
  let i = 0;
  while (i < text.length) {
    const idx = hay.indexOf(t, i);
    if (idx === -1) { parts.push({ s: text.slice(i), hit: false }); break; }
    if (idx > i) parts.push({ s: text.slice(i, idx), hit: false });
    parts.push({ s: text.slice(idx, idx + t.length), hit: true });
    i = idx + t.length;
  }
  return (
    <>
      {parts.map((p, k) =>
        p.hit ? (
          <mark key={k} className="rounded bg-primary/25 px-0.5 font-semibold text-[#C8922A]">{p.s}</mark>
        ) : (
          <span key={k}>{p.s}</span>
        ),
      )}
    </>
  );
}

/** Debounce simple (200 ms par défaut). */
export function useDebounced<T>(value: T, delay = 200) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

const LEVELS: Array<{ key: StockLevelFilter; label: string; active: string }> = [
  { key: "tous", label: "Tous", active: "border-[#C8922A] bg-primary/15 text-[#C8922A]" },
  { key: "bon", label: "Bon stock", active: "border-green-500 bg-green-500/15 text-green-400" },
  { key: "bas", label: "Stock bas", active: "border-orange-500 bg-orange-500/15 text-orange-400" },
  { key: "epuise", label: "Épuisé", active: "border-red-500 bg-red-500/15 text-red-400" },
];

const SORTS: Array<{ key: StockSort; label: string }> = [
  { key: "titre_asc", label: "Titre A → Z" },
  { key: "titre_desc", label: "Titre Z → A" },
  { key: "dispo_asc", label: "Stock disponible (croissant)" },
  { key: "dispo_desc", label: "Stock disponible (décroissant)" },
  { key: "date_desc", label: "Date d'ajout (récent)" },
  { key: "date_asc", label: "Date d'ajout (ancien)" },
];

interface Props {
  query: string;
  onQuery: (v: string) => void;
  level: StockLevelFilter;
  onLevel: (v: StockLevelFilter) => void;
  sort: StockSort;
  onSort: (v: StockSort) => void;
  resultCount: number;
  totalCount: number;
  activeTerm: string;
}

export function StockSearchBar({
  query, onQuery, level, onLevel, sort, onSort, resultCount, totalCount, activeTerm,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isMac = useMemo(
    () => typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent),
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        e.stopPropagation();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);

  return (
    <div className="space-y-3">
      {/* Search input */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-primary/50" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") { onQuery(""); (e.target as HTMLInputElement).blur(); } }}
          placeholder="Rechercher un livre par titre ou auteur..."
          aria-label="Rechercher un livre"
          className={cn(
            "h-12 w-full rounded-xl border border-primary/15 bg-primary/[0.05] pl-11 pr-28 text-sm text-foreground",
            "placeholder:text-muted-foreground/60 outline-none transition-all",
            "focus:border-[#C8922A] focus:ring-[3px] focus:ring-primary/20",
          )}
        />
        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
          {query && (
            <button
              type="button"
              aria-label="Effacer la recherche"
              onClick={() => { onQuery(""); inputRef.current?.focus(); }}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden rounded-md border border-primary/20 bg-primary/[0.06] px-1.5 py-0.5 text-[11px] text-muted-foreground sm:inline-block">
            {isMac ? "⌘K" : "Ctrl+K"}
          </kbd>
        </div>
      </div>

      {/* Filter pills + sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:pb-0">
          {LEVELS.map((l) => (
            <button
              key={l.key}
              type="button"
              onClick={() => onLevel(l.key)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-1.5 text-[13px] transition-colors",
                level === l.key
                  ? cn("font-semibold", l.active)
                  : "border-primary/15 bg-primary/[0.05] text-muted-foreground hover:bg-primary/10 hover:text-foreground",
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value as StockSort)}
          aria-label="Trier par"
          className="h-9 shrink-0 rounded-full border border-primary/15 bg-primary/[0.05] px-4 text-[13px] text-muted-foreground outline-none transition-colors hover:text-foreground focus:border-[#C8922A]"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Summary bar */}
      {activeTerm.trim() ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/15 bg-primary/[0.05] px-4 py-2.5 text-sm">
          <p className="text-muted-foreground">
            Recherche : <span className="font-semibold text-[#C8922A]">« {activeTerm.trim()} »</span> — {resultCount} livre(s) trouvé(s) sur {totalCount} au total
          </p>
          <button
            type="button"
            onClick={() => onQuery("")}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" /> Effacer la recherche
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{resultCount} livre(s) trouvé(s)</p>
      )}
    </div>
  );
}

/** Barre de progression du stock disponible. */
export function StockBar({ dispo, imprimes }: { dispo: number; imprimes: number }) {
  const pct = imprimes > 0 ? Math.min(100, Math.round((dispo / imprimes) * 100)) : 0;
  if (dispo === 0) {
    return (
      <span className="inline-flex items-center rounded-full border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-400">
        ÉPUISÉ
      </span>
    );
  }
  const color = pct > 50 ? "bg-green-500" : pct >= 20 ? "bg-orange-500" : "bg-red-500";
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
        <span className={cn("block h-full rounded-full transition-all duration-500", color)} style={{ width: `${pct}%` }} />
      </span>
      <span className="text-[10px] text-muted-foreground">{pct}% disponible</span>
    </span>
  );
}
