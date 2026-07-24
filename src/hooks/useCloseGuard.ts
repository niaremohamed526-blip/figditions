import { useCallback, useState } from "react";

/**
 * Small helper composing the "attempt to close a form" flow.
 * - `requestClose()`: called by any close path (X button, backdrop, Escape).
 *   If `isDirty` is true → shows the confirmation modal.
 *   Otherwise → calls `doClose()` directly.
 * - `confirmDiscard()`: called by the modal "Abandonner" button.
 * - `cancelClose()`:    called by the modal "Continuer la saisie" button / backdrop.
 * - `handleOpenChange`: drop-in for shadcn Sheet/Dialog `onOpenChange`.
 */
export function useCloseGuard(isDirty: boolean, doClose: () => void) {
  const [showModal, setShowModal] = useState(false);

  const requestClose = useCallback(() => {
    if (isDirty) setShowModal(true);
    else doClose();
  }, [isDirty, doClose]);

  const cancelClose = useCallback(() => setShowModal(false), []);

  const confirmDiscard = useCallback(() => {
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
