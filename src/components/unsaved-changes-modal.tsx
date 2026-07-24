import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

interface Props {
  open: boolean;
  onContinue: () => void; // "Continuer la saisie" — dismiss the modal, keep form
  onDiscard: () => void;  // "Abandonner"          — close form, drop data
  title?: string;
  message?: string;
}

/**
 * Confirmation modal shown when a user tries to close a form that has
 * unsaved changes. Default action (Enter / backdrop click) = Continue.
 */
export function UnsavedChangesModal({
  open,
  onContinue,
  onDiscard,
  title = "Modifications non sauvegardées",
  message = "Vous avez des données non sauvegardées. Si vous fermez maintenant, toutes vos saisies seront perdues.",
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onContinue();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onContinue();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onContinue]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ animation: "unsaved-fade 200ms ease-out" }}
    >
      {/* Backdrop — click = continue (safe default, no data loss) */}
      <div
        onClick={onContinue}
        className="absolute inset-0 bg-black/70"
        style={{ backdropFilter: "blur(4px)" }}
      />

      {/* Card */}
      <div
        className="relative w-full max-w-[400px] text-center"
        style={{
          background: "rgba(13,10,6,0.95)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(200,146,42,0.3)",
          borderRadius: 16,
          padding: 32,
          animation: "unsaved-pop 200ms ease-out",
        }}
      >
        <div className="flex justify-center mb-4">
          <AlertTriangle className="h-12 w-12" style={{ color: "#C8922A" }} strokeWidth={2} />
        </div>
        <h2 className="text-white font-bold" style={{ fontSize: 20 }}>{title}</h2>
        <p className="mx-auto" style={{ fontSize: 14, color: "#B8A898", margin: "16px 0 32px" }}>
          {message}
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={onContinue}
            autoFocus
            className="text-white font-semibold"
            style={{
              background: "linear-gradient(135deg,#C8922A,#A67420)",
              borderRadius: 10,
              padding: "12px 24px",
              fontWeight: 600,
              flex: 1,
              border: 0,
              cursor: "pointer",
            }}
          >
            Continuer la saisie
          </button>
          <button
            type="button"
            onClick={onDiscard}
            style={{
              background: "transparent",
              border: "1px solid rgba(239,68,68,0.4)",
              color: "#EF4444",
              borderRadius: 10,
              padding: "12px 24px",
              flex: 1,
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Abandonner
          </button>
        </div>
      </div>

      <style>{`
        @keyframes unsaved-pop {
          from { transform: scale(0.9); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
        @keyframes unsaved-fade {
          from { opacity: 0; } to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
