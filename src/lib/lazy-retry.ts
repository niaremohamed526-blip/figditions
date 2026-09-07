import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "fig-chunk-reload";

/**
 * React.lazy with resilience against stale deployments.
 * When a new version is deployed, the HTML cached in the browser may point to
 * JS chunks that no longer exist. In that case we retry once, then force a
 * single hard reload to pick up the fresh build.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const mod = await factory();
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(RELOAD_KEY);
      }
      return mod;
    } catch (err) {
      // second attempt (transient network failure)
      try {
        return await factory();
      } catch {
        if (typeof window !== "undefined") {
          const alreadyReloaded =
            window.sessionStorage.getItem(RELOAD_KEY) === "1";
          if (!alreadyReloaded) {
            window.sessionStorage.setItem(RELOAD_KEY, "1");
            window.location.reload();
            // never resolves; the page is reloading
            return await new Promise<{ default: T }>(() => {});
          }
        }
        throw err;
      }
    }
  });
}
