import logoAsset from "@/assets/figditions-logo.png.asset.json";
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
      src={logoAsset.url}
      alt={alt}
      className={cn("object-contain", className)}
      style={{
        background: "transparent",
        backgroundColor: "transparent",
        filter: "drop-shadow(0 2px 12px rgba(0,0,0,0.55))",
        ...style,
      }}
    />
  );
}
