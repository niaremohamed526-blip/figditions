import { useSyncExternalStore } from "react";

export type Lang = "fr" | "en";
const KEY = "figditions.lang";

let current: Lang = (() => {
  if (typeof window === "undefined") return "fr";
  return ((localStorage.getItem(KEY) as Lang | null) ?? "fr");
})();
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function getSnapshot() { return current; }
function getServerSnapshot(): Lang { return "fr"; }

export function setLang(l: Lang) {
  current = l;
  if (typeof window !== "undefined") localStorage.setItem(KEY, l);
  listeners.forEach((cb) => cb());
}

export function useI18n() {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const t = (fr: string, en: string) => (lang === "fr" ? fr : en);
  return { lang, setLang, t };
}
