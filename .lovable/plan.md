
# Migration Lovable Cloud → Supabase externe (pour Vercel)

Objectif : disposer de la `SUPABASE_SERVICE_ROLE_KEY` et de toutes les cl\u00e9s c\u00f4t\u00e9 Vercel afin que les server functions (conversions EPUB/MOBI, PayDunya, invitations, webhooks, cron) fonctionnent en production.

## \u26a0\ufe0f Avant de d\u00e9marrer — \u00e0 lire

- **Op\u00e9ration longue et risqu\u00e9e** (2–4 h de travail + temps de propagation DNS/emails).
- **Risque de perte de donn\u00e9es** si l'export/import est mal fait. Faire un export complet avant toute action.
- Vous **perdez** : Lovable AI Gateway (LOVABLE_API_KEY), gestion des secrets Lovable, emails auth Lovable, notifications int\u00e9gr\u00e9es. Il faudra les remplacer par des services tiers (OpenAI/Gemini directement, Resend pour emails, etc.).
- Le code utilise `supabaseAdmin` un peu partout : il continuera de fonctionner tel quel une fois la nouvelle `SUPABASE_SERVICE_ROLE_KEY` en place.

## \u00c9tapes (ce que VOUS faites)

1. **Cr\u00e9er le projet Supabase**
   - Aller sur https://supabase.com → New project.
   - R\u00e9gion : Europe (Paris/Frankfurt) pour Mali/Afrique de l'Ouest.
   - Noter : Project URL, `anon` key, `service_role` key, DB password.

2. **Exporter les donn\u00e9es actuelles**
   - Depuis Lovable : Cloud → Advanced settings → Export data. R\u00e9cup\u00e9rer le dump.

3. **Exporter les fichiers des buckets Storage**
   - Buckets \u00e0 sauvegarder : `manuscrits`, `logos`, `conversions`.
   - Je vous fournirai un script Node pour t\u00e9l\u00e9charger tous les fichiers.

## \u00c9tapes (ce que JE fais dans le code)

4. **Pr\u00e9parer les migrations SQL consolid\u00e9es**
   - Extraire tout le sch\u00e9ma actuel (17 tables, fonctions, triggers, RLS, GRANT) dans un fichier `supabase/migrations/` r\u00e9utilisable sur le nouveau projet.
   - Inclure les enums (`app_plan`, etc.), fonctions (`has_role`, `handle_new_user`, `fn_notify`, triggers de cascade…).

5. **Cr\u00e9er un script de r\u00e9-upload Storage**
   - Node script qui lit le dump local et re-uploade dans les nouveaux buckets via `service_role`.
   - Recr\u00e9er les 3 buckets avec les bonnes politiques (public pour `logos`, priv\u00e9 pour `manuscrits` et `conversions`).

6. **Retirer les d\u00e9pendances Lovable Cloud sp\u00e9cifiques**
   - `LOVABLE_API_KEY` : identifier o\u00f9 il est utilis\u00e9 (probablement AI features) et le remplacer par un appel direct \u00e0 Gemini/OpenAI avec cl\u00e9 utilisateur, ou d\u00e9sactiver la feature.
   - Emails auth : basculer vers les templates Supabase natifs (ou Resend) → recr\u00e9er les 6 templates (signup, reset, magic link, email change, invite, reauth).
   - Retirer les r\u00e9f\u00e9rences Lovable dans `src/integrations/` si besoin.

7. **Mettre \u00e0 jour la configuration**
   - `.env.local` + Vercel : `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_*` correspondants, `APP_URL`, `CRON_SECRET`, `PAYDUNYA_*`, `CLOUDCONVERT_API_KEY`.
   - Reconfigurer Google OAuth (nouveau redirect URI dans Google Cloud Console + Supabase Auth Providers).

8. **Reconfigurer les webhooks / cron externes**
   - PayDunya IPN → nouvelle URL Vercel.
   - pg_cron → recr\u00e9er dans le nouveau projet (rappels, etc.).

## \u00c9tapes (validation)

9. **Tester en pr\u00e9-production**
   - Cr\u00e9er un compte de test, upload manuscrit, cr\u00e9er contrat, lancer une conversion EPUB, faire un paiement PayDunya sandbox, tester une invitation.
   - V\u00e9rifier logs Vercel + Supabase.

10. **Basculer le domaine `figditions.xyz`** vers Vercel une fois tout vert.

## D\u00e9cisions n\u00e9cessaires de votre part avant que je code

- **Cl\u00e9 IA** : voulez-vous garder les features IA (si oui, avec quelle cl\u00e9 : OpenAI ? Gemini ?) ou les d\u00e9sactiver temporairement ?
- **Emails** : accepter les templates par d\u00e9faut Supabase (envoy\u00e9s depuis `noreply@mail.app.supabase.io`) pour d\u00e9marrer, puis brancher Resend plus tard ?
- **Vous confirmez avoir fait l'export des donn\u00e9es Lovable Cloud** avant que je commence \u00e0 modifier le code ?

Une fois ces trois points r\u00e9pondus, je passe en mode build et j'ex\u00e9cute les \u00e9tapes 4–7.
