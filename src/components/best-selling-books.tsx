import { Link } from "@tanstack/react-router";
import { fcfa } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface BookRanking {
  manuscritId: string;
  titre: string;
  auteur: string;
  genre?: string | null;
  copies: number;
  revenue: number;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export function BestSellingBooks({
  books,
  limit = 5,
  clickable = true,
}: {
  books: BookRanking[];
  limit?: number;
  clickable?: boolean;
}) {
  const list = books.slice(0, limit);
  if (list.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Aucune vente enregistrée pour le moment.</p>;
  }
  const max = Math.max(...list.map((b) => b.copies), 1);

  return (
    <div className="space-y-2">
      {list.map((b, i) => {
        const pct = (b.copies / max) * 100;
        const badge = i < 3 ? MEDALS[i] : `#${i + 1}`;
        const Row = (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background/50 hover:bg-primary/5 transition-colors">
            <div className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0",
              i === 0 && "bg-[color:var(--gold)]/15 text-[color:var(--gold)]",
              i === 1 && "bg-slate-400/15 text-slate-300",
              i === 2 && "bg-orange-700/15 text-orange-400",
              i > 2 && "bg-muted text-muted-foreground",
            )}>
              {badge}
            </div>
            <div className="text-2xl flex-shrink-0">📚</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium truncate">{b.titre}</p>
                {b.genre && (
                  <span className="inline-flex items-center rounded-full border border-border bg-muted/30 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {b.genre}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{b.auteur}</p>
              <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-semibold tabular-nums">{b.copies} ex.</p>
              <p className="text-xs text-[color:var(--gold)] font-medium tabular-nums">{fcfa(b.revenue)}</p>
            </div>
          </div>
        );
        return clickable ? (
          <Link key={b.manuscritId} to="/manuscrits/$manuscritId" params={{ manuscritId: b.manuscritId }} className="block">
            {Row}
          </Link>
        ) : (
          <div key={b.manuscritId}>{Row}</div>
        );
      })}
    </div>
  );
}
