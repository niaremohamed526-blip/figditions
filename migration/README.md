# Migration Lovable Cloud → Supabase externe

## ⚠️ AVANT DE COMMENCER

Ne lancez PAS de modification de code tant que les étapes 1 à 4 ci-dessous ne sont pas terminées.

---

## Étape 1 — Exporter les données (schéma + rows)

Depuis l'interface Lovable :

1. Ouvrir **Cloud** → **Advanced settings** → **Export data**.
2. Cliquer sur **Export**. Lovable prépare un dump SQL complet.
3. Télécharger le fichier `.sql` (ou `.zip`) et le sauvegarder dans un dossier sûr sur votre ordinateur, hors du repo.

Ce dump contient : tables, données, RLS, fonctions, triggers, GRANT.

---

## Étape 2 — Exporter les fichiers Storage

Vos 3 buckets à sauvegarder :
- `manuscrits` (privé — PDF des livres)
- `logos` (public — logos entreprises)
- `conversions` (privé — sources et EPUB/MOBI générés)

### Installer les dépendances du script

```bash
cd migration
npm install @supabase/supabase-js
```

### Configurer les variables

Créer un fichier `migration/.env.export` (à ne PAS commiter) :

```bash
SOURCE_SUPABASE_URL=https://yqufxcfllbyoadhedypc.supabase.co
SOURCE_SUPABASE_SERVICE_ROLE_KEY=<demander à Lovable support ou utiliser ce que vous avez>
EXPORT_DIR=./backup-storage
```

⚠️ Sam de Lovable a confirmé que `SUPABASE_SERVICE_ROLE_KEY` n'est pas accessible sur Lovable Cloud.
**Solution alternative** : utilisez la clé `SUPABASE_PUBLISHABLE_KEY` — le script tentera d'abord avec l'anon key, mais ne pourra télécharger que les fichiers publics du bucket `logos`. Pour `manuscrits` et `conversions`, il faut créer temporairement une politique RLS permissive OU passer par le Studio Supabase de Lovable si accessible.

### Lancer l'export

```bash
node export-storage.mjs
```

Cela crée `./backup-storage/<bucket>/<chemin>` pour chaque fichier.

---

## Étape 3 — Créer le nouveau projet Supabase

1. Aller sur https://supabase.com → **New project**.
2. Nom : `figditions-prod`, région : **Europe (Frankfurt)** ou **Paris**.
3. Choisir un mot de passe DB fort, le noter dans un gestionnaire de mots de passe.
4. Attendre 2 min que le projet soit prêt.
5. Récupérer dans **Project Settings → API** :
   - `Project URL` → sera votre `SUPABASE_URL`
   - `anon public` key → sera votre `SUPABASE_PUBLISHABLE_KEY`
   - `service_role` key → sera votre `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **SECRET**

---

## Étape 4 — Importer le dump SQL

1. Ouvrir **SQL Editor** dans le dashboard du nouveau projet.
2. Coller le contenu du dump téléchargé à l'étape 1.
3. Exécuter.
4. Vérifier dans **Table Editor** que les 17 tables sont présentes avec leurs données.

---

## Étape 5 — Réuploader les fichiers Storage

Compléter `migration/.env.export` avec les infos du nouveau projet :

```bash
DEST_SUPABASE_URL=https://<nouveau-projet>.supabase.co
DEST_SUPABASE_SERVICE_ROLE_KEY=<service_role du nouveau projet>
IMPORT_DIR=./backup-storage
```

Puis :

```bash
node import-storage.mjs
```

Le script recrée les 3 buckets avec les bonnes politiques (public pour `logos`, privé pour les autres) et réuploade tous les fichiers.

---

## Étape 6 — Reconfigurer Google OAuth

1. Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client.
2. Ajouter le nouveau redirect URI Supabase :
   `https://<nouveau-projet>.supabase.co/auth/v1/callback`
3. Dans le dashboard Supabase → **Authentication → Providers → Google** :
   - Activer
   - Coller Client ID + Client Secret
   - Save

---

## Étape 7 — Créer une clé Gemini

1. Aller sur https://aistudio.google.com/apikey
2. **Create API key** → copier la clé (commence par `AIza...`)
3. La garder pour l'étape 9.

---

## Étape 8 — Me confirmer que tout est prêt

Répondez-moi avec :

- ✅ Dump SQL importé dans le nouveau projet Supabase
- ✅ Fichiers Storage réuploadés
- ✅ Google OAuth reconfiguré
- ✅ Clé Gemini obtenue
- Les 3 valeurs suivantes (je les stockerai comme secrets) :
  - `SUPABASE_URL` du nouveau projet
  - `SUPABASE_PUBLISHABLE_KEY` (anon)
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `GEMINI_API_KEY`

À ce moment-là je passe en mode code : je remplace les appels `LOVABLE_API_KEY` par Gemini direct, je mets à jour `.env`, `src/integrations/supabase/client.ts`, et je vous donne la liste finale des variables à mettre dans Vercel.

---

## Étape 9 — Déploiement Vercel (dernière étape, après mon code)

Je vous fournirai la liste complète des variables à coller dans Vercel → Settings → Environment Variables.
