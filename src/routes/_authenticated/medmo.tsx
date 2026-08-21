import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { Sparkles, Plus, Trash2, MessageSquareText } from "lucide-react";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { useMedmoThreads } from "@/hooks/use-medmo-threads";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/medmo")({
  component: MedmoLayout,
});

export function MedmoThreadList({
  threads,
  activeId,
  onDelete,
}: {
  threads: { id: string; title: string; updated_at: string }[] | null;
  activeId: string | null;
  onDelete: (id: string, isActive: boolean) => void;
}) {
  if (threads === null) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  if (threads.length === 0) {
    return (
      <div className="text-center py-8 px-3">
        <MessageSquareText className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
        <p className="text-xs text-muted-foreground">Aucune conversation pour le moment.</p>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      {threads.map((t) => {
        const active = t.id === activeId;
        return (
          <div
            key={t.id}
            className={cn(
              "group relative flex items-center rounded-lg transition-colors",
              active ? "bg-primary/10" : "hover:bg-sidebar-accent",
            )}
          >
            <Link
              to="/medmo/$threadId"
              params={{ threadId: t.id }}
              className={cn(
                "flex-1 min-w-0 px-3 py-2.5 text-sm truncate",
                active ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.title}
            </Link>
            <button
              onClick={() => onDelete(t.id, active)}
              aria-label="Supprimer la conversation"
              className="shrink-0 mr-2 p-1.5 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 transition-opacity"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function MedmoLayout() {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const { threads, creating, newThread, removeThread } = useMedmoThreads(user?.id, profile?.entreprise_id);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeId = pathname.startsWith("/medmo/") ? pathname.split("/")[2] : null;

  return (
    <div className="flex h-[calc(100dvh-13.5rem)] md:h-[calc(100dvh-4rem)] -my-2 md:-my-4 min-h-0">
      {/* Threads sidebar (desktop) */}
      <aside className="hidden md:flex w-72 shrink-0 flex-col border-r border-border bg-sidebar/40 min-h-0">
        <div className="px-4 py-4 border-b border-border flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[linear-gradient(135deg,#C8922A,#A67420)] flex items-center justify-center shadow-[0_0_20px_rgba(200,146,42,0.3)]">
            <Sparkles className="h-4.5 w-4.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold">PR MEDMO</div>
            <div className="text-[10px] text-muted-foreground">Votre copilote éditorial</div>
          </div>
        </div>
        <div className="p-3">
          <button
            onClick={newThread}
            disabled={creating}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#C8922A,#A67420)] text-white text-sm font-semibold px-3 py-2.5 hover:brightness-110 disabled:opacity-50 shadow-lg"
          >
            <Plus className="h-4 w-4" /> Nouvelle conversation
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-0">
          <MedmoThreadList threads={threads} activeId={activeId} onDelete={removeThread} />
        </div>
      </aside>

      {/* Main chat area */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <Outlet />
      </div>
    </div>
  );
}
