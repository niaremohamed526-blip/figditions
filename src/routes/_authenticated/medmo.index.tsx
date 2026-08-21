import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { motion } from "motion/react";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { useMedmoThreads } from "@/hooks/use-medmo-threads";
import { MedmoThreadList, MedmoBrandMark } from "./medmo";

export const Route = createFileRoute("/_authenticated/medmo/")({
  component: MedmoIndex,
  head: () => ({
    meta: [{ title: "PR MEDMO — Assistant IA | FIGDITIONS" }],
  }),
});

function MedmoIndex() {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const { threads, creating, newThread, removeThread } = useMedmoThreads(
    user?.id,
    profile?.entreprise_id,
  );

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(1000px_480px_at_50%_-10%,rgba(200,146,42,0.07),transparent)]">
      <motion.div
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
        className="max-w-xl mx-auto px-4 py-10 flex flex-col items-center text-center gap-6"
      >
        <motion.div
          variants={{
            hidden: { opacity: 0, scale: 0.8 },
            show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 240, damping: 18 } },
          }}
          className="relative"
        >
          <motion.span
            className="absolute inset-0 -m-5 rounded-full bg-[color:var(--gold)]/25 blur-2xl"
            animate={{ opacity: [0.4, 0.8, 0.4], scale: [1, 1.12, 1] }}
            transition={{ duration: 3.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          />
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3.8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          >
            <MedmoBrandMark className="h-20 w-20 rounded-3xl" />
          </motion.div>
        </motion.div>
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 14 },
            show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 26 } },
          }}
        >
          <h1 className="text-2xl font-bold">
            <span className="bg-[linear-gradient(120deg,#E7B958,#C8922A,#A67420)] bg-clip-text text-transparent">
              PR MEDMO
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            Votre copilote IA pour FIGDITIONS. Posez une question, demandez une analyse de vos stocks
            ou ventes, ou laissez-le agir pour vous — toujours avec votre confirmation.
          </p>
        </motion.div>
        <motion.button
          variants={{
            hidden: { opacity: 0, y: 14 },
            show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 26 } },
          }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={newThread}
          disabled={creating}
          className="inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#C8922A,#A67420)] text-white text-sm font-semibold px-6 py-3 hover:brightness-110 disabled:opacity-50 shadow-[0_8px_28px_rgba(200,146,42,0.35)]"
        >
          <Plus className="h-4 w-4" /> Démarrer une conversation
        </motion.button>

        {/* Mobile: thread list lives here (sidebar is desktop-only) */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 14 },
            show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 26 } },
          }}
          className="md:hidden w-full mt-4 text-left"
        >
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
            Vos conversations
          </h2>
          <MedmoThreadList threads={threads} activeId={null} onDelete={removeThread} />
        </motion.div>
      </motion.div>
    </div>
  );
}
