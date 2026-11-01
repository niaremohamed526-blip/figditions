// App theme (light / dark / follow the device). Only the logged-in app
// switches: the public site stays dark, it is designed around a dark hero.

export type ThemePref = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const KEY = "figditions-theme";
// Until the light theme has been reviewed on every page, nobody is switched
// without choosing it. Change to "system" to follow the device by default.
export const DEFAULT_THEME: ThemePref = "dark";

export function readThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch { /* storage blocked */ }
  return DEFAULT_THEME;
}

export function writeThemePref(p: ThemePref) {
  try { localStorage.setItem(KEY, p); } catch { /* storage blocked */ }
}

export function resolveTheme(p: ThemePref): ResolvedTheme {
  if (p !== "system") return p;
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyTheme(t: ResolvedTheme) {
  const el = document.documentElement;
  el.classList.toggle("light", t === "light");
  el.style.colorScheme = t;
}

/** Public pages that always stay dark (must match the inline boot script). */
const PUBLIC_PATHS = ["/", "/login", "/signup", "/a-propos", "/conditions-utilisation", "/politique-de-confidentialite",
  "/mentions-legales", "/mot-de-passe-oublie", "/reinitialiser-mot-de-passe"];
const PUBLIC_PREFIXES = ["/lecture/", "/rejoindre/"];

/**
 * Runs in <head> before the page paints, so an app page opened directly in
 * light mode doesn't flash dark first.
 */
export const THEME_BOOT_JS = `(function(){try{var p=location.pathname;var pub=${JSON.stringify(PUBLIC_PATHS)}.indexOf(p)>=0||${JSON.stringify(PUBLIC_PREFIXES)}.some(function(x){return p.indexOf(x)===0});if(pub)return;var v=localStorage.getItem(${JSON.stringify(KEY)})||${JSON.stringify(DEFAULT_THEME)};var light=v==="light"||(v==="system"&&window.matchMedia&&matchMedia("(prefers-color-scheme: light)").matches);if(light){document.documentElement.classList.add("light");document.documentElement.style.colorScheme="light";}}catch(e){}})();`;
