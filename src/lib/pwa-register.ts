// Guarded service worker registration.
// - Never registers in dev, Lovable preview, iframes, or with ?sw=off
// - Unregisters any stale /sw.js in those contexts to avoid caching bugs

const APP_SW_PATH = "/sw.js";

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
      if (url.endsWith(APP_SW_PATH)) await r.unregister();
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
    // vite-plugin-pwa emits /sw.js at build time
    await navigator.serviceWorker.register(APP_SW_PATH, { scope: "/" });
  } catch (err) {
    console.warn("[PWA] Service worker registration failed:", err);
  }
}
