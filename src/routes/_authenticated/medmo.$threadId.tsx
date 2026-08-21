import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { UIMessage } from "ai";
import { loadThreadMessages } from "@/lib/medmo";
import { MedmoChat } from "@/components/medmo-chat";

export const Route = createFileRoute("/_authenticated/medmo/$threadId")({
  component: MedmoThreadPage,
  head: () => ({
    meta: [{ title: "PR MEDMO — Conversation | FIGDITIONS" }],
  }),
});

function MedmoThreadPage() {
  const { threadId } = Route.useParams();
  const [initial, setInitial] = useState<UIMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setInitial(null);
    setError(null);
    loadThreadMessages(threadId)
      .then((msgs) => { if (!cancelled) setInitial(msgs); })
      .catch((e) => { if (!cancelled) setError(e?.message ?? "Erreur de chargement"); });
    return () => { cancelled = true; };
  }, [threadId]);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-sm text-red-400">{error}</p>
          <p className="text-xs text-muted-foreground mt-1">Rechargez la page ou revenez à la liste des conversations.</p>
        </div>
      </div>
    );
  }
  if (!initial) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  // Keyed by threadId: messages can never bleed between threads.
  return <MedmoChat key={threadId} threadId={threadId} initialMessages={initial} />;
}
