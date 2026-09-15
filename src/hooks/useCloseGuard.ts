import { useCallback, useRef, useState } from "react";

/**
 * Small helper composing the "attempt to close a form" flow.
 * - `requestClose()`: called by any close path (X button, backdrop, Escape).
 *   If `isDirty` is true → shows the confirmation modal.
 *   Otherwise → calls `doClose()` directly.
 * - `confirmDiscard()`: called by the modal "Abandonner" button.
 * - `cancelClose()`:    called by the modal "Continuer la saisie" button.
 * - `handleOpenChange`: drop-in for shadcn Sheet/Dialog `onOpenChange`.
 *
 * Radix drawers/dialogs dispatch their own "interact outside" close attempts
 * when the user clicks the confirmation modal (it is portalled outside the
 * drawer). Those stray attempts used to immediately re-open the confirmation
 * modal right after "Continuer la saisie" closed it, so the button looked
 * broken. We therefore ignore close attempts while the modal is visible and
 * during a short cooldown after a decision was made.
 */
export function useCloseGuard(isDirty: boolean, doClose: () => void) {
  const [showModal, setShowModal] = useState(false);
  const showModalRef = useRef(false);
  const cooldownUntil = useRef(0);

  const requestClose = useCallback(() => {
    // A decision is being made (or was just made) → ignore stray close attempts.
    if (showModalRef.current || Date.now() < cooldownUntil.current) return;
    if (isDirty) {
      showModalRef.current = true;
      setShowModal(true);
    } else {
      doClose();
    }
  }, [isDirty, doClose]);

  // "Continuer la saisie": pure UI state change : the form stays open and filled.
  const cancelClose = useCallback(() => {
    showModalRef.current = false;
    cooldownUntil.current = Date.now() + 500;
    setShowModal(false);
  }, []);

  // "Abandonner": close the modal, then close the underlying form for real.
  const confirmDiscard = useCallback(() => {
    showModalRef.current = false;
    cooldownUntil.current = Date.now() + 500;
    setShowModal(false);
    doClose();
  }, [doClose]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) requestClose();
    },
    [requestClose],
  );

  return { showModal, requestClose, cancelClose, confirmDiscard, handleOpenChange };
}
