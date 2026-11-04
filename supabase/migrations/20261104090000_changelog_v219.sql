-- v2.19 : conditions d'utilisation et politique de confidentialité corrigées.
INSERT INTO public.changelog_entries (titre, hook, version, items)
VALUES (
  'Conditions et confidentialité mises à jour',
  'Nos textes légaux décrivent maintenant exactement ce que fait FIGDITIONS.',
  '2.19',
  '[
    {"type": "amelioration", "page_concernee": "global", "texte": "Conditions d''utilisation : la liste des documents générés est complète (bordereaux de dépôt, reçus, quittances, relevés de droits, rapports) et la partie sur les sauvegardes est précisée : pensez à garder vos exports PDF."},
    {"type": "amelioration", "page_concernee": "global", "texte": "Politique de confidentialité : la liste des données enregistrées est complète, notamment les coordonnées des auteurs et le nom saisi par chaque lecteur d''un manuscrit partagé."}
  ]'::jsonb
);
