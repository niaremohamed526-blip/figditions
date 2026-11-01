import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { useMedmoThreads } from "@/hooks/use-medmo-threads";
import { MedmoThreadList } from "./medmo";

export const Route = createFileRoute("/_authenticated/medmo/")({
  component: MedmoIndex,
  head: () => ({
    meta: [{ title: "PR MEDMO, assistant IA | FIGDITIONS" }],
  }),
});

// Same three promises as the homepage's Pr. MEDMO section.
const POINTS = [
  {
    title: "Posez vos questions",
    text: "« Combien d'exemplaires reste-t-il à la Librairie Nouvel Horizon ? » La réponse vient de vos données réelles.",
  },
  {
    title: "Photographiez votre cahier",
    text: "Une page de cahier de ventes est lue, les titres reconnus dans votre catalogue, et les ventes proposées à l'enregistrement.",
  },
  {
    title: "Vous gardez le dernier mot",
    text: "Aucune écriture sans votre validation. En cas de doute sur un titre ou une librairie, il vous demande confirmation.",
  },
];

function MedmoIndex() {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const { threads, creating, newThread, removeThread } = useMedmoThreads(
    user?.id,
    profile?.entreprise_id,
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-5 py-10 md:py-16">
        <p className="flex items-center gap-3 text-[12px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="h-px w-8 bg-[color:var(--gold)]" aria-hidden="true" />
          Votre copilote éditorial
        </p>
        <h1 className="mt-5 text-foreground">
          Pr. MEDMO connaît <em className="italic text-[color:var(--gold)]">vos chiffres.</em>
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground max-w-lg">
          Posez une question, demandez une analyse de vos stocks ou de vos ventes, ou laissez-le
          préparer le travail. Rien n'est enregistré sans votre confirmation.
        </p>

        <button
          onClick={newThread}
          disabled={creating}
          className="mt-8 inline-flex items-center gap-2 rounded-md bg-[#C8922A] text-white text-[15px] font-medium px-5 h-11 transition-colors hover:bg-[#B5821F] disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Démarrer une conversation
        </button>

        <ol className="mt-12 border-t border-border">
          {POINTS.map((p, i) => (
            <li key={p.title} className="grid grid-cols-[2.5rem_1fr] gap-x-3 py-5 border-b border-border">
              <span className="font-wordmark-serif text-2xl leading-none text-[color:var(--gold)] tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h2 className="text-[15px] font-medium text-foreground">{p.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.text}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* Mobile: thread list lives here (sidebar is desktop-only) */}
        <div className="md:hidden mt-10">
          <h2 className="text-[12px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Vos conversations
          </h2>
          <MedmoThreadList threads={threads} activeId={null} onDelete={removeThread} />
        </div>
      </div>
    </div>
  );
}
