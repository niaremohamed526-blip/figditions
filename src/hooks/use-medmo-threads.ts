import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { listThreads, createThread, deleteThread, type ChatThread } from "@/lib/medmo";

/** Shared thread-list state for the DC MEDMO layout + index page. */
export function useMedmoThreads(userId: string | undefined, entrepriseId: string | null | undefined) {
  const [threads, setThreads] = useState<ChatThread[] | null>(null);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      setThreads(await listThreads());
    } catch (e: any) {
      toast.error(e?.message ?? "Impossible de charger les conversations");
    }
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  // The chat route bumps titles / updated_at; the chat UI fires this event on finish.
  useEffect(() => {
    const handler = () => { void refresh(); };
    window.addEventListener("medmo:threads-changed", handler);
    return () => window.removeEventListener("medmo:threads-changed", handler);
  }, [refresh]);

  const newThread = useCallback(async () => {
    if (!userId || creating) return;
    setCreating(true);
    try {
      const t = await createThread(userId, entrepriseId ?? null);
      await refresh();
      navigate({ to: "/medmo/$threadId", params: { threadId: t.id } });
    } catch (e: any) {
      toast.error(e?.message ?? "Impossible de créer la conversation");
    } finally {
      setCreating(false);
    }
  }, [userId, entrepriseId, creating, navigate, refresh]);

  const removeThread = useCallback(async (threadId: string, isActive: boolean) => {
    try {
      await deleteThread(threadId);
      await refresh();
      if (isActive) navigate({ to: "/medmo" });
    } catch (e: any) {
      toast.error(e?.message ?? "Impossible de supprimer la conversation");
    }
  }, [navigate, refresh]);

  return { threads, creating, newThread, removeThread, refresh };
}
