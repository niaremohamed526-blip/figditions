/**
 * Install FIGDITIONS as an app. Chrome, Edge and Android fire
 * `beforeinstallprompt` early, often before React mounts, so it is caught
 * here at import time and kept for the install button.
 */
import { useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type Plateforme = "ios" | "android" | "mac-safari" | "desktop";

let invite: InstallPromptEvent | null = null;
let installee = false;
const abonnes = new Set<() => void>();
const prevenir = () => abonnes.forEach((f) => f());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    invite = e as InstallPromptEvent;
    prevenir();
  });
  window.addEventListener("appinstalled", () => {
    invite = null;
    installee = true;
    prevenir();
  });
}

function dejaInstallee(): boolean {
  if (typeof window === "undefined") return false;
  return installee
    || window.matchMedia?.("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function plateforme(): Plateforme {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua)) return "mac-safari";
  return "desktop";
}

export function usePwaInstall() {
  const [, setTick] = useState(0);
  const [pret, setPret] = useState(false);
  useEffect(() => {
    const f = () => setTick((n) => n + 1);
    abonnes.add(f);
    setPret(true);
    return () => { abonnes.delete(f); };
  }, []);

  return {
    /** False during server render: nothing install-related is shown then. */
    pret,
    installee: pret && dejaInstallee(),
    /** The browser can install in one click. */
    direct: pret && !!invite,
    plateforme: pret ? plateforme() : ("desktop" as Plateforme),
    /** Opens the browser's install window. Returns true if the user accepted. */
    installer: async () => {
      if (!invite) return false;
      const e = invite;
      await e.prompt();
      const { outcome } = await e.userChoice;
      invite = null;
      if (outcome === "accepted") installee = true;
      prevenir();
      return outcome === "accepted";
    },
  };
}
