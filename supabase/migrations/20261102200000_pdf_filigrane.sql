-- v2.14 : PDF filigrane setting per house.
-- pdf_filigrane : show the house image faintly on every PDF page (default on).
-- filigrane_url : its own image; empty means "use the house logo".
ALTER TABLE public.entreprises
  ADD COLUMN IF NOT EXISTS pdf_filigrane boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS filigrane_url text;

INSERT INTO public.changelog_entries (titre, hook, version, items)
VALUES (
  'Des PDF plus beaux, avec votre logo',
  'Tous vos documents PDF ont maintenant le même design moderne, et votre logo peut y apparaître en filigrane.',
  '2.14',
  '[
    {"type": "nouveaute", "page_concernee": "parametres", "texte": "Nouveau réglage « Vos documents PDF » dans Paramètres, Maison d''édition : votre logo en filigrane sur chaque page, ou une autre image, ou aucun filigrane."},
    {"type": "amelioration", "page_concernee": "finances", "texte": "Factures, reçus, quittances, relevés et bordereaux : un seul design, le logo FIGDITIONS en haut, des montants et des dates bien écrits, des tableaux lisibles sur plusieurs pages."},
    {"type": "amelioration", "page_concernee": "finances", "texte": "Rapport financier redessiné : couverture claire, tableau des ventes lisible, sections bien espacées."},
    {"type": "correction", "page_concernee": "finances", "texte": "Le bénéfice du rapport financier est maintenant le même que dans l''application (onglet Rentabilité)."},
    {"type": "amelioration", "page_concernee": "stocks", "texte": "Le guide d''utilisation des stocks reprend le nouveau design et indique correctement que les bordereaux sont inclus dès le plan Pro."}
  ]'::jsonb
);
