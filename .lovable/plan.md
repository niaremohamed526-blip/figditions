# Vérification PayDunya — Plan de test

## Objectif
Confirmer que :
1. La création d'invoice PayDunya fonctionne en mode `test` (sandbox).
2. Le webhook `/api/public/paydunya-webhook` met à jour correctement `abonnements`, `paiements` et **`entreprises.plan` / `max_utilisateurs` / `abonnement_expire_le`**.
3. La protection anti-rejeu (idempotence) tient.

## État actuel (code audité)
- `PAYDUNYA_MASTER_KEY`, `PRIVATE_KEY`, `TOKEN`, `MODE` présents dans les secrets serveur.
- `createPaymentInvoice` (serverFn) : gate admin + insert `abonnements` + `paiements` (statut `en_attente`).
- `paydunya-webhook` POST : ré-confirme via API PayDunya (source de vérité), idempotent, met à jour les 3 tables.
- `guard_entreprises_sensitive_fields` autorise `service_role` → l'update du plan passera.

## Étapes de vérification

### 1. Smoke test du endpoint webhook (publié)
- `POST /api/public/paydunya-webhook` sans token → attendu **400 "Missing token"**.
- `GET` → **200 "PayDunya webhook endpoint"**.
Confirme que la route est bien déployée et joignable depuis l'extérieur (URL stable PayDunya pourra appeler).

### 2. Création d'une vraie invoice sandbox via la serverFn
Depuis une session admin (Playwright sur le preview) :
- Aller dans `/parametres` onglet plan, cliquer "Upgrader vers Pro mensuel".
- Vérifier : insert dans `abonnements` (statut `en_attente`, `paydunya_token` rempli), redirection vers `paydunya.com/sandbox-checkout/invoice/<token>`.

### 3. Simulation du callback IPN
Au lieu de payer manuellement dans le sandbox (long et flaky), simuler le POST IPN sur le webhook avec le token réel généré à l'étape 2 :
```
POST /api/public/paydunya-webhook
Content-Type: application/json
{ "data": { "invoice_token": "<token>" } }
```
Le webhook va lui-même appeler `confirm/<token>` chez PayDunya. Deux cas :
- **Si le sandbox PayDunya renvoie `completed`** (test card auto-validée) → vérifier que :
  - `abonnements.statut = 'actif'`, `date_fin` = +30j
  - `paiements.statut = 'succes'`
  - `entreprises.plan = 'pro'`, `max_utilisateurs = 3`, `abonnement_expire_le` rempli
- **Si `pending`** (paiement non effectué dans le sandbox UI) → aucune mutation, retour 200.

### 4. Test anti-rejeu
Re-POSTer le même token : doit retourner `"Already processed"` 200 sans nouvelle mutation.

### 5. Cas erreur
- Token inconnu → 200 "ok" (anti-leak), aucune mutation. ✔

## Outils utilisés
- `stack_modern--invoke-server-function` pour les POST vers `/api/public/paydunya-webhook`.
- `supabase--read_query` pour inspecter `abonnements`, `paiements`, `entreprises` avant/après.
- `stack_modern--server-function-logs` si une étape échoue.
- (Optionnel) Playwright pour exécuter le clic UI réel à l'étape 2 — sinon on appelle la serverFn `createPaymentInvoice` directement via curl avec la session admin.

## Livrable
Rapport clair en français listant pour chaque étape : ✅ ou ❌ + état SQL avant/après pour l'entreprise testée. Si un bug est détecté, je propose une correction (sans l'appliquer — repasse en plan mode pour validation).

## Pré-requis avant de lancer
- Confirmer quelle **entreprise** je peux utiliser pour le test (idéalement la tienne sur le compte de connexion preview, plan actuel `starter`).
- Confirmer que je peux insérer/modifier des lignes de test dans `abonnements` / `paiements` pour cette entreprise.
