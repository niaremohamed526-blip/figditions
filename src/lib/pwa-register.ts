// Guarded service worker registration.
// - Never registers in dev, Lovable preview, iframes, or with ?sw=off
// - Unregisters any stale /sw.js in those contexts to avoid caching bugs

const APP_SW_PATH = "/sw.js?v=20260821-medmo-v2";

function isPreviewOrDevHost(): boolean {
  if (typeof window === "undefined") return true;
  const h = window.location.hostname;
  return (
    h.startsWith("id-preview--") ||
    h.startsWith("preview--") ||
    h === "lovableproject.com" ||
    h.endsWith(".lovableproject.com") ||
    h === "lovableproject-dev.com" ||
    h.endsWith(".lovableproject-dev.com") ||
    h === "beta.lovable.dev" ||
    h.endsWith(".beta.lovable.dev") ||
    h === "localhost" ||
    h === "127.0.0.1"
  );
}

function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

async function unregisterAppSw() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) {
      const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
      if (new URL(url).pathname === "/sw.js") await r.unregister();
    }
  } catch {
    /* ignore */
  }
}

export async function registerPwa() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const url = new URL(window.location.href);
  if (url.searchParams.get("sw") === "off") {
    await unregisterAppSw();
    return;
  }

  if (!import.meta.env.PROD || isInIframe() || isPreviewOrDevHost()) {
    await unregisterAppSw();
    return;
  }

  try {
    let reloadingForUpdate = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloadingForUpdate) return;
      reloadingForUpdate = true;
      window.location.reload();
    });

    const registration = await navigator.serviceWorker.register(APP_SW_PATH, {
      scope: "/",
      updateViaCache: "none",
    });
    await registration.update();

    // Installed PWAs often stay open for days. Re-check periodically and
    // whenever the user returns online or brings the app back to the front.
    const checkForUpdate = () => void registration.update().catch(() => undefined);
    window.setInterval(checkForUpdate, 60 * 60 * 1000);
    window.addEventListener("online", checkForUpdate);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") checkForUpdate();
    });
  } catch (err) {
    console.warn("[PWA] Service worker registration failed:", err);
  }
}
