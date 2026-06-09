import logoUrl from "@/assets/figditions-logo.png";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  alt = "FIGDITIONS Logo",
  style,
}: {
  className?: string;
  alt?: string;
  style?: React.CSSProperties;
}) {
  return (
    <img
      src={logoUrl}
      alt={alt}
      className={cn("object-contain", className)}
      style={{
        background: "transparent",
        backgroundColor: "transparent",
        ...style,
      }}
    />
  );
}
