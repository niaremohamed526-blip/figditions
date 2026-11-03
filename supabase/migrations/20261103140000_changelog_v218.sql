-- v2.18 : nettoyage du code et correction des librairies au nom proche.
INSERT INTO public.changelog_entries (titre, hook, version, items)
VALUES (
  'Librairies au nom proche mieux reconnues',
  'Pr. MEDMO ne confond plus deux librairies dont l''une porte le nom de l''autre, comme « Tonino » et « Tonino Koutiala ».',
  '2.18',
  '[
    {"type": "correction", "page_concernee": "medmo", "texte": "Les ventes saisies par photo chez « Tonino » ne sont plus refusées à cause de « Tonino Koutiala » : le nom exact de la librairie est reconnu en priorité."},
    {"type": "amelioration", "page_concernee": "stocks", "texte": "Le taux de commission et l''adresse proposés pour un nouveau dépôt viennent toujours de la bonne librairie."},
    {"type": "amelioration", "page_concernee": "global", "texte": "Application allégée : plus de 4 000 lignes de code inutilisé retirées, pour des mises à jour plus sûres."}
  ]'::jsonb
);
