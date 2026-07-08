import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw, Info, ExternalLink, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { checkConfigStatus, type EnvCheck } from "@/lib/config-status.functions";

interface StatusData {
  checks: EnvCheck[];
  runtimeHints: { isVercel: boolean; isCloudflare: boolean; nodeEnv: string | null };
  generatedAt: string;
}

export function ConfigStatusSection() {
  const runCheck = useServerFn(checkConfigStatus);
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await runCheck();
      setData(result as StatusData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(text);
    toast.success("Copié");
    setTimeout(() => setCopied(null), 1500);
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          <span className="font-medium">{error}</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const requiredMissing = data.checks.filter((c) => c.required && !c.present);
  const optionalMissing = data.checks.filter((c) => !c.required && !c.present);
  const serviceRoleMissing = data.checks.find((c) => c.name === "SUPABASE_SERVICE_ROLE_KEY" && !c.present);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              Statut de configuration
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Vérifie que toutes les variables d'environnement nécessaires sont configurées sur le serveur.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-2" /> Rafraîchir
          </Button>
        </div>

        {/* Summary badges */}
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${
            requiredMissing.length === 0
              ? "bg-emerald-500/15 text-emerald-500"
              : "bg-destructive/15 text-destructive"
          }`}>
            {requiredMissing.length === 0 ? <Check className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {requiredMissing.length === 0 ? "Toutes les variables requises sont présentes" : `${requiredMissing.length} variable(s) requise(s) manquante(s)`}
          </span>
          {optionalMissing.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 bg-amber-500/15 text-amber-500">
              <AlertTriangle className="h-3 w-3" />
              {optionalMissing.length} optionnelle(s) manquante(s)
            </span>
          )}
          {data.runtimeHints.isVercel && (
            <span className="inline-flex items-center rounded-full px-3 py-1 bg-primary/15 text-primary">
              Runtime: Vercel
            </span>
          )}
          {data.runtimeHints.isCloudflare && (
            <span className="inline-flex items-center rounded-full px-3 py-1 bg-primary/15 text-primary">
              Runtime: Cloudflare
            </span>
          )}
        </div>
      </div>

      {/* Service role warning */}
      {serviceRoleMissing && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-500">
                SUPABASE_SERVICE_ROLE_KEY manquante
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Cette clé permet aux fonctions serveur d'effectuer des opérations privilégiées.
                La plupart des fonctions courantes (créer un membre, gérer les permissions) fonctionnent
                sans elle, mais certaines actions resteront indisponibles :
              </p>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground list-disc pl-5">
                {serviceRoleMissing.usedFor.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </div>
          </div>

          {data.runtimeHints.isVercel ? (
            <div className="rounded-lg bg-card border border-border p-4 space-y-3">
              <p className="text-sm font-medium">Configuration sur Vercel (étape par étape) :</p>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal pl-5">
                <li>Ouvrez votre projet sur <a className="text-primary underline" href="https://vercel.com/dashboard" target="_blank" rel="noreferrer">Vercel Dashboard <ExternalLink className="h-3 w-3 inline" /></a></li>
                <li>Allez dans <b>Settings → Environment Variables</b></li>
                <li>Ajoutez une nouvelle variable :
                  <div className="mt-2 flex items-center gap-2">
                    <code className="rounded bg-muted px-2 py-1 text-xs">SUPABASE_SERVICE_ROLE_KEY</code>
                    <button
                      onClick={() => copy("SUPABASE_SERVICE_ROLE_KEY")}
                      className="text-primary hover:opacity-80"
                      aria-label="Copier"
                    >
                      {copied === "SUPABASE_SERVICE_ROLE_KEY" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                </li>
                <li>Récupérez la valeur depuis <b>Lovable → View Backend → API keys</b> (clé <code className="text-xs">service_role</code>)</li>
                <li>Cochez <b>Production</b>, <b>Preview</b> et <b>Development</b></li>
                <li>Redéployez : <b>Deployments → dernière → ⋯ → Redeploy</b></li>
              </ol>
            </div>
          ) : (
            <div className="rounded-lg bg-card border border-border p-4">
              <p className="text-sm text-muted-foreground">
                Ajoutez la variable <code className="text-xs bg-muted px-1.5 py-0.5 rounded">SUPABASE_SERVICE_ROLE_KEY</code> dans
                les variables d'environnement de votre hébergeur, puis redéployez le site.
              </p>
            </div>
          )}
        </div>
      )}

      {/* All checks */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="font-semibold">Détail des variables</h3>
        </div>
        <div className="divide-y divide-border">
          {data.checks.map((c) => (
            <div key={c.name} className="p-4 sm:p-6 flex items-start gap-4">
              <div className="flex-shrink-0 mt-0.5">
                {c.present ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : c.required ? (
                  <XCircle className="h-5 w-5 text-destructive" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-sm font-mono font-medium">{c.name}</code>
                  <span className={`text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 ${
                    c.required ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                  }`}>
                    {c.required ? "Requise" : "Optionnelle"}
                  </span>
                  <span className={`text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 ${
                    c.present
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-destructive/15 text-destructive"
                  }`}>
                    {c.present ? "Configurée" : "Manquante"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{c.description}</p>
                {c.usedFor.length > 0 && (
                  <p className="text-xs text-muted-foreground/80 mt-1.5">
                    <span className="font-medium">Utilisée pour :</span> {c.usedFor.join(" · ")}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Dernière vérification : {new Date(data.generatedAt).toLocaleString("fr-FR")}
      </p>
    </div>
  );
}
