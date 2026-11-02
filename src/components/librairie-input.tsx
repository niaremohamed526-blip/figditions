import { useEffect, useMemo, useRef, useState } from "react";
import { Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetch-all";
import { normalizeMatchKey } from "@/lib/normalizeText";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface LibrairieConnue {
  nom: string;
  adresse: string | null;
}

/** Librairies déjà utilisées dans les dépôts de la maison (une entrée par nom exact). */
export function useLibrairiesConnues(): LibrairieConnue[] {
  const [list, setList] = useState<LibrairieConnue[]>([]);
  useEffect(() => {
    let alive = true;
    fetchAllRows<{ librairie_nom: string | null; librairie_adresse: string | null }>(() =>
      (supabase as any).from("stocks").select("librairie_nom, librairie_adresse"),
    )
      .then((rows) => {
        const map = new Map<string, LibrairieConnue>();
        for (const r of rows) {
          const nom = r.librairie_nom?.trim();
          if (!nom) continue;
          const e = map.get(nom) ?? { nom, adresse: null };
          if (!e.adresse && r.librairie_adresse?.trim()) e.adresse = r.librairie_adresse.trim();
          map.set(nom, e);
        }
        if (alive) setList([...map.values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr")));
      })
      .catch(() => { /* la saisie libre reste possible */ });
    return () => { alive = false; };
  }, []);
  return list;
}

/**
 * Nom de librairie : propose les librairies existantes pour éviter les doublons
 * (« Tonino » / « tonino »). Une succursale reste une librairie à part : « Tonino Koutiala ».
 */
export function LibrairieInput({
  value,
  onChange,
  onPickAdresse,
  placeholder = "Ex. Librairie Renaissance",
  autoFocus,
}: {
  value: string;
  onChange: (nom: string) => void;
  /** Appelé quand une librairie connue est choisie, avec son adresse. */
  onPickAdresse?: (adresse: string | null) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const connues = useLibrairiesConnues();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const key = normalizeMatchKey(value);
  const exacte = connues.find((l) => l.nom === value.trim());
  const presque = !exacte && key ? connues.find((l) => normalizeMatchKey(l.nom) === key) : undefined;
  const suggestions = useMemo(
    () => (key ? connues.filter((l) => normalizeMatchKey(l.nom).includes(key)) : connues).slice(0, 8),
    [connues, key],
  );

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const pick = (l: LibrairieConnue) => {
    onChange(l.nom);
    onPickAdresse?.(l.adresse);
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <Input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
      />
      {open && suggestions.length > 0 && !exacte && (
        <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-md" role="listbox">
          {suggestions.map((l) => (
            <li key={l.nom}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(l)}
                className="flex w-full items-start gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted"
              >
                <Store className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate">{l.nom}</span>
                  {l.adresse && <span className="block truncate text-xs text-muted-foreground">{l.adresse}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {presque ? (
        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
          Cette librairie existe déjà sous le nom «{" "}
          <button type="button" className="underline" onClick={() => pick(presque)}>{presque.nom}</button> ». Cliquez pour l'utiliser.
        </p>
      ) : value.trim() && !exacte && connues.length > 0 ? (
        <p className={cn("mt-1 text-xs text-muted-foreground")}>
          Nouvelle librairie. Pour une succursale, ajoutez le quartier ou la ville (ex. « Tonino Koutiala »).
        </p>
      ) : null}
    </div>
  );
}
