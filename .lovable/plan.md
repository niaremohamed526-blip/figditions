# FIGDITIONS — Audit & interconnexion complète

Cette opération est très large (11 chantiers, ~25 fichiers touchés). Je propose de la livrer en **4 phases atomiques**, validées une par une, plutôt que tout en un seul commit risqué.

## Phase 1 — Fondations temps réel & état global

1. **Realtime Supabase** : activer la publication sur `manuscrits`, `auteurs`, `contrats`, `stocks`, `stock_interne`, `mouvements_stock`, `ventes`, `abonnements`, `paiements`, `notifications` (via migration `ALTER PUBLICATION supabase_realtime ADD TABLE ...` + `REPLICA IDENTITY FULL`).
2. **Contexte global** `AppStateProvider` (React Context + React Query) exposant : `user`, `entreprise` (plan live), `stats` (compteurs dashboard), `notifications`. Monté dans `_authenticated.tsx`.
3. **Hook `useRealtimeInvalidate`** : un seul channel par table → invalide les `queryKey` correspondantes. Évite la duplication d'abonnements.
4. Migration des pages existantes (dashboard, manuscrits, auteurs, stocks, finances, contrats, parametres) vers `useQuery` avec `queryKey` standardisées (`['manuscrits', entrepriseId]`, etc.).

## Phase 2 — Cascades métier (triggers Postgres)

Plutôt qu'orchestrer côté client (fragile), j'implémente les règles critiques en **triggers SQL** — atomiques par construction :

- `trg_manuscrit_publie` : à `UPDATE statut='publie'`, crée `stock_interne` si absent.
- `trg_mouvement_transfert` : sur `INSERT mouvements_stock type='transfert'`, décrémente `stock_interne.quantite_disponible`, upsert `stocks` (destination), incrémente `exemplaires_deposes`.
- `trg_mouvement_retour` : effet inverse.
- `trg_stock_vente` : sur `UPDATE stocks.exemplaires_vendus` (delta>0), `INSERT ventes` avec prix, qté, droits = pourcentage contrat ou 10%.
- `trg_stock_interne_vente_directe` : idem sur `quantite_vendue_directement`.
- `trg_manuscrit_delete` : `auteur_id`/`manuscrit_id` orphelins → flag `est_orphelin` (nouvelles colonnes nullables sur `contrats`, `stocks`, `ventes`).
- `trg_auteur_delete` : `manuscrits.auteur_id = NULL`.
- Fonction `pourcentage_droits_pour(manuscrit_id, auteur_id)` lue par `trg_stock_vente`.

Toutes les RLS existantes sont préservées (triggers en `SECURITY DEFINER` avec `search_path=public`).

## Phase 3 — Notifications & feed d'activité

- Nouvelle table `notifications` (id, entreprise_id, type, titre, message, lien, lu, created_at) + RLS scoped `entreprise_id`.
- Nouvelle table `activites` (feed dashboard, 10 derniers événements).
- Triggers : stock bas, vente, contrat signé, royalty payée, manuscrit publié → insèrent dans `notifications` + `activites`.
- Job côté serverFn (appelé au mount du dashboard, throttle 1×/h) : génère les notifs « contrat expirant <30j », « royalty en attente >30j », « abonnement <7j ».
- UI : `<NotificationBell />` dans le navbar (badge non-lu, dropdown, mark-all-read, navigation au clic).

## Phase 4 — Limites de plan & polish

- `usePlanLimits()` lit `entreprise.plan` en live (realtime sur `entreprises`). Vérifie à chaque action critique (ajout manuscrit, librairie, etc.).
- Webhook PayDunya déjà en place → ajoute `entreprises.plan` UPDATE + broadcast realtime → toutes les pages bloquées se débloquent sans refresh.
- Estimateur ↔ stock interne : bouton « Utiliser cette estimation » sur l'estimateur ; bouton « Commander une impression » dans l'alerte stock bas → ouvre estimateur prérempli (query params).
- Toast global `🔄 Données mises à jour automatiquement` débouncé (5s) sur chaque invalidation realtime déclenchée par un autre user/onglet.

## Détails techniques

- **Tables nouvelles** : `notifications`, `activites`.
- **Colonnes nouvelles** : `contrats.est_orphelin`, `stocks.est_orphelin`, `ventes.est_orphelin` (booleans, default false).
- **Fonctions/triggers SQL** : ~10 fonctions PL/pgSQL.
- **Fichiers TSX nouveaux** : `src/lib/app-state.tsx`, `src/hooks/use-realtime.ts`, `src/hooks/use-plan-limits.ts`, `src/components/notification-bell.tsx`, `src/components/activity-feed.tsx`.
- **Fichiers TSX modifiés** : `_authenticated.tsx`, `app-shell.tsx`, `dashboard.tsx`, `manuscrits.*.tsx`, `auteurs.*.tsx`, `stocks.tsx`, `stock-interne.tsx`, `finances.tsx`, `contrats.tsx`, `estimateur.tsx`, `parametres.tsx`.

## Risques & garde-fous

- Les triggers de cascade peuvent **doubler les ventes** si la page écrit elle-même dans `ventes`. Je dois auditer chaque appel `supabase.from('ventes').insert(...)` existant et le **retirer** au profit du trigger. Pareil pour les UPSERT stocks↔stock_interne.
- Realtime sur 10 tables = beaucoup de réseau. Je limite à un canal partagé par table avec filtres `entreprise_id=eq.X`.
- La migration `ALTER PUBLICATION` doit être idempotente (`IF NOT EXISTS` via DO block).

## Question avant de démarrer

Vu l'ampleur, **veux-tu que je livre Phase 1+2 en un commit** (fondations + cascades SQL — la base nécessaire à tout le reste), puis Phase 3 et 4 séparément ? Ou tout d'un coup au risque d'un debug long si quelque chose casse ?
