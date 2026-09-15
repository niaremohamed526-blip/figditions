import { useEffect, useState } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { onlineManager, useIsMutating, useIsFetching } from "@tanstack/react-query";

/**
 * Global offline banner + pending sync indicator.
 * Reflects React Query's onlineManager, which pauses network mutations
 * while offline and resumes them automatically when the connection returns.
 */
export function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const mutating = useIsMutating();
  const fetching = useIsFetching();

  useEffect(() => {
    setOnline(onlineManager.isOnline());
    const unsub = onlineManager.subscribe((isOnline) => setOnline(isOnline));
    return () => unsub();
  }, []);

  if (online) {
    // Show a subtle sync pill when queued mutations are being replayed
    if (mutating > 0 && fetching === 0) {
      return (
        <div className="fixed top-2 right-2 z-[9998] flex items-center gap-2 rounded-full bg-[color:var(--gold)]/15 border border-[color:var(--gold)]/40 px-3 py-1.5 text-xs text-[color:var(--gold)] shadow-lg backdrop-blur">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Synchronisation…
        </div>
      );
    }
    return null;
  }

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[9998] bg-[#1A1208] border-b border-[color:var(--gold)]/40 text-white text-xs md:text-sm px-4 py-2 flex items-center justify-center gap-2 shadow-lg"
    >
      <WifiOff className="h-4 w-4 text-[color:var(--gold)]" />
      <span>
        Mode hors ligne : vos actions seront enregistrées et synchronisées dès le retour du réseau.
      </span>
    </div>
  );
}
