import { ConfirmationModal } from "@/components/ui/confirmation-modal";

interface Props {
  open: boolean;
  onContinue: () => void; // "Continuer la saisie" — dismiss the modal, keep form
  onDiscard: () => void;  // "Abandonner"          — close form, drop data
  title?: string;
  message?: string;
}

/**
 * Shown when a user tries to close a form that has unsaved changes.
 * Default action (Enter / Escape / backdrop click) = Continue (safe).
 */
export function UnsavedChangesModal({
  open,
  onContinue,
  onDiscard,
  title = "Quitter sans sauvegarder ?",
  message = "Vos saisies seront perdues.",
}: Props) {
  return (
    <ConfirmationModal
      isOpen={open}
      title={title}
      message={message}
      confirmLabel="Continuer la saisie"
      cancelLabel="Abandonner"
      confirmVariant="gold"
      cancelVariant="danger"
      iconVariant="gold"
      onConfirm={onContinue}
      onCancel={onDiscard}
      escapeConfirms
      backdropCancels={false}
    />
  );
}
