-- Note de mise à jour v2.10 : refonte de la Vue d'ensemble des Finances.
INSERT INTO public.changelog_entries (titre, hook, version, items)
VALUES (
  'Des finances claires en un coup d''œil',
  'Finances répond maintenant à trois questions : combien vous avez gagné, combien on vous doit, combien vous devez à vos auteurs.',
  '2.10',
  '[
    {"type": "nouveaute", "page_concernee": "finances", "texte": "La Vue d''ensemble répond à trois questions simples : combien vous avez gagné, combien on vous doit et combien vous devez à vos auteurs. Choisissez ce mois, cette année ou depuis le début."},
    {"type": "nouveaute", "page_concernee": "finances", "texte": "Qui vous doit de l''argent : chaque librairie, combien elle doit et depuis combien de jours. Les dettes de plus de 30 jours passent en orange, après 60 jours en rouge."},
    {"type": "nouveaute", "page_concernee": "finances", "texte": "Une librairie vous paie ? Indiquez le montant reçu : il est réparti tout seul sur ses ventes les plus anciennes."},
    {"type": "nouveaute", "page_concernee": "finances", "texte": "Bouton Relancer : un message WhatsApp poli, déjà rédigé avec le montant et la date, pour rappeler un paiement."},
    {"type": "amelioration", "page_concernee": "finances", "texte": "Un seul calcul du bénéfice partout : la Vue d''ensemble et la Rentabilité donnent le même chiffre. Les livres non vendus restent du stock, pas une perte."},
    {"type": "amelioration", "page_concernee": "stocks", "texte": "Un tirage ou un coût d''impression inhabituel demande une confirmation, pour éviter qu''une faute de frappe fausse vos chiffres."}
  ]'::jsonb
);
