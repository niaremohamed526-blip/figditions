import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BookOption {
  id: string;
  titre: string;
  auteur?: string | null;
}

interface BookComboboxProps {
  items: BookOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  /** Optional extra entry at the top of the list (ex: « Aucun », « Saisie manuelle ») */
  extraOption?: { value: string; label: string };
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
  maxVisible?: number;
}

/**
 * Champ de recherche de livre (combobox) — filtrage instantané par titre ou auteur.
 * Remplace les listes déroulantes statiques trop longues.
 */
export function BookCombobox({
  items,
  value,
  onChange,
  placeholder = "Rechercher un livre…",
  extraOption,
  emptyLabel = "Aucun livre publié",
  disabled,
  className,
  maxVisible = 8,
}: BookComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => items.find((i) => i.id === value), [items, value]);
  const selectedLabel =
    extraOption && value === extraOption.value ? extraOption.label : selected?.titre ?? "";

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((i) =>
      `${i.titre} ${i.auteur ?? ""}`.toLowerCase().includes(needle),
    );
  }, [items, query]);

  // Clic à l'extérieur : referme et réaffiche la sélection courante
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  const pick = (id: string) => {
    onChange(id);
    setQuery("");
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      const total = results.length + (extraOption ? 1 : 0);
      if (total === 0) return;
      setHighlight((h) => (e.key === "ArrowDown" ? (h + 1) % total : (h - 1 + total) % total));
    } else if (e.key === "Enter") {
      if (!open) return;
      e.preventDefault();
      const list = extraOption ? [extraOption.value, ...results.map((r) => r.id)] : results.map((r) => r.id);
      const id = list[highlight];
      if (id) pick(id);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  };

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/50" />
      <input
        type="text"
        disabled={disabled}
        value={open ? query : selectedLabel}
        placeholder={selectedLabel && !open ? selectedLabel : placeholder}
        onChange={(e) => { setQuery(e.target.value); setHighlight(0); setOpen(true); }}
        onFocus={() => { setOpen(true); setQuery(""); setHighlight(0); }}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        className={cn(
          "h-11 w-full rounded-[10px] border border-primary/15 bg-primary/[0.05] pl-10 pr-10 text-sm text-foreground",
          "placeholder:text-muted-foreground transition-colors outline-none",
          "focus:border-primary focus:ring-[3px] focus:ring-primary/10",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      />
      {(open ? query.length > 0 : !!selectedLabel) && !disabled && (
        <button
          type="button"
          aria-label="Effacer"
          onClick={() => { setQuery(""); onChange(""); setOpen(false); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {open && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-[9999] overflow-y-auto rounded-[10px] border border-primary/20 bg-card shadow-2xl"
          style={{ maxHeight: maxVisible * 35 + 8 }}
        >
          {extraOption && (
            <button
              type="button"
              onClick={() => pick(extraOption.value)}
              className={cn(
                "block w-full border-b border-primary/[0.06] px-4 py-2.5 text-left text-sm transition-colors hover:bg-primary/10",
                value === extraOption.value && "bg-primary/10",
                highlight === 0 && "bg-primary/10",
              )}
            >
              {extraOption.label}
            </button>
          )}
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm italic text-muted-foreground">
              {query.trim()
                ? `Aucun livre trouvé pour « ${query.trim()} »`
                : emptyLabel}
            </p>
          ) : (
            results.map((b, i) => {
              const idx = extraOption ? i + 1 : i;
              const isSel = b.id === value;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => pick(b.id)}
                  onMouseEnter={() => setHighlight(idx)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 border-b border-primary/[0.06] px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-primary/10",
                    (isSel || highlight === idx) && "bg-primary/10",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">{b.titre}</span>
                    {b.auteur && (
                      <span className="mt-0.5 block truncate text-xs text-primary">{b.auteur}</span>
                    )}
                  </span>
                  {isSel && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
