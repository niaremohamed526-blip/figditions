# Nettoyer les tirets et underscores dans FIGDITIONS

## Objectif
Retirer les tirets (`-`) et underscores (`_`) de tout ce que les utilisateurs voient, téléchargent ou impriment, sans casser l’application.

Une suppression littérale dans tout le code n’est pas techniquement possible : ces caractères font partie de la syntaxe, des adresses web, des noms de fichiers, des styles, des champs de la base de données et des échanges avec les services externes. Les retirer empêcherait le site de démarrer et rendrait les données inaccessibles.

## Modifications prévues

1. **Interface complète**
   - Examiner toutes les pages, fenêtres, tableaux, boutons, messages, filtres, notifications et textes français/anglais.
   - Remplacer les tirets visibles par une ponctuation naturelle, un espace ou une formulation sans tiret.
   - Transformer les valeurs techniques affichées avec underscore en libellés lisibles, par exemple `epreuve_1` → `Épreuve 1` et `en_attente` → `En attente`.

2. **Documents et exports**
   - Nettoyer les factures, bordereaux, contrats, quittances, exports et textes générés par Pr. MEDMO.
   - Conserver les formats réglementaires ou normalisés qui exigent un tiret, notamment les ISBN et certaines références de facture.

3. **Données existantes affichées**
   - Ajouter une présentation lisible des valeurs historiques contenant des underscores, sans modifier leurs valeurs internes.
   - Ne pas altérer les noms propres, titres de livres, adresses, emails ou contenus saisis par les utilisateurs.

4. **Éléments techniques conservés**
   - Conserver les tirets et underscores indispensables dans le code, les adresses, les routes, les noms de fichiers, les styles, les clés de configuration, les champs de base de données et les intégrations externes.
   - Ne pas renommer les colonnes ou statuts internes : l’interface les convertira uniquement à l’affichage.

5. **Validation**
   - Vérifier la compilation et les principaux parcours sur ordinateur et mobile.
   - Rechercher une dernière fois les caractères visibles restants et documenter les exceptions obligatoires.
   - Ajouter l’entrée correspondante dans « Quoi de neuf ».

## Résultat attendu
Les utilisateurs ne verront plus de tirets ou underscores techniques dans l’interface et les documents. Le fonctionnement interne restera intact et compatible avec les données existantes.
