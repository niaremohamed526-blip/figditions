import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Plus } from "lucide-react";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { useMedmoThreads } from "@/hooks/use-medmo-threads";
import { MedmoThreadList } from "./medmo";

export const Route = createFileRoute("/_authenticated/medmo/")({
  component: MedmoIndex,
  head: () => ({
    meta: [{ title: "DC MEDMO — Assistant IA | FIGDITIONS" }],
  }),
});

function MedmoIndex() {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const { threads, creating, newThread, removeThread } = useMedmoThreads(user?.id, profile?.entreprise_id);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl mx-auto px-4 py-10 flex flex-col items-center text-center gap-5">
        <div className="h-20 w-20 rounded-3xl bg-[linear-gradient(135deg,#C8922A,#A67420)] shadow-[0_0_50px_rgba(200,146,42,0.4)] flex items-center justify-center">
          <Sparkles className="h-10 w-10 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">DC MEDMO</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            Votre copilote IA pour FIGDITIONS. Posez une question, demandez une analyse de vos stocks ou ventes,
            ou laissez-le agir pour vous — toujours avec votre confirmation.
          </p>
        </div>
        <button
          onClick={newThread}
          disabled={creating}
          className="inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#C8922A,#A67420)] text-white text-sm font-semibold px-6 py-3 hover:brightness-110 disabled:opacity-50 shadow-lg"
        >
          <Plus className="h-4 w-4" /> Démarrer une conversation
        </button>

        {/* Mobile: thread list lives here (sidebar is desktop-only) */}
        <div className="md:hidden w-full mt-6 text-left">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
            Vos conversations
          </h2>
          <MedmoThreadList threads={threads} activeId={null} onDelete={removeThread} />
        </div>
      </div>
    </div>
  );
}
