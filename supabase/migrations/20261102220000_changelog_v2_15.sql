-- v2.15 : FIGDITIONS as a real app (install, offline viewing, stays signed in).
INSERT INTO public.changelog_entries (titre, hook, version, items)
VALUES (
  'FIGDITIONS devient une vraie application',
  'Installez FIGDITIONS en un clic, restez connecté, et consultez vos chiffres même pendant une coupure.',
  '2.15',
  '[
    {"type": "nouveaute", "page_concernee": "global", "texte": "Bouton « Installer l''application » sur la page d''accueil : FIGDITIONS s''installe sur votre téléphone ou votre ordinateur, avec son icône, en plein écran."},
    {"type": "nouveaute", "page_concernee": "global", "texte": "Pendant une coupure de réseau, l''application s''ouvre et affiche les dernières données que vous avez consultées sur l''appareil."},
    {"type": "nouveaute", "page_concernee": "finances", "texte": "Appui long sur l''icône de l''application : raccourcis vers Enregistrer une vente, Stocks, Finances et Pr. MEDMO."},
    {"type": "correction", "page_concernee": "global", "texte": "Vous restez connecté : l''application ne redemande plus votre mot de passe en revenant après une absence ou sur un réseau faible."},
    {"type": "amelioration", "page_concernee": "global", "texte": "L''application installée s''ouvre directement sur votre tableau de bord, et l''écran ne zoome plus tout seul quand vous touchez un champ."},
    {"type": "amelioration", "page_concernee": "finances", "texte": "Sans connexion, un enregistrement affiche un message clair : rien n''est envoyé à moitié, réessayez au retour du réseau."}
  ]'::jsonb
);
