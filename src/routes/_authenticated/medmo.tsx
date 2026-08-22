import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { Plus, Trash2, MessageSquareText } from "lucide-react";
import { motion } from "motion/react";
import { lazy, Suspense } from "react";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { useMedmoThreads } from "@/hooks/use-medmo-threads";
import { cn } from "@/lib/utils";
import medmoMark from "@/assets/medmo-mark.png";

const Ballpit = lazy(() => import("@/components/Ballpit"));

const MEDMO_BALL_COLORS = [0xc8922a, 0xa0681e, 0x745757];

export const Route = createFileRoute("/_authenticated/medmo")({
  component: MedmoLayout,
});

function MedmoBallpitBackground() {
  return (
    <>
      <div className="absolute inset-0 z-0" aria-hidden>
        <Suspense fallback={null}>
          <Ballpit
            count={100}
            gravity={0.5}
            friction={0.9975}
            wallBounce={0.95}
            followCursor
            colors={MEDMO_BALL_COLORS}
            ambientColor={0xc8922a}
            ambientIntensity={0.5}
            lightIntensity={150}
            minSize={0.3}
            maxSize={0.9}
          />
        </Suspense>
      </div>
      {/* Readability overlay */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(13,10,6,0.25)_0%,rgba(13,10,6,0.6)_100%)]"
        aria-hidden
      />
    </>
  );
}

export function MedmoBrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl border border-[color:var(--gold)]/40",
        "bg-[radial-gradient(circle_at_35%_30%,#2b2110,#14100a_75%)]",
        "shadow-[0_0_20px_rgba(200,146,42,0.3)]",
        className,
      )}
    >
      <img src={medmoMark} alt="Pr. MEDMO" className="h-[60%] w-[60%] object-contain" />
    </div>
  );
}

/** Wordmark officiel : « Pr. » en serif italique + « MEDMO » en capitales or. */
export function MedmoWordmark({ className, prClassName, nameClassName }: {
  className?: string;
  prClassName?: string;
  nameClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-baseline gap-[0.3em] whitespace-nowrap", className)}>
      <span className={cn("font-wordmark-serif italic text-[color:var(--gold)]", prClassName)}>Pr.</span>
      <span
        className={cn(
          "font-bold tracking-[0.14em] bg-[linear-gradient(120deg,#E7B958,#C8922A,#A67420)] bg-clip-text text-transparent",
          nameClassName,
        )}
      >
        MEDMO
      </span>
    </span>
  );
}

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
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
      className="space-y-1"
    >
      {threads.map((t) => {
        const active = t.id === activeId;
        return (
          <motion.div
            key={t.id}
            variants={{
              hidden: { opacity: 0, x: -10 },
              show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 350, damping: 28 } },
            }}
            className={cn(
              "group relative flex items-center rounded-lg transition-colors overflow-hidden",
              active ? "bg-[color:var(--gold)]/10" : "hover:bg-sidebar-accent",
            )}
          >
            {active && (
              <motion.span
                layoutId="medmo-active-thread"
                className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-[linear-gradient(180deg,#E7B958,#A67420)]"
              />
            )}
            <Link
              to="/medmo/$threadId"
              params={{ threadId: t.id }}
              className={cn(
                "flex-1 min-w-0 px-3 py-2.5 text-sm truncate",
                active
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground",
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
          </motion.div>
        );
      })}
    </motion.div>
  );
}

function MedmoLayout() {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const { threads, creating, newThread, removeThread } = useMedmoThreads(
    user?.id,
    profile?.entreprise_id,
  );
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeId = pathname.startsWith("/medmo/") ? pathname.split("/")[2] : null;

  return (
    <div className="relative flex h-[calc(100dvh-13.5rem)] md:h-[calc(100dvh-4rem)] -my-2 md:-my-4 min-h-0 overflow-hidden">
      <MedmoBallpitBackground />
      {/* Threads sidebar (desktop) */}
      <aside className="hidden md:flex relative z-10 w-72 shrink-0 flex-col border-r border-border bg-sidebar/40 backdrop-blur-sm min-h-0">
        <div className="px-4 py-4 border-b border-border flex items-center gap-2.5">
          <MedmoBrandMark className="h-9 w-9" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold">PR MEDMO</div>
            <div className="text-[10px] text-muted-foreground">Votre copilote éditorial</div>
          </div>
        </div>
        <div className="p-3">
          <motion.button
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.97 }}
            onClick={newThread}
            disabled={creating}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#C8922A,#A67420)] text-white text-sm font-semibold px-3 py-2.5 hover:brightness-110 disabled:opacity-50 shadow-lg"
          >
            <Plus className="h-4 w-4" /> Nouvelle conversation
          </motion.button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-0">
          <MedmoThreadList threads={threads} activeId={activeId} onDelete={removeThread} />
        </div>
      </aside>

      {/* Main chat area */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col relative z-10">
        <Outlet />
      </div>
    </div>
  );
}
