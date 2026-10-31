import type { ReactNode } from "react";
import { Logo } from "@/components/logo";

/** Full-screen FIGDITIONS logo with a gold breathing / orbit animation. */
export function BrandLoader({ children }: { children?: ReactNode }) {
  return (
    <div className="min-h-screen gradient-bg flex flex-col items-center justify-center gap-8 p-6" role="status" aria-live="polite">
      <div className="brand-loader relative flex items-center justify-center">
        <span className="brand-loader-halo" aria-hidden />
        <span className="brand-loader-orbit" aria-hidden />
        <Logo className="brand-loader-logo relative h-20 w-auto" alt="FIGDITIONS" />
      </div>
      <div className="brand-loader-bar" aria-hidden />
      {children ?? <span className="sr-only">Chargement…</span>}
    </div>
  );
}
