import { useEffect, useState } from "react";

export type Lang = "fr" | "en";
const KEY = "figditions.lang";

let listeners: Array<(l: Lang) => void> = [];
let current: Lang = "fr";

export function useI18n() {
  const [lang, setLang] = useState<Lang>(current);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = (localStorage.getItem(KEY) as Lang | null) ?? "fr";
    current = stored;
    setLang(stored);
    const onChange = (l: Lang) => setLang(l);
    listeners.push(onChange);
    return () => { listeners = listeners.filter((x) => x !== onChange); };
  }, []);
  const change = (l: Lang) => {
    current = l;
    if (typeof window !== "undefined") localStorage.setItem(KEY, l);
    listeners.forEach((cb) => cb(l));
  };
  const t = (fr: string, en: string) => (lang === "fr" ? fr : en);
  return { lang, setLang: change, t };
}
