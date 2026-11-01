import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Z_INDEX } from "@/lib/zIndex";

interface Props {
  /** Small uppercase line above the title. */
  kicker: string;
  /** Accessible name of the dialog. */
  label: string;
  actionLabel: string;
  onClose: () => void;
  /** Blocking: no X, no Escape. The only way out is the action button. */
  blocking?: boolean;
  /** Extra line under the action button. */
  note?: ReactNode;
  children: ReactNode;
}

/**
 * Full-screen editorial page laid over the app: used for "Quoi de neuf" and
 * the daily brief. In blocking mode the user has to press the button first.
 */
export function FullscreenNotice({
  kicker,
  label,
  actionLabel,
  onClose,
  blocking = false,
  note,
  children,
}: Props) {
  const [leaving, setLeaving] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const finish = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(onClose, 200);
  };

  // Nothing behind the page should scroll while it is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    buttonRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    if (blocking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocking]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className={cn(
        "app-content fixed inset-0 flex flex-col bg-background text-foreground transition-opacity duration-200",
        leaving ? "opacity-0" : "animate-in fade-in-0 duration-300",
      )}
      style={{ zIndex: Z_INDEX.confirmation }}
    >
      <header className="shrink-0 border-b border-border">
        <div className="max-w-2xl mx-auto px-5 h-14 flex items-center justify-between">
          <span className="font-wordmark-serif text-xl tracking-wide">FIGDITIONS</span>
          {!blocking && (
            <button
              onClick={finish}
              aria-label="Fermer"
              className="-mr-2 p-2 rounded-md text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="max-w-2xl mx-auto px-5 py-10 md:py-16">
          <p className="flex items-center gap-3 text-[12px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="h-px w-8 bg-[color:var(--gold)]" aria-hidden="true" />
            {kicker}
          </p>
          {children}
        </div>
      </div>

      <footer className="shrink-0 border-t border-border">
        <div className="max-w-2xl mx-auto px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            ref={buttonRef}
            onClick={finish}
            className="w-full sm:w-auto sm:min-w-56 h-11 px-6 rounded-md bg-[#C8922A] text-white text-[15px] font-medium transition-colors hover:bg-[#B5821F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8922A] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {actionLabel}
          </button>
          {note && <p className="mt-3 text-[13px] text-muted-foreground">{note}</p>}
        </div>
      </footer>
    </div>
  );
}
