import { useState } from "react";
import { PenLine, Store } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const PRESETS = [10, 15, 20];

/** Bookshop commission (0 = none) + 10 % author rights, shared by every deposit form. */
export function CommissionFields({
  taux, onTauxChange, droits, onDroitsChange,
}: {
  taux: number;
  onTauxChange: (t: number) => void;
  droits: boolean;
  onDroitsChange: (v: boolean) => void;
}) {
  const [autre, setAutre] = useState(false);
  const showAutre = autre || (taux > 0 && !PRESETS.includes(taux));
  const chip = (active: boolean) => cn(
    "flex-1 py-2 rounded-lg text-sm font-semibold border transition",
    active
      ? "bg-orange-400/15 border-orange-400/50 text-orange-300"
      : "bg-background border-border text-muted-foreground hover:border-orange-400/30",
  );

  return (
    <div className="rounded-xl border border-border bg-background/30 p-4 space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-sm">
            <Store className="h-4 w-4 text-orange-400" />
            Commission librairie
          </Label>
          <Switch
            checked={taux > 0}
            onCheckedChange={(v: boolean) => { setAutre(false); onTauxChange(v ? 20 : 0); }}
          />
        </div>
        {taux > 0 && (
          <div className="flex gap-2 pt-1">
            {PRESETS.map((p) => (
              <button key={p} type="button" onClick={() => { setAutre(false); onTauxChange(p); }} className={chip(!showAutre && taux === p)}>
                {p} %
              </button>
            ))}
            <button type="button" onClick={() => setAutre(true)} className={chip(showAutre)}>
              Autre
            </button>
          </div>
        )}
        {taux > 0 && showAutre && (
          <div className="flex items-center gap-2">
            <Input
              type="number" inputMode="decimal" min={1} max={100} step="0.5"
              value={taux}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) onTauxChange(Math.min(100, Math.max(0, n)));
              }}
              className="w-28 bg-input"
              aria-label="Commission librairie en pourcentage"
            />
            <span className="text-sm text-muted-foreground">% du prix de vente</span>
          </div>
        )}
        {taux === 0 && (
          <p className="text-xs text-muted-foreground">Aucune commission ne sera appliquée à la librairie.</p>
        )}
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <Label className="flex items-center gap-2 text-sm">
          <PenLine className="h-4 w-4 text-[color:var(--gold)]" />
          Droits d'auteur (10 %)
        </Label>
        <Switch checked={droits} onCheckedChange={(v: boolean) => onDroitsChange(v)} />
      </div>
    </div>
  );
}
