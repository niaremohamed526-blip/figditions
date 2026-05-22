import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard, BookOpen, PenLine, Package, Wallet, FileText, Settings, LogOut, Menu, X, Calculator, Lock, Factory,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile, type AppRole } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { planFor } from "@/lib/plans";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: AppRole[];
  feature?: "contrats" | "finances";
};

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard, roles: ["admin", "editeur", "comptable", "commercial"] },
  { to: "/manuscrits", label: "Manuscrits", icon: BookOpen, roles: ["admin", "editeur"] },
  { to: "/auteurs", label: "Auteurs", icon: PenLine, roles: ["admin", "editeur"] },
  { to: "/stocks", label: "Stocks", icon: Package, roles: ["admin", "commercial"] },
  { to: "/estimateur", label: "Estimateur", icon: Calculator, roles: ["admin", "editeur"] },
  { to: "/imprimeries", label: "Imprimeries", icon: Factory, roles: ["admin", "editeur", "comptable", "commercial"] },
  { to: "/finances", label: "Finances", icon: Wallet, roles: ["admin", "comptable"], feature: "finances" },
  { to: "/contrats", label: "Contrats", icon: FileText, roles: ["admin"], feature: "contrats" },
  { to: "/parametres", label: "Paramètres", icon: Settings, roles: ["admin"] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { profile, entreprise } = useProfile(user?.id);
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

  const initial = (profile?.full_name || user?.email || "?").charAt(0).toUpperCase();

  const renderLink = (n: typeof items[number], onClick?: () => void) => {
    const active = path === n.to || path.startsWith(n.to + "/");
    const Icon = n.icon;
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
        <span className="flex-1">{n.label}</span>
        {n.locked && <Lock className="h-3.5 w-3.5 text-[color:var(--gold)]" />}
      </Link>
    );
  };

  return (
    <div className="min-h-screen gradient-bg flex">
      <aside className="hidden md:flex w-64 flex-col bg-sidebar border-r border-border sticky top-0 h-screen">
        <div className="px-3 py-5 border-b border-border">
          <Link to="/dashboard" className="block">
            <Logo className="h-16 w-full" />
          </Link>
        </div>
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {items.map((n) => renderLink(n))}
        </nav>
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile?.full_name || "Utilisateur"}</p>
              <p className="text-xs text-muted-foreground truncate">{entreprise?.nom}</p>
            </div>
            <button onClick={handleLogout} className="text-muted-foreground hover:text-foreground" title="Déconnexion">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-sidebar/95 backdrop-blur border-b border-border h-14 flex items-center justify-between px-4">
        <Link to="/dashboard"><Logo className="h-10 w-auto" /></Link>
        <button onClick={() => setMobileOpen((o) => !o)} className="p-2">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-14 z-20 bg-background/95 backdrop-blur p-4 animate-fade-in overflow-y-auto">
          <nav className="space-y-1">
            {items.map((n) => renderLink(n, () => setMobileOpen(false)))}
            <button onClick={handleLogout} className="w-full flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium hover:bg-sidebar-accent text-left">
              <LogOut className="h-4 w-4" /> Déconnexion
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
