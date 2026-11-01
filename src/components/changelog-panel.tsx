import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { FullscreenNotice } from "@/components/fullscreen-notice";
import { TYPE_META, groupItems, pageTagLabel, type ChangelogEntry } from "@/lib/changelog";

interface Props {
  entries: ChangelogEntry[] | null;
  /** Blocking mode: shown once after an update, closed only with the button. */
  blocking?: boolean;
  onClose: () => void;
}

export function ChangelogPanel({ entries, blocking = false, onClose }: Props) {
  const list = entries ?? [];

  return (
    <FullscreenNotice
      kicker={blocking ? "Nouvelle mise à jour" : "Quoi de neuf"}
      label="Quoi de neuf dans FIGDITIONS"
      actionLabel={blocking ? "J'ai compris, continuer" : "Fermer"}
      blocking={blocking}
      onClose={onClose}
      note="Retrouvez ces nouveautés à tout moment dans la cloche, rubrique « Quoi de neuf »."
    >
      {entries === null && (
        <p className="mt-8 text-[15px] text-muted-foreground">Chargement…</p>
      )}
      {entries !== null && list.length === 0 && (
        <p className="mt-8 text-[15px] text-muted-foreground">
          Rien de neuf pour le moment. Les prochaines mises à jour apparaîtront ici.
        </p>
      )}

      {list.map((entry, idx) => (
        <article key={entry.id} className={idx > 0 ? "mt-16 pt-12 border-t border-border" : "mt-5"}>
          {idx === 0 ? (
            <h1 className="text-foreground">{entry.hook}</h1>
          ) : (
            <h2 className="font-wordmark-serif font-normal text-[28px] leading-tight text-foreground">
              {entry.hook}
            </h2>
          )}
          <p className="mt-4 text-[15px] text-foreground">{entry.titre}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {format(new Date(entry.date_publication), "d MMMM yyyy", { locale: fr })}
            {entry.version ? ` · version ${entry.version}` : ""}
          </p>

          {groupItems(entry.items).map((group) => (
            <section key={group.type} className="mt-10">
              <h3 className="text-[12px] uppercase tracking-[0.2em] text-[color:var(--gold)]">
                {TYPE_META[group.type].label}
              </h3>
              <ol className="mt-3 border-t border-border">
                {group.items.map((item, i) => {
                  const tag = pageTagLabel(item.page_concernee);
                  return (
                    <li key={i} className="grid grid-cols-[2.5rem_1fr] gap-x-3 py-4 border-b border-border">
                      <span className="font-wordmark-serif text-2xl leading-none text-[color:var(--gold)] tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <p className="text-[15px] leading-relaxed text-foreground">{item.texte}</p>
                        {tag && <p className="mt-1 text-[13px] text-muted-foreground">{tag}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </article>
      ))}
    </FullscreenNotice>
  );
}
