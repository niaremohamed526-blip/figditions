import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FullscreenNotice } from "@/components/fullscreen-notice";

const BRIEF_TYPE = "brief_quotidien";

interface Brief {
  id: string;
  message: string;
  lu: boolean;
}

interface BriefPoint {
  label: string;
  text: string;
  to: string | null;
}

const seenKey = (userId: string) => `figd:brief-vu:${userId}`;

function readSeen(userId: string): string | null {
  try {
    return localStorage.getItem(seenKey(userId));
  } catch {
    return null;
  }
}

function writeSeen(userId: string, briefId: string) {
  try {
    localStorage.setItem(seenKey(userId), briefId);
  } catch {
    // Private mode: the brief may show again on the next visit, which is harmless.
  }
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The cron writes "A · B · C." (see api/public/hooks/morning-brief.ts). */
export function parseBrief(message: string): BriefPoint[] {
  return message
    .replace(/\.\s*$/, "")
    .split(" · ")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith("Hier : "))
        return { label: "Ventes d'hier", text: capitalize(part.slice(7)), to: "/finances" };
      if (part.startsWith("Stock faible : "))
        return { label: "À réimprimer", text: part.slice(15), to: "/stocks" };
      if (part.startsWith("Dépôts presque vides chez "))
        return { label: "Dépôts presque vides", text: part.slice(26), to: "/stocks" };
      if (part.includes("paiement")) return { label: "Paiements en attente", text: part, to: "/finances" };
      if (part.includes("contrat")) return { label: "Contrats à renouveler", text: part, to: "/contrats" };
      return { label: "À noter", text: part, to: null };
    });
}

/**
 * Today's brief, once per user and per brief: shown on the first visit after
 * the morning cron ran, never again once closed on this device.
 */
export function useDailyBrief({
  userId,
  entrepriseId,
}: {
  userId: string | null | undefined;
  entrepriseId: string | null | undefined;
}) {
  const [brief, setBrief] = useState<Brief | null>(null);

  useEffect(() => {
    if (!userId || !entrepriseId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, message, lu, metadata, created_at")
        .eq("entreprise_id", entrepriseId)
        .eq("type", BRIEF_TYPE)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || error || !data) return;
      // The cron stamps the Bamako date, which is UTC.
      const today = new Date().toISOString().slice(0, 10);
      const day = (data.metadata as { date?: string } | null)?.date ?? data.created_at.slice(0, 10);
      if (day !== today || readSeen(userId) === data.id) return;
      setBrief({ id: data.id, message: data.message, lu: data.lu });
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, entrepriseId]);

  const dismiss = useCallback(() => {
    if (!brief || !userId) return;
    writeSeen(userId, brief.id);
    setBrief(null);
    if (!brief.lu) {
      supabase
        .from("notifications")
        .update({ lu: true })
        .eq("id", brief.id)
        .then(({ error }) => {
          if (error) console.warn("[brief] mark read failed", error);
        });
    }
  }, [brief, userId]);

  return { brief, dismiss };
}

export function DailyBriefScreen({
  message,
  onClose,
  onOpen,
}: {
  message: string;
  onClose: () => void;
  onOpen: (to: string) => void;
}) {
  const points = parseBrief(message);

  return (
    <FullscreenNotice
      kicker="Votre brief du jour"
      label="Votre brief du jour"
      actionLabel="Commencer ma journée"
      blocking
      onClose={onClose}
      note="Ce brief reste disponible dans la cloche de notifications."
    >
      <h1 className="mt-5 text-foreground">
        Ce qui vous attend <em className="italic text-[color:var(--gold)]">aujourd'hui.</em>
      </h1>
      <p className="mt-4 text-[15px] text-muted-foreground">
        {capitalize(format(new Date(), "EEEE d MMMM", { locale: fr }))}
      </p>

      <ol className="mt-10 border-t border-border">
        {points.map((p, i) => (
          <li key={i} className="grid grid-cols-[2.5rem_1fr] gap-x-3 py-5 border-b border-border">
            <span className="font-wordmark-serif text-2xl leading-none text-[color:var(--gold)] tabular-nums">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <h2 className="text-[12px] uppercase tracking-[0.2em] text-muted-foreground">{p.label}</h2>
              <p className="mt-1 text-[15px] leading-relaxed text-foreground">{p.text}</p>
              {p.to && (
                <button
                  onClick={() => onOpen(p.to!)}
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-[color:var(--gold)] hover:underline underline-offset-4"
                >
                  Voir <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </FullscreenNotice>
  );
}
