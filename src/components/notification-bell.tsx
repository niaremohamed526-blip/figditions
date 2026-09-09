import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/use-realtime";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Notification {
  id: string;
  type: string;
  titre: string;
  message: string;
  lien: string | null;
  lu: boolean;
  created_at: string;
}

export function NotificationBell({
  entrepriseId,
  hasUnseenChangelog = false,
  onOpenChangelog,
}: {
  entrepriseId: string | null | undefined;
  hasUnseenChangelog?: boolean;
  onOpenChangelog?: () => void;
}) {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    if (!entrepriseId) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data ?? []) as Notification[]);
  }, [entrepriseId]);

  useEffect(() => { load(); }, [load]);

  useRealtimeTable("notifications", entrepriseId ?? null, () => {
    load();
    // toast on new notification arriving while bell is closed
    if (!open) {
      // We re-load above; sonner toast is best-effort
      toast("🔔 Nouvelle notification", { duration: 2500 });
    }
  });

  const unread = items.filter((i) => !i.lu).length;

  const markAllRead = async () => {
    if (!entrepriseId || unread === 0) return;
    const ids = items.filter((i) => !i.lu).map((i) => i.id);
    await supabase.from("notifications").update({ lu: true }).in("id", ids);
    setItems((prev) => prev.map((i) => ({ ...i, lu: true })));
  };

  const openOne = async (n: Notification) => {
    if (!n.lu) {
      await supabase.from("notifications").update({ lu: true }).eq("id", n.id);
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, lu: true } : i)));
    }
    setOpen(false);
    if (n.lien) navigate({ to: n.lien });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 ? (
            <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : hasUnseenChangelog ? (
            <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-[color:var(--gold)]" />
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[calc(100vw-2rem)] max-w-80 p-0 bg-card border-border max-h-[70vh] overflow-hidden flex flex-col">
        {onOpenChangelog && (
          <button
            onClick={() => { setOpen(false); onOpenChangelog(); }}
            className="w-full text-left px-4 py-3 border-b border-border flex items-center gap-2 hover:bg-sidebar-accent transition-colors"
          >
            <span className="text-base">📋</span>
            <span className="text-sm font-medium flex-1">Quoi de neuf</span>
            {hasUnseenChangelog && <span className="h-2 w-2 rounded-full bg-[color:var(--gold)]" />}
          </button>
        )}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              <CheckCheck className="h-3 w-3" /> Tout marquer lu
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Aucune notification
            </div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => openOne(n)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-border/50 hover:bg-sidebar-accent transition-colors",
                  !n.lu && "bg-primary/5",
                )}
              >
                <div className="flex items-start gap-2">
                  {!n.lu && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{n.titre}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
