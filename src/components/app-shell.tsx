import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard, BookOpen, PenLine, Package, Wallet, FileText, Settings, LogOut, Menu, X, Calculator, Lock, Factory, RefreshCw, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { useI18n, type Lang } from "@/hooks/use-i18n";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { planFor } from "@/lib/plans";
import { NotificationBell } from "@/components/notification-bell";
import { useRealtimeTable } from "@/hooks/use-realtime";
import { notifyEntrepriseUpdated } from "@/hooks/use-auth";
import type { PermissionKey } from "@/lib/permissions";
import { useChangelog } from "@/hooks/use-changelog";
import { ChangelogPanel } from "@/components/changelog-panel";

type NavItem = {
  to: string;
  labelFr: string;
  labelEn: string;
  icon: typeof LayoutDashboard;
  permission: PermissionKey | "stocks_any";
  feature?: "contrats" | "finances" | "conversions";
};

const NAV: NavItem[] = [
  { to: "/dashboard", labelFr: "Tableau de bord", labelEn: "Dashboard", icon: LayoutDashboard, permission: "dashboard" },
  { to: "/medmo", labelFr: "PR MEDMO", labelEn: "PR MEDMO", icon: Sparkles, permission: "medmo" },
  { to: "/manuscrits", labelFr: "Manuscrits", labelEn: "Manuscripts", icon: BookOpen, permission: "manuscrits" },
  { to: "/auteurs", labelFr: "Auteurs", labelEn: "Authors", icon: PenLine, permission: "auteurs" },
  { to: "/stocks", labelFr: "Stocks", labelEn: "Stock Tracking", icon: Package, permission: "stocks_any" },
  { to: "/estimateur", labelFr: "Estimateur", labelEn: "Cost Estimator", icon: Calculator, permission: "estimateur" },
  { to: "/imprimeries", labelFr: "Imprimeries", labelEn: "Print Directory", icon: Factory, permission: "imprimeries" },
  { to: "/conversions", labelFr: "Conversions", labelEn: "Conversions", icon: RefreshCw, permission: "conversions", feature: "conversions" },
  { to: "/finances", labelFr: "Finances", labelEn: "Finances", icon: Wallet, permission: "finances", feature: "finances" },
  { to: "/contrats", labelFr: "Contrats & Droits", labelEn: "Contracts & Rights", icon: FileText, permission: "contrats", feature: "contrats" },
  { to: "/parametres", labelFr: "Paramètres", labelEn: "Settings", icon: Settings, permission: "parametres" },
];


function LangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="inline-flex rounded-md border border-border bg-background/50 p-0.5 text-xs">
      {(["fr", "en"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={cn(
            "px-2 py-1 rounded-[5px] font-semibold uppercase transition-colors",
            lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { profile, entreprise } = useProfile(user?.id);
  const { t, lang, setLang } = useI18n();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  useRealtimeTable("entreprises", entreprise?.id ?? null, () => {
    notifyEntrepriseUpdated();
  }, "id");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const isAdmin = profile?.role === "admin";
  const perms = profile?.permissions ?? {};
  const plan = planFor(entreprise?.plan);

  const changelog = useChangelog({
    userId: user?.id,
    permissions: profile?.permissions,
    isAdmin,
    ready: !!profile,
  });

  const hasPermission = (n: NavItem) => {
    if (isAdmin) return true;
    if (n.permission === "stocks_any") return !!(perms.stocks_interne || perms.stocks_externe);
    // PR MEDMO predates per-member permissions: visible unless explicitly revoked.
    if (n.permission === "medmo") return perms.medmo !== false;
    return !!perms[n.permission];
  };

  const items = NAV
    .filter(hasPermission)
    .map((n) => ({ ...n, locked: n.feature ? !plan[n.feature] : false }));

  const companyName = entreprise?.nom ?? "";
  const companyInitial = (companyName || profile?.full_name || user?.email || "?").charAt(0).toUpperCase();
  const logoUrl = entreprise?.logo_url ?? null;

  const renderLink = (n: typeof items[number], onClick?: () => void) => {
    const active = path === n.to || path.startsWith(n.to + "/");
    const Icon = n.icon;
    const label = lang === "fr" ? n.labelFr : n.labelEn;
    return (
      <Link key={n.to} to={n.to} onClick={onClick}
        className={cn(
          "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
          active ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent",
          n.locked && "opacity-60",
        )}>
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r bg-primary shadow-[0_0_12px_var(--color-primary)]" />
        )}
        <Icon className="h-4 w-4" />
        <span className="flex-1">{label}</span>
        {n.locked && <Lock className="h-3.5 w-3.5 text-[color:var(--gold)]" />}
      </Link>
    );
  };

  const CompanyAvatar = () => (
    logoUrl ? (
      <img
        src={logoUrl}
        alt={companyName}
        className="h-9 w-9 rounded-lg object-cover bg-transparent"
      />
    ) : (
      <div className="h-9 w-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center font-semibold">
        {companyInitial}
      </div>
    )
  );

  // Mobile bottom tabs: filter by what user can access (max 4 visible)
  const mobileTabsAll = [
    { to: "/dashboard", icon: LayoutDashboard, labelFr: "Accueil", labelEn: "Home", permission: "dashboard" as PermissionKey | "stocks_any" },
    { to: "/manuscrits", icon: BookOpen, labelFr: "Livres", labelEn: "Books", permission: "manuscrits" as PermissionKey | "stocks_any" },
    { to: "/stocks", icon: Package, labelFr: "Stocks", labelEn: "Stocks", permission: "stocks_any" as PermissionKey | "stocks_any" },
    { to: "/finances", icon: Wallet, labelFr: "Finances", labelEn: "Finance", permission: "finances" as PermissionKey | "stocks_any" },
  ];
  const mobileTabs = mobileTabsAll.filter((tab) => {
    if (isAdmin) return true;
    if (tab.permission === "stocks_any") return !!(perms.stocks_interne || perms.stocks_externe);
    return !!perms[tab.permission as PermissionKey];
  });

  return (
    <div className="min-h-screen gradient-bg flex">
      <aside className="hidden md:flex w-64 flex-col bg-sidebar border-r border-border sticky top-0 h-screen">
        <div className="px-3 py-5 border-b border-border flex items-center justify-between gap-2">
          <Link to="/dashboard" className="flex items-center justify-center flex-1 min-w-0">
            <Logo className="h-16 w-auto" />
          </Link>
          <NotificationBell entrepriseId={entreprise?.id} hasUnseenChangelog={changelog.hasUnseen} onOpenChangelog={changelog.openHistory} />
          <LangToggle lang={lang} setLang={setLang} />
        </div>
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {items.map((n) => renderLink(n))}
        </nav>
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3">
            <CompanyAvatar />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{companyName || t("Maison d'édition", "Publisher")}</p>
              <p className="text-xs text-muted-foreground truncate">{profile?.full_name ?? user?.email}</p>
            </div>
            <button onClick={handleLogout} className="text-muted-foreground hover:text-foreground" title={t("Déconnexion", "Logout")}>
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-sidebar/95 backdrop-blur border-b border-border h-14 flex items-center justify-between px-3 gap-2">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-1 rounded-md hover:bg-sidebar-accent"
          aria-label="Menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link to="/dashboard" className="flex-1 flex justify-center">
          <Logo className="h-10 w-auto" />
        </Link>
        <NotificationBell entrepriseId={entreprise?.id} />
        <LangToggle lang={lang} setLang={setLang} />
      </div>

      <div
        className={cn(
          "md:hidden fixed inset-0 z-40 transition-opacity duration-300",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        onClick={() => setMobileOpen(false)}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <aside
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-sidebar border-r border-border flex flex-col transition-transform duration-300 ease-out",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="px-3 py-5 border-b border-border flex items-center justify-between gap-2">
            <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="block flex-1 min-w-0">
              <Logo className="h-10 w-auto" />
            </Link>
            <button onClick={() => setMobileOpen(false)} className="p-2 rounded-md hover:bg-sidebar-accent" aria-label="Fermer">
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {items.map((n) => renderLink(n, () => setMobileOpen(false)))}
          </nav>
          <div className="border-t border-border p-4">
            <div className="flex items-center gap-3">
              <CompanyAvatar />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{companyName || t("Maison d'édition", "Publisher")}</p>
                <p className="text-xs text-muted-foreground truncate">{profile?.full_name ?? user?.email}</p>
              </div>
              <button onClick={handleLogout} className="text-muted-foreground hover:text-foreground" title={t("Déconnexion", "Logout")}>
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-sidebar/95 backdrop-blur border-t border-border h-16 flex items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
        {mobileTabs.map((tab) => {
          const active = path === tab.to || path.startsWith(tab.to + "/");
          const Icon = tab.icon;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{lang === "fr" ? tab.labelFr : tab.labelEn}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMobileOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
          <span>{t("Plus", "More")}</span>
        </button>
      </nav>

      <main className="flex-1 min-w-0 pt-14 md:pt-0 pb-20 md:pb-0">
        <div className="px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
