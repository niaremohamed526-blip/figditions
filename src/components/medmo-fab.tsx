import { lazy, Suspense, useCallback, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { X, ArrowUpRight, Plus } from "lucide-react";
import { createThread } from "@/lib/medmo";
import { MedmoWordmark } from "@/components/medmo-wordmark";
import { cn } from "@/lib/utils";
import medmoMark from "@/assets/medmo-mark.png";

const MedmoChat = lazy(() => import("@/components/medmo-chat"));

/** Floating Pr. MEDMO button + compact chat panel available on every authenticated page. */
export function MedmoFab({
  userId,
  entrepriseId,
  allowed,
}: {
  userId: string;
  entrepriseId: string | null;
  allowed: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const ensureThread = useCallback(async () => {
    if (threadId) return threadId;
    setCreating(true);
    try {
      const t = await createThread(userId, entrepriseId);
      setThreadId(t.id);
      return t.id;
    } finally {
      setCreating(false);
    }
  }, [threadId, userId, entrepriseId]);

  const handleOpen = useCallback(async () => {
    setOpen(true);
    await ensureThread();
  }, [ensureThread]);

  const newConversation = useCallback(async () => {
    setCreating(true);
    try {
      const t = await createThread(userId, entrepriseId);
      setThreadId(t.id);
    } finally {
      setCreating(false);
    }
  }, [userId, entrepriseId]);

  // Keep this component's hook tree stable; visibility is decided only after all hooks run.
  if (!allowed || pathname.startsWith("/medmo")) return null;

  return (
    <>
      <motion.button
        onClick={handleOpen}
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.5 }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className={cn(
          "fixed z-50 flex items-center justify-center",
          "bottom-20 mb-[env(safe-area-inset-bottom)] md:mb-0 md:bottom-6 right-4 md:right-6",
          "h-14 w-14 rounded-full",
          "bg-[radial-gradient(circle_at_35%_30%,#2b2110,#14100a_70%)]",
          "border border-[color:var(--gold)]/50",
          "shadow-[0_0_24px_rgba(200,146,42,0.45),0_0_48px_rgba(200,146,42,0.2)]",
          "hover:shadow-[0_0_32px_rgba(200,146,42,0.6),0_0_64px_rgba(200,146,42,0.25)] transition-shadow duration-300",
        )}
        aria-label="Ouvrir PR MEDMO"
      >
        <span className="absolute inset-0 rounded-full bg-[color:var(--gold)]/25 animate-ping" />
        <img src={medmoMark} alt="PR MEDMO" className="relative h-7 w-7 object-contain" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            {/* Mobile backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm md:hidden"
              onClick={() => setOpen(false)}
            />

            {/* Chat panel */}
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className={cn(
                "fixed z-50 overflow-hidden rounded-t-2xl md:rounded-2xl border border-[color:var(--gold)]/30 bg-card",
                "shadow-[0_16px_60px_rgba(0,0,0,0.55)]",
                "inset-x-0 bottom-0 h-[calc(85dvh_-_env(safe-area-inset-bottom))] md:inset-auto md:bottom-6 md:right-6 md:w-[420px] md:h-[640px]",
              )}
            >
              {/* Panel header */}
              <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border bg-sidebar/60 shrink-0">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    "bg-[radial-gradient(circle_at_35%_30%,#2b2110,#14100a_70%)]",
                    "border border-[color:var(--gold)]/40",
                  )}
                >
                  <img src={medmoMark} alt="" className="h-5 w-5 object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <MedmoWordmark className="text-base" />
                  <p className="text-[10px] text-muted-foreground truncate leading-none">
                    Assistant IA FIGDITIONS
                  </p>
                </div>
                <button
                  type="button"
                  onClick={newConversation}
                  disabled={creating}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
                  title="Nouvelle conversation"
                >
                  <Plus className={cn("h-4 w-4", creating && "animate-spin")} />
                </button>
                <Link
                  to="/medmo"
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
                  title="Ouvrir dans l'application"
                >
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Chat body */}
              <div className="h-[calc(100%-3.25rem)] min-h-0">
                {threadId ? (
                  <Suspense
                    fallback={
                      <div className="h-full flex items-center justify-center">
                        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                      </div>
                    }
                  >
                    <MedmoChat threadId={threadId} initialMessages={[]} compact />
                  </Suspense>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    <span className="text-xs">Préparation de PR MEDMO…</span>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
