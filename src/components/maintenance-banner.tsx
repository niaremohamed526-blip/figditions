import { useEffect, useState } from "react";
import { Wrench, X } from "lucide-react";

/**
 * Temporary maintenance notice for the server move.
 * Hides itself automatically once MAINTENANCE_END has passed, so it needs no
 * follow-up deploy to disappear. Times are UTC, which is Bamako time.
 */
const MAINTENANCE_END = Date.parse("2026-10-31T22:00:00Z");

export function MaintenanceBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(Date.now() < MAINTENANCE_END);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[9996] bg-[#1A1208] border-b border-[color:var(--gold)]/40 text-white text-xs md:text-sm px-4 py-2 flex items-center justify-center gap-2 shadow-lg"
    >
      <Wrench className="h-4 w-4 shrink-0 text-[color:var(--gold)]" />
      <span>
        Maintenance ce soir de 21h à 22h : nous améliorons FIGDITIONS. L'application peut être
        indisponible quelques minutes. Vos données restent intactes.
      </span>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Fermer"
        className="ml-2 rounded p-1 hover:bg-white/10"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
