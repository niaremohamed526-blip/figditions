-- Note de mise à jour v2.11 : Finances plus belles et plus rapides.
INSERT INTO public.changelog_entries (titre, hook, version, items)
VALUES (
  'Finances, plus belles et plus rapides',
  'Moins de texte, quatre onglets, et des reçus pour vos librairies et vos auteurs.',
  '2.11',
  '[
    {"type": "amelioration", "page_concernee": "finances", "texte": "Nouvelle Vue d''ensemble : votre bénéfice en grand, ce qu''on vous doit avec la part déjà encaissée, et ce que vous devez à vos auteurs."},
    {"type": "amelioration", "page_concernee": "finances", "texte": "Quatre onglets au lieu de sept : Aperçu, Ventes, Dépenses, Auteurs. Rentabilité, Livres étrangers et Journal s''ouvrent depuis l''Aperçu."},
    {"type": "nouveaute", "page_concernee": "finances", "texte": "Quand une librairie paie, téléchargez un reçu PDF à lui remettre, avec les ventes réglées et ce qui reste à payer."},
    {"type": "nouveaute", "page_concernee": "finances", "texte": "Payez un auteur pour une partie de ses ventes seulement : décochez celles que vous réglerez plus tard."},
    {"type": "nouveaute", "page_concernee": "finances", "texte": "Relevé annuel pour chaque auteur : toutes ses ventes de l''année, ce qui est payé et ce qui reste, en PDF."},
    {"type": "amelioration", "page_concernee": "finances", "texte": "Dépenses plus rapides : refaites une dépense du mois dernier en un clic (loyer, salaires), ou ajoutez-en une depuis l''Aperçu."},
    {"type": "amelioration", "page_concernee": "stocks", "texte": "En créant un dépôt, FIGDITIONS propose vos librairies existantes et signale un nom déjà utilisé. Pour une succursale, ajoutez le quartier ou la ville."}
  ]'::jsonb
);
