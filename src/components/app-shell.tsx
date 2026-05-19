import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard, BookOpen, PenLine, Package, Wallet, FileText, Settings, LogOut, Menu, X, Calculator,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";

const NAV = [
  { to: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/manuscrits", label: "Manuscrits", icon: BookOpen },
  { to: "/auteurs", label: "Auteurs", icon: PenLine },
  { to: "/stocks", label: "Stocks", icon: Package },
  { to: "/estimateur", label: "Estimateur", icon: Calculator },
  { to: "/finances", label: "Finances", icon: Wallet },
  { to: "/contrats", label: "Contrats", icon: FileText },
  { to: "/parametres", label: "Paramètres", icon: Settings },
] as const;

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

  const initial = (profile?.full_name || user?.email || "?").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen gradient-bg flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar border-r border-border sticky top-0 h-screen">
        <div className="px-3 py-5 border-b border-border">
          <Link to="/dashboard" className="block">
            <Logo className="h-16 w-full" />
          </Link>
        </div>
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = path === to || path.startsWith(to + "/");
            return (
              <Link key={to} to={to}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                )}>
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r bg-primary shadow-[0_0_12px_var(--color-primary)]" />
                )}
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </Link>
            );
          })}
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

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-sidebar/95 backdrop-blur border-b border-border h-14 flex items-center justify-between px-4">
        <Link to="/dashboard"><Logo className="h-10 w-auto" /></Link>
        <button onClick={() => setMobileOpen((o) => !o)} className="p-2">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-14 z-20 bg-background/95 backdrop-blur p-4 animate-fade-in">
          <nav className="space-y-1">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium hover:bg-sidebar-accent">
                <Icon className="h-4 w-4" /> {label}
              </Link>
            ))}
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
