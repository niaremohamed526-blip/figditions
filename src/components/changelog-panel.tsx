import { useEffect, useState } from "react";
import { Gift, X, Check } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Z_INDEX } from "@/lib/zIndex";
import {
  TYPE_META,
  groupItems,
  pageTagLabel,
  type ChangelogEntry,
} from "@/lib/changelog";

interface Props {
  entries: ChangelogEntry[] | null;
  /** Blocking mode: no X, no backdrop click, no Escape. */
  blocking?: boolean;
  onClose: () => void;
}

export function ChangelogPanel({ entries, blocking = false, onClose }: Props) {
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [escapeHatch, setEscapeHatch] = useState(false);

  // Never trap the user forever if something goes wrong.
  useEffect(() => {
    if (!blocking) return;
    const t = setTimeout(() => setEscapeHatch(true), 15000);
    return () => clearTimeout(t);
  }, [blocking]);

  const finish = () => {
    if (busy) return;
    setBusy(true);
    setLeaving(true);
    setTimeout(() => onClose(), 250);
  };

  useEffect(() => {
    if (blocking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocking]);

  const list = entries ?? [];

  return (
    <div className="fixed inset-0" style={{ zIndex: Z_INDEX.confirmation }}>
      <div
        onClick={blocking ? undefined : finish}
        className={cn(
          "absolute inset-0 transition-opacity duration-300",
          leaving ? "opacity-0" : "opacity-100",
          !blocking && "cursor-pointer",
        )}
        style={{ background: "rgba(13,10,6,0.85)", backdropFilter: "blur(6px)" }}
      />

      <aside
        className={cn(
          "absolute top-0 right-0 h-screen w-full sm:w-[520px] flex flex-col overflow-hidden",
          leaving ? "animate-changelog-out" : "animate-changelog-in",
        )}
        style={{
          background: "linear-gradient(165deg, rgba(26,18,8,0.98), rgba(13,10,6,0.98))",
          borderLeft: "1px solid rgba(200,146,42,0.25)",
          boxShadow: "-20px 0 60px rgba(0,0,0,0.6)",
        }}
      >
        {!blocking && (
          <button
            onClick={finish}
            aria-label="Fermer"
            className="absolute top-4 right-4 z-10 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        <div className="flex-1 overflow-y-auto px-6 sm:px-8 pt-8 pb-6">
          <div className="flex items-center gap-2 mb-4">
            <span
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl animate-pulse-soft"
              style={{ background: "rgba(200,146,42,0.12)", border: "1px solid rgba(200,146,42,0.3)" }}
            >
              <Gift className="h-5 w-5" style={{ color: "var(--gold, #C8922A)" }} />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#C8922A" }}>
              Quoi de neuf
            </span>
          </div>

          {list.length === 0 && (
            <p className="text-sm text-muted-foreground py-10">
              Rien de neuf pour le moment. Revenez bientôt, ça bouge souvent ici.
            </p>
          )}

          {list.map((entry, idx) => (
            <section key={entry.id} className={cn(idx > 0 && "mt-10 pt-8 border-t border-[rgba(200,146,42,0.15)]")}>
              <h2 className="text-[22px] font-bold leading-[1.3] text-foreground">{entry.hook}</h2>
              <p className="mt-2 text-[15px] font-semibold" style={{ color: "#C8922A" }}>
                {entry.titre}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {format(new Date(entry.date_publication), "d MMMM yyyy", { locale: fr })}
                {entry.version ? ` · version ${entry.version}` : ""}
              </p>

              <div className="mt-5 space-y-5">
                {groupItems(entry.items).map((group) => {
                  const meta = TYPE_META[group.type];
                  return (
                    <div key={group.type}>
                      <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: meta.color }}>
                        {meta.emoji} {meta.label}
                      </h3>
                      {group.items.map((item, i) => {
                        const tag = pageTagLabel(item.page_concernee);
                        return (
                          <div
                            key={i}
                            className="rounded-lg px-4 py-3 mb-2"
                            style={{
                              background: "rgba(200,146,42,0.05)",
                              borderLeft: `3px solid ${meta.color}`,
                            }}
                          >
                            <p className="text-sm text-foreground/90 leading-relaxed">{item.texte}</p>
                            {tag && (
                              <span className="inline-block mt-2 rounded-full px-2 py-0.5 text-[10px] font-semibold text-muted-foreground bg-white/5 border border-white/10">
                                {tag}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div
          className="px-6 sm:px-8 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
          style={{ borderTop: "1px solid rgba(200,146,42,0.15)" }}
        >
          <button
            onClick={finish}
            disabled={busy && !escapeHatch}
            className="w-full h-12 rounded-xl font-semibold text-[15px] text-[#1A1208] transition-transform active:scale-[0.98] disabled:opacity-70"
            style={{ background: "linear-gradient(135deg, #C8922A, #A67420)" }}
          >
            {blocking ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Check className="h-4 w-4" /> J'ai compris, continuer
              </span>
            ) : (
              "Fermer"
            )}
          </button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Vous pouvez revoir cet historique à tout moment depuis la cloche de notifications.
          </p>
        </div>
      </aside>
    </div>
  );
}
