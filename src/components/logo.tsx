import logoUrl from "@/assets/figditions-logo.png";
import { cn } from "@/lib/utils";

export function Logo({ className, alt = "FIGDITIONS" }: { className?: string; alt?: string }) {
  return <img src={logoUrl} alt={alt} className={cn("object-contain", className)} />;
}
