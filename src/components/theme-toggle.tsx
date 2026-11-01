import { useEffect, useState } from "react";
import { Monitor, Moon, Sun, Check } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/hooks/use-i18n";
import {
  applyTheme, readThemePref, resolveTheme, writeThemePref,
  type ResolvedTheme, type ThemePref,
} from "@/lib/theme";

const CHANGE_EVENT = "figditions-theme-change";

/**
 * Applies the chosen theme while the app is mounted and goes back to dark
 * when leaving it (the public site is always dark).
 */
export function useAppTheme() {
  const [pref, setPref] = useState<ThemePref>(() =>
    typeof window === "undefined" ? "dark" : readThemePref(),
  );

  useEffect(() => {
    const sync = () => applyTheme(resolveTheme(pref));
    sync();
    const mq = window.matchMedia?.("(prefers-color-scheme: light)");
    if (pref === "system") mq?.addEventListener("change", sync);
    return () => mq?.removeEventListener("change", sync);
  }, [pref]);

  useEffect(() => {
    const onChange = () => setPref(readThemePref());
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      applyTheme("dark");
    };
  }, []);

  return pref;
}

function choose(p: ThemePref) {
  writeThemePref(p);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Theme currently on <html>, for components that need it (e.g. toasts). */
export function useHtmlTheme(): ResolvedTheme {
  const [t, setT] = useState<ResolvedTheme>("dark");
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setT(el.classList.contains("light") ? "light" : "dark");
    read();
    const obs = new MutationObserver(read);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return t;
}

export function ThemeToggle({ pref }: { pref: ThemePref }) {
  const { t } = useI18n();
  const options: { value: ThemePref; label: string; icon: typeof Sun }[] = [
    { value: "light", label: t("Clair", "Light"), icon: Sun },
    { value: "dark", label: t("Sombre", "Dark"), icon: Moon },
    { value: "system", label: t("Comme l'appareil", "Match device"), icon: Monitor },
  ];
  const Current = resolveTheme(pref) === "light" ? Sun : Moon;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="text-muted-foreground hover:text-foreground p-1 rounded-md"
        title={t("Apparence", "Appearance")}
        aria-label={t("Apparence", "Appearance")}
      >
        <Current className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top">
        {options.map((o) => (
          <DropdownMenuItem key={o.value} onSelect={() => choose(o.value)} className="gap-2">
            <o.icon className="h-4 w-4" />
            <span className="flex-1">{o.label}</span>
            {pref === o.value && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
