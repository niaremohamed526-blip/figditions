import { cn } from "@/lib/utils";

/** Wordmark officiel : « Pr. » en serif italique + « MEDMO » en capitales or. */
export function MedmoWordmark({ className, prClassName, nameClassName }: {
  className?: string;
  prClassName?: string;
  nameClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-baseline gap-[0.3em] whitespace-nowrap", className)}>
      <span className={cn("font-wordmark-serif italic text-[color:var(--gold)]", prClassName)}>Pr.</span>
      <span
        className={cn(
          "font-bold tracking-[0.14em] bg-[linear-gradient(120deg,#E7B958,#C8922A,#A67420)] bg-clip-text text-transparent",
          nameClassName,
        )}
      >
        MEDMO
      </span>
    </span>
  );
}
