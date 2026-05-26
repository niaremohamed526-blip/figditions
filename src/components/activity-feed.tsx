import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/use-realtime";

interface Notif {
  id: string;
  type: string;
  titre: string;
  message: string;
  lien: string | null;
  lu: boolean;
  created_at: string;
}

export function ActivityFeed({ entrepriseId, limit = 10 }: { entrepriseId: string | null; limit?: number }) {
  const [items, setItems] = useState<Notif[] | null>(null);

  const reload = async () => {
    if (!entrepriseId) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, type, titre, message, lien, lu, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    setItems((data ?? []) as Notif[]);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [entrepriseId]);
  useRealtimeTable("notifications", entrepriseId, reload);

  if (!entrepriseId || items === null) return null;

  return (
    <div className="rounded-xl border border-border bg-background/40 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" /> 🔔 Notifications récentes
        </h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Aucune notification</p>
      ) : (
        <ol className="space-y-1">
          {items.map((n) => {
            const content = (
              <div className={`flex items-start gap-3 py-2 px-2 rounded-lg border-b border-border last:border-0 ${!n.lu ? "bg-primary/5" : ""}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{n.titre}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })}
                  </p>
                </div>
                {!n.lu && <span className="h-2 w-2 mt-2 rounded-full bg-primary shrink-0" />}
              </div>
            );
            return (
              <li key={n.id}>
                {n.lien ? <Link to={n.lien as any} className="block hover:bg-muted/30 rounded-lg">{content}</Link> : content}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
