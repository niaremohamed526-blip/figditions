import { FIGDITIONS_SITE_LOGO_URL } from "@/lib/brand-assets";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  alt = "FIGDITIONS Logo",
  style,
  variant = "glow",
}: {
  className?: string;
  alt?: string;
  style?: React.CSSProperties;
  /**
   * `glow` : gold glow for dark backgrounds (default, use everywhere in-app)
   * `gold` : solid gold tint for light backgrounds (PDF thumbnails, print previews)
   * `plain` : no filter
   */
  variant?: "glow" | "gold" | "plain";
}) {
  const filter =
    variant === "glow"
      ? "drop-shadow(0 0 8px rgba(200,146,42,0.8)) drop-shadow(0 0 20px rgba(200,146,42,0.4)) drop-shadow(0 0 40px rgba(200,146,42,0.2)) brightness(1.2)"
      : variant === "gold"
        ? "invert(65%) sepia(50%) saturate(500%) hue-rotate(5deg) brightness(0.9)"
        : undefined;

  return (
    <img
      src={FIGDITIONS_SITE_LOGO_URL}
      alt={alt}
      className={cn("object-contain logo select-none", className)}
      draggable={false}
      style={{
        background: "transparent",
        backgroundColor: "transparent",
        mixBlendMode: variant === "glow" ? "screen" : undefined,
        filter,
        ...style,
      }}
    />
  );
}
