import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard, BookOpen, PenLine, Package, Wallet, FileText, Settings, Calculator, Factory, LogOut,
} from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { supabase } from "@/integrations/supabase/client";

type Item = { to?: string; labelFr: string; labelEn: string; icon: typeof LayoutDashboard; action?: () => void | Promise<void> };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { lang, t } = useI18n();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const nav: Item[] = [
    { to: "/dashboard", labelFr: "Tableau de bord", labelEn: "Dashboard", icon: LayoutDashboard },
    { to: "/manuscrits", labelFr: "Manuscrits", labelEn: "Manuscripts", icon: BookOpen },
    { to: "/auteurs", labelFr: "Auteurs", labelEn: "Authors", icon: PenLine },
    { to: "/stocks", labelFr: "Stocks", labelEn: "Stock", icon: Package },
    { to: "/estimateur", labelFr: "Estimateur", labelEn: "Estimator", icon: Calculator },
    { to: "/imprimeries", labelFr: "Imprimeries", labelEn: "Printers", icon: Factory },
    { to: "/finances", labelFr: "Finances", labelEn: "Finances", icon: Wallet },
    { to: "/contrats", labelFr: "Contrats", labelEn: "Contracts", icon: FileText },
    { to: "/parametres", labelFr: "Paramètres", labelEn: "Settings", icon: Settings },
  ];

  const actions: Item[] = [
    {
      labelFr: "Déconnexion", labelEn: "Sign out", icon: LogOut,
      action: async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); },
    },
  ];

  const run = (item: Item) => {
    setOpen(false);
    if (item.to) navigate({ to: item.to });
    else item.action?.();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={t("Rechercher une page, une action…", "Search pages, actions…")} />
      <CommandList>
        <CommandEmpty>{t("Aucun résultat.", "No results.")}</CommandEmpty>
        <CommandGroup heading={t("Navigation", "Navigation")}>
          {nav.map((item) => (
            <CommandItem key={item.to} value={`${item.labelFr} ${item.labelEn}`} onSelect={() => run(item)}>
              <item.icon className="mr-2 h-4 w-4" />
              <span>{lang === "fr" ? item.labelFr : item.labelEn}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading={t("Actions", "Actions")}>
          {actions.map((item) => (
            <CommandItem key={item.labelFr} value={`${item.labelFr} ${item.labelEn}`} onSelect={() => run(item)}>
              <item.icon className="mr-2 h-4 w-4" />
              <span>{lang === "fr" ? item.labelFr : item.labelEn}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
