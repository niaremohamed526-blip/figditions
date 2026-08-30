import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { subDays, subMonths, subYears } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type DateRange = { from: Date | null; to: Date | null };

const PRESETS: { label: string; compute: () => DateRange }[] = [
  { label: "30 jours", compute: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { label: "3 mois", compute: () => ({ from: subMonths(new Date(), 3), to: new Date() }) },
  { label: "6 mois", compute: () => ({ from: subMonths(new Date(), 6), to: new Date() }) },
  { label: "1 an", compute: () => ({ from: subYears(new Date(), 1), to: new Date() }) },
  { label: "Tout", compute: () => ({ from: null, to: null }) },
];

export const defaultRange = (): DateRange => ({ from: subMonths(new Date(), 6), to: new Date() });

export function inRange(dateStr: string | null | undefined, range: DateRange) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (range.from && d < range.from) return false;
  if (range.to && d > range.to) return false;
  return true;
}

interface Props {
  title: string;
  defaultOpen?: boolean;
  range: DateRange;
  setRange: (r: DateRange) => void;
  children: ReactNode;
  showFilter?: boolean;
  /** Aperçu affiché dans l'en-tête (sparklines) quand la section est repliée. */
  preview?: ReactNode;
}

export function AnalyticsSection({ title, defaultOpen = false, range, setRange, children, showFilter = true, preview }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [activePreset, setActivePreset] = useState("6 mois");

  const toInputVal = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 p-4 hover:bg-primary/5 transition-colors"
      >
        <h2 className="dash-section-label mb-0 font-semibold">{title}</h2>
        <div className="ml-auto mr-3 hidden items-center gap-4 md:flex">{!open && preview}</div>
        <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="dash-stagger p-4 pt-0 space-y-4">
          {showFilter && (
            <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <Button
                    key={p.label}
                    size="sm"
                    variant={activePreset === p.label ? "default" : "outline"}
                    className={cn(
                      "h-8",
                      activePreset === p.label && "bg-primary text-primary-foreground hover:bg-primary/90",
                    )}
                    onClick={() => {
                      setActivePreset(p.label);
                      setRange(p.compute());
                    }}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
              <div className="flex items-end gap-2 ml-auto">
                <div className="space-y-1">
                  <Label className="text-xs">Du</Label>
                  <Input
                    type="date"
                    className="h-8 w-36"
                    value={toInputVal(range.from)}
                    onChange={(e) => {
                      setActivePreset("");
                      setRange({ ...range, from: e.target.value ? new Date(e.target.value) : null });
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Au</Label>
                  <Input
                    type="date"
                    className="h-8 w-36"
                    value={toInputVal(range.to)}
                    onChange={(e) => {
                      setActivePreset("");
                      setRange({ ...range, to: e.target.value ? new Date(e.target.value) : null });
                    }}
                  />
                </div>
              </div>
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

export function EmptyChart({ label = "Pas encore de données pour cette période" }: { label?: string }) {
  return (
    <div className="h-full min-h-40 flex flex-col items-center justify-center text-center text-muted-foreground gap-2 py-8">
      <svg width="60" height="40" viewBox="0 0 60 40" fill="none" className="opacity-40">
        <rect x="4" y="24" width="8" height="12" rx="1" fill="currentColor" />
        <rect x="18" y="16" width="8" height="20" rx="1" fill="currentColor" />
        <rect x="32" y="8" width="8" height="28" rx="1" fill="currentColor" />
        <rect x="46" y="20" width="8" height="16" rx="1" fill="currentColor" />
      </svg>
      <p className="text-sm">{label}</p>
    </div>
  );
}
