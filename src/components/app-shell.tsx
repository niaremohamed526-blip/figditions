import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard, BookOpen, PenLine, Package, Wallet, FileText, Settings, LogOut, Menu, X, Calculator, Lock, Factory,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile, type AppRole } from "@/hooks/use-auth";
import { useI18n, type Lang } from "@/hooks/use-i18n";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { planFor } from "@/lib/plans";

type NavItem = {
  to: string;
  labelFr: string;
  labelEn: string;
  icon: typeof LayoutDashboard;
  roles: AppRole[];
  feature?: "contrats" | "finances";
};

const NAV: NavItem[] = [
  { to: "/dashboard", labelFr: "Tableau de bord", labelEn: "Dashboard", icon: LayoutDashboard, roles: ["admin", "editeur", "comptable", "commercial"] },
  { to: "/manuscrits", labelFr: "Manuscrits", labelEn: "Manuscripts", icon: BookOpen, roles: ["admin", "editeur"] },
  { to: "/auteurs", labelFr: "Auteurs", labelEn: "Authors", icon: PenLine, roles: ["admin", "editeur"] },
  { to: "/stocks", labelFr: "Stocks", labelEn: "Stock Tracking", icon: Package, roles: ["admin", "commercial"] },
  { to: "/estimateur", labelFr: "Estimateur", labelEn: "Cost Estimator", icon: Calculator, roles: ["admin", "editeur"] },
  { to: "/imprimeries", labelFr: "Imprimeries", labelEn: "Print Directory", icon: Factory, roles: ["admin", "editeur", "comptable", "commercial"] },
  { to: "/finances", labelFr: "Finances", labelEn: "Finances", icon: Wallet, roles: ["admin", "comptable"], feature: "finances" },
  { to: "/contrats", labelFr: "Contrats", labelEn: "Contracts", icon: FileText, roles: ["admin"], feature: "contrats" },
  { to: "/parametres", labelFr: "Paramètres", labelEn: "Settings", icon: Settings, roles: ["admin"] },
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const role: AppRole = profile?.role ?? "admin";
  const plan = planFor(entreprise?.plan);
  const items = NAV
    .filter((n) => n.roles.includes(role))
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

  return (
    <div className="min-h-screen gradient-bg flex">
      <aside className="hidden md:flex w-64 flex-col bg-sidebar border-r border-border sticky top-0 h-screen">
        <div className="px-3 py-5 border-b border-border flex items-center justify-between gap-2">
          <Link to="/dashboard" className="block flex-1 min-w-0">
            <Logo className="h-12 w-full" />
          </Link>
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

      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-sidebar/95 backdrop-blur border-b border-border h-14 flex items-center justify-between px-4 gap-2">
        <Link to="/dashboard"><Logo className="h-10 w-auto" /></Link>
        <div className="flex items-center gap-2">
          <LangToggle lang={lang} setLang={setLang} />
          <button onClick={() => setMobileOpen((o) => !o)} className="p-2">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-14 z-20 bg-background/95 backdrop-blur p-4 animate-fade-in overflow-y-auto">
          <nav className="space-y-1">
            {items.map((n) => renderLink(n, () => setMobileOpen(false)))}
            <button onClick={handleLogout} className="w-full flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium hover:bg-sidebar-accent text-left">
              <LogOut className="h-4 w-4" /> {t("Déconnexion", "Logout")}
            </button>
          </nav>
        </div>
      )}

      <main className="flex-1 min-w-0 pt-14 md:pt-0">
        <div className="px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
