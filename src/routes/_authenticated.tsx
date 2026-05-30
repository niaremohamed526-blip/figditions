import { createFileRoute, Outlet, Navigate, useRouterState } from "@tanstack/react-router";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { AppShell } from "@/components/app-shell";
import { CommandPalette } from "@/components/command-palette";
import { AccessDenied } from "@/components/access-denied";
import { canAccessPath } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading } = useAuth();
  const { profile, entreprise, loading: profileLoading } = useProfile(user?.id);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (loading || (user && profileLoading)) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;

  const isAdmin = profile?.role === "admin";
  const allowed = canAccessPath(pathname, profile?.permissions, isAdmin);

  // Find admin email for "Contacter l'administrateur"
  const adminEmail = entreprise?.email ?? null;

  return (
    <AppShell>
      <CommandPalette />
      <div key={pathname} className="animate-page-in">
        {allowed ? <Outlet /> : <AccessDenied pathname={pathname} adminEmail={adminEmail} />}
      </div>
    </AppShell>
  );
}
