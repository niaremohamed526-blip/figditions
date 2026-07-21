
# Manuel d'utilisation — Stock interne & externe (PDF téléchargeable)

## Objectif
Ajouter dans la page **Stocks** un bouton "📖 Manuel d'utilisation" qui génère et télécharge un PDF en français, écrit en langage simple, expliquant pas à pas comment utiliser le Stock interne et le Stock externe (dépôts en librairie, saisie rapide, import Excel, bordereaux, ventes, commissions, droits d'auteur).

## Ce que je vais créer

### 1. Nouveau fichier `src/lib/pdf-manuel-stocks.ts`
Générateur PDF (jsPDF) avec :
- Couverture avec logo FIGDITIONS, titre "Manuel d'utilisation — Gestion des Stocks", date, nom de la maison d'édition
- Sommaire cliquable
- Sections écrites en français simple, avec:
  - Encadrés "💡 Astuce", "⚠️ Attention", "✅ Exemple"
  - Captures textuelles des boutons/icônes ("Cliquez sur le bouton bleu **+ Ajouter**")
  - Étapes numérotées

### 2. Bouton dans `src/routes/_authenticated/stocks.tsx`
À côté des autres boutons de l'entête : **📖 Guide d'utilisation** → télécharge le PDF instantanément (aucune donnée serveur nécessaire).

## Plan du manuel (contenu FR)

**1. Bienvenue**
- À quoi sert la page Stocks
- Différence entre Stock interne (chez vous) et Stock externe (en librairie)

**2. Stock interne — Vos livres au dépôt**
- Comment ajouter un stock : bouton "Ajouter un stock" → choisir le titre → quantité → prix
- Comment modifier la quantité (réception d'imprimerie, casse, perte)
- Comprendre les alertes de stock bas
- Comment enregistrer une vente directe (au bureau, en salon, en ligne)
  - Calcul automatique des droits d'auteur (10%)
  - Pas de commission car pas de librairie

**3. Stock externe — Vos livres en librairie**
- Enregistrer un dépôt manuellement (formulaire classique)
- **Mode rapide 1 : Import Excel** 
  - Télécharger le modèle
  - Remplir dans Excel (une ligne = un livre)
  - Uploader → prévisualiser → valider
- **Mode rapide 2 : Saisie rapide (Caisse)**
  - Choisir la librairie une fois
  - Enchaîner : titre → Entrée → quantité → Entrée → prix → Entrée
  - Ctrl+Entrée pour tout enregistrer
- Suivi des exemplaires : déposés / vendus / restants
- Enregistrer une vente réalisée en librairie
  - Commission librairie **20 %** appliquée automatiquement
  - Droits d'auteur **10 %** calculés sur le brut
  - Net éditeur = 70 % du CA

**4. Bordereaux (plan Business)**
- À quoi sert un bordereau (document officiel signé éditeur + librairie)
- Générer un bordereau de dépôt / de vente
- Ajouter un logo personnalisé (filigrane)
- Télécharger, imprimer, faire signer

**5. Comprendre les calculs**
- Tableau récapitulatif : Vente directe vs Vente librairie
- Exemple chiffré (livre à 10 000 FCFA)

**6. Questions fréquentes**
- Que faire si je me trompe dans une saisie ?
- Comment supprimer un dépôt ?
- Pourquoi je ne vois pas les bordereaux ? (plan Business requis)

**7. Support**
- Contact FIGDITIONS

## Détails techniques
- jsPDF (déjà utilisé pour les bordereaux) → pas de nouvelle dépendance
- Logo FIGDITIONS depuis `src/assets` (déjà présent)
- Génération 100% client, téléchargement instantané
- Format A4, ~12-15 pages, typographie sobre (Helvetica), palette cohérente avec la marque
- Nom du fichier : `Manuel-Stocks-FIGDITIONS.pdf`

## Ce que je NE touche pas
- Aucune logique métier
- Aucune migration DB
- Aucun composant existant autre que l'ajout d'un bouton dans stocks.tsx

Confirmez et je passe en build.
