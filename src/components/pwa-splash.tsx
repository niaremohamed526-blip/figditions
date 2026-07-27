import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function PwaSplash() {
  // Start visible immediately so the app content never flashes behind it.
  const [visible, setVisible] = useState(() =>
    typeof window === "undefined" ? false : isStandalone()
  );
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isStandalone()) {
      setVisible(false);
      return;
    }

    // Hold the splash a little longer so the logo animation feels complete.
    const fadeAt = window.setTimeout(() => setFading(true), 2800);
    const hideAt = window.setTimeout(() => setVisible(false), 4000);
    return () => {
      window.clearTimeout(fadeAt);
      window.clearTimeout(hideAt);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "#0D0A06",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 24,
        opacity: fading ? 0 : 1,
        transition: "opacity 900ms ease",
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      <div className="splash-logo-wrap">
        <div className="splash-glow" />
        <Logo
          style={{
            height: 120,
            width: "auto",
            position: "relative",
            zIndex: 1,
          }}
        />
      </div>
      <div
        style={{
          color: "#C8922A",
          fontSize: 11,
          letterSpacing: 4,
          textTransform: "uppercase",
          fontWeight: 600,
          animation: "splash-fade-in 1200ms ease 600ms both",
        }}
      >
        FIGDITIONS
      </div>
      <style>{`
        @keyframes splash-logo-in {
          0% { opacity: 0; transform: scale(0.6); filter: blur(8px); }
          60% { opacity: 1; transform: scale(1.05); filter: blur(0); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes splash-glow-pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.9); }
          50% { opacity: 0.9; transform: scale(1.15); }
        }
        @keyframes splash-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .splash-logo-wrap {
          position: relative;
          display: grid;
          place-items: center;
          animation: splash-logo-in 1200ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .splash-glow {
          position: absolute;
          inset: -40px;
          border-radius: 50%;
          background: radial-gradient(closest-side, rgba(200,146,42,0.45), rgba(200,146,42,0) 70%);
          animation: splash-glow-pulse 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
