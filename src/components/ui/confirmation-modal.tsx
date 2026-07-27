import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Trash2, Info, Lock, UserMinus } from "lucide-react";
import { Z_INDEX } from "@/lib/zIndex";

export type ConfirmVariant = "gold" | "danger" | "default";

export interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ConfirmVariant;
  cancelVariant?: ConfirmVariant;
  icon?: ReactNode;
  iconVariant?: "gold" | "danger" | "info";
  onConfirm: () => void;
  onCancel: () => void;
  /** For unsaved-changes flow: Escape triggers confirm (stay in form) instead of cancel. */
  escapeConfirms?: boolean;
  /** For destructive flows, backdrop click cancels. Default = cancel. */
  backdropCancels?: boolean;
}

/**
 * Global reusable confirmation modal. Portalled to document.body with the
 * highest z-index in the scale so it renders above every drawer/sheet/dialog.
 */
export function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel = "Continuer",
  cancelLabel = "Abandonner",
  confirmVariant = "gold",
  cancelVariant = "default",
  icon,
  iconVariant = "gold",
  onConfirm,
  onCancel,
  escapeConfirms = false,
  backdropCancels = true,
}: ConfirmationModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  // Focus management + focus trap + keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    openerRef.current = (document.activeElement as HTMLElement) ?? null;
    // Focus primary button when opened
    const t = window.setTimeout(() => confirmRef.current?.focus(), 30);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onConfirm();
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (escapeConfirms) onConfirm();
        else onCancel();
      } else if (e.key === "Tab") {
        // Trap between the two buttons only
        e.preventDefault();
        const active = document.activeElement;
        if (active === confirmRef.current) cancelRef.current?.focus();
        else confirmRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey, true);
      // Restore focus to opener
      openerRef.current?.focus?.();
    };
  }, [isOpen, onConfirm, onCancel, escapeConfirms]);

  if (!isOpen || typeof document === "undefined") return null;

  const iconWrapStyle: React.CSSProperties =
    iconVariant === "danger"
      ? { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)" }
      : { background: "rgba(200,146,42,0.12)", border: "1px solid rgba(200,146,42,0.2)" };

  const iconColor = iconVariant === "danger" ? "#EF4444" : "#C8922A";

  const confirmStyle: React.CSSProperties =
    confirmVariant === "danger"
      ? {
          background: "rgba(239,68,68,0.15)",
          border: "1px solid rgba(239,68,68,0.3)",
          color: "#EF4444",
        }
      : confirmVariant === "gold"
      ? {
          background: "linear-gradient(135deg,#C8922A,#A67420)",
          color: "white",
          boxShadow: "0 4px 16px rgba(200,146,42,0.25)",
          border: 0,
        }
      : { background: "rgba(255,255,255,0.06)", color: "white", border: "1px solid rgba(255,255,255,0.1)" };

  const cancelStyle: React.CSSProperties =
    cancelVariant === "danger"
      ? {
          background: "transparent",
          border: "1px solid rgba(239,68,68,0.35)",
          color: "#EF4444",
        }
      : {
          background: "transparent",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "#B8A898",
        };

  return createPortal(
    <>
      <div
        onClick={backdropCancels ? onCancel : onConfirm}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          zIndex: Z_INDEX.confirmationBackdrop,
          animation: "figd-fade-in 200ms ease-out",
          pointerEvents: "auto",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="figd-confirm-title"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: Z_INDEX.confirmation,
          width: "calc(100% - 32px)",
          maxWidth: 360,
          pointerEvents: "auto",
        }}
      >
        <div
          style={{
            background: "rgba(26,18,8,0.97)",
            border: "1px solid rgba(200,146,42,0.25)",
            borderRadius: 20,
            padding: "28px 24px",
            boxShadow:
              "0 25px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(200,146,42,0.08), 0 0 60px rgba(200,146,42,0.04)",
            animation: "figd-modal-pop 250ms cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px auto",
              ...iconWrapStyle,
            }}
          >
            {icon ?? <AlertTriangle size={22} color={iconColor} />}
          </div>
          <h2
            id="figd-confirm-title"
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "white",
              textAlign: "center",
              marginBottom: 8,
              lineHeight: 1.3,
            }}
          >
            {title}
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "#B8A898",
              textAlign: "center",
              lineHeight: 1.5,
              margin: "0 0 24px 0",
            }}
          >
            {message}
          </p>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            style={{
              width: "100%",
              height: 44,
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 8,
              cursor: "pointer",
              ...confirmStyle,
            }}
          >
            {confirmLabel}
          </button>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            style={{
              width: "100%",
              height: 44,
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              ...cancelStyle,
            }}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes figd-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes figd-modal-pop {
          from { opacity: 0; transform: translate(-50%, calc(-50% + 12px)) scale(0.93); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </>,
    document.body,
  );
}

/* Preset icons for common flows */
export const ConfirmIcons = {
  warning: (color = "#C8922A") => <AlertTriangle size={22} color={color} />,
  delete: () => <Trash2 size={22} color="#EF4444" />,
  info: () => <Info size={22} color="#C8922A" />,
  lock: () => <Lock size={22} color="#C8922A" />,
  removeUser: () => <UserMinus size={22} color="#EF4444" />,
};
