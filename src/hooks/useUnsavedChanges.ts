import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tracks whether a form has unsaved changes.
 *
 * Usage:
 *   const { isDirty, markDirty, markClean } = useUnsavedChanges(initialValues);
 *   // call markDirty(currentValues) whenever the form state changes
 *   // call markClean() after a successful save
 *
 * `initialValues` can be re-passed on each render : the hook keeps a stable
 * snapshot of the FIRST initial values it saw, so comparisons stay meaningful
 * even when the parent re-computes the object each render.
 */
export function useUnsavedChanges<T>(initialValues: T) {
  const initialRef = useRef<string>(JSON.stringify(initialValues));
  const [isDirty, setIsDirty] = useState(false);

  const markDirty = useCallback((values: T) => {
    setIsDirty(JSON.stringify(values) !== initialRef.current);
  }, []);

  const markClean = useCallback((newBaseline?: T) => {
    if (newBaseline !== undefined) {
      initialRef.current = JSON.stringify(newBaseline);
    }
    setIsDirty(false);
  }, []);

  const forceDirty = useCallback(() => setIsDirty(true), []);

  // Native browser beforeunload warning when dirty (tab close / reload / nav away).
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  return { isDirty, markDirty, markClean, forceDirty };
}
