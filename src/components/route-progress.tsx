import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";

/** Thin top progress bar that animates during route transitions. */
export function RouteProgress() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    const unsubBefore = router.subscribe("onBeforeNavigate", () => {
      setVisible(true);
      setProgress(10);
      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        setProgress((p) => (p < 80 ? p + Math.random() * 8 : p));
      }, 200);
    });

    const unsubAfter = router.subscribe("onResolved", () => {
      if (timer) clearInterval(timer);
      setProgress(100);
      hideTimer = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 250);
    });

    return () => {
      unsubBefore();
      unsubAfter();
      if (timer) clearInterval(timer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [router]);

  return (
    <div
      aria-hidden
      className="fixed top-0 left-0 right-0 z-[100] h-[2px] pointer-events-none"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 200ms" }}
    >
      <div
        className="h-full bg-primary"
        style={{
          width: `${progress}%`,
          transition: "width 200ms ease-out",
          boxShadow: "0 0 8px var(--color-primary)",
        }}
      />
    </div>
  );
}
