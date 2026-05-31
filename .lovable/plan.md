## Objectif
Basculer PayDunya en mode production et s'assurer que, lorsqu'un paiement est confirmé, l'abonnement passe automatiquement de `en_attente` → `active`.

## Étapes

### 1. Bascule du mode PayDunya (action serveur)
- Appeler `update_secret` sur `PAYDUNYA_MODE` → tu saisiras la valeur `live` dans le formulaire sécurisé.
- Effet immédiat côté code : `getPaydunyaCredentials()` lira `"live"` et `paydunyaBaseUrl()` enverra les requêtes sur `https://app.paydunya.com/api/v1` (au lieu du sandbox).

### 2. Vérifications de configuration (pas de code modifié)
Avant tout test, je vérifie :
- `APP_URL` pointe bien vers une URL publique HTTPS (production), car PayDunya l'utilise pour le callback IPN `${APP_URL}/api/public/paydunya-webhook`.
- L'URL IPN `https://<ton-domaine>/api/public/paydunya-webhook` est bien déclarée dans **ton dashboard PayDunya** (rubrique IPN URL). Sans ça, aucune confirmation ne reviendra, donc aucun abonnement ne passera à `active`.
- Les clés `PAYDUNYA_MASTER_KEY`, `PAYDUNYA_PRIVATE_KEY`, `PAYDUNYA_TOKEN` actuelles sont bien les clés **live** (tu l'as confirmé précédemment).

Je te confirmerai chacun de ces points et te donnerai l'URL exacte à coller dans PayDunya.

### 3. Test de paiement end-to-end
Important : je ne peux pas exécuter un paiement réel à ta place (il faut un vrai compte mobile money / carte qui débitera de l'argent réel). Le test se fait en deux temps :

**a) Côté serveur (je peux faire seul)** — Je vais :
- Lire les dernières lignes de la table `abonnements` avant le test (état initial).
- Une fois que tu as cliqué "Payer" dans l'app et complété le paiement chez PayDunya, je :
  - relis la table `abonnements` pour voir si `statut` est passé à `active` et si `paydunya_reference` est rempli ;
  - lis les logs serveur (`server-function-logs` avec filtre `paydunya-webhook`) pour confirmer que le webhook a bien été reçu et traité ;
  - si nécessaire, déclenche manuellement un appel à `confirmPaydunyaInvoice` via la server function pour rejouer la confirmation sur un token donné.

**b) Côté toi (action manuelle indispensable)** :
- Te connecter à l'app, ouvrir Paramètres → Plans, choisir Pro ou Business, et compléter le paiement chez PayDunya avec une vraie méthode.
- Me dire "c'est payé" pour que je lance les vérifs serveur.

### 4. Diagnostic si l'abonnement reste `en_attente`
Si après paiement le statut ne bascule pas, je suivrai cet arbre :
1. **Webhook jamais appelé** → IPN URL mal configurée dans PayDunya, ou `APP_URL` incorrect → on corrige.
2. **Webhook appelé mais erreur** → je lis les logs, et je corrige le handler ou la requête de confirmation.
3. **Webhook OK mais update DB échoue** → je regarde le trigger `guard_entreprises_sensitive_fields` qui n'autorise les modifs de plan que pour `service_role` ; je m'assure que le webhook utilise bien `supabaseAdmin`.

### 5. Robustesse — petite amélioration (optionnelle, à valider)
Pour éviter qu'un futur abonnement reste bloqué silencieusement, je peux ajouter :
- un **fallback poll** : sur la page Paramètres après retour de PayDunya (search param `payment=success`), appeler une server function qui interroge PayDunya avec le token et force la confirmation côté DB si le webhook a raté.
- un petit panneau "État de l'abonnement" affichant le statut réel + date d'expiration dans Paramètres.

Dis-moi si tu veux que j'inclue ces deux ajouts dans la même passe.

## Ce qu'il me faut de ta part
1. **Approuver ce plan** pour que je puisse passer en mode build.
2. Quand je serai en build mode : confirmer dans le formulaire de `update_secret` la valeur `live` pour `PAYDUNYA_MODE`.
3. Après mes vérifs de config, faire un vrai paiement test (petit montant) et me dire quand c'est fait.
