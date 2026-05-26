import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to realtime changes on a Postgres table for the current entreprise.
 * The callback is called on any INSERT/UPDATE/DELETE. Use it to refetch data.
 */
export function useRealtimeTable(
  table: string,
  entrepriseId: string | null | undefined,
  onChange: () => void,
  filterColumn: string = "entreprise_id",
) {
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    if (!entrepriseId) return;
    const uniq = Math.random().toString(36).slice(2, 10);
    const channel = supabase
      .channel(`rt:${table}:${entrepriseId}:${uniq}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `${filterColumn}=eq.${entrepriseId}`,
        },
        () => cbRef.current(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, entrepriseId, filterColumn]);
}
