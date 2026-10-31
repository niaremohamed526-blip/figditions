import { createFileRoute, Outlet, Navigate, useRouterState } from "@tanstack/react-router";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { AppShell } from "@/components/app-shell";
import { CommandPalette } from "@/components/command-palette";
import { AccessDenied } from "@/components/access-denied";
import { BrandLoader } from "@/components/brand-loader";
import { MedmoFab } from "@/components/medmo-fab";
import { canAccessPath } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading } = useAuth();
  const { profile, entreprise, loading: profileLoading, refresh: refreshProfile } = useProfile(user?.id);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (loading || (user && profileLoading)) return <BrandLoader />;
  if (!user) return <Navigate to="/login" />;
  if (!profile) {
    // Profile could not be read (network). Saying "Accès restreint" here would be false.
    return (
      <BrandLoader>
        <div className="max-w-sm text-center space-y-4">
          <p className="text-lg font-semibold">Connexion lente</p>
          <p className="text-sm text-muted-foreground">Nous n'avons pas pu charger votre compte. Vérifiez votre connexion internet puis réessayez.</p>
          <button onClick={() => refreshProfile()} className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Réessayer</button>
        </div>
      </BrandLoader>
    );
  }

  const isAdmin = profile?.role === "admin";
  const allowed = canAccessPath(pathname, profile?.permissions, isAdmin);
  const medmoAllowed = isAdmin || profile?.permissions?.medmo !== false;

  // Find admin email for "Contacter l'administrateur"
  const adminEmail = entreprise?.email ?? null;

  return (
    <AppShell>
      <CommandPalette />
      <div key={pathname} className="animate-page-in">
        {allowed ? <Outlet /> : <AccessDenied pathname={pathname} adminEmail={adminEmail} />}
      </div>
      <MedmoFab
        userId={user.id}
        entrepriseId={profile?.entreprise_id ?? null}
        allowed={medmoAllowed}
      />
    </AppShell>
  );
}
