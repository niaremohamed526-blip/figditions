import { Link } from "@tanstack/react-router";
import { Lock, Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pageLabel, permissionForPath } from "@/lib/permissions";

interface Props {
  pathname: string;
  adminEmail?: string | null;
}

export function AccessDenied({ pathname, adminEmail }: Props) {
  const key = permissionForPath(pathname);
  const requested = key ? pageLabel(key) : pathname;

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center space-y-6 animate-[fade-up_0.5s_ease-out_both]">
        <div className="mx-auto h-24 w-24 rounded-3xl bg-[color:var(--gold)]/15 text-[color:var(--gold)] flex items-center justify-center animate-[pulse_2.5s_ease-in-out_infinite]">
          <Lock className="h-12 w-12" />
        </div>

        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Accès restreint</h1>
          <p className="mt-2 text-muted-foreground">
            Vous n'avez pas les permissions nécessaires pour accéder à cette page.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          Cette section est réservée aux membres autorisés par l'administrateur de votre maison d'édition.
        </div>

        <p className="text-xs text-muted-foreground">
          Page demandée : <span className="font-medium text-foreground">{requested}</span>
        </p>

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          {adminEmail && (
            <a href={`mailto:${adminEmail}?subject=Demande d'accès : ${requested}`}>
              <Button variant="outline" className="w-full sm:w-auto">
                <Mail className="h-4 w-4" /> Contacter l'administrateur
              </Button>
            </a>
          )}
          <Link to="/dashboard">
            <Button className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
              <ArrowLeft className="h-4 w-4" /> Retourner au tableau de bord
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
