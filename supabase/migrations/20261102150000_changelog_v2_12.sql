-- Note de mise à jour v2.12 : Finances redessinées et corrections.
INSERT INTO public.changelog_entries (titre, hook, version, items)
VALUES (
  'Ventes, Dépenses, Auteurs et Rentabilité redessinés',
  'Toutes les pages Finances ont la même allure, plus claire, et de petites erreurs ont été corrigées partout.',
  '2.12',
  '[
    {"type": "amelioration", "page_concernee": "finances", "texte": "Ventes : le total, l''encaissé et le reste en grand, des filtres en un clic, et une liste lisible sur téléphone, sans tableau à faire glisser."},
    {"type": "correction", "page_concernee": "finances", "texte": "« Encaisser tout » s''arrête à la première erreur au lieu de continuer, pour qu''aucun paiement ne soit compté deux fois."},
    {"type": "amelioration", "page_concernee": "finances", "texte": "Dépenses : votre total en grand, le mois et l''année d''un coup d''œil, et un filtre par catégorie en un clic."},
    {"type": "amelioration", "page_concernee": "finances", "texte": "Auteurs : ce que vous devez en grand, chaque auteur sur une ligne avec son bouton Payer, et l''historique des quittances plus lisible."},
    {"type": "amelioration", "page_concernee": "finances", "texte": "Rentabilité : une carte par livre avec son bénéfice, sa marge et la part de l''impression déjà remboursée."},
    {"type": "correction", "page_concernee": "dashboard", "texte": "Sur téléphone, le message d''accueil du tableau de bord n''est plus coupé."},
    {"type": "correction", "page_concernee": "stocks", "texte": "« En circulation » devient « Déposés » : ce chiffre compte tous les exemplaires déposés, vendus compris."},
    {"type": "correction", "page_concernee": "parametres", "texte": "Votre plan affiche sa date de fin (sans renouvellement automatique) et l''alerte d''expiration est lisible en thème clair."},
    {"type": "correction", "page_concernee": "global", "texte": "Textes corrigés : unités en français (Mo, Ko), ponctuation, noms d''onglets et de Pr. MEDMO harmonisés."}
  ]'::jsonb
);
