import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { filterEntriesForUser, type ChangelogEntry } from "@/lib/changelog";
import type { Permissions } from "@/lib/permissions";

interface Options {
  userId: string | null | undefined;
  permissions: Permissions | null | undefined;
  isAdmin: boolean;
  ready?: boolean;
}

async function fetchEntries(limit: number): Promise<ChangelogEntry[]> {
  const { data, error } = await supabase
    .from("changelog_entries")
    .select("id, titre, hook, version, date_publication, items")
    .eq("actif", true)
    .order("date_publication", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((d) => ({
    ...d,
    items: Array.isArray(d.items) ? (d.items as unknown as ChangelogEntry["items"]) : [],
  })) as ChangelogEntry[];
}

async function fetchSeenIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("changelog_vu_par")
    .select("changelog_id")
    .eq("user_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.changelog_id as string));
}

export function useChangelog({ userId, permissions, isAdmin, ready = true }: Options) {
  const [unseen, setUnseen] = useState<ChangelogEntry[]>([]);
  const [showBlocking, setShowBlocking] = useState(false);
  const [history, setHistory] = useState<ChangelogEntry[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Detect unseen entries once per session start.
  useEffect(() => {
    if (!ready || !userId) return;
    let cancelled = false;
    const run = async () => {
      try {
        const [entries, seen] = await Promise.all([fetchEntries(20), fetchSeenIds(userId)]);
        if (cancelled) return;
        const fresh = filterEntriesForUser(
          entries.filter((e) => !seen.has(e.id)),
          permissions,
          isAdmin,
        );
        if (fresh.length === 0) return;
        setUnseen(fresh);
        // Let the page finish rendering before interrupting.
        setTimeout(() => {
          if (!cancelled) setShowBlocking(true);
        }, 500);
      } catch (err) {
        console.warn("[changelog] detection failed", err);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // Intentionally keyed on userId only: a new entry published mid-session
    // must not interrupt the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, ready]);

  const markSeen = useCallback(
    async (entries: ChangelogEntry[]) => {
      if (!userId || entries.length === 0) return;
      const rows = entries.map((e) => ({ changelog_id: e.id, user_id: userId }));
      const { error } = await supabase
        .from("changelog_vu_par")
        .upsert(rows, { onConflict: "changelog_id,user_id", ignoreDuplicates: true });
      if (error) throw error;
    },
    [userId],
  );

  const dismissBlocking = useCallback(async () => {
    const entries = unseen;
    setShowBlocking(false);
    setUnseen([]);
    try {
      await markSeen(entries);
    } catch (err) {
      console.warn("[changelog] mark seen failed", err);
    }
  }, [unseen, markSeen]);

  const openHistory = useCallback(async () => {
    setShowHistory(true);
    try {
      const [entries, seen] = await Promise.all([
        fetchEntries(10),
        userId ? fetchSeenIds(userId) : Promise.resolve(new Set<string>()),
      ]);
      setHistory(filterEntriesForUser(entries, permissions, isAdmin));
      // Visiting the history counts as having seen everything.
      const toMark = entries.filter((e) => !seen.has(e.id));
      setUnseen([]);
      if (toMark.length > 0) await markSeen(toMark);
    } catch (err) {
      console.warn("[changelog] history failed", err);
      setHistory([]);
    }
  }, [userId, permissions, isAdmin, markSeen]);

  return {
    unseen,
    hasUnseen: unseen.length > 0,
    showBlocking,
    dismissBlocking,
    history,
    showHistory,
    openHistory,
    closeHistory: () => setShowHistory(false),
  };
}
