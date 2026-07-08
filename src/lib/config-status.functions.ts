import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EnvCheck = {
  name: string;
  present: boolean;
  required: boolean;
  description: string;
  usedFor: string[];
};

/**
 * Admin-only: report which server env vars are configured on the current
 * runtime (Vercel, Cloudflare, Lovable Cloud, etc.). Values are never
 * returned — only a boolean presence flag.
 */
export const checkConfigStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Admin gate
    const { data: me } = await context.supabase
      .from("profiles")
      .select("role")
      .eq("id", context.userId)
      .single();
    if (!me || me.role !== "admin") {
      throw new Error("Réservé à l'administrateur");
    }

    const has = (v: string | undefined) => typeof v === "string" && v.length > 0;

    const checks: EnvCheck[] = [
      {
        name: "SUPABASE_URL",
        present: has(process.env.SUPABASE_URL),
        required: true,
        description: "URL de votre backend Lovable Cloud (Supabase).",
        usedFor: ["Toutes les opérations serveur"],
      },
      {
        name: "SUPABASE_PUBLISHABLE_KEY",
        present: has(process.env.SUPABASE_PUBLISHABLE_KEY),
        required: true,
        description: "Clé publique (anon) utilisée pour les requêtes authentifiées côté serveur.",
        usedFor: ["Middleware d'authentification", "Lecture publique"],
      },
      {
        name: "SUPABASE_SERVICE_ROLE_KEY",
        present: has(process.env.SUPABASE_SERVICE_ROLE_KEY),
        required: false,
        description: "Clé d'administration (bypass RLS). Nécessaire pour certaines actions privilégiées.",
        usedFor: [
          "Suppression d'un membre (auth.admin.deleteUser)",
          "Lecture publique d'une invitation par lien",
          "Webhooks PayDunya",
          "Rappels automatiques (cron)",
          "Partage sécurisé de PDF",
        ],
      },
      {
        name: "APP_URL",
        present: has(process.env.APP_URL),
        required: true,
        description: "URL publique de votre site (utilisée pour les liens dans les emails et redirections).",
        usedFor: ["Liens d'invitation", "Redirections de paiement"],
      },
      {
        name: "CRON_SECRET",
        present: has(process.env.CRON_SECRET),
        required: false,
        description: "Secret partagé pour authentifier les appels cron externes.",
        usedFor: ["Endpoint /api/public/hooks/check-reminders"],
      },
      {
        name: "PAYDUNYA_MASTER_KEY",
        present: has(process.env.PAYDUNYA_MASTER_KEY),
        required: false,
        description: "Clé maître PayDunya (paiements).",
        usedFor: ["Paiement d'abonnement"],
      },
      {
        name: "PAYDUNYA_PRIVATE_KEY",
        present: has(process.env.PAYDUNYA_PRIVATE_KEY),
        required: false,
        description: "Clé privée PayDunya.",
        usedFor: ["Paiement d'abonnement"],
      },
      {
        name: "PAYDUNYA_TOKEN",
        present: has(process.env.PAYDUNYA_TOKEN),
        required: false,
        description: "Token PayDunya.",
        usedFor: ["Paiement d'abonnement"],
      },
      {
        name: "PAYDUNYA_MODE",
        present: has(process.env.PAYDUNYA_MODE),
        required: false,
        description: "Mode PayDunya (test / live).",
        usedFor: ["Paiement d'abonnement"],
      },
      {
        name: "CLOUDCONVERT_API_KEY",
        present: has(process.env.CLOUDCONVERT_API_KEY),
        required: false,
        description: "Clé CloudConvert pour la conversion de manuscrits en ebook.",
        usedFor: ["Module Conversions"],
      },
      {
        name: "LOVABLE_API_KEY",
        present: has(process.env.LOVABLE_API_KEY),
        required: false,
        description: "Clé Lovable AI Gateway.",
        usedFor: ["Fonctionnalités IA"],
      },
    ];

    // Detect runtime hints
    const runtimeHints = {
      isVercel: has(process.env.VERCEL) || has(process.env.VERCEL_ENV),
      isCloudflare: has(process.env.CF_PAGES) || has(process.env.CLOUDFLARE_ENV),
      nodeEnv: process.env.NODE_ENV ?? null,
    };

    return {
      checks,
      runtimeHints,
      generatedAt: new Date().toISOString(),
    };
  });
